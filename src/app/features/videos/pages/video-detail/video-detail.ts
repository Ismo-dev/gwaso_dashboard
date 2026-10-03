import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { forkJoin } from 'rxjs';
import { FilArianeService } from '../../../../core/services/fil-ariane.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { messageErreur } from '../../../../core/utils/erreurs';
import { Avatar } from '../../../../shared/components/avatar/avatar';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { DepuisPipe } from '../../../../shared/pipes/depuis.pipe';
import { FichierPipe } from '../../../../shared/pipes/fichier.pipe';
import { LIBELLES_TYPE_COMPTE } from '../../../utilisateurs/models/utilisateur.model';
import {
  CommentaireResponse,
  formaterDuree,
  formaterTaille,
  LIBELLES_TYPE_VIDEO,
  VideoAdminResponse,
  VideoResponse,
} from '../../models/video.model';
import { ModerationVideo } from '../../services/moderation-video';
import { VideoService } from '../../services/video.service';

/**
 * Fiche d'une vidéo : lecture, décision de modération, informations sur la vidéo et sur son auteur,
 * chiffres et commentaires (l'admin peut supprimer un commentaire).
 */
@Component({
  imports: [
    RouterLink,
    DatePipe,
    DecimalPipe,
    MatButton,
    MatIconButton,
    MatTooltip,
    NgIcon,
    Avatar,
    EmptyState,
    StatusBadge,
    DepuisPipe,
    FichierPipe,
  ],
  selector: 'app-video-detail',
  styleUrl: './video-detail.scss',
  templateUrl: './video-detail.html',
})
export class VideoDetail {
  private videoService = inject(VideoService);
  private moderation = inject(ModerationVideo);
  private notification = inject(NotificationService);
  private filAriane = inject(FilArianeService);
  private router = inject(Router);

  /** Identifiant lu dans l'adresse (/videos/:id) grâce à withComponentInputBinding(). */
  readonly id = input.required<string>();

  protected detail = signal<VideoAdminResponse | null>(null);
  protected commentaires = signal<CommentaireResponse[]>([]);
  protected totalCommentaires = signal(0);
  protected chargement = signal(true);
  protected introuvable = signal(false);
  protected erreur = signal(false);
  protected actionEnCours = signal(false);

  protected readonly libellesRole = LIBELLES_TYPE_COMPTE;
  protected video = computed(() => this.detail()?.video ?? null);
  protected auteur = computed(() => this.detail()?.auteur ?? null);
  protected type = computed(() => {
    const video = this.video();
    return video ? LIBELLES_TYPE_VIDEO[video.type] : '';
  });
  protected duree = computed(() => formaterDuree(this.video()?.dureeSecondes ?? null));
  protected taille = computed(() => formaterTaille(this.video()?.tailleOctets ?? null));

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
      detail: this.videoService.getDetail(id),
      commentaires: this.videoService.getCommentaires(id, { taille: 50 }),
    }).subscribe({
      next: ({ detail, commentaires }) => {
        this.detail.set(detail);
        this.commentaires.set(commentaires.contenu);
        this.totalCommentaires.set(commentaires.totalElements);
        this.filAriane.definirPageCourante(detail.video.titre);
        this.chargement.set(false);
      },
      error: (erreur: HttpErrorResponse) => {
        this.introuvable.set(erreur.status === 404);
        this.erreur.set(erreur.status !== 404);
        this.chargement.set(false);
      },
    });
  }

  // ----- Modération -----

  publier(video: VideoResponse): Promise<void> {
    return this.agir(() => this.moderation.publier(video));
  }

  refuser(video: VideoResponse): Promise<void> {
    return this.agir(() => this.moderation.refuser(video));
  }

  desactiver(video: VideoResponse): Promise<void> {
    return this.agir(() => this.moderation.desactiver(video));
  }

  reactiver(video: VideoResponse): Promise<void> {
    return this.agir(() => this.moderation.reactiver(video));
  }

  async supprimer(video: VideoResponse): Promise<void> {
    this.actionEnCours.set(true);
    const fait = await this.moderation.supprimer(video);
    this.actionEnCours.set(false);
    if (fait) {
      this.router.navigate(['/videos']);
    }
  }

  private async agir(action: () => Promise<boolean>): Promise<void> {
    this.actionEnCours.set(true);
    const fait = await action();
    this.actionEnCours.set(false);
    if (fait) {
      this.charger(this.id());
    }
  }

  // ----- Commentaires -----

  supprimerCommentaire(commentaire: CommentaireResponse): void {
    this.videoService.supprimerCommentaire(commentaire.id).subscribe({
      next: () => {
        this.commentaires.update((liste) => liste.filter((c) => c.id !== commentaire.id));
        this.totalCommentaires.update((total) => total - 1);
        this.notification.info('Le commentaire est supprimé.');
      },
      error: (erreur: unknown) =>
        this.notification.erreur(messageErreur(erreur, "Le commentaire n'a pas pu être supprimé.")),
    });
  }
}
