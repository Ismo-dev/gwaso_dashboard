import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconButton } from '@angular/material/button';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatTooltip } from '@angular/material/tooltip';
import { NgIcon } from '@ng-icons/core';
import { NotificationService } from '../../../../core/services/notification.service';
import { SessionService } from '../../../../core/services/session.service';
import { messageErreur } from '../../../../core/utils/erreurs';
import { Avatar } from '../../../../shared/components/avatar/avatar';
import { DepuisPipe } from '../../../../shared/pipes/depuis.pipe';
import { CommentaireResponse, VideoResponse } from '../../models/video.model';
import { VideoService } from '../../services/video.service';

/**
 * Commentaires d'une vidéo, en panneau à côté du fil : lire, écrire (comme un membre) et supprimer.
 * On ne commente qu'une vidéo publiée.
 */
@Component({
  imports: [ReactiveFormsModule, MatIconButton, MatProgressSpinner, MatTooltip, NgIcon, Avatar, DepuisPipe],
  selector: 'app-commentaires-video',
  styleUrl: './commentaires-video.scss',
  templateUrl: './commentaires-video.html',
  host: { role: 'complementary', '[attr.aria-label]': "'Commentaires de ' + video().titre" },
})
export class CommentairesVideo {
  private videoService = inject(VideoService);
  private notification = inject(NotificationService);
  protected session = inject(SessionService);

  readonly video = input.required<VideoResponse>();
  readonly fermer = output<void>();
  /** +1 ou -1 : le fil met à jour son compteur. */
  readonly nombreChange = output<number>();

  protected commentaires = signal<CommentaireResponse[]>([]);
  protected chargement = signal(true);
  protected envoi = signal(false);
  protected champ = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(1000)],
  });

  /** On recharge seulement quand on change de vidéo (pas quand ses compteurs bougent). */
  private videoId = computed(() => this.video().id);

  constructor() {
    effect(() => {
      const id = this.videoId();
      untracked(() => this.charger(id));
    });
  }

  private charger(id: string): void {
    this.chargement.set(true);
    this.videoService.getCommentaires(id, { taille: 50 }).subscribe({
      next: (page) => {
        this.commentaires.set(page.contenu);
        this.chargement.set(false);
      },
      error: () => {
        this.commentaires.set([]);
        this.chargement.set(false);
      },
    });
  }

  envoyer(): void {
    const contenu = this.champ.value.trim();
    if (!contenu || this.envoi()) {
      return;
    }
    this.envoi.set(true);
    this.videoService.commenter(this.video().id, contenu).subscribe({
      next: (commentaire) => {
        this.commentaires.update((liste) => [commentaire, ...liste]);
        this.champ.reset();
        this.envoi.set(false);
        this.nombreChange.emit(1);
      },
      error: (erreur: unknown) => {
        this.envoi.set(false);
        this.notification.erreur(messageErreur(erreur, "Le commentaire n'a pas pu être envoyé."));
      },
    });
  }

  /** Entrée envoie, Maj+Entrée va à la ligne. */
  touche(evenement: KeyboardEvent): void {
    if (evenement.key === 'Enter' && !evenement.shiftKey) {
      evenement.preventDefault();
      this.envoyer();
    }
  }

  supprimer(commentaire: CommentaireResponse): void {
    this.videoService.supprimerCommentaire(commentaire.id).subscribe({
      next: () => {
        this.commentaires.update((liste) => liste.filter((c) => c.id !== commentaire.id));
        this.nombreChange.emit(-1);
      },
      error: (erreur: unknown) =>
        this.notification.erreur(messageErreur(erreur, "Le commentaire n'a pas pu être supprimé.")),
    });
  }
}
