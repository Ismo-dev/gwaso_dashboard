import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatAutocomplete, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { MatButton } from '@angular/material/button';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatOption } from '@angular/material/core';
import { MatError, MatFormField, MatHint, MatLabel, MatPrefix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatProgressBar } from '@angular/material/progress-bar';
import { Router, RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  firstValueFrom,
  lastValueFrom,
  map,
  of,
  startWith,
  switchMap,
  tap,
} from 'rxjs';
import { AValiderService } from '../../../../core/services/a-valider.service';
import { FilArianeService } from '../../../../core/services/fil-ariane.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { messageErreur } from '../../../../core/utils/erreurs';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { FichierPipe } from '../../../../shared/pipes/fichier.pipe';
import { RecetteService } from '../../../recettes/services/recette.service';
import {
  formaterDuree,
  formaterTaille,
  TypeVideo,
  VideoRequest,
  VideoResponse,
} from '../../models/video.model';
import { VideoService } from '../../services/video.service';

/** Formats acceptés par l'API (le type réel est revérifié côté serveur). */
const TYPES_VIDEO = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska'];
const TYPES_IMAGE = ['image/jpeg', 'image/png', 'image/webp'];
const TAILLE_MAX_MO = 200;

/** Sujet de la vidéo : une recette du catalogue, ou un type libre. */
type Sujet = 'RECETTE' | 'ASTUCE' | 'TECHNIQUE' | 'GENERAL';

interface RecetteChoisie {
  id: string;
  nom: string;
}

/** Étapes de l'enregistrement, affichées pendant l'envoi. */
type Etape = 'infos' | 'fichier' | 'miniature' | 'publication';

/**
 * Publication d'une vidéo par l'administrateur (/videos/nouvelle), ou modification (/videos/:id/modifier).
 * Déroulé : informations → envoi du fichier (avec progression) → miniature → mise en ligne.
 * Publiée par un administrateur, la vidéo est en ligne tout de suite, sans validation.
 */
@Component({
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButton,
    MatButtonToggleGroup,
    MatButtonToggle,
    MatFormField,
    MatLabel,
    MatHint,
    MatError,
    MatPrefix,
    MatInput,
    MatAutocomplete,
    MatAutocompleteTrigger,
    MatOption,
    MatProgressBar,
    NgIcon,
    PageHeader,
    EmptyState,
    FichierPipe,
  ],
  selector: 'app-video-formulaire',
  styleUrl: './video-formulaire.scss',
  templateUrl: './video-formulaire.html',
})
export class VideoFormulaire {
  private videoService = inject(VideoService);
  private recetteService = inject(RecetteService);
  private notification = inject(NotificationService);
  private aValider = inject(AValiderService);
  private filAriane = inject(FilArianeService);
  private router = inject(Router);

  /** Présent sur /videos/:id/modifier. */
  readonly id = input<string>();

  protected readonly tailleMax = TAILLE_MAX_MO;
  protected readonly formatsVideo = TYPES_VIDEO.join(',');
  protected readonly formatsImage = TYPES_IMAGE.join(',');

  protected video = signal<VideoResponse | null>(null);
  protected estNouvelle = computed(() => !this.id());
  protected chargement = signal(false);
  protected introuvable = signal(false);

  // ----- Informations -----
  protected formulaire = inject(FormBuilder).nonNullable.group({
    titre: ['', [Validators.required, Validators.maxLength(150)]],
    description: ['', Validators.maxLength(3000)],
    sujet: ['GENERAL' as Sujet],
  });
  protected sujet = toSignal(
    this.formulaire.controls.sujet.valueChanges.pipe(startWith(this.formulaire.controls.sujet.value)),
    { requireSync: true },
  );
  protected longueurDescription = toSignal(
    this.formulaire.controls.description.valueChanges.pipe(map((v) => v.length)),
    { initialValue: 0 },
  );

  // ----- Recette liée (recettes publiées seulement) -----
  protected champRecette = new FormControl<string | RecetteChoisie>('', { nonNullable: true });
  protected suggestionsRecettes = toSignal(
    this.champRecette.valueChanges.pipe(
      startWith(''),
      map((valeur) => (typeof valeur === 'string' ? valeur.trim() : null)),
      debounceTime(250),
      distinctUntilChanged(),
      switchMap((terme) =>
        terme === null
          ? of([] as RecetteChoisie[])
          : this.recetteService
              .rechercher({ statut: 'PUBLIEE', recherche: terme || undefined, taille: 8 })
              .pipe(
                map((page) => page.contenu.map((r) => ({ id: r.id, nom: r.nom }))),
                catchError(() => of([] as RecetteChoisie[])),
              ),
      ),
      takeUntilDestroyed(),
    ),
    { initialValue: [] as RecetteChoisie[] },
  );
  protected nomRecette = (valeur: string | RecetteChoisie | null): string =>
    typeof valeur === 'string' ? valeur : (valeur?.nom ?? '');

