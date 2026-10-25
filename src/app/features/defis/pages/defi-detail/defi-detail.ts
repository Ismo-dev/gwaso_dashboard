import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatTooltip } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { firstValueFrom, forkJoin } from 'rxjs';
import { AValiderService } from '../../../../core/services/a-valider.service';
import { ConfirmationService } from '../../../../core/services/confirmation.service';
import { FilArianeService } from '../../../../core/services/fil-ariane.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { messageErreur } from '../../../../core/utils/erreurs';
import { Avatar } from '../../../../shared/components/avatar/avatar';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { TexteRiche } from '../../../../shared/components/texte-riche/texte-riche';
import { DepuisPipe } from '../../../../shared/pipes/depuis.pipe';
import { FichierPipe } from '../../../../shared/pipes/fichier.pipe';
import { LIBELLES_TYPE_COMPTE } from '../../../utilisateurs/models/utilisateur.model';
import {
  DefiResponse,
  estVideo,
  iconeType,
  ParticipationDefiResponse,
  PhotoDefiResponse,
} from '../../models/defi.model';
import { DefiService } from '../../services/defi.service';

/** Note maximale proposée à l'administrateur. */
const NOTE_MAX = 20;

/** Participant avec son rang (rang publié, ou rang provisoire calculé à partir des notes). */
interface LigneClassement {
  participation: ParticipationDefiResponse;
  rang: number | null;
}

/**
 * Fiche d'un défi : décision sur une proposition de chef, annulation, contenu du défi,
 * participants, notes et publication du classement.
 * Le statut suit les dates tout seul (ouvert le jour du début, terminé après le jour de fin).
 * Les notes : par les admins pour un défi de l'administration, par le chef auteur sinon ;
 * seulement une fois le défi commencé. Le classement se publie quand le défi est terminé.
 */
@Component({
  imports: [
    RouterLink,
    DatePipe,
    DecimalPipe,
    MatButton,
    MatProgressSpinner,
    MatTooltip,
    NgIcon,
    Avatar,
    EmptyState,
    StatusBadge,
    TexteRiche,
    DepuisPipe,
    FichierPipe,
  ],
  selector: 'app-defi-detail',
  // Échap ferme la photo agrandie
  host: { '(document:keydown.escape)': 'photoOuverte.set(null)' },
  styleUrl: './defi-detail.scss',
  templateUrl: './defi-detail.html',
})
export class DefiDetail {
  private defiService = inject(DefiService);
  private confirmation = inject(ConfirmationService);
  private notification = inject(NotificationService);
  private aValider = inject(AValiderService);
  private filAriane = inject(FilArianeService);
  private router = inject(Router);

  /** Identifiant lu dans l'adresse (/defis/:id). */
  readonly id = input.required<string>();

  protected readonly noteMax = NOTE_MAX;
  protected readonly estVideo = estVideo;
  protected readonly iconeType = iconeType;
  protected readonly libellesRole = LIBELLES_TYPE_COMPTE;

  protected defi = signal<DefiResponse | null>(null);
  protected participants = signal<ParticipationDefiResponse[]>([]);
  protected photos = signal<PhotoDefiResponse[]>([]);
  /** Photo affichée en grand (null : galerie fermée). */
  protected photoOuverte = signal<PhotoDefiResponse | null>(null);
  protected chargement = signal(true);
  protected introuvable = signal(false);
  protected erreur = signal(false);
  protected actionEnCours = signal(false);
  /** Participation dont la note est en cours d'enregistrement. */
  protected noteEnCours = signal<string | null>(null);

  /** On note une fois le défi commencé, et seulement si c'est à l'administration de noter. */
  protected peutNoter = computed(() => {
    const defi = this.defi();
    return !!defi && defi.noteParAdmin && (defi.statut === 'EN_COURS' || defi.statut === 'TERMINE');
  });
  /** Le classement se publie quand le défi est terminé. */
  protected peutPublier = computed(() => this.peutNoter() && this.defi()?.statut === 'TERMINE');
  protected devinette = computed(() => this.defi()?.modeParticipation === 'REPONSE');
  protected quiz = computed(() => this.defi()?.modeParticipation === 'QUIZ');
  /** Devinette et quiz : points calculés automatiquement, pas de note à saisir. */
  protected corrigeAuto = computed(() => this.devinette() || this.quiz());
  /** Saisie d'une note : seulement pour les défis « réalisation ». */
  protected saisieNote = computed(() => this.peutNoter() && !this.corrigeAuto());
  protected nbNotes = computed(() => this.participants().filter((p) => p.score !== null).length);
  protected modifiable = computed(() => {
    const statut = this.defi()?.statut;
    return statut !== 'TERMINE' && statut !== 'ANNULE';
  });

