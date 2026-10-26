import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatAutocomplete, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatOptgroup, MatOption } from '@angular/material/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatError, MatFormField, MatHint, MatLabel, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSelect } from '@angular/material/select';
import { MatTooltip } from '@angular/material/tooltip';
import { NgIcon } from '@ng-icons/core';
import { forkJoin, Observable, of, startWith, switchMap } from 'rxjs';
import { ConfirmationService } from '../../../../core/services/confirmation.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { messageErreur } from '../../../../core/utils/erreurs';
import { EditeurRiche } from '../../../../shared/components/editeur-riche/editeur-riche';
import { ImageUpload } from '../../../../shared/components/image-upload/image-upload';
import { VideoUpload } from '../../../../shared/components/video-upload/video-upload';
import { AudioEtape } from '../audio-etape/audio-etape';
import { UnitePipe } from '../../../../shared/pipes/unite.pipe';
import { IngredientFormulaire } from '../../../ingredients/components/ingredient-formulaire/ingredient-formulaire';
import { IngredientResponse, Unite, UNITES } from '../../../ingredients/models/ingredient.model';
import { IngredientService } from '../../../ingredients/services/ingredient.service';
import { UstensileFormulaire } from '../../../ustensiles/components/ustensile-formulaire/ustensile-formulaire';
import { UstensileResponse } from '../../../ustensiles/models/ustensile.model';
import { UstensileService } from '../../../ustensiles/services/ustensile.service';
import {
  EtapeIngredientResponse,
  EtapeResponse,
  EtapeUstensileAlternativeResponse,
  EtapeUstensileResponse,
  RecetteIngredientResponse,
} from '../../models/recette.model';
import { RecetteService } from '../../services/recette.service';
import { AlternativesEtape } from '../alternatives-etape/alternatives-etape';

/** Choix dans une liste : un élément existant, ou la création d'un nouveau à partir du texte saisi. */
type Choix<T> = T | { creer: string };

export interface DonneesEtapeEditeur {
  recetteId: string;
  /** Numéro affiché (1, 2, 3...). */
  numero: number;
  /** Ordre enregistré pour une nouvelle étape (unique dans la recette). */
  ordre: number;
  /** Étape à modifier ; absente pour un ajout. */
  etape?: EtapeResponse;
  /** Ingrédients de la recette : l'étape pioche dedans. */
  ingredientsRecette: RecetteIngredientResponse[];
}

/** Ce que l'éditeur renvoie en se fermant. */
export interface ResultatEtapeEditeur {
  etape: EtapeResponse | null;
  /** true si quelque chose a été enregistré : la recette doit recharger ses étapes. */
  modifie: boolean;
  /** true si des ingrédients ont été ajoutés à la recette depuis l'étape : elle doit les recharger. */
  ingredientsRecetteModifies: boolean;
}

/**
 * Éditeur complet d'une étape, ouvert en panneau sur le côté droit (la recette reste visible derrière).
 *
 * 1. Ce qu'il faut faire : titre, instructions (texte riche), durée → enregistre l'étape.
 * 2. Ingrédients utilisés dans l'étape, avec leur quantité. On peut choisir un ingrédient
 *    qui n'est pas encore dans la recette (il y est ajouté) ou en créer un nouveau.
 * 3. Ustensiles (existants ou créés sur place) et leurs alternatives, propres à cette étape.
 * 4. Photo ou vidéo de l'étape.
 * Les sections 2 à 4 se débloquent quand l'étape est enregistrée (l'API a besoin de son identifiant).
 * Une étape peut n'avoir ni ingrédient, ni ustensile, ni média.
 */
