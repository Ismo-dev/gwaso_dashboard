import { DecimalPipe } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatTooltip } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { Avatar } from '../../../../shared/components/avatar/avatar';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { DepuisPipe } from '../../../../shared/pipes/depuis.pipe';
import { FichierPipe } from '../../../../shared/pipes/fichier.pipe';
import { CommentairesVideo } from '../../components/commentaires-video/commentaires-video';
import { formaterDuree, LIBELLES_TYPE_VIDEO, StatutVideo, VideoResponse } from '../../models/video.model';
import { ModerationVideo } from '../../services/moderation-video';
import { VideoService } from '../../services/video.service';

const TAILLE_PAGE = 8;

/**
 * Fil de vidéos, comme dans l'application : une vidéo par écran, on fait défiler de haut en bas.
 * La vidéo visible se lance toute seule (sans le son, comme sur les réseaux sociaux), les autres sont en pause.
 * L'admin garde ses actions sur le côté : publier ou refuser (à valider), retirer (publiée), supprimer.
 * Il aime et commente une vidéo publiée comme n'importe quel membre.
 * Les vues ne sont pas comptées : on passe par les routes d'administration.
 */
@Component({
  imports: [
    RouterLink,
    DecimalPipe,
    MatButton,
    MatIconButton,
    MatButtonToggleGroup,
    MatButtonToggle,
    MatProgressSpinner,
    MatTooltip,
    NgIcon,
    Avatar,
    EmptyState,
    DepuisPipe,
    FichierPipe,
    CommentairesVideo,
  ],
  selector: 'app-videos-fil',
  styleUrl: './videos-fil.scss',
  templateUrl: './videos-fil.html',
  host: { '(document:keydown)': 'clavier($event)' },
})
export class VideosFil {
  private videoService = inject(VideoService);
  private moderation = inject(ModerationVideo);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  /** ?statut=EN_ATTENTE_VALIDATION pour modérer en faisant défiler ; publiées par défaut. */
  readonly statut = input<string>();
  protected statutActif = computed<StatutVideo>(() =>
    this.statut() === 'EN_ATTENTE_VALIDATION' ? 'EN_ATTENTE_VALIDATION' : 'PUBLIEE',
  );

  protected readonly types = LIBELLES_TYPE_VIDEO;
  protected videos = signal<VideoResponse[]>([]);
  protected chargement = signal(false);
  protected erreur = signal(false);
  private pageSuivante = 0;
  private dernierePage = false;
  /** Toutes les pages sont chargées : on l'indique en bas du fil. */
  protected toutVu = signal(false);

  /** Index de la vidéo à l'écran. */
  protected actif = signal(0);
  /** Son coupé par défaut : le navigateur n'autorise la lecture automatique que sans le son. */
  protected son = signal(false);
  protected actionEnCours = signal<string | null>(null);

  // ----- Lecture de la vidéo visible -----
  protected readonly formaterDuree = formaterDuree;
  /** Position et durée de la vidéo à l'écran (en secondes), pour la barre de progression. */
  protected temps = signal({ courant: 0, total: 0 });
  /** Description affichée en entier (« voir plus »), par vidéo. */
  protected descriptionsOuvertes = signal<ReadonlySet<string>>(new Set());

  // ----- J'aime et commentaires -----
  /** true : l'admin connecté aime la vidéo (chargé quand la vidéo arrive à l'écran). */
  protected jaime = signal<Record<string, boolean>>({});
  protected commentairesDe = signal<VideoResponse | null>(null);

  private conteneur = viewChild<ElementRef<HTMLElement>>('conteneur');
  private diapos = viewChildren<ElementRef<HTMLElement>>('diapo');
  private lecteurs = viewChildren<ElementRef<HTMLVideoElement>>('lecteur');
  private observateur: IntersectionObserver | null = null;

