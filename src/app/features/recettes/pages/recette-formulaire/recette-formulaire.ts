import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  computed,
  effect,
  inject,
  input,
  OnInit,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatAutocomplete, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatOption } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { MatError, MatFormField, MatHint, MatLabel, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSelect } from '@angular/material/select';
import { MatTooltip } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { concat, firstValueFrom, forkJoin, last, startWith } from 'rxjs';
import { ConfirmationService } from '../../../../core/services/confirmation.service';
import { FilArianeService } from '../../../../core/services/fil-ariane.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { messageErreur } from '../../../../core/utils/erreurs';
import { EditeurRiche } from '../../../../shared/components/editeur-riche/editeur-riche';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { ImageUpload } from '../../../../shared/components/image-upload/image-upload';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { TexteRiche } from '../../../../shared/components/texte-riche/texte-riche';
import { FichierPipe } from '../../../../shared/pipes/fichier.pipe';
import { UnitePipe } from '../../../../shared/pipes/unite.pipe';
import { CategorieResponse } from '../../../categories/models/categorie.model';
import { CategorieService } from '../../../categories/services/categorie.service';
import {
  DonneesIngredientDialog,
  IngredientDialog,
} from '../../../ingredients/components/ingredient-dialog/ingredient-dialog';
import { IngredientResponse, Unite, UNITES } from '../../../ingredients/models/ingredient.model';
import { IngredientService } from '../../../ingredients/services/ingredient.service';
import {
  DonneesEtapeEditeur,
  EtapeEditeur,
  ResultatEtapeEditeur,
} from '../../components/etape-editeur/etape-editeur';
import {
  Difficulte,
  EtapeIngredientResponse,
  EtapeResponse,
  EtapeUstensileResponse,
  NomRecetteResponse,
  RecetteIngredientResponse,
  RecetteRequest,
  RecetteResponse,
  MAX_CATEGORIES_RECETTE,
} from '../../models/recette.model';
import { RecetteService } from '../../services/recette.service';

/**
 * Création et modification d'une recette par l'administrateur.
 *
 * Déroulé en deux temps (l'API a besoin de l'identifiant de la recette pour la photo,
 * les ingrédients et les étapes) :
 *   1. l'admin remplit les informations → la recette est créée en brouillon ;
 *   2. la photo, les ingrédients et les étapes se débloquent → il publie quand la liste de contrôle est complète.
 */
/** Les quatre parties du formulaire, dans l'ordre. */
type SectionRecette = 'infos' | 'photo' | 'ingredients' | 'etapes';
type EtatControle = 'fait' | 'en-cours' | 'a-faire';

@Component({
  imports: [
    ReactiveFormsModule,
    RouterLink,
    DecimalPipe,
    MatButton,
    MatIconButton,
    MatCheckbox,
    MatFormField,
    MatLabel,
    MatHint,
    MatError,
    MatSuffix,
    MatInput,
    MatSelect,
    MatOption,
    MatAutocomplete,
    MatAutocompleteTrigger,
    MatProgressSpinner,
    MatTooltip,
    NgIcon,
    PageHeader,
    EmptyState,
    StatusBadge,
    ImageUpload,
    UnitePipe,
    EditeurRiche,
    TexteRiche,
    FichierPipe,
  ],
  selector: 'app-recette-formulaire',
  styleUrl: './recette-formulaire.scss',
  templateUrl: './recette-formulaire.html',
})
export class RecetteFormulaire implements OnInit {
  private recetteService = inject(RecetteService);
  private categorieService = inject(CategorieService);
  private ingredientService = inject(IngredientService);
  private confirmation = inject(ConfirmationService);
  private notification = inject(NotificationService);
  private filAriane = inject(FilArianeService);
  private dialog = inject(MatDialog);
  private router = inject(Router);

  /** Identifiant de la recette à modifier (absent sur /recettes/nouvelle). */
  readonly id = input<string>();

  protected readonly unites = UNITES;
  protected readonly maxCategories = MAX_CATEGORIES_RECETTE;
  protected readonly difficultes: { valeur: Difficulte; libelle: string }[] = [
    { valeur: 'FACILE', libelle: 'Facile' },
    { valeur: 'MOYEN', libelle: 'Moyenne' },
    { valeur: 'DIFFICILE', libelle: 'Difficile' },
  ];

