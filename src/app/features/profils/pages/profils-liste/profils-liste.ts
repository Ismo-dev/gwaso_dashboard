import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatDialog } from '@angular/material/dialog';
import { MatFormField, MatLabel, MatPrefix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { MatTooltip } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { firstValueFrom, forkJoin } from 'rxjs';
import { ConfirmationService } from '../../../../core/services/confirmation.service';
import { EcranService } from '../../../../core/services/ecran.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { DonneesDroitDialog, DroitDialog } from '../../components/droit-dialog/droit-dialog';
import { MatriceDroits } from '../../components/matrice-droits/matrice-droits';
import { DonneesProfilDialog, ProfilDialog } from '../../components/profil-dialog/profil-dialog';
import {
  DroitAffiche,
  DroitResponse,
  DROITS_INDISPENSABLES,
  GroupeDroits,
  grouperDroits,
  libelleDroit,
  ProfilResponse,
} from '../../models/profil.model';
import { ProfilService } from '../../services/profil.service';

type Onglet = 'profils' | 'droits';

/**
 * Profils et droits.
 * - Onglet « Profils » : à gauche la liste des profils, à droite les droits du profil choisi,
 *   regroupés par domaine (Recettes, Vidéos...) avec un interrupteur par droit.
 * - Onglet « Catalogue des droits » : créer, renommer, activer / désactiver ou supprimer les droits eux-mêmes.
 */
@Component({
  imports: [
    MatriceDroits,
    FormsModule,
    MatButton,
    MatIconButton,
    MatButtonToggleGroup,
    MatButtonToggle,
    MatSlideToggle,
    MatFormField,
    MatLabel,
    MatPrefix,
    MatInput,
    MatSelect,
    MatOption,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    MatTooltip,
    NgIcon,
    PageHeader,
    EmptyState,
  ],
  selector: 'app-profils-liste',
  styleUrl: './profils-liste.scss',
  templateUrl: './profils-liste.html',
})
export class ProfilsListe implements OnInit {
  private profilService = inject(ProfilService);
  private dialog = inject(MatDialog);
  private confirmation = inject(ConfirmationService);
  private notification = inject(NotificationService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  protected ecran = inject(EcranService);

  /** Onglet lu dans l'adresse (?onglet=droits). */
  readonly onglet = input<string>();
  protected ongletActif = computed<Onglet>(() =>
    this.onglet() === 'droits' ? 'droits' : 'profils',
  );

  protected readonly libelleDroit = libelleDroit;
  protected profils = signal<ProfilResponse[]>([]);
  protected droits = signal<DroitResponse[]>([]);
  protected chargement = signal(true);
  protected erreur = signal(false);

  // ----- Profil sélectionné -----
  protected profilSelectionneId = signal<string | null>(null);
  protected profilSelectionne = computed(
    () => this.profils().find((profil) => profil.id === this.profilSelectionneId()) ?? null,
  );
  protected chargementDroitsProfil = signal(false);
  /** Droits enregistrés pour le profil (pour savoir s'il y a des modifications). */
  private droitsEnregistres = signal<Set<string>>(new Set());
  /** Droits cochés à l'écran. */
  protected droitsCoches = signal<Set<string>>(new Set());
  protected enregistrement = signal(false);

  protected modifie = computed(() => {
    const enregistres = this.droitsEnregistres();
    const coches = this.droitsCoches();
    return enregistres.size !== coches.size || [...coches].some((id) => !enregistres.has(id));
  });

  // ----- Recherche dans les droits -----
  protected rechercheDroit = signal('');
  protected droitsFiltres = computed(() => {
    const terme = this.rechercheDroit().trim().toLowerCase();
    return terme
      ? this.droits().filter(
          (droit) =>
            droit.action.toLowerCase().includes(terme) ||
            (droit.description ?? '').toLowerCase().includes(terme),
        )
      : this.droits();
  });
  /** Droits regroupés par domaine (préfixe du code : RECETTE_, VIDEO_...). */
  protected groupesDroits = computed<GroupeDroits[]>(() => grouperDroits(this.droitsFiltres()));
  protected nbCochesGroupe(groupe: GroupeDroits): number {
    const coches = this.droitsCoches();
    return groupe.droits.filter((d) => coches.has(d.id)).length;
  }

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set(false);
    forkJoin({
      profils: this.profilService.getAll(),
      droits: this.profilService.getDroits(),
    }).subscribe({
      next: ({ profils, droits }) => {
        this.profils.set([...profils].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')));
        this.droits.set([...droits].sort((a, b) => a.action.localeCompare(b.action)));
        this.chargement.set(false);
        // On ouvre le premier profil pour que la page ne soit jamais vide
        const premier = this.profilSelectionne() ?? this.profils()[0];
        if (premier) {
          this.ouvrirProfil(premier.id);
        }
      },
      error: () => {
        this.erreur.set(true);
        this.chargement.set(false);
      },
    });
  }

  changerOnglet(onglet: Onglet): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { onglet: onglet === 'profils' ? null : onglet },
      replaceUrl: true,
    });
  }

  // ----- Sélection d'un profil -----

  async choisirProfil(id: string): Promise<void> {
    if (id === this.profilSelectionneId()) {
      return;
    }
    // Ne pas perdre des modifications sans prévenir
    if (this.modifie()) {
      const abandonner = await this.confirmation.demander({
        titre: 'Abandonner les modifications ?',
        message: `Les droits cochés pour « ${this.profilSelectionne()?.nom} » n'ont pas été enregistrés.`,
        texteConfirmer: 'Abandonner',
        texteAnnuler: 'Rester sur ce profil',
        danger: true,
      });
      if (!abandonner) {
        return;
      }
    }
    this.ouvrirProfil(id);
  }

  private ouvrirProfil(id: string): void {
    this.profilSelectionneId.set(id);
    this.chargementDroitsProfil.set(true);
    this.profilService.getDroitsDuProfil(id).subscribe({
      next: (attributions) => {
        const ids = new Set(attributions.map((attribution) => attribution.droitId));
        this.droitsEnregistres.set(ids);
        this.droitsCoches.set(new Set(ids));
        this.chargementDroitsProfil.set(false);
      },
      error: () => {
        this.droitsEnregistres.set(new Set());
        this.droitsCoches.set(new Set());
        this.chargementDroitsProfil.set(false);
      },
    });
  }

  // ----- Cases à cocher -----

  basculerDroit(id: string, coche: boolean): void {
    this.droitsCoches.update((ids) => {
      const copie = new Set(ids);
      if (coche) {
        copie.add(id);
      } else {
        copie.delete(id);
      }
      return copie;
    });
  }

  protected iconeProfil(profil: ProfilResponse): string {
    return profil.systeme ? 'lucideShieldCheck' : profil.inscription ? 'lucideUserPlus' : 'lucideKeyRound';
  }

  protected indispensable(droit: DroitAffiche): boolean {
    return DROITS_INDISPENSABLES.includes(droit.action);
  }

  /** Droit indispensable du profil système : on ne peut pas le lui retirer. */
  protected verrouille(profil: ProfilResponse, droit: DroitAffiche): boolean {
    return profil.systeme && DROITS_INDISPENSABLES.includes(droit.action);
  }

  /** Tout le domaine d'un coup (ex. tous les droits « Recettes »). */
  basculerGroupe(groupe: GroupeDroits, coche: boolean): void {
    const profil = this.profilSelectionne();
    this.droitsCoches.update((ids) => {
      const copie = new Set(ids);
      for (const droit of groupe.droits) {
        if (profil && !coche && this.verrouille(profil, droit)) {
          continue;
        }
        if (coche) {
          copie.add(droit.id);
        } else {
          copie.delete(droit.id);
        }
      }
      return copie;
    });
  }

  annulerModifications(): void {
    this.droitsCoches.set(new Set(this.droitsEnregistres()));
  }

  enregistrerDroits(): void {
    const profil = this.profilSelectionne();
    if (!profil) {
      return;
    }
    this.enregistrement.set(true);
    this.profilService.modifierDroitsDuProfil(profil.id, [...this.droitsCoches()]).subscribe({
      next: (attributions) => {
        const ids = new Set(attributions.map((attribution) => attribution.droitId));
        this.droitsEnregistres.set(ids);
        this.droitsCoches.set(new Set(ids));
        this.profils.update((liste) =>
          liste.map((p) => (p.id === profil.id ? { ...p, nbDroits: ids.size } : p)),
        );
        this.enregistrement.set(false);
        this.notification.succes(`Les droits de « ${profil.nom} » sont enregistrés.`);
      },
      error: () => this.enregistrement.set(false),
    });
  }

  // ----- Profils -----

  /** Relit la liste (un changement de profil des inscriptions touche aussi les autres profils du type). */
  private rafraichirProfils(): void {
    this.profilService.getAll().subscribe({
      next: (profils) => this.profils.set([...profils].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))),
    });
  }

  async nouveauProfil(): Promise<void> {
    const profil = await this.ouvrirDialogueProfil({ profils: this.profils() });
    if (profil) {
      this.rafraichirProfils();
      this.notification.succes(
        `Le profil « ${profil.nom} » est créé. Cochez maintenant ses droits.`,
      );
      this.ouvrirProfil(profil.id);
    }
  }

  async modifierProfil(profil: ProfilResponse): Promise<void> {
    const resultat = await this.ouvrirDialogueProfil({ profil, profils: this.profils() });
    if (resultat) {
      this.rafraichirProfils();
      this.notification.succes('Le profil est modifié.');
    }
  }

  /** Désactivé : plus proposé pour les nouveaux comptes, et ses droits ne sont plus donnés. */
  async changerActivationProfil(profil: ProfilResponse): Promise<void> {
    if (profil.actif) {
      const confirme = await this.confirmation.demander({
        titre: `Désactiver le profil « ${profil.nom} » ?`,
        message:
          `Il ne sera plus proposé pour les nouveaux comptes, et ses ${profil.nbUtilisateurs} compte(s) n'auront plus ses droits ` +
          `(ils gardent le profil : il suffira de le réactiver).`,
        texteConfirmer: 'Désactiver',
        danger: true,
      });
      if (!confirme) {
        return;
      }
    }
    this.profilService.changerActivation(profil.id, !profil.actif).subscribe({
      next: (resultat) => {
        this.rafraichirProfils();
        this.notification.succes(
          resultat.actif ? `Le profil « ${resultat.nom} » est réactivé.` : `Le profil « ${resultat.nom} » est désactivé.`,
        );
      },
    });
  }

  /** Désactivé : le droit reste dans le catalogue et les profils, mais n'est donné à personne. */
  /** La matrice a changé les droits d'un profil : on met son compteur à jour (et sa fiche si elle est ouverte). */
  apresMatrice({ profilId, nbDroits }: { profilId: string; nbDroits: number }): void {
    this.profils.update((profils) => profils.map((p) => (p.id === profilId ? { ...p, nbDroits } : p)));
    if (this.profilSelectionneId() === profilId) {
      this.ouvrirProfil(profilId);
    }
  }

  changerActivationDroit(droit: DroitResponse): void {
    this.profilService.changerActivationDroit(droit.id, !droit.actif).subscribe({
      next: (resultat) => {
        this.droits.update((droits) => droits.map((d) => (d.id === resultat.id ? resultat : d)));
        this.notification.succes(
          resultat.actif ? `Le droit ${resultat.action} est réactivé.` : `Le droit ${resultat.action} est désactivé : il n'est plus donné.`,
        );
      },
    });
  }

  async supprimerProfil(profil: ProfilResponse): Promise<void> {
    const confirme = await this.confirmation.demander({
      titre: `Supprimer le profil « ${profil.nom} » ?`,
      message: 'Les membres qui ont ce profil perdront les droits associés.',
      texteConfirmer: 'Supprimer le profil',
      danger: true,
    });
    if (!confirme) {
      return;
    }
    this.profilService.supprimer(profil.id).subscribe({
      next: () => {
        const restants = this.profils().filter((p) => p.id !== profil.id);
        this.profils.set(restants);
        this.droitsEnregistres.set(new Set());
        this.droitsCoches.set(new Set());
        this.profilSelectionneId.set(null);
        if (restants[0]) {
          this.ouvrirProfil(restants[0].id);
        }
        this.notification.succes(`Le profil « ${profil.nom} » est supprimé.`);
      },
    });
  }

  // ----- Droits (catalogue) -----

  async nouveauDroit(): Promise<void> {
    const droit = await this.ouvrirDialogueDroit({});
    if (droit) {
      this.droits.update((droits) =>
        [...droits, droit].sort((a, b) => a.action.localeCompare(b.action)),
      );
      this.notification.succes(`Le droit ${droit.action} est créé.`);
    }
  }

  async modifierDroit(droit: DroitResponse): Promise<void> {
    const resultat = await this.ouvrirDialogueDroit({ droit });
    if (resultat) {
      this.droits.update((droits) => droits.map((d) => (d.id === resultat.id ? resultat : d)));
      this.notification.succes('Le droit est modifié.');
    }
  }

  async supprimerDroit(droit: DroitResponse): Promise<void> {
    const confirme = await this.confirmation.demander({
      titre: `Supprimer le droit ${droit.action} ?`,
      message: 'Il sera retiré de tous les profils qui le possèdent.',
      texteConfirmer: 'Supprimer le droit',
      danger: true,
    });
    if (!confirme) {
      return;
    }
    this.profilService.supprimerDroit(droit.id).subscribe({
      next: () => {
        this.droits.update((droits) => droits.filter((d) => d.id !== droit.id));
        this.basculerDroit(droit.id, false);
        this.droitsEnregistres.update((ids) => new Set([...ids].filter((id) => id !== droit.id)));
        this.notification.succes(`Le droit ${droit.action} est supprimé.`);
      },
    });
  }

  private ouvrirDialogueProfil(donnees: DonneesProfilDialog): Promise<ProfilResponse | undefined> {
    const fenetre = this.dialog.open<ProfilDialog, DonneesProfilDialog, ProfilResponse>(
      ProfilDialog,
      {
        data: donnees,
        width: '600px',
        maxWidth: 'calc(100vw - 2rem)',
      },
    );
    return firstValueFrom(fenetre.afterClosed());
  }

  private ouvrirDialogueDroit(donnees: DonneesDroitDialog): Promise<DroitResponse | undefined> {
    const fenetre = this.dialog.open<DroitDialog, DonneesDroitDialog, DroitResponse>(DroitDialog, {
      data: donnees,
      width: '520px',
      maxWidth: 'calc(100vw - 2rem)',
    });
    return firstValueFrom(fenetre.afterClosed());
  }
}