@Component({
  imports: [
    ReactiveFormsModule,
    DecimalPipe,
    MatButton,
    MatIconButton,
    MatFormField,
    MatLabel,
    MatHint,
    MatError,
    MatSuffix,
    MatInput,
    MatSelect,
    MatOption,
    MatOptgroup,
    MatAutocomplete,
    MatAutocompleteTrigger,
    MatProgressSpinner,
    MatTooltip,
    MatDialogTitle,
    NgIcon,
    EditeurRiche,
    ImageUpload,
    VideoUpload,
    AudioEtape,
    UnitePipe,
    AlternativesEtape,
    IngredientFormulaire,
    UstensileFormulaire,
  ],
  selector: 'app-etape-editeur',
  styleUrl: './etape-editeur.scss',
  templateUrl: './etape-editeur.html',
})
export class EtapeEditeur implements OnInit {
  private recetteService = inject(RecetteService);
  private ustensileService = inject(UstensileService);
  private ingredientService = inject(IngredientService);
  private confirmation = inject(ConfirmationService);
  private notification = inject(NotificationService);
  private fenetre = inject(MatDialogRef<EtapeEditeur, ResultatEtapeEditeur>);
  protected donnees = inject<DonneesEtapeEditeur>(MAT_DIALOG_DATA);

  protected readonly unites = UNITES;

  // ----- État général -----
  protected etape = signal<EtapeResponse | null>(this.donnees.etape ?? null);
  private modifie = false;
  private ingredientsRecetteModifies = false;

  // ----- 1. Ce qu'il faut faire -----
  protected formulaire = inject(FormBuilder).group({
    titre: [this.donnees.etape?.titre ?? '', [Validators.required, Validators.maxLength(120)]],
    instructions: [
      this.donnees.etape?.instructions ?? '',
      [Validators.required, Validators.maxLength(4000)],
    ],
    dureeMinutes: [
      this.donnees.etape?.dureeMinutes ?? null,
      [Validators.min(1), Validators.max(1440)],
    ],
  });
  protected enregistrement = signal(false);
  protected erreur = signal('');
  private titreSaisi = toSignal(
    this.formulaire.controls.titre.valueChanges.pipe(
      startWith(this.formulaire.controls.titre.value),
    ),
  );
  protected titreAffiche = computed(
    () => this.titreSaisi()?.trim() || (this.etape() ? 'Sans titre' : 'Nouvelle étape'),
  );

  // ----- 2. Ingrédients de l'étape -----
  protected ingredientsEtape = signal<EtapeIngredientResponse[]>([]);
  /** Ingrédients de la recette ; la liste grandit si l'étape en ajoute un nouveau. */
  protected ingredientsRecette = signal<RecetteIngredientResponse[]>(
    this.donnees.ingredientsRecette,
  );
  private catalogueIngredients = signal<IngredientResponse[]>([]);
  protected champIngredient = new FormControl<string | Choix<IngredientResponse>>('', {
    nonNullable: true,
  });
  protected quantiteIngredient = new FormControl<number | null>(null, [
    Validators.required,
    Validators.min(0.01),
  ]);
  protected uniteIngredient = new FormControl<Unite | null>(null, Validators.required);
  protected ajoutIngredient = signal(false);
  private saisieIngredient = toSignal(this.champIngredient.valueChanges.pipe(startWith('')), {
    initialValue: '' as string | Choix<IngredientResponse>,
  });
  protected texteIngredient = computed(() => {
    const saisie = this.saisieIngredient();
    return typeof saisie === 'string' ? saisie.trim() : '';
  });
  /** Ingrédient choisi dans la liste (null tant que l'admin tape du texte). */
  protected ingredientChoisi = computed(() => {
    const saisie = this.saisieIngredient();
    return typeof saisie === 'object' && !('creer' in saisie) ? saisie : null;
  });
  /** true si l'ingrédient choisi n'est pas encore dans la recette : il y sera ajouté. */
  protected horsRecette = computed(() => {
    const choisi = this.ingredientChoisi();
    return !!choisi && !this.ingredientsRecette().some((i) => i.ingredientId === choisi.id);
  });