  // ----- Données -----
  protected recette = signal<RecetteResponse | null>(null);
  protected ingredients = signal<RecetteIngredientResponse[]>([]);
  protected etapes = signal<EtapeResponse[]>([]);
  protected categories = signal<CategorieResponse[]>([]);
  protected catalogueIngredients = signal<IngredientResponse[]>([]);

  protected chargement = signal(false);
  protected introuvable = signal(false);

  // ----- 1. Informations -----
  protected formulaire = inject(FormBuilder).group({
    nom: ['', [Validators.required, Validators.maxLength(120)]],
    sousTitre: ['', Validators.maxLength(150)],
    categorieIds: [
      [] as string[],
      [Validators.required, Validators.maxLength(MAX_CATEGORIES_RECETTE)],
    ],
    description: ['', Validators.maxLength(3000)],
    dureeMin: [
      null as number | null,
      [Validators.required, Validators.min(1), Validators.max(1440)],
    ],
    nbPersonnes: [4 as number | null, [Validators.min(1), Validators.max(100)]],
    difficulte: ['MOYEN' as Difficulte],
    estMalienne: [true],
    telechargeable: [true],
  });
  protected enregistrementInfos = signal(false);
  protected erreurInfos = signal('');

  // ----- Autres noms du plat (ex. Mafé = Tigadèguèna) -----
  protected noms = signal<NomRecetteResponse[]>([]);
  /** Noms saisis avant la création de la recette : enregistrés juste après. */
  protected nomsEnAttente = signal<string[]>([]);
  protected champNom = new FormControl('', { nonNullable: true });

  // ----- 2. Photo -----
  protected photo = signal<File | null>(null);
  protected envoiPhoto = signal(false);

  // ----- 3. Ingrédients -----
  protected champIngredient = new FormControl<string | IngredientResponse | { creer: string }>('', {
    nonNullable: true,
  });
  protected quantite = new FormControl<number | null>(null, [
    Validators.required,
    Validators.min(0.01),
  ]);
  protected unite = new FormControl<Unite | null>(null, Validators.required);
  protected ajoutIngredient = signal(false);
  protected erreurIngredient = signal('');
  private saisieIngredient = toSignal(this.champIngredient.valueChanges.pipe(startWith('')), {
    initialValue: '' as string | IngredientResponse | { creer: string },
  });
  /** Texte tapé (vide si un ingrédient de la liste est sélectionné). */
  protected texteIngredient = computed(() => {
    const saisie = this.saisieIngredient();
    return typeof saisie === 'string' ? saisie.trim() : '';
  });

  /** Suggestions : ingrédients du catalogue pas encore dans la recette, filtrés par la saisie. */
  protected suggestions = computed(() => {
    const terme = this.texteIngredient().toLowerCase();
    const dejaPresents = new Set(this.ingredients().map((i) => i.ingredientId));
    return this.catalogueIngredients()
      .filter((i) => !dejaPresents.has(i.id) && (!terme || i.nom.toLowerCase().includes(terme)))
      .slice(0, 12);
  });

  /** « Créer … » s'affiche si aucun ingrédient du catalogue ne porte exactement ce nom. */
  protected peutCreerIngredient = computed(() => {
    const terme = this.texteIngredient().toLowerCase();
    return !!terme && !this.catalogueIngredients().some((i) => i.nom.toLowerCase() === terme);
  });

  // ----- 4. Étapes -----
  /** Ingrédients et ustensiles de chaque étape (clé : identifiant de l'étape), pour les résumés. */
  protected contenuEtapes = signal<
    Record<string, { ingredients: EtapeIngredientResponse[]; ustensiles: EtapeUstensileResponse[] }>
  >({});
  protected etapeEnCours = signal<string | null>(null);

  // ----- Publication -----
  protected publication = signal(false);

  protected estNouvelle = computed(() => !this.recette());
  protected verrouille = computed(() => !this.recette());
  protected dureeEtapes = computed(() =>
    this.etapes().reduce((t, e) => t + (e.dureeMinutes ?? 0), 0),
  );

