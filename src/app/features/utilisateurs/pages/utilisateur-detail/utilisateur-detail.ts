import { DatePipe, LowerCasePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatOption, MatSelect } from '@angular/material/select';
import { Router, RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { firstValueFrom, map, Observable } from 'rxjs';
import { TypeCompte, StatutCompte } from '../../../../core/models/enums.model';
import { AValiderService } from '../../../../core/services/a-valider.service';
import { ConfirmationService } from '../../../../core/services/confirmation.service';
import { FilArianeService } from '../../../../core/services/fil-ariane.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { SessionService } from '../../../../core/services/session.service';
import { messageErreur } from '../../../../core/utils/erreurs';
import { Avatar } from '../../../../shared/components/avatar/avatar';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import {
  FicheUtilisateur,
  ICONES_TYPE_COMPTE,
  lienCarte,
  LIBELLES_OPERATEUR,
  LIBELLES_NIVEAU,
  LIBELLES_TYPE_COMPTE,
  ORDRE_TYPES_COMPTE,
} from '../../models/utilisateur.model';
import { DroitsLecture } from '../../../profils/components/droits-lecture/droits-lecture';
import {
  DroitAffiche,
  ProfilDroitsResponse,
  ProfilResponse,
} from '../../../profils/models/profil.model';
import { ProfilService } from '../../../profils/services/profil.service';
import { UtilisateurService } from '../../services/utilisateur.service';
import { ActiviteChef } from '../../components/activite-chef/activite-chef';
import { DemandesCuisinier } from '../../components/demandes-cuisinier/demandes-cuisinier';
import { ouvrirJustificatif } from '../../components/justificatif-dialog/ouvrir-justificatif';
import { ModifierUtilisateurDialog } from '../../components/modifier-utilisateur-dialog/modifier-utilisateur-dialog';
import { ProduitsProducteur } from '../../components/produits-producteur/produits-producteur';

const ROLES: TypeCompte[] = ORDRE_TYPES_COMPTE;

/**
 * Fiche d'un membre. Le rôle est passé dans l'adresse (?role=CHEF) car l'API
 * a une route différente par type de compte.
 */
@Component({
  imports: [
    RouterLink,
    DatePipe,
    LowerCasePipe,
    MatButton,
    NgIcon,
    Avatar,
    StatusBadge,
    EmptyState,
    DroitsLecture,
    DemandesCuisinier,
    ActiviteChef,
    ProduitsProducteur,
    MatFormField,
    MatLabel,
    MatSelect,
    MatOption,
  ],
  selector: 'app-utilisateur-detail',
  styleUrl: './utilisateur-detail.scss',
  templateUrl: './utilisateur-detail.html',
})
export class UtilisateurDetail {
  private utilisateurService = inject(UtilisateurService);
  private confirmation = inject(ConfirmationService);
  private notification = inject(NotificationService);
  private aValider = inject(AValiderService);
  private filAriane = inject(FilArianeService);
  protected session = inject(SessionService);
  private profilService = inject(ProfilService);
  private dialog = inject(MatDialog);
  private router = inject(Router);

  readonly id = input.required<string>();
  readonly role = input<string>();

  protected readonly libellesRole = LIBELLES_TYPE_COMPTE;
  protected readonly iconesRole = ICONES_TYPE_COMPTE;
  protected readonly lienCarte = lienCarte;
  protected readonly libellesOperateur = LIBELLES_OPERATEUR;
  protected readonly libellesNiveau = LIBELLES_NIVEAU;

  protected fiche = signal<FicheUtilisateur | null>(null);
  /** Droits du profil de la personne (affichés dans la carte « Profil »). */
  protected droitsProfil = signal<ProfilDroitsResponse[]>([]);
  protected droitsAffiches = computed<DroitAffiche[]>(() =>
    this.droitsProfil().map((a) => ({
      id: a.droitId,
      action: a.droitAction,
      description: a.droitDescription,
      actif: a.droitActif,
    })),
  );
  /** Profils qu'on peut donner à ce compte : tous les profils actifs. */
  protected profilsPossibles = signal<ProfilResponse[]>([]);
  protected changementProfil = signal(false);
  protected chargement = signal(true);
  protected introuvable = signal(false);
  protected erreur = signal(false);
  protected actionEnCours = signal(false);

  protected estMoi = computed(() => this.fiche()?.id === this.session.utilisateur()?.id);
  protected aUnStatutAValider = computed(() => {
    const role = this.fiche()?.role;
    return role === 'CHEF' || role === 'PRODUCTEUR';
  });

  constructor() {
    effect(() => {
      const id = this.id();
      const role = ROLES.find((r) => r === this.role());
      untracked(() => this.charger(id, role));
    });
  }

  charger(id: string = this.id(), role = ROLES.find((r) => r === this.role())): void {
    this.chargement.set(true);
    this.introuvable.set(false);
    this.erreur.set(false);

    if (!role) {
      // Sans rôle, on ne sait pas quelle route appeler : on considère la fiche introuvable
      this.introuvable.set(true);
      this.chargement.set(false);
      return;
    }

    this.lireFiche(id, role).subscribe({
      next: (fiche) => {
        this.fiche.set(fiche);
        this.chargerDroits(fiche.profilId);
        this.profilService.getAll().subscribe({
          next: (profils) =>
            this.profilsPossibles.set(
              profils.filter((p) => p.actif).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
            ),
        });
        this.filAriane.definirPageCourante(`${fiche.prenom} ${fiche.nom}`);
        this.chargement.set(false);
      },
      error: (erreur: HttpErrorResponse) => {
        this.introuvable.set(erreur.status === 404);
        this.erreur.set(erreur.status !== 404);
        this.chargement.set(false);
      },
    });
  }

  // ----- Demande de statut -----

  async valider(): Promise<void> {
    const fiche = this.fiche();
    if (!fiche) {
      return;
    }
    const role = LIBELLES_TYPE_COMPTE[fiche.role].toLowerCase();
    const confirme = await this.confirmation.demander({
      titre: `Valider ${fiche.prenom} ${fiche.nom} ?`,
      message: `Son compte obtiendra le statut ${role} et les droits associés.`,
      texteConfirmer: 'Valider la demande',
    });
    if (!confirme) {
      return;
    }
    this.actionEnCours.set(true);
    const requete =
      fiche.role === 'CHEF'
        ? this.utilisateurService.validerChef(fiche.id)
        : this.utilisateurService.validerProducteur(fiche.id);
    requete.subscribe({
      next: () => this.apresAction(`${fiche.prenom} ${fiche.nom} est maintenant ${role}.`),
      error: () => this.actionEnCours.set(false),
    });
  }

  async refuser(): Promise<void> {
    const fiche = this.fiche();
    if (!fiche) {
      return;
    }
    const motif = await this.confirmation.demanderMotif({
      titre: `Refuser la demande de ${fiche.prenom} ${fiche.nom} ?`,
      message:
        'Son compte reste actif, mais sans le statut demandé. Il pourra envoyer un nouveau justificatif.',
      libelle: 'Motif du refus',
      aide: 'Ce message sera montré à la personne : indiquez ce qui manque.',
      texteConfirmer: 'Refuser la demande',
    });
    if (!motif) {
      return;
    }
    this.actionEnCours.set(true);
    const requete =
      fiche.role === 'CHEF'
        ? this.utilisateurService.rejeterChef(fiche.id, motif)
        : this.utilisateurService.rejeterProducteur(fiche.id, motif);
    requete.subscribe({
      next: () => this.apresAction(`La demande de ${fiche.prenom} ${fiche.nom} a été refusée.`),
      error: () => this.actionEnCours.set(false),
    });
  }

  // ----- Compte -----

  async changerStatut(statut: StatutCompte): Promise<void> {
    const fiche = this.fiche();
    if (!fiche) {
      return;
    }
    const nom = `${fiche.prenom} ${fiche.nom}`;
    const textes: Record<
      string,
      { titre: string; message: string; bouton: string; danger: boolean; succes: string }
    > = {
      SUSPENDU: {
        titre: `Suspendre le compte de ${nom} ?`,
        message:
          'La personne ne pourra plus se connecter. Ses contenus restent en place. Vous pourrez réactiver le compte à tout moment.',
        bouton: 'Suspendre le compte',
        danger: true,
        succes: `Le compte de ${nom} est suspendu.`,
      },
      INACTIF: {
        titre: `Désactiver le compte de ${nom} ?`,
        message:
          'Le compte est mis en sommeil (par exemple à la demande de la personne). Vous pourrez le réactiver.',
        bouton: 'Désactiver le compte',
        danger: true,
        succes: `Le compte de ${nom} est désactivé.`,
      },
      ACTIF: {
        titre: `Réactiver le compte de ${nom} ?`,
        message: 'La personne pourra de nouveau se connecter et utiliser Gwaso.',
        bouton: 'Réactiver le compte',
        danger: false,
        succes: `Le compte de ${nom} est réactivé.`,
      },
    };
    const texte = textes[statut];
    const confirme = await this.confirmation.demander({
      titre: texte.titre,
      message: texte.message,
      texteConfirmer: texte.bouton,
      danger: texte.danger,
    });
    if (!confirme) {
      return;
    }
    this.actionEnCours.set(true);
    this.utilisateurService.changerStatutCompte(fiche.id, statut).subscribe({
      next: () => {
        this.fiche.set({ ...fiche, statutCompte: statut });
        this.actionEnCours.set(false);
        this.notification.succes(texte.succes);
      },
      error: () => this.actionEnCours.set(false),
    });
  }

  private apresAction(message: string): void {
    this.actionEnCours.set(false);
    this.notification.succes(message);
    this.aValider.rafraichir();
    this.charger();
  }

  /** Appelle la bonne route selon le rôle et ramène tout au même format. */
  private lireFiche(id: string, role: TypeCompte): Observable<FicheUtilisateur> {
    switch (role) {
      case 'CHEF':
        return this.utilisateurService.getChef(id).pipe(map((c) => ({ ...c, role })));
      case 'PRODUCTEUR':
        return this.utilisateurService.getProducteur(id).pipe(map((p) => ({ ...p, role })));
      case 'CUISINIER':
        return this.utilisateurService
          .getCuisinier(id)
          .pipe(map((c) => ({ ...c, role, statutCompte: c.statut })));
      case 'ADMIN':
        return this.utilisateurService
          .getAdmin(id)
          .pipe(map((a) => ({ ...a, role, statutCompte: a.statut })));
      case 'LIVREUR':
        return this.utilisateurService.getLivreur(id).pipe(map((l) => ({ ...l, role })));
    }
  }

  private chargerDroits(profilId: string | null): void {
    if (!profilId) {
      this.droitsProfil.set([]);
      return;
    }
    this.profilService.getDroitsDuProfil(profilId).subscribe({
      next: (droits) => this.droitsProfil.set(droits),
      error: () => this.droitsProfil.set([]),
    });
  }

  /** Un compte garde son type (cuisinier, admin...) : seuls les profils de ce type sont proposés. */
  async changerProfil(profilId: string, liste: MatSelect): Promise<void> {
    const fiche = this.fiche();
    if (!fiche || profilId === fiche.profilId) {
      return;
    }
    // Les droits du compte changent avec le profil : on fait confirmer, la liste revient en arrière si on annule
    const nouveau = this.profilsPossibles().find((p) => p.id === profilId);
    const nbDroits = nouveau?.nbDroits ?? 0;
    const confirme = await this.confirmation.demander({
      titre: `Donner le profil « ${nouveau?.nom ?? ''} » à ${fiche.prenom} ${fiche.nom} ?`,
      message:
        `${fiche.profilNom ? `Il remplace le profil « ${fiche.profilNom} ». ` : ''}` +
        `Ses droits deviennent ceux du nouveau profil (${nbDroits} droit${nbDroits > 1 ? 's' : ''}), dès sa prochaine action.`,
      texteConfirmer: 'Changer le profil',
    });
    if (!confirme) {
      liste.writeValue(fiche.profilId);
      return;
    }
    this.changementProfil.set(true);
    this.utilisateurService.changerProfil(fiche.id, profilId).subscribe({
      next: (resume) => {
        this.fiche.set({ ...fiche, profilId: resume.profilId, profilNom: resume.profilNom });
        this.chargerDroits(resume.profilId);
        this.changementProfil.set(false);
        this.notification.succes(
          `${fiche.prenom} ${fiche.nom} a maintenant le profil « ${resume.profilNom} ».`,
        );
      },
      error: (erreur: unknown) => {
        this.changementProfil.set(false);
        liste.writeValue(fiche.profilId);
        this.notification.erreur(messageErreur(erreur, "Le profil n'a pas pu être changé."));
      },
    });
  }

  /** Identité, contact, niveau ou localité. */
  async modifier(): Promise<void> {
    const fiche = this.fiche();
    if (!fiche) {
      return;
    }
    const modifie = await firstValueFrom(
      this.dialog
        .open<ModifierUtilisateurDialog, FicheUtilisateur, boolean>(ModifierUtilisateurDialog, {
          data: fiche,
          width: '600px',
          maxWidth: 'calc(100vw - 32px)',
        })
        .afterClosed(),
    );
    if (modifie) {
      this.notification.succes('Le compte est modifié.');
      this.charger();
    }
  }

  /** Demande validée : le cuisinier est maintenant chef ou producteur, on rouvre sa fiche avec ce rôle. */
  apresChangementDeType(id: string, role: 'CHEF' | 'PRODUCTEUR'): void {
    this.router.navigate(['/utilisateurs', id], { queryParams: { role }, replaceUrl: true });
  }

  /** Le justificatif ne s'affiche qu'à la demande, dans une fenêtre. */
  voirJustificatif(url: string, nom: string): void {
    ouvrirJustificatif(this.dialog, url, nom);
  }
}