  /** Suggestions en deux groupes : d'abord ceux de la recette, puis le reste du catalogue. */
  protected suggestionsIngredients = computed(() => {
    const terme = this.texteIngredient().toLowerCase();
    const dansEtape = new Set(this.ingredientsEtape().map((i) => i.ingredientId));
    const dansRecette = new Set(this.ingredientsRecette().map((i) => i.ingredientId));
    const candidats = this.catalogueIngredients().filter(
      (i) => !dansEtape.has(i.id) && (!terme || i.nom.toLowerCase().includes(terme)),
    );
    return {
      recette: candidats.filter((i) => dansRecette.has(i.id)),
      autres: candidats.filter((i) => !dansRecette.has(i.id)).slice(0, 8),
    };
  });
  /** On propose « Créer … » si aucun ingrédient du catalogue ne porte exactement ce nom. */
  protected peutCreerIngredient = computed(() => {
    const terme = this.texteIngredient().toLowerCase();
    return !!terme && !this.catalogueIngredients().some((i) => i.nom.toLowerCase() === terme);
  });
  protected nomIngredient = (valeur: string | Choix<IngredientResponse> | null): string =>
    !valeur
      ? ''
      : typeof valeur === 'string'
        ? valeur
        : 'creer' in valeur
          ? valeur.creer
          : valeur.nom;

  // ----- 3. Ustensiles de l'étape -----
  protected ustensilesEtape = signal<EtapeUstensileResponse[]>([]);
  private catalogueUstensiles = signal<UstensileResponse[]>([]);
  protected champUstensile = new FormControl<string | Choix<UstensileResponse>>('', {
    nonNullable: true,
  });
  protected quantiteUstensile = new FormControl<number | null>(null, Validators.min(1));
  protected ajoutUstensile = signal(false);
  private saisieUstensile = toSignal(this.champUstensile.valueChanges.pipe(startWith('')), {
    initialValue: '' as string | Choix<UstensileResponse>,
  });
  protected texteUstensile = computed(() => {
    const saisie = this.saisieUstensile();
    return typeof saisie === 'string' ? saisie.trim() : '';
  });
  protected suggestionsUstensiles = computed(() => {
    const terme = this.texteUstensile().toLowerCase();
    const deja = new Set(this.ustensilesEtape().map((u) => u.ustensileId));
    return this.catalogueUstensiles()
      .filter((u) => !deja.has(u.id) && (!terme || u.nom.toLowerCase().includes(terme)))
      .slice(0, 10);
  });
  protected peutCreerUstensile = computed(() => {
    const terme = this.texteUstensile().toLowerCase();
    return !!terme && !this.catalogueUstensiles().some((u) => u.nom.toLowerCase() === terme);
  });
  protected nomUstensile = (valeur: string | Choix<UstensileResponse> | null): string =>
    !valeur
      ? ''
      : typeof valeur === 'string'
        ? valeur
        : 'creer' in valeur
          ? valeur.creer
          : valeur.nom;

  // ----- 4. Photo et vidéo -----
  protected photo = signal<File | null>(null);
  protected video = signal<File | null>(null);
  protected envoiPhoto = signal(false);
  protected envoiVideo = signal(false);

  constructor() {
    // Fermeture par Échap ou clic à côté : on vérifie d'abord qu'il n'y a rien de non enregistré
    this.fenetre.disableClose = true;
    this.fenetre
      .backdropClick()
      .pipe(takeUntilDestroyed())
      .subscribe(() => void this.fermer());
    this.fenetre
      .keydownEvents()
      .pipe(takeUntilDestroyed())
      .subscribe((evenement) => {
        if (evenement.key === 'Escape') {
          void this.fermer();
        }
      });
  }

  ngOnInit(): void {
    this.ingredientService.getAll().subscribe({
      next: (ingredients) =>
        this.catalogueIngredients.set(
          // Une proposition refusée ne s'utilise plus
          ingredients.filter((i) => i.statut !== 'REFUSE').sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
        ),
    });
    this.ustensileService.getAll().subscribe({
      next: (ustensiles) =>
        this.catalogueUstensiles.set(
          ustensiles.filter((u) => u.statut !== 'REFUSE').sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
        ),
    });
    const etape = this.etape();
    if (etape) {
      this.chargerContenu(etape.id);
    }
  }

  private chargerContenu(etapeId: string): void {
    forkJoin({
      ingredients: this.recetteService.getIngredientsEtape(etapeId),
      ustensiles: this.recetteService.getUstensilesEtape(etapeId),
    }).subscribe({
      next: ({ ingredients, ustensiles }) => {
        this.ingredientsEtape.set(ingredients);
        this.ustensilesEtape.set(ustensiles);
      },
    });
  }

  // ===================== 1. Ce qu'il faut faire =====================