  /** Partie du formulaire que l'utilisateur est en train de remplir (elle a le focus). */
  protected sectionActive = signal<SectionRecette | null>(null);

  /**
   * Avancement, dans l'ordre du formulaire : informations, photo, ingrédients, étapes.
   * Une étape est obligatoire pour publier (un brouillon peut s'en passer).
   */
  protected controles = computed(() => [
    {
      section: 'infos' as const,
      libelle: 'Informations générales',
      fait: !!this.recette(),
      obligatoire: true,
    },
    {
      section: 'photo' as const,
      libelle: 'Photo du plat',
      fait: !!this.recette()?.photoUrl,
      obligatoire: false,
    },
    {
      section: 'ingredients' as const,
      libelle: 'Au moins un ingrédient',
      fait: this.ingredients().length > 0,
      obligatoire: true,
    },
    {
      section: 'etapes' as const,
      libelle: 'Au moins une étape',
      fait: this.etapes().length > 0,
      obligatoire: true,
    },
  ]);

  /**
   * État affiché de chaque point : une partie complète est « faite » (vert), même si elle a le focus ;
   * la partie en cours de saisie et pas encore complète est « en cours » (orange).
   */
  protected avancement = computed(() =>
    this.controles().map((c) => {
      const etat: EtatControle = c.fait
        ? 'fait'
        : this.sectionActive() === c.section
          ? 'en-cours'
          : 'a-faire';
      const detail =
        etat === 'fait'
          ? 'Fait'
          : etat === 'en-cours'
            ? 'En cours de saisie'
            : c.obligatoire
              ? 'À faire · obligatoire'
              : 'À faire · recommandé';
      return { ...c, etat, detail };
    }),
  );

  /** Ce qui manque encore pour publier (affiché sous le bouton). */
  protected manquants = computed(() =>
    this.controles()
      .filter((c) => c.obligatoire && !c.fait)
      .map((c) => c.libelle.toLowerCase()),
  );

  /** Amène la partie à l'écran (clic dans la carte d'avancement). */
  allerA(section: SectionRecette): void {
    const cible = document.getElementById(`section-${section}`);
    if (!cible) {
      return;
    }
    const doux = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    cible.scrollIntoView({ behavior: doux ? 'smooth' : 'auto', block: 'start' });
    cible.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
    this.sectionActive.set(section);
  }