  // ----- Fichier vidéo -----
  protected fichier = signal<File | null>(null);
  protected apercu = signal<string | null>(null);
  protected dureeSecondes = signal<number | null>(null);
  protected survol = signal(false);
  protected erreurFichier = signal('');
  protected duree = computed(() => formaterDuree(this.dureeSecondes()));
  protected taille = computed(() => formaterTaille(this.fichier()?.size ?? null));

  // ----- Miniature -----
  protected miniature = signal<File | null>(null);
  protected apercuMiniature = signal<string | null>(null);
  /** true : image prise automatiquement dans la vidéo (l'admin peut la changer). */
  protected miniatureAuto = signal(false);

  // ----- Enregistrement -----
  protected enCours = signal(false);
  protected etape = signal<Etape | null>(null);
  protected progression = signal(0);
  protected erreur = signal('');

  constructor() {
    effect(() => {
      const id = this.id();
      if (id) {
        untracked(() => this.charger(id));
      }
    });
    inject(DestroyRef).onDestroy(() => {
      this.liberer(this.apercu());
      this.liberer(this.apercuMiniature());
    });
  }

  private charger(id: string): void {
    this.chargement.set(true);
    this.videoService.getDetail(id).subscribe({
      next: ({ video }) => {
        this.video.set(video);
        this.dureeSecondes.set(video.dureeSecondes);
        this.formulaire.reset({
          titre: video.titre,
          description: video.description ?? '',
          sujet: video.recetteId ? 'RECETTE' : (video.type as Sujet),
        });
        if (video.recetteId) {
          this.champRecette.setValue({ id: video.recetteId, nom: video.recetteNom ?? '' });
        }
        this.filAriane.definirPageCourante(`Modifier « ${video.titre} »`);
        this.chargement.set(false);
      },
      error: (erreur: HttpErrorResponse) => {
        this.introuvable.set(erreur.status === 404);
        this.chargement.set(false);
      },
    });
  }

  // ===================== Fichier =====================

  choisirFichier(evenement: Event): void {
    const champ = evenement.target as HTMLInputElement;
    const fichier = champ.files?.[0];
    champ.value = '';
    if (fichier) {
      this.prendreFichier(fichier);
    }
  }

  deposer(evenement: DragEvent): void {
    evenement.preventDefault();
    this.survol.set(false);
    const fichier = evenement.dataTransfer?.files?.[0];
    if (fichier) {
      this.prendreFichier(fichier);
    }
  }

  private prendreFichier(fichier: File): void {
    if (!TYPES_VIDEO.includes(fichier.type)) {
      this.erreurFichier.set('Format non accepté. Choisissez une vidéo MP4, WebM, MOV ou MKV.');
      return;
    }
    if (fichier.size > TAILLE_MAX_MO * 1024 * 1024) {
      this.erreurFichier.set(
        `Vidéo trop lourde (${Math.round(fichier.size / 1024 / 1024)} Mo). Maximum : ${TAILLE_MAX_MO} Mo.`,
      );
      return;
    }
    this.erreurFichier.set('');
    this.liberer(this.apercu());
    this.fichier.set(fichier);
    this.apercu.set(URL.createObjectURL(fichier));
    this.dureeSecondes.set(null);
    // Titre proposé à partir du nom du fichier, si le champ est encore vide
    if (!this.formulaire.controls.titre.value) {
      const nom = fichier.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
      this.formulaire.controls.titre.setValue(nom.charAt(0).toUpperCase() + nom.slice(1));
    }
  }

  /**
   * La durée est lue dans la vidéo elle-même dès que le navigateur la connaît.
   * Nouvelle vidéo sans miniature : on en prend une automatiquement (l'image à 1 s).
   */
  lireDuree(lecteur: HTMLVideoElement): void {
    if (Number.isFinite(lecteur.duration)) {
      this.dureeSecondes.set(Math.round(lecteur.duration));
    }
    if (this.fichier() && !this.miniature() && !this.video()?.miniatureUrl) {
      this.genererMiniature(lecteur);
    }
  }

  private genererMiniature(lecteur: HTMLVideoElement): void {
    const instant = Math.min(1, (lecteur.duration || 0) / 2);
    lecteur.addEventListener(
      'seeked',
      () => {
        this.dessiner(lecteur, (image) => {
          this.prendreMiniature(image);
          this.miniatureAuto.set(true);
        });
        lecteur.currentTime = 0;
      },
      { once: true },
    );
    lecteur.currentTime = instant;
  }

  // ===================== Miniature =====================

  choisirMiniature(evenement: Event): void {
    const champ = evenement.target as HTMLInputElement;
    const image = champ.files?.[0];
    champ.value = '';
    if (!image) {
      return;
    }
    if (!TYPES_IMAGE.includes(image.type) || image.size > 5 * 1024 * 1024) {
      this.notification.avertissement('Image JPG, PNG ou WebP de 5 Mo maximum.');
      return;
    }
    this.prendreMiniature(image);
    this.miniatureAuto.set(false);
  }