  enregistrer(): void {
    const titre = (this.formulaire.controls.titre.value ?? '').trim();
    if (!titre) {
      this.formulaire.controls.titre.setValue('');
    }
    if (this.formulaire.invalid) {
      this.formulaire.markAllAsTouched();
      this.erreur.set(this.messageValidation());
      return;
    }
    this.enregistrement.set(true);
    this.erreur.set('');

    const v = this.formulaire.getRawValue();
    const existante = this.etape();
    const requete = {
      recetteId: this.donnees.recetteId,
      ordre: existante?.ordre ?? this.donnees.ordre,
      titre: (v.titre ?? '').trim(),
      instructions: v.instructions ?? '',
      dureeMinutes: v.dureeMinutes,
    };
    const appel = existante
      ? this.recetteService.modifierEtape(existante.id, requete)
      : this.recetteService.creerEtape(requete);

    appel.subscribe({
      next: (etape) => {
        this.etape.set(etape);
        this.modifie = true;
        this.formulaire.markAsPristine();
        this.enregistrement.set(false);
        this.notification.succes(
          existante
            ? "L'étape est enregistrée."
            : 'Étape créée. Ajoutez maintenant ses ingrédients, ustensiles et médias.',
        );
      },
      error: (erreur: unknown) => {
        this.enregistrement.set(false);
        this.erreur.set(messageErreur(erreur, "Impossible d'enregistrer l'étape."));
      },
    });
  }

  /** Dit précisément quel champ bloque l'enregistrement. */
  private messageValidation(): string {
    const c = this.formulaire.controls;
    const problemes: string[] = [];
    if (c.titre.invalid) {
      problemes.push(
        c.titre.hasError('maxlength')
          ? 'le titre est trop long (120 caractères max.)'
          : 'le titre est obligatoire',
      );
    }
    if (c.instructions.invalid) {
      problemes.push(
        c.instructions.hasError('maxlength')
          ? 'les instructions sont trop longues'
          : 'les instructions sont obligatoires',
      );
    }
    if (c.dureeMinutes.invalid) {
      problemes.push('la durée doit être comprise entre 1 et 1 440 minutes');
    }
    const texte = problemes.join(', ');
    return texte.charAt(0).toUpperCase() + texte.slice(1) + '.';
  }

  // ===================== 2. Ingrédients =====================

  /**
   * Nouvel ingrédient en cours de création, dans le panneau même (nom saisi), ou null.
   * Pas de fenêtre par-dessus le panneau : un seul défilement, et l'étape reste sous les yeux.
   */
  protected creationIngredient = signal<string | null>(null);

  /** L'admin a choisi un ingrédient, ou « Créer … », dans la liste. */
  choisirIngredient(choix: Choix<IngredientResponse>): void {
    if ('creer' in choix) {
      this.creationIngredient.set(choix.creer);
      return;
    }
    this.utiliserIngredient(choix);
  }

  /** Ingrédient créé dans le panneau : il rejoint le catalogue et devient le choix courant. */
  ingredientCree(cree: IngredientResponse): void {
    this.creationIngredient.set(null);
    this.catalogueIngredients.update((liste) =>
      [...liste, cree].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
    );
    this.champIngredient.setValue(cree);
    this.utiliserIngredient(cree);
  }

  annulerCreationIngredient(dejaCree: IngredientResponse | null): void {
    if (dejaCree) {
      this.ingredientCree(dejaCree);
      return;
    }
    this.champIngredient.setValue(this.creationIngredient() ?? '');
    this.creationIngredient.set(null);
  }

  private utiliserIngredient(ingredient: IngredientResponse): void {
    // Quantité proposée : celle de la recette si l'ingrédient y est déjà, sinon l'unité du catalogue
    const id = ingredient.id;
    const dansRecette = this.ingredientsRecette().find((i) => i.ingredientId === id);
    this.quantiteIngredient.setValue(dansRecette?.quantite ?? null);
    this.uniteIngredient.setValue((dansRecette?.unite as Unite | null) ?? ingredient.unite);
  }