  protected peutPublier = computed(() => {
    const statut = this.recette()?.statut;
    return (
      (statut === 'BROUILLON' || statut === 'REJETEE' || statut === 'ARCHIVEE') &&
      this.controles().every((c) => c.fait || !c.obligatoire)
    );
  });

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => (id ? this.chargerRecette(id) : this.reinitialiser()));
    });
  }

  ngOnInit(): void {
    this.categorieService.getAll().subscribe({
      next: (categories) =>
        this.categories.set([...categories].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))),
    });
    this.ingredientService.getAll().subscribe({
      next: (ingredients) =>
        this.catalogueIngredients.set(
          [...ingredients].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
        ),
    });
  }

  // ===================== Chargement =====================

  private chargerRecette(id: string): void {
    this.chargement.set(true);
    this.introuvable.set(false);
    forkJoin({
      recette: this.recetteService.getById(id),
      ingredients: this.recetteService.getIngredients(id),
      etapes: this.recetteService.getEtapes(id),
      noms: this.recetteService.getNoms(id),
    }).subscribe({
      next: ({ recette, ingredients, etapes, noms }) => {
        this.recette.set(recette);
        this.noms.set(noms);
        this.ingredients.set(ingredients);
        this.etapes.set(this.trierEtapes(etapes));
        this.chargerContenuEtapes(etapes);
        this.remplirFormulaire(recette);
        this.filAriane.definirPageCourante(`Modifier « ${recette.nom} »`);
        this.chargement.set(false);
      },
      error: (erreur: HttpErrorResponse) => {
        this.introuvable.set(erreur.status === 404);
        this.chargement.set(false);
      },
    });
  }

  private reinitialiser(): void {
    this.recette.set(null);
    this.noms.set([]);
    this.nomsEnAttente.set([]);
    this.ingredients.set([]);
    this.etapes.set([]);
    this.formulaire.reset({
      difficulte: 'MOYEN',
      nbPersonnes: 4,
      estMalienne: true,
      telechargeable: true,
    });
  }

  private remplirFormulaire(recette: RecetteResponse): void {
    this.formulaire.reset({
      nom: recette.nom,
      sousTitre: recette.sousTitre ?? '',
      categorieIds: recette.categories?.length
        ? recette.categories.map((c) => c.id)
        : recette.categorieId
          ? [recette.categorieId]
          : [],
      description: recette.description ?? '',
      dureeMin: recette.dureeMin,
      nbPersonnes: recette.nbPersonnes,
      difficulte: recette.difficulte,
      estMalienne: recette.estMalienne,
      telechargeable: recette.telechargeable,
    });
  }

  // ===================== 1. Informations =====================

  /** Le maximum est atteint : les catégories non choisies ne sont plus proposées. */
  protected categorieBloquee(id: string): boolean {
    const choisies = this.formulaire.controls.categorieIds.value ?? [];
    return choisies.length >= MAX_CATEGORIES_RECETTE && !choisies.includes(id);
  }

  /** La catégorie principale actuelle reste en tête si elle est toujours choisie (l'application mobile l'affiche). */
  private ordonnerCategories(ids: string[]): string[] {
    const principale = this.recette()?.categorieId;
    return principale && ids.includes(principale)
      ? [principale, ...ids.filter((id) => id !== principale)]
      : ids;
  }

  enregistrerInfos(): void {
    if (this.formulaire.invalid) {
      this.formulaire.markAllAsTouched();
      this.erreurInfos.set('Certains champs sont à compléter. Ils sont signalés en rouge.');
      return;
    }
    this.enregistrementInfos.set(true);
    this.erreurInfos.set('');

    const v = this.formulaire.getRawValue();
    // Un nom tapé mais pas encore validé (Entrée) compte aussi
    const nomTape = this.champNom.value.trim().replace(/,$/, '').trim();
    const requete: RecetteRequest = {
      nom: (v.nom ?? '').trim(),
      // Chaîne vide pour effacer : un null est ignoré en modification
      sousTitre: (v.sousTitre ?? '').trim(),
      categorieIds: this.ordonnerCategories(v.categorieIds ?? []),
      description: (v.description ?? '').trim() || null,
      dureeMin: v.dureeMin ?? 0,
      nbPersonnes: v.nbPersonnes,
      difficulte: v.difficulte ?? 'MOYEN',
      estMalienne: v.estMalienne ?? true,
      telechargeable: v.telechargeable ?? true,
    };
    const existante = this.recette();
    if (!existante) {
      requete.autresNoms = [...this.nomsEnAttente(), ...(nomTape ? [nomTape] : [])];
    }
    const appel = existante
      ? this.recetteService.modifier(existante.id, requete)
      : this.recetteService.creer(requete);

    appel.subscribe({
      next: (recette) => {
        this.enregistrementInfos.set(false);
        this.recette.set(recette);
        this.formulaire.markAsPristine();
        if (existante) {
          this.notification.succes('Les informations sont enregistrées.');
          if (nomTape) {
            this.ajouterNom();
          }
        } else {
          // Les autres noms sont enregistrés par l'API avec la recette
          this.nomsEnAttente.set([]);
          this.champNom.setValue('');
          this.notification.succes(
            'Recette créée en brouillon. Ajoutez maintenant la photo, les ingrédients et les étapes.',
          );
          // L'adresse devient celle de la modification : un rafraîchissement ne perd rien
          this.router.navigate(['/recettes', recette.id, 'modifier'], { replaceUrl: true });
        }
      },
      error: (erreur: unknown) => {
        this.enregistrementInfos.set(false);
        this.erreurInfos.set(messageErreur(erreur, "Impossible d'enregistrer la recette."));
      },
    });
  }

  // ===================== Autres noms =====================

  /** Ajoute le nom tapé (Entrée ou virgule). Avant la création, il est gardé en attente. */
  ajouterNom(): void {
    const nom = this.champNom.value.trim().replace(/,$/, '').trim();
    if (!nom) {
      return;
    }
    const existe = [
      this.formulaire.controls.nom.value ?? '',
      ...this.noms().map((n) => n.nom),
      ...this.nomsEnAttente(),
    ].some((n) => n.trim().toLowerCase() === nom.toLowerCase());
    if (existe) {
      this.notification.avertissement(`« ${nom} » est déjà un nom de cette recette.`);
      return;
    }
    const recette = this.recette();
    if (!recette) {
      this.nomsEnAttente.update((liste) => [...liste, nom]);
      this.champNom.setValue('');
      return;
    }
    this.recetteService.ajouterNom(recette.id, nom).subscribe({
      next: (ajoute) => {
        this.noms.update((liste) => [...liste, ajoute]);
        this.champNom.setValue('');
      },
      error: (erreur: unknown) =>
        this.notification.erreur(messageErreur(erreur, "Ce nom n'a pas pu être ajouté.")),
    });
  }

  retirerNom(nom: NomRecetteResponse): void {
    this.recetteService.retirerNom(nom.id).subscribe({
      next: () => this.noms.update((liste) => liste.filter((n) => n.id !== nom.id)),
      error: (erreur: unknown) =>
        this.notification.erreur(messageErreur(erreur, "Ce nom n'a pas pu être retiré.")),
    });
  }

  retirerNomEnAttente(nom: string): void {
    this.nomsEnAttente.update((liste) => liste.filter((n) => n !== nom));
  }

  // ===================== 2. Photo =====================

  envoyerPhoto(): void {
    const recette = this.recette();
    const fichier = this.photo();
    if (!recette || !fichier) {
      return;
    }
    this.envoiPhoto.set(true);
    this.recetteService.envoyerPhoto(recette.id, fichier).subscribe({
      next: () => {
        this.recetteService
          .getById(recette.id)
          .subscribe((miseAJour) => this.recette.set(miseAJour));
        this.photo.set(null);
        this.envoiPhoto.set(false);
        this.notification.succes('La photo est enregistrée.');
      },
      error: (erreur: unknown) => {
        this.envoiPhoto.set(false);
        this.notification.erreur(messageErreur(erreur, "La photo n'a pas pu être envoyée."));
      },
    });
  }

  // ===================== 3. Ingrédients =====================

  protected nomIngredient = (
    valeur: string | IngredientResponse | { creer: string } | null,
  ): string =>
    !valeur
      ? ''
      : typeof valeur === 'string'
        ? valeur
        : 'creer' in valeur
          ? valeur.creer
          : valeur.nom;

  /**
   * Quand l'admin choisit un ingrédient, on propose son unité habituelle.
   * « Créer … » ouvre la fiche ingrédient pré-remplie : l'ingrédient créé est ensuite sélectionné.
   */
  async choisirIngredient(choix: IngredientResponse | { creer: string }): Promise<void> {
    let ingredient: IngredientResponse;
    if ('creer' in choix) {
      const cree = await firstValueFrom(
        this.dialog
          .open<IngredientDialog, DonneesIngredientDialog, IngredientResponse>(IngredientDialog, {
            data: { nomInitial: choix.creer },
            width: 'min(560px, 96vw)',
          })
          .afterClosed(),
      );
      if (!cree) {
        this.champIngredient.setValue(choix.creer);
        return;
      }
      this.catalogueIngredients.update((liste) =>
        [...liste, cree].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
      );
      this.champIngredient.setValue(cree);
      this.notification.succes(`« ${cree.nom} » est ajouté au catalogue des ingrédients.`);
      ingredient = cree;
    } else {
      ingredient = choix;
    }
    if (ingredient.unite) {
      this.unite.setValue(ingredient.unite);
    }
  }

  ajouterIngredient(): void {
    const recette = this.recette();
    const choix = this.champIngredient.value;
    if (!recette) {
      return;
    }
    if (typeof choix === 'string' || 'creer' in choix) {
      this.erreurIngredient.set(
        'Choisissez un ingrédient dans la liste, ou « Créer … » s’il n’existe pas encore.',
      );
      return;
    }
    if (this.quantite.invalid || this.unite.invalid) {
      this.quantite.markAsTouched();
      this.unite.markAsTouched();
      return;
    }
    this.ajoutIngredient.set(true);
    this.erreurIngredient.set('');
    this.recetteService
      .ajouterIngredient({
        recetteId: recette.id,
        ingredientId: choix.id,
        quantite: this.quantite.value ?? 0,
        unite: this.unite.value ?? 'PIECE',
      })
      .subscribe({
        next: (ajout) => {
          this.ingredients.update((liste) => [...liste, ajout]);
          this.rafraichirBudget();
          this.champIngredient.setValue('');
          this.quantite.reset();
          this.unite.reset();
          this.ajoutIngredient.set(false);
        },
        error: (erreur: unknown) => {
          this.ajoutIngredient.set(false);
          this.erreurIngredient.set(messageErreur(erreur, "Impossible d'ajouter l'ingrédient."));
        },
      });
  }

  retirerIngredient(ingredient: RecetteIngredientResponse): void {
    // Action facilement réversible (on peut le rajouter) : pas de confirmation, mais un message
    this.recetteService.retirerIngredient(ingredient.id).subscribe({
      next: () => {
        this.ingredients.update((liste) => liste.filter((i) => i.id !== ingredient.id));
        this.rafraichirBudget();
        this.notification.info(`${ingredient.ingredientNom} est retiré de la recette.`);
      },
    });
  }

  // ===================== 4. Étapes =====================

  async ajouterEtape(): Promise<void> {
    const recette = this.recette();
    if (!recette) {
      return;
    }
    const ordreMax = this.etapes().reduce((max, e) => Math.max(max, e.ordre), 0);
    const resultat = await this.ouvrirEtape({
      recetteId: recette.id,
      numero: this.etapes().length + 1,
      ordre: ordreMax + 1,
      ingredientsRecette: this.ingredients(),
    });
    this.apresEditeurEtape(resultat);
  }

  async modifierEtape(etape: EtapeResponse, index: number): Promise<void> {
    const recette = this.recette();
    if (!recette) {
      return;
    }
    const resultat = await this.ouvrirEtape({
      recetteId: recette.id,
      numero: index + 1,
      ordre: etape.ordre,
      etape,
      ingredientsRecette: this.ingredients(),
    });
    this.apresEditeurEtape(resultat);
  }

  /** Au retour de l'éditeur d'étape : on relit ce qui a pu changer. */
  private apresEditeurEtape(resultat: ResultatEtapeEditeur | undefined): void {
    const recette = this.recette();
    if (resultat?.ingredientsRecetteModifies && recette) {
      this.recetteService.getIngredients(recette.id).subscribe((ingredients) => {
        this.ingredients.set(ingredients);
        this.rafraichirBudget();
      });
    }
    if (resultat?.modifie) {
      this.rechargerEtapes();
    }
  }

  /** Relit les étapes et leur contenu (après l'éditeur d'étape ou un déplacement). */
  private rechargerEtapes(): void {
    const recette = this.recette();
    if (!recette) {
      return;
    }
    this.recetteService.getEtapes(recette.id).subscribe((etapes) => {
      this.etapes.set(this.trierEtapes(etapes));
      this.chargerContenuEtapes(etapes);
    });
  }

  /** Charge les ingrédients et ustensiles de chaque étape (affichés en résumé sur les cartes). */
  private chargerContenuEtapes(etapes: EtapeResponse[]): void {
    if (etapes.length === 0) {
      this.contenuEtapes.set({});
      return;
    }
    const requetes = Object.fromEntries(
      etapes.map((etape) => [
        etape.id,
        forkJoin({
          ingredients: this.recetteService.getIngredientsEtape(etape.id),
          ustensiles: this.recetteService.getUstensilesEtape(etape.id),
        }),
      ]),
    );
    forkJoin(requetes).subscribe({ next: (contenu) => this.contenuEtapes.set(contenu) });
  }

  async supprimerEtape(etape: EtapeResponse, index: number): Promise<void> {
    const confirme = await this.confirmation.demander({
      titre: `Supprimer l'étape ${index + 1} ?`,
      message: `« ${etape.titre ?? 'Sans titre'} » sera retirée de la recette.`,
      texteConfirmer: "Supprimer l'étape",
      danger: true,
    });
    if (!confirme) {
      return;
    }
    this.etapeEnCours.set(etape.id);
    this.recetteService.supprimerEtape(etape.id).subscribe({
      next: () => {
        this.etapes.update((liste) => liste.filter((e) => e.id !== etape.id));
        this.etapeEnCours.set(null);
      },
      error: () => this.etapeEnCours.set(null),
    });
  }

  /**
   * Échange la place de deux étapes. L'ordre doit rester unique dans la recette :
   * on passe par un numéro temporaire (A → temporaire, B → ancien A, A → ancien B).
   */
  deplacerEtape(index: number, direction: -1 | 1): void {
    const liste = this.etapes();
    const a = liste[index];
    const b = liste[index + direction];
    const recette = this.recette();
    if (!a || !b || !recette) {
      return;
    }
    // L'API refuse d'enregistrer une étape sans titre ni instructions (anciennes données incomplètes)
    const incomplete = [a, b].find((e) => !e.titre?.trim() || !e.instructions?.trim());
    if (incomplete) {
      const numero = liste.indexOf(incomplete) + 1;
      this.notification.avertissement(
        `Complétez d'abord le titre et les instructions de l'étape ${numero} pour pouvoir la déplacer.`,
      );
      return;
    }
    const temporaire = liste.reduce((max, e) => Math.max(max, e.ordre), 0) + 1;
    const requete = (etape: EtapeResponse, ordre: number) => ({
      recetteId: recette.id,
      ordre,
      titre: etape.titre ?? '',
      instructions: etape.instructions ?? '',
      dureeMinutes: etape.dureeMinutes,
    });

    this.etapeEnCours.set(a.id);
    concat(
      this.recetteService.modifierEtape(a.id, requete(a, temporaire)),
      this.recetteService.modifierEtape(b.id, requete(b, a.ordre)),
      this.recetteService.modifierEtape(a.id, requete(a, b.ordre)),
    )
      .pipe(last())
      .subscribe({
        next: () => {
          this.etapeEnCours.set(null);
          this.rechargerEtapes();
        },
        error: (erreur: unknown) => {
          this.etapeEnCours.set(null);
          this.rechargerEtapes();
          this.notification.erreur(messageErreur(erreur, "L'étape n'a pas pu être déplacée."));
        },
      });
  }

  // ===================== Publication =====================

  async publier(): Promise<void> {
    const recette = this.recette();
    if (!recette || !this.peutPublier()) {
      return;
    }
    const confirme = await this.confirmation.demander({
      titre: `Publier « ${recette.nom} » ?`,
      message:
        'La recette sera visible par tous les utilisateurs de Gwaso, sur l’application et le site.',
      texteConfirmer: 'Publier la recette',
    });
    if (!confirme) {
      return;
    }
    this.publication.set(true);
    this.recetteService.soumettre(recette.id).subscribe({
      next: (publiee) => {
        this.recette.set(publiee);
        this.publication.set(false);
        this.notification.succes(`« ${publiee.nom} » est publiée.`);
        this.router.navigate(['/recettes', publiee.id]);
      },
      error: (erreur: unknown) => {
        this.publication.set(false);
        this.notification.erreur(messageErreur(erreur, 'La recette n’a pas pu être publiée.'));
      },
    });
  }

  /** Ouvre l'éditeur d'étape en panneau sur le côté droit de l'écran. */
  private ouvrirEtape(donnees: DonneesEtapeEditeur): Promise<ResultatEtapeEditeur | undefined> {
    const fenetre = this.dialog.open<EtapeEditeur, DonneesEtapeEditeur, ResultatEtapeEditeur>(
      EtapeEditeur,
      {
        data: donnees,
        width: 'min(760px, 100vw)',
        maxWidth: '100vw',
        height: '100dvh',
        position: { right: '0', top: '0' },
        panelClass: 'gw-panneau-lateral',
        autoFocus: 'first-tabbable',
      },
    );
    return firstValueFrom(fenetre.afterClosed());
  }

  /** Le budget est calculé par l'API à partir des ingrédients : on relit la recette. */
  private rafraichirBudget(): void {
    const recette = this.recette();
    if (recette) {
      this.recetteService.getById(recette.id).subscribe((miseAJour) => this.recette.set(miseAJour));
    }
  }

  private trierEtapes(etapes: EtapeResponse[]): EtapeResponse[] {
    return [...etapes].sort((a, b) => a.ordre - b.ordre);
  }
}