  /** Prend l'image affichée à l'instant dans le lecteur comme miniature. */
  capturer(lecteur: HTMLVideoElement): void {
    if (!lecteur.videoWidth) {
      this.notification.avertissement('Lancez ou avancez la vidéo, puis réessayez.');
      return;
    }
    const reussi = this.dessiner(lecteur, (image) => {
      this.prendreMiniature(image);
      this.miniatureAuto.set(false);
      this.notification.info('Cette image servira de miniature.');
    });
    if (!reussi) {
      // Vidéo déjà sur le serveur : le navigateur interdit d'en copier une image
      this.notification.avertissement('Impossible de capturer cette vidéo. Choisissez plutôt une photo.');
    }
  }

  /** Copie l'image affichée dans le lecteur en JPEG. false si le navigateur l'interdit. */
  private dessiner(lecteur: HTMLVideoElement, apres: (image: File) => void): boolean {
    if (!lecteur.videoWidth) {
      return false;
    }
    const toile = document.createElement('canvas');
    toile.width = lecteur.videoWidth;
    toile.height = lecteur.videoHeight;
    try {
      toile.getContext('2d')?.drawImage(lecteur, 0, 0);
      toile.toBlob(
        (image) => image && apres(new File([image], 'miniature.jpg', { type: 'image/jpeg' })),
        'image/jpeg',
        0.88,
      );
      return true;
    } catch {
      return false;
    }
  }

  retirerMiniature(): void {
    this.miniatureAuto.set(false);
    this.liberer(this.apercuMiniature());
    this.miniature.set(null);
    this.apercuMiniature.set(null);
  }

  private prendreMiniature(image: File): void {
    this.liberer(this.apercuMiniature());
    this.miniature.set(image);
    this.apercuMiniature.set(URL.createObjectURL(image));
  }

  // ===================== Enregistrement =====================

  /** publier = true : mise en ligne immédiate ; false : brouillon. */
  async enregistrer(publier: boolean): Promise<void> {
    const existante = this.video();
    if (this.formulaire.invalid) {
      this.formulaire.markAllAsTouched();
      this.erreur.set('Donnez un titre à la vidéo.');
      return;
    }
    if (!existante && !this.fichier()) {
      this.erreur.set('Choisissez le fichier vidéo.');
      return;
    }
    const v = this.formulaire.getRawValue();
    const recette = this.champRecette.value;
    if (v.sujet === 'RECETTE' && typeof recette !== 'object') {
      this.erreur.set('Choisissez la recette dans la liste proposée.');
      return;
    }

    const requete: VideoRequest = {
      titre: v.titre.trim(),
      description: v.description.trim() || null,
      recetteId: v.sujet === 'RECETTE' ? (recette as RecetteChoisie).id : null,
      type: v.sujet === 'RECETTE' ? null : (v.sujet as TypeVideo),
      dureeSecondes: this.dureeSecondes(),
    };

    this.enCours.set(true);
    this.erreur.set('');
    let video: VideoResponse | null = existante;
    try {
      this.etape.set('infos');
      video = await firstValueFrom(
        existante ? this.videoService.modifier(existante.id, requete) : this.videoService.creer(requete),
      );
      this.video.set(video);

      const fichier = this.fichier();
      if (fichier) {
        this.etape.set('fichier');
        this.progression.set(0);
        const id = video.id;
        await lastValueFrom(
          this.videoService.envoyerFichier(id, fichier).pipe(
            tap((envoi) => {
              if (envoi.etape === 'progression') {
                this.progression.set(envoi.pourcentage);
              } else {
                video = envoi.video;
              }
            }),
          ),
        );
        this.fichier.set(null);
      }

      const miniature = this.miniature();
      if (miniature && video) {
        this.etape.set('miniature');
        video = await firstValueFrom(this.videoService.envoyerMiniature(video.id, miniature));
        this.retirerMiniature();
      }

      if (publier && video && (video.statut === 'BROUILLON' || video.statut === 'REJETEE')) {
        this.etape.set('publication');
        video = await firstValueFrom(this.videoService.publier(video.id));
      }

      this.aValider.rafraichir();
      this.notification.succes(
        video?.statut === 'PUBLIEE'
          ? `« ${video.titre} » est en ligne.`
          : `« ${video?.titre} » est enregistrée en brouillon.`,
      );
      this.router.navigate(['/videos', video!.id]);
    } catch (erreur) {
      this.enCours.set(false);
      this.etape.set(null);
      // La vidéo existe déjà (brouillon) : on passe en mode modification pour pouvoir réessayer
      if (video && !existante) {
        this.router.navigate(['/videos', video.id, 'modifier'], { replaceUrl: true });
        this.erreur.set(
          messageErreur(erreur, "Le fichier n'a pas pu être envoyé.") +
            ' La vidéo est gardée en brouillon : vous pouvez réessayer.',
        );
      } else {
        this.erreur.set(messageErreur(erreur, "La vidéo n'a pas pu être enregistrée."));
      }
    }
  }

  private liberer(url: string | null): void {
    if (url) {
      URL.revokeObjectURL(url);
    }
  }
}