  ajouterIngredient(): void {
    const etape = this.etape();
    const ingredient = this.ingredientChoisi();
    if (!etape) {
      return;
    }
    if (!ingredient) {
      this.notification.avertissement(
        'Choisissez un ingrédient dans la liste, ou « Créer … » s’il n’existe pas encore.',
      );
      return;
    }
    if (this.quantiteIngredient.invalid || this.uniteIngredient.invalid) {
      this.quantiteIngredient.markAsTouched();
      this.uniteIngredient.markAsTouched();
      return;
    }
    const quantite = this.quantiteIngredient.value ?? 0;
    const unite = this.uniteIngredient.value ?? 'PIECE';
    const horsRecette = this.horsRecette();

    // Un ingrédient absent de la recette y est d'abord ajouté, avec la même quantité
    const ajoutRecette$: Observable<RecetteIngredientResponse | null> = horsRecette
      ? this.recetteService.ajouterIngredient({
          recetteId: this.donnees.recetteId,
          ingredientId: ingredient.id,
          quantite,
          unite,
        })
      : of(null);

    this.ajoutIngredient.set(true);
    ajoutRecette$
      .pipe(
        switchMap((ajoutRecette) => {
          if (ajoutRecette) {
            this.ingredientsRecette.update((liste) => [...liste, ajoutRecette]);
            this.ingredientsRecetteModifies = true;
          }
          return this.recetteService.ajouterIngredientEtape({
            etapeId: etape.id,
            ingredientId: ingredient.id,
            quantite,
            unite,
          });
        }),
      )
      .subscribe({
        next: (ajout) => {
          this.ingredientsEtape.update((liste) => [...liste, ajout]);
          this.modifie = true;
          this.champIngredient.setValue('');
          this.quantiteIngredient.reset();
          this.uniteIngredient.reset();
          this.ajoutIngredient.set(false);
          if (horsRecette) {
            this.notification.info(
              `${ingredient.nom} a aussi été ajouté aux ingrédients de la recette.`,
            );
          }
        },
        error: (erreur: unknown) => {
          this.ajoutIngredient.set(false);
          this.notification.erreur(messageErreur(erreur, "L'ingrédient n'a pas pu être ajouté."));
        },
      });
  }

  retirerIngredient(ingredient: EtapeIngredientResponse): void {
    this.recetteService.retirerIngredientEtape(ingredient.id).subscribe({
      next: () => {
        this.ingredientsEtape.update((liste) => liste.filter((i) => i.id !== ingredient.id));
        this.modifie = true;
      },
    });
  }

  // ===================== 3. Ustensiles =====================

  /** Nouvel ustensile en cours de création dans le panneau (nom saisi), ou null. */
  protected creationUstensile = signal<string | null>(null);

  /** « Créer … » dans la liste des ustensiles : la fiche s'ouvre dans le panneau, pré-remplie. */
  choisirUstensile(choix: Choix<UstensileResponse>): void {
    if ('creer' in choix) {
      this.creationUstensile.set(choix.creer);
    }
  }

  ustensileCree(cree: UstensileResponse): void {
    this.creationUstensile.set(null);
    this.catalogueUstensiles.update((liste) =>
      [...liste, cree].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
    );
    this.champUstensile.setValue(cree);
  }

  annulerCreationUstensile(dejaCree: UstensileResponse | null): void {
    if (dejaCree) {
      this.ustensileCree(dejaCree);
      return;
    }
    this.champUstensile.setValue(this.creationUstensile() ?? '');
    this.creationUstensile.set(null);
  }

  ajouterUstensile(): void {
    const etape = this.etape();
    const choix = this.champUstensile.value;
    if (!etape) {
      return;
    }
    if (typeof choix === 'string' || 'creer' in choix) {
      this.notification.avertissement(
        'Choisissez un ustensile dans la liste, ou « Créer … » s’il n’existe pas encore.',
      );
      return;
    }
    this.ajoutUstensile.set(true);
    this.recetteService
      .ajouterUstensileEtape({
        etapeId: etape.id,
        ustensileId: choix.id,
        quantite: this.quantiteUstensile.value,
      })
      .subscribe({
        next: (ajout) => {
          this.ustensilesEtape.update((liste) => [...liste, ajout]);
          this.modifie = true;
          this.champUstensile.setValue('');
          this.quantiteUstensile.reset();
          this.ajoutUstensile.set(false);
        },
        error: (erreur: unknown) => {
          this.ajoutUstensile.set(false);
          this.notification.erreur(messageErreur(erreur, "L'ustensile n'a pas pu être ajouté."));
        },
      });
  }