  constructor() {
    // Changement de fil (publiées / à valider) : on repart du début
    effect(() => {
      this.statutActif();
      untracked(() => this.recommencer());
    });

    // Repère la vidéo visible (au moins 60 % à l'écran)
    afterNextRender(() => {
      this.observateur = new IntersectionObserver(
        (entrees) => {
          for (const entree of entrees) {
            if (entree.isIntersecting) {
              this.actif.set(Number((entree.target as HTMLElement).dataset['index']));
            }
          }
        },
        { root: this.conteneur()?.nativeElement ?? null, threshold: 0.6 },
      );
      this.diapos().forEach((d) => this.observateur?.observe(d.nativeElement));
    });
    inject(DestroyRef).onDestroy(() => this.observateur?.disconnect());

    // Nouvelles diapositives (page suivante chargée) : on les observe aussi
    effect(() => {
      const diapos = this.diapos();
      untracked(() => diapos.forEach((d) => this.observateur?.observe(d.nativeElement)));
    });

    // Lecture de la vidéo visible, pause des autres
    effect(() => {
      const actif = this.actif();
      const son = this.son();
      for (const lecteur of this.lecteurs()) {
        const video = lecteur.nativeElement;
        video.muted = !son;
        if (Number(video.dataset['index']) === actif) {
          video.play().catch(() => undefined);
        } else {
          video.pause();
        }
      }
    });

    // Nouvelle vidéo à l'écran : barre remise à zéro, et on regarde si l'admin l'aime déjà
    effect(() => {
      const video = this.videos()[this.actif()];
      untracked(() => {
        this.temps.set({ courant: 0, total: video?.dureeSecondes ?? 0 });
        if (video && video.statut === 'PUBLIEE' && !(video.id in this.jaime())) {
          this.videoService.getMesReactions(video.id).subscribe({
            next: (r) => this.jaime.update((etat) => ({ ...etat, [video.id]: r.reactions.includes('AIME') })),
            error: () => undefined,
          });
        }
        // Le panneau des commentaires suit la vidéo à l'écran
        if (this.commentairesDe() && video) {
          this.commentairesDe.set(video);
        }
      });
    });

    // Presque au bout du fil : on charge la suite
    effect(() => {
      const actif = this.actif();
      const total = this.videos().length;
      if (total > 0 && actif >= total - 2) {
        untracked(() => this.chargerSuite());
      }
    });
  }

  private recommencer(): void {
    this.videos.set([]);
    this.pageSuivante = 0;
    this.dernierePage = false;
    this.toutVu.set(false);
    this.actif.set(0);
    this.conteneur()?.nativeElement.scrollTo({ top: 0 });
    this.chargerSuite();
  }

  chargerSuite(): void {
    if (this.chargement() || this.dernierePage) {
      return;
    }
    this.chargement.set(true);
    this.erreur.set(false);
    this.videoService
      .rechercher({ statut: this.statutActif(), page: this.pageSuivante, taille: TAILLE_PAGE })
      .subscribe({
        next: (page) => {
          // On n'affiche que les vidéos qui ont un fichier
          const nouvelles = page.contenu.filter((v) => !!v.videoUrl);
          this.videos.update((liste) => [...liste, ...nouvelles]);
          this.pageSuivante = page.page + 1;
          this.dernierePage = page.page + 1 >= page.totalPages;
          this.toutVu.set(this.dernierePage);
          this.chargement.set(false);
        },
        error: () => {
          this.chargement.set(false);
          this.erreur.set(true);
        },
      });
  }