  /**
   * Classement affiché : rangs publiés si le classement est public, sinon rangs provisoires
   * calculés comme le fera l'API (ex æquo = même rang ; sans note = pas de rang).
   */
  protected classement = computed<LigneClassement[]>(() => {
    const auto = this.corrigeAuto();
    const quiz = this.quiz();
    // Corrigés automatiquement : à points égaux, le plus rapide passe devant (comme l'API)
    const vitesse = (p: ParticipationDefiResponse) =>
      quiz ? (p.tempsTotalMs ?? Number.MAX_SAFE_INTEGER) : p.dateSoumission ? Date.parse(p.dateSoumission) : Number.MAX_SAFE_INTEGER;
    const tries = [...this.participants()].sort(
      (a, b) => (b.score ?? -1) - (a.score ?? -1) || (auto ? vitesse(a) - vitesse(b) : 0),
    );
    let rang = 0;
    let precedent: number | null = null;
    return tries.map((participation, index) => {
      if (this.defi()?.classementPublie) {
        return { participation, rang: participation.classement };
      }
      if (participation.score === null) {
        return { participation, rang: null };
      }
      if (auto || participation.score !== precedent) {
        rang = index + 1;
        precedent = participation.score;
      }
      return { participation, rang };
    });
  });
  protected podium = computed(() =>
    this.classement()
      .filter((l) => l.rang !== null && l.rang <= 3)
      .slice(0, 3),
  );

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => this.charger(id));
    });
  }

  charger(id: string): void {
    this.chargement.set(true);
    this.introuvable.set(false);
    this.erreur.set(false);
    forkJoin({
      defi: this.defiService.getById(id),
      participants: this.defiService.getParticipants(id),
      photos: this.defiService.getPhotos(id),
    }).subscribe({
      next: ({ defi, participants, photos }) => {
        this.defi.set(defi);
        this.participants.set(participants);
        this.photos.set(photos);
        this.filAriane.definirPageCourante(defi.nom);
        this.chargement.set(false);
      },
      error: (erreur: HttpErrorResponse) => {
        this.introuvable.set(erreur.status === 404);
        this.erreur.set(erreur.status !== 404);
        this.chargement.set(false);
      },
    });
  }

  /** « Commence dans 3 jours », « Encore 5 jours »... */
  protected echeance(defi: DefiResponse): string {
    const jour = 24 * 60 * 60 * 1000;
    const aujourdhui = new Date(new Date().toDateString()).getTime();
    const debut = new Date(defi.dateDebut + 'T00:00:00').getTime();
    const fin = new Date(defi.dateFin + 'T00:00:00').getTime();
    if (aujourdhui < debut) {
      const n = Math.round((debut - aujourdhui) / jour);
      return n === 1 ? 'Commence demain' : `Commence dans ${n} jours`;
    }
    if (aujourdhui <= fin) {
      const n = Math.round((fin - aujourdhui) / jour);
      return n === 0 ? "Se termine aujourd'hui" : `Encore ${n} jour${n > 1 ? 's' : ''}`;
    }
    return 'Période terminée';
  }

  // ===================== Décision sur une proposition =====================

  async valider(defi: DefiResponse): Promise<void> {
    const confirme = await this.confirmation.demander({
      titre: `Valider « ${defi.nom} » ?`,
      message: 'Le défi sera visible par les cuisiniers, qui pourront y participer.',
      texteConfirmer: 'Valider le défi',
    });
    if (confirme) {
      await this.executer(
        () => firstValueFrom(this.defiService.decider(defi.id, true)),
        `« ${defi.nom} » est validé.`,
      );
    }
  }

  async refuser(defi: DefiResponse): Promise<void> {
    const motif = await this.confirmation.demanderMotif({
      titre: `Refuser « ${defi.nom} » ?`,
      message: 'Le chef pourra corriger son défi et le proposer à nouveau.',
      libelle: 'Motif du refus',
      aide: 'Ce message sera montré au chef : dites ce qu’il faut changer.',
      texteConfirmer: 'Refuser le défi',
    });
    if (motif) {
      await this.executer(
        () => firstValueFrom(this.defiService.decider(defi.id, false, motif)),
        `« ${defi.nom} » est refusé. Le chef verra votre motif.`,
      );
    }
  }

  // ===================== Vie du défi =====================

  /** Seule action manuelle sur le statut : le reste suit les dates. */
  async annuler(defi: DefiResponse): Promise<void> {
    const confirme = await this.confirmation.demander({
      titre: `Annuler « ${defi.nom} » ?`,
      message: 'Le défi ne sera plus proposé. Cette action ne peut pas être défaite.',
      texteConfirmer: 'Annuler le défi',
      texteAnnuler: 'Retour',
      danger: true,
    });
    if (confirme) {
      await this.executer(() => firstValueFrom(this.defiService.annuler(defi.id)), `« ${defi.nom} » est annulé.`);
    }
  }

  async supprimer(defi: DefiResponse): Promise<void> {
    const confirme = await this.confirmation.demander({
      titre: `Supprimer « ${defi.nom} » ?`,
      message: 'Le défi et ses participations disparaîtront de Gwaso.',
      texteConfirmer: 'Supprimer',
      danger: true,
    });
    if (!confirme) {
      return;
    }
    this.actionEnCours.set(true);
    this.defiService.supprimer(defi.id).subscribe({
      next: () => {
        this.notification.succes(`« ${defi.nom} » est supprimé.`);
        this.aValider.rafraichir();
        this.router.navigate(['/defis']);
      },
      error: (erreur: unknown) => {
        this.actionEnCours.set(false);
        this.notification.erreur(messageErreur(erreur, "Le défi n'a pas pu être supprimé."));
      },
    });
  }

  // ===================== Notes et classement =====================

  /** Enregistre la note quand l'admin quitte le champ (ou appuie sur Entrée). */
  enregistrerNote(participation: ParticipationDefiResponse, champ: HTMLInputElement): void {
    const texte = champ.value.trim().replace(',', '.');
    if (texte === '') {
      champ.value = participation.score?.toString() ?? '';
      return;
    }
    const note = Number(texte);
    if (Number.isNaN(note) || note < 0 || note > NOTE_MAX) {
      this.notification.avertissement(`La note doit être comprise entre 0 et ${NOTE_MAX}.`);
      champ.value = participation.score?.toString() ?? '';
      return;
    }
    if (note === participation.score) {
      return;
    }
    this.noteEnCours.set(participation.id);
    this.defiService.noter(participation.id, note).subscribe({
      next: (miseAJour) => {
        this.participants.update((liste) =>
          liste.map((p) => (p.id === miseAJour.id ? { ...p, score: miseAJour.score } : p)),
        );
        this.noteEnCours.set(null);
      },
      error: (erreur: unknown) => {
        this.noteEnCours.set(null);
        champ.value = participation.score?.toString() ?? '';
        this.notification.erreur(messageErreur(erreur, "La note n'a pas pu être enregistrée."));
      },
    });
  }

  async publierClassement(defi: DefiResponse): Promise<void> {
    const sansNote = this.participants().length - this.nbNotes();
    const confirme = await this.confirmation.demander({
      titre: defi.classementPublie ? 'Mettre à jour le classement publié ?' : 'Publier le classement ?',
      message:
        'Les rangs sont calculés à partir des notes (ex æquo = même rang). Tous les membres voient ensuite le classement.' +
        (sansNote > 0 ? ` ${sansNote} participant${sansNote > 1 ? 's' : ''} sans note ne sera pas classé.` : ''),
      texteConfirmer: defi.classementPublie ? 'Mettre à jour' : 'Publier le classement',
    });
    if (confirme) {
      await this.executer(
        () => firstValueFrom(this.defiService.publierClassement(defi.id)),
        'Le classement est publié. Bravo aux participants !',
      );
    }
  }

  private async executer(appel: () => Promise<unknown>, succes: string): Promise<void> {
    this.actionEnCours.set(true);
    try {
      await appel();
      this.notification.succes(succes);
      this.aValider.rafraichir();
      this.charger(this.id());
    } catch (erreur) {
      this.notification.erreur(messageErreur(erreur, "L'action n'a pas pu être effectuée."));
    } finally {
      this.actionEnCours.set(false);
    }
  }
}