  retirerUstensile(ustensile: EtapeUstensileResponse): void {
    this.recetteService.retirerUstensileEtape(ustensile.id).subscribe({
      next: () => {
        this.ustensilesEtape.update((liste) => liste.filter((u) => u.id !== ustensile.id));
        this.modifie = true;
      },
    });
  }

  /** Les alternatives d'un ustensile ont changé : on garde la liste de l'étape à jour. */
  majAlternatives(ustensileId: string, alternatives: EtapeUstensileAlternativeResponse[]): void {
    this.ustensilesEtape.update((liste) =>
      liste.map((u) => (u.id === ustensileId ? { ...u, alternatives } : u)),
    );
    this.modifie = true;
  }

  // ===================== 4. Photo et vidéo =====================

  envoyerPhoto(): void {
    const etape = this.etape();
    const fichier = this.photo();
    if (!etape || !fichier) {
      return;
    }
    this.envoiPhoto.set(true);
    this.recetteService.envoyerPhotoEtape(etape.id, fichier).subscribe({
      next: () =>
        this.apresEnvoi(
          etape.id,
          'La photo de l’étape est enregistrée.',
          () => this.photo.set(null),
          this.envoiPhoto,
        ),
      error: (erreur: unknown) => {
        this.envoiPhoto.set(false);
        this.notification.erreur(messageErreur(erreur, "La photo n'a pas pu être envoyée."));
      },
    });
  }

  envoyerVideo(): void {
    const etape = this.etape();
    const fichier = this.video();
    if (!etape || !fichier) {
      return;
    }
    this.envoiVideo.set(true);
    this.recetteService.envoyerVideoEtape(etape.id, fichier).subscribe({
      next: () =>
        this.apresEnvoi(
          etape.id,
          'La vidéo de l’étape est enregistrée.',
          () => this.video.set(null),
          this.envoiVideo,
        ),
      error: (erreur: unknown) => {
        this.envoiVideo.set(false);
        this.notification.erreur(
          messageErreur(erreur, "La vidéo n'a pas pu être envoyée (200 Mo maximum)."),
        );
      },
    });
  }

  /** Après l'enregistrement ou le retrait d'un audio : on relit l'étape (adresse de l'audio). */
  relireEtape(): void {
    const etape = this.etape();
    if (!etape) {
      return;
    }
    this.modifie = true;
    this.recetteService.getEtapes(this.donnees.recetteId).subscribe((etapes) => {
      const miseAJour = etapes.find((e) => e.id === etape.id);
      if (miseAJour) {
        this.etape.set(miseAJour);
      }
    });
  }

  /** Après un envoi : on relit l'étape pour obtenir l'adresse du fichier enregistré. */
  private apresEnvoi(
    etapeId: string,
    message: string,
    viderChoix: () => void,
    enCours: { set(v: boolean): void },
  ): void {
    this.modifie = true;
    this.recetteService.getEtapes(this.donnees.recetteId).subscribe((etapes) => {
      const miseAJour = etapes.find((e) => e.id === etapeId);
      if (miseAJour) {
        this.etape.set(miseAJour);
      }
      viderChoix();
      enCours.set(false);
      this.notification.succes(message);
    });
  }

  // ===================== Fermeture =====================

  async fermer(): Promise<void> {
    const nonEnregistre = this.formulaire.dirty || !!this.photo() || !!this.video();
    if (nonEnregistre) {
      const abandonner = await this.confirmation.demander({
        titre: 'Fermer sans enregistrer ?',
        message: "Certaines modifications de cette étape n'ont pas été enregistrées.",
        texteConfirmer: 'Fermer sans enregistrer',
        texteAnnuler: "Continuer l'édition",
        danger: true,
      });
      if (!abandonner) {
        return;
      }
    }
    this.fenetre.close({
      etape: this.etape(),
      modifie: this.modifie,
      ingredientsRecetteModifies: this.ingredientsRecetteModifies,
    });
  }
}