  changerFil(statut: StatutVideo): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { statut: statut === 'PUBLIEE' ? null : statut },
      replaceUrl: true,
    });
  }

  // ----- Navigation -----

  aller(index: number): void {
    const diapo = this.diapos()[index];
    diapo?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** Flèches haut / bas pour passer d'une vidéo à l'autre, M pour le son. */
  clavier(evenement: KeyboardEvent): void {
    const cible = evenement.target as HTMLElement | null;
    if (cible?.closest('input, textarea, app-commentaires-video, mat-dialog-container, .cdk-overlay-container')) {
      return;
    }
    if (evenement.key === 'ArrowDown') {
      evenement.preventDefault();
      this.aller(Math.min(this.actif() + 1, this.videos().length - 1));
    } else if (evenement.key === 'ArrowUp') {
      evenement.preventDefault();
      this.aller(Math.max(this.actif() - 1, 0));
    } else if (evenement.key.toLowerCase() === 'm') {
      this.son.update((v) => !v);
    }
  }

  basculerLecture(index: number): void {
    const lecteur = this.lecteurs().find((l) => Number(l.nativeElement.dataset['index']) === index);
    const video = lecteur?.nativeElement;
    if (video) {
      if (video.paused) {
        video.play().catch(() => undefined);
      } else {
        video.pause();
      }
    }
  }

  // ----- Barre de progression -----

  suivreTemps(index: number, video: HTMLVideoElement): void {
    if (index === this.actif()) {
      this.temps.set({ courant: video.currentTime, total: Number.isFinite(video.duration) ? video.duration : 0 });
    }
  }

  avancer(index: number, champ: HTMLInputElement): void {
    const lecteur = this.lecteurs().find((l) => Number(l.nativeElement.dataset['index']) === index);
    if (lecteur) {
      lecteur.nativeElement.currentTime = Number(champ.value);
    }
  }

  basculerDescription(id: string): void {
    this.descriptionsOuvertes.update((ouvertes) => {
      const copie = new Set(ouvertes);
      if (!copie.delete(id)) {
        copie.add(id);
      }
      return copie;
    });
  }

  // ----- J'aime et commentaires -----

  basculerJaime(video: VideoResponse): void {
    const aime = !!this.jaime()[video.id];
    // Réponse immédiate à l'écran, corrigée par le serveur ensuite
    this.jaime.update((etat) => ({ ...etat, [video.id]: !aime }));
    this.majVideo(video.id, { nbJaime: video.nbJaime + (aime ? -1 : 1) });
    (aime ? this.videoService.nePlusAimer(video.id) : this.videoService.aimer(video.id)).subscribe({
      next: (r) => {
        this.jaime.update((etat) => ({ ...etat, [video.id]: r.reactions.includes('AIME') }));
        this.majVideo(video.id, { nbJaime: r.nbJaime });
      },
      error: () => {
        this.jaime.update((etat) => ({ ...etat, [video.id]: aime }));
        this.majVideo(video.id, { nbJaime: video.nbJaime });
      },
    });
  }

  basculerCommentaires(video: VideoResponse): void {
    this.commentairesDe.update((ouverte) => (ouverte?.id === video.id ? null : video));
  }

  compterCommentaire(id: string, ecart: number): void {
    const video = this.videos().find((v) => v.id === id);
    if (video) {
      this.majVideo(id, { nbCommentaires: Math.max(0, video.nbCommentaires + ecart) });
    }
  }

  private majVideo(id: string, changements: Partial<VideoResponse>): void {
    this.videos.update((liste) => liste.map((v) => (v.id === id ? { ...v, ...changements } : v)));
  }

  // ----- Modération -----

  async publier(video: VideoResponse): Promise<void> {
    await this.agir(video, () => this.moderation.publier(video), true);
  }

  async refuser(video: VideoResponse): Promise<void> {
    await this.agir(video, () => this.moderation.refuser(video), true);
  }

  async retirer(video: VideoResponse): Promise<void> {
    await this.agir(video, () => this.moderation.desactiver(video), true);
  }

  async supprimer(video: VideoResponse): Promise<void> {
    await this.agir(video, () => this.moderation.supprimer(video), true);
  }

  /** Après une décision, la vidéo quitte le fil (elle ne correspond plus au filtre) ; on passe à la suivante. */
  private async agir(
    video: VideoResponse,
    action: () => Promise<boolean>,
    retirerDuFil: boolean,
  ): Promise<void> {
    this.actionEnCours.set(video.id);
    const fait = await action();
    this.actionEnCours.set(null);
    if (fait && retirerDuFil) {
      const index = this.videos().findIndex((v) => v.id === video.id);
      this.videos.update((liste) => liste.filter((v) => v.id !== video.id));
      this.actif.set(Math.min(index, Math.max(this.videos().length - 1, 0)));
      if (this.videos().length < 3) {
        this.chargerSuite();
      }
    }
  }
}
