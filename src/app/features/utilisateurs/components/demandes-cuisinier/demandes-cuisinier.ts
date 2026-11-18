import { DatePipe, LowerCasePipe } from '@angular/common';
import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { NgIcon } from '@ng-icons/core';
import { AValiderService } from '../../../../core/services/a-valider.service';
import { ConfirmationService } from '../../../../core/services/confirmation.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { messageErreur } from '../../../../core/utils/erreurs';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import {
  DemandeStatutResponse,
  LIBELLES_TYPE_COMPTE,
  OPERATEURS_MOBILE_MONEY,
  TypeDemande,
} from '../../models/utilisateur.model';
import { UtilisateurService } from '../../services/utilisateur.service';
import { choisirProfil } from '../../../profils/components/choix-profil-dialog/ouvrir-choix-profil';
import { ouvrirJustificatif } from '../justificatif-dialog/ouvrir-justificatif';

/**
 * Demandes d'un cuisinier pour devenir chef cuisinier ou producteur.
 * La demande en attente est mise en avant avec son justificatif et la décision ; les anciennes sont listées dessous.
 */
@Component({
  imports: [DatePipe, LowerCasePipe, MatButton, NgIcon, StatusBadge],
  selector: 'app-demandes-cuisinier',
  styleUrl: './demandes-cuisinier.scss',
  templateUrl: './demandes-cuisinier.html',
})
export class DemandesCuisinier {
  private utilisateurService = inject(UtilisateurService);
  private confirmation = inject(ConfirmationService);
  private notification = inject(NotificationService);
  private aValider = inject(AValiderService);
  private dialog = inject(MatDialog);

  readonly utilisateurId = input.required<string>();
  /** Demande validée : le compte a changé de type (la fiche doit se recharger avec le nouveau rôle). */
  readonly valide = output<TypeDemande>();
  protected readonly operateurs = OPERATEURS_MOBILE_MONEY;

  protected readonly libellesRole = LIBELLES_TYPE_COMPTE;
  protected demandes = signal<DemandeStatutResponse[]>([]);
  protected enAttente = computed(
    () => this.demandes().find((d) => d.statut === 'EN_ATTENTE') ?? null,
  );
  protected anciennes = computed(() => this.demandes().filter((d) => d.statut !== 'EN_ATTENTE'));
  protected enCours = signal(false);

  constructor() {
    effect(() => {
      const id = this.utilisateurId();
      untracked(() => this.charger(id));
    });
  }

  private charger(id: string): void {
    this.utilisateurService.getDemandesDe(id).subscribe({
      next: (demandes) => this.demandes.set(demandes),
      error: () => this.demandes.set([]),
    });
  }

  /** [verso] : la seconde photo de la pièce d'identité d'un livreur. */
  voirJustificatif(demande: DemandeStatutResponse, verso = false): void {
    const nom = `${demande.demandeurPrenom} ${demande.demandeurNom}`;
    ouvrirJustificatif(
      this.dialog,
      verso ? demande.preuveVersoUrl! : demande.preuveUrl,
      verso ? `${nom} (verso)` : nom,
    );
  }

  async valider(demande: DemandeStatutResponse): Promise<void> {
    const role = LIBELLES_TYPE_COMPTE[demande.type].toLowerCase();
    const profilId = await choisirProfil(this.dialog, {
      titre: `${demande.demandeurPrenom} ${demande.demandeurNom} devient ${role} ?`,
      message: `Son compte passe de cuisinier à ${role}. Il garde ses favoris, commentaires et contenus. Choisissez le profil qui lui donne ses droits.`,
      texteConfirmer: 'Valider la demande',
      suggestion: ({ CHEF: 'chef', PRODUCTEUR: 'producteur', LIVREUR: 'livreur' } as const)[
        demande.type
      ],
    });
    if (!profilId) {
      return;
    }
    this.enCours.set(true);
    this.utilisateurService.validerDemande(demande.id, profilId).subscribe({
      next: () => {
        this.enCours.set(false);
        this.aValider.rafraichir();
        this.notification.succes(
          `${demande.demandeurPrenom} ${demande.demandeurNom} est maintenant ${role}.`,
        );
        this.valide.emit(demande.type);
      },
      error: (erreur: unknown) => {
        this.enCours.set(false);
        this.notification.erreur(messageErreur(erreur, "La demande n'a pas pu être validée."));
      },
    });
  }

  async refuser(demande: DemandeStatutResponse): Promise<void> {
    const motif = await this.confirmation.demanderMotif({
      titre: `Refuser la demande de ${demande.demandeurPrenom} ${demande.demandeurNom} ?`,
      message:
        'Il reste cuisinier et pourra faire une nouvelle demande avec un autre justificatif.',
      libelle: 'Motif du refus',
      aide: 'Ce message sera montré à la personne : indiquez ce qui manque.',
      texteConfirmer: 'Refuser la demande',
    });
    if (!motif) {
      return;
    }
    this.enCours.set(true);
    this.utilisateurService.refuserDemande(demande.id, motif).subscribe({
      next: (resultat) => {
        this.enCours.set(false);
        this.demandes.update((liste) => liste.map((d) => (d.id === resultat.id ? resultat : d)));
        this.aValider.rafraichir();
        this.notification.succes('La demande est refusée. Le motif sera montré au cuisinier.');
      },
      error: (erreur: unknown) => {
        this.enCours.set(false);
        this.notification.erreur(messageErreur(erreur, "La demande n'a pas pu être refusée."));
      },
    });
  }
}
