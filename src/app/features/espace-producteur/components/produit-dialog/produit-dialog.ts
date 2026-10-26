import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatAutocomplete, MatAutocompleteSelectedEvent, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { MatButton, MatIconButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatError, MatFormField, MatHint, MatLabel, MatPrefix, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { NgIcon } from '@ng-icons/core';
import { startWith } from 'rxjs';
import { NotificationService } from '../../../../core/services/notification.service';
import { messageErreur } from '../../../../core/utils/erreurs';
import { ImageUpload } from '../../../../shared/components/image-upload/image-upload';
import { FichierPipe } from '../../../../shared/pipes/fichier.pipe';
import { UnitePipe } from '../../../../shared/pipes/unite.pipe';
import { CategorieIngredientResponse } from '../../../ingredients/models/categorie-ingredient.model';
import { CategorieIngredientService } from '../../../ingredients/services/categorie-ingredient.service';
import { IngredientResponse, Unite, UNITES } from '../../../ingredients/models/ingredient.model';
import { IngredientService } from '../../../ingredients/services/ingredient.service';
import { ProduitProducteurRequest, ProduitProducteurResponse } from '../../models/produit.model';
import { ProduitProducteurService } from '../../services/produit-producteur.service';

export interface DonneesProduitDialog {
  /** Produit à modifier ; absent pour une mise en vente (création). */
  produit?: ProduitProducteurResponse;
  /** Ingrédients déjà chargés, sinon ils sont récupérés via l'API. */
  ingredients?: IngredientResponse[];
}

/**
 * Dialogue d'ajout ou de modification d'un produit commercialisé par le producteur.
 * Conforme aux standards ergonomiques et au design system des formulaires d'administration GWASO.
 */
@Component({
  imports: [
    ReactiveFormsModule,
    DecimalPipe,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatButton,
    MatIconButton,
    MatFormField,
    MatLabel,
    MatInput,
    MatHint,
    MatError,
    MatSuffix,
    MatSelect,
    MatOption,
    MatAutocomplete,
    MatAutocompleteTrigger,
    MatProgressSpinner,
    NgIcon,
    ImageUpload,
    FichierPipe,
    UnitePipe,
  ],
  providers: [CategorieIngredientService],
  selector: 'app-produit-dialog',
  styleUrl: './produit-dialog.scss',
  templateUrl: './produit-dialog.html',
})
export class ProduitDialog implements OnInit {
  private produitService = inject(ProduitProducteurService);
  private ingredientService = inject(IngredientService);
  private categorieIngredientService = inject(CategorieIngredientService);
  private notification = inject(NotificationService);
  private fenetre = inject(MatDialogRef<ProduitDialog, ProduitProducteurResponse>);
  protected donnees = inject<DonneesProduitDialog>(MAT_DIALOG_DATA);

  protected readonly unites = UNITES;

  protected tousLesIngredients = signal<IngredientResponse[]>(this.donnees.ingredients ?? []);
  protected categoriesApi = signal<CategorieIngredientResponse[]>([]);
  protected categorieFiltre = signal<string | null>(null);
  protected chargementIngredients = signal(false);
  protected enCours = signal(false);
  protected erreur = signal('');
  protected photo: File | null = null;

  /** Recherche autocomplétée de rayon / catégorie */
  protected champRechercheCategorie = new FormControl<{ id: string; nom: string } | string | null>('');
  protected texteRechercheCategorie = signal('');

  protected champRechercheCategorieNouveau = new FormControl<{ id: string; nom: string } | string | null>('');
  protected texteRechercheCatNouveau = signal('');

  /** Mode proposition d'un nouvel ingrédient inexistant au catalogue */
  protected modeNouvelIngredient = signal(false);
  protected nomNouveau = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(80)],
  });
  protected categorieIdNouveau = new FormControl<string | null>(null);
  protected uniteNouveau = new FormControl<Unite>('KG', {
    nonNullable: true,
    validators: [Validators.required],
  });

  protected champRecherche = new FormControl<IngredientResponse | string | null>(
    this.donnees.produit ? this.donnees.produit.ingredientNom : '',
  );

  /** Ingrédient sélectionné (initialisé immédiatement avec les données d'édition si modification) */
  protected ingredientSelectionne = signal<IngredientResponse | null>(
    this.donnees.produit
      ? {
          id: this.donnees.produit.ingredientId,
          nom: this.donnees.produit.ingredientNom,
          photoUrl: this.donnees.produit.ingredientPhotoUrl ?? null,
          unite: this.donnees.produit.unite,
          prixMin: null,
          prixMax: null,
          categorieId: this.donnees.produit.categorieId ?? null,
          categorieNom: this.donnees.produit.categorieNom ?? null,
        }
      : null,
  );

  /** Plafond maximal autorisé pour le prix indicatif (basé sur le catalogue de référence) */
  protected prixPlafond = computed<number | null>(() => {
    const ing = this.ingredientSelectionne();
    if (!ing) {
      return null;
    }
    if (ing.prixMax !== null && ing.prixMax !== undefined) {
      return ing.prixMax;
    }
    if (ing.prixMin !== null && ing.prixMin !== undefined) {
      return ing.prixMin;
    }
    return null;
  });

  /** Indique si l'ingrédient possède déjà une photo officielle de référence dans le catalogue */
  protected aPhotoCatalogue = computed(() => !!this.ingredientSelectionne()?.photoUrl);

  protected formulaire = inject(FormBuilder).group({
    ingredientId: [
      this.donnees.produit?.ingredientId ?? '',
      [Validators.required],
    ],
    prixIndicatif: [
      this.donnees.produit?.prixIndicatif ?? null,
      [Validators.required, Validators.min(1)],
    ],
    quantite: [
      this.donnees.produit?.quantite ?? 1,
      [Validators.required, Validators.min(0.01)],
    ],
    unite: [
      this.donnees.produit?.unite ?? ('KG' as Unite),
      [Validators.required],
    ],
    imageUrl: [this.donnees.produit?.imageUrl ?? ''],
  });

  /** Catégories uniques combinées (depuis les ingrédients réels + l'API des catégories) */
  protected categories = computed(() => {
    const ings = this.tousLesIngredients();
    const map = new Map<string, { id: string; nom: string; compte: number }>();

    // Extraction depuis les ingrédients chargés
    for (const ing of ings) {
      if (ing.categorieId || ing.categorieNom) {
        const id = ing.categorieId || ing.categorieNom!;
        const nom = ing.categorieNom || 'Autres denrées';
        const existant = map.get(id);
        if (existant) {
          existant.compte++;
        } else {
          map.set(id, { id, nom, compte: 1 });
        }
      }
    }

    // Fusion avec les catégories retournées par l'API
    for (const cat of this.categoriesApi()) {
      if (!map.has(cat.id)) {
        const compte = ings.filter((i) => i.categorieId === cat.id).length;
        map.set(cat.id, { id: cat.id, nom: cat.nom, compte });
      }
    }

    return Array.from(map.values()).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  });

  protected totalIngredients = computed(() => this.tousLesIngredients().length);

  /** Catégories filtrées dans la recherche principale */
  protected categoriesFiltrees = computed(() => {
    const terme = this.texteRechercheCategorie().trim().toLowerCase();
    const cats = this.categories();
    if (!terme) {
      return cats;
    }
    return cats.filter((c) => c.nom.toLowerCase().includes(terme));
  });

  /** Catégories suggérées dans le formulaire de proposition d'ingrédient */
  protected categoriesNouveauFiltrees = computed(() => {
    const terme = this.texteRechercheCatNouveau().trim().toLowerCase();
    const cats = this.categories();
    if (!terme) {
      return cats;
    }
    return cats.filter((c) => c.nom.toLowerCase().includes(terme));
  });

  afficherNomCategorie = (cat: { id: string; nom: string } | string | null): string => {
    if (!cat) {
      return '';
    }
    return typeof cat === 'string' ? cat : cat.nom;
  };

  /** Ingrédients filtrés selon le rayon et le texte recherché */
  protected texteRecherche = signal('');
  protected ingredientsFiltres = computed(() => {
    const terme = this.texteRecherche().trim().toLowerCase();
    const catId = this.categorieFiltre();
    let liste = this.tousLesIngredients();

    if (catId) {
      liste = liste.filter(
        (ing) => ing.categorieId === catId || ing.categorieNom === catId,
      );
    }

    if (terme) {
      liste = liste.filter((ing) => ing.nom.toLowerCase().includes(terme));
    }

    return liste.slice(0, 50);
  });

  /** Ingrédients trouvés dans d'autres rayons si un filtre est actif */
  protected ingredientsDansAutresRayons = computed(() => {
    const terme = this.texteRecherche().trim().toLowerCase();
    const catId = this.categorieFiltre();
    if (!terme || !catId) {
      return [];
    }
    return this.tousLesIngredients().filter(
      (ing) => (ing.categorieId !== catId && ing.categorieNom !== catId) && ing.nom.toLowerCase().includes(terme),
    );
  });

  /** Premier ingrédient correspondant exactement ou partiellement dans un autre rayon */
  protected premierDansAutreRayon = computed(() => {
    const autres = this.ingredientsDansAutresRayons();
    if (autres.length === 0) return null;
    const terme = this.texteRecherche().trim().toLowerCase();
    const exact = autres.find((i) => i.nom.toLowerCase() === terme);
    return exact ?? autres[0];
  });

  /** Indique si le terme saisi ne correspond à aucun ingrédient existant dans tout le catalogue */
  protected aucunIngredientTrouve = computed(() => {
    const terme = this.texteRecherche().trim().toLowerCase();
    if (!terme || terme.length < 2) {
      return false;
    }
    return !this.tousLesIngredients().some(
      (i) => i.nom.toLowerCase() === terme || i.nom.toLowerCase().startsWith(terme),
    );
  });

  afficherNomIngredient = (ingredient: IngredientResponse | string | null): string => {
    if (!ingredient) {
      return '';
    }
    return typeof ingredient === 'string' ? ingredient : ingredient.nom;
  };

  /** Nom de la catégorie pour un ingrédient donné */
  categorieNomDe(ing: IngredientResponse): string | null {
    if (ing.categorieNom) {
      return ing.categorieNom;
    }
    if (ing.categorieId) {
      const cat = this.categoriesApi().find((c) => c.id === ing.categorieId);
      if (cat) {
        return cat.nom;
      }
    }
    return null;
  }

  ngOnInit(): void {
    this.champRecherche.valueChanges
      .pipe(startWith(this.champRecherche.value ?? ''))
      .subscribe((val) => {
        const texte = typeof val === 'string' ? val : (val?.nom ?? '');
        this.texteRecherche.set(texte);

        // Synchronisation de l'ID si le texte saisi correspond exactement à un ingrédient
        const ingActuel = this.ingredientSelectionne();
        if (ingActuel && ingActuel.nom !== texte && !this.modeNouvelIngredient()) {
          const match = this.tousLesIngredients().find(
            (i) => i.nom.toLowerCase() === texte.trim().toLowerCase(),
          );
          if (match) {
            this.formulaire.controls.ingredientId.setValue(match.id);
            this.ingredientSelectionne.set(match);
            this.mettreAJourValidateursPrix(this.prixPlafond());
          } else if (!this.donnees.produit) {
            this.formulaire.controls.ingredientId.setValue('');
            this.ingredientSelectionne.set(null);
            this.mettreAJourValidateursPrix(null);
          }
        }
      });

    this.champRechercheCategorie.valueChanges
      .pipe(startWith(this.champRechercheCategorie.value))
      .subscribe((val) => {
        let texte = '';
        if (typeof val === 'string') {
          texte = val;
        } else if (val && typeof val === 'object' && 'nom' in val) {
          texte = val.nom;
        }
        this.texteRechercheCategorie.set(texte);
        if (!texte) {
          this.categorieFiltre.set(null);
        } else {
          const match = this.categories().find((c) => c.nom.toLowerCase() === texte.trim().toLowerCase());
          if (match) {
            this.categorieFiltre.set(match.id);
          }
        }
      });

    this.champRechercheCategorieNouveau.valueChanges
      .pipe(startWith(this.champRechercheCategorieNouveau.value))
      .subscribe((val) => {
        let texte = '';
        if (typeof val === 'string') {
          texte = val;
        } else if (val && typeof val === 'object' && 'nom' in val) {
          texte = val.nom;
        }
        this.texteRechercheCatNouveau.set(texte);
        const match = this.categories().find((c) => c.nom.toLowerCase() === texte.trim().toLowerCase());
        this.categorieIdNouveau.setValue(match ? match.id : null);
      });

    this.chargerCategories();

    if (this.tousLesIngredients().length === 0) {
      this.chargerIngredients();
    } else {
      this.enrichirIngredientSelectionne(this.tousLesIngredients());
    }

    this.mettreAJourValidateursPrix(this.prixPlafond());
  }

  private chargerCategories(): void {
    this.categorieIngredientService.getAll().subscribe({
      next: (cats) => {
        this.categoriesApi.set(cats);
        if (this.tousLesIngredients().length > 0) {
          this.enrichirIngredientSelectionne(this.tousLesIngredients());
        }
      },
      error: () => this.categoriesApi.set([]),
    });
  }

  filtrerCategorie(catId: string | null): void {
    this.categorieFiltre.set(this.categorieFiltre() === catId ? null : catId);
    if (!catId) {
      this.champRechercheCategorie.setValue('', { emitEvent: false });
    } else {
      const cat = this.categories().find((c) => c.id === catId);
      if (cat) {
        this.champRechercheCategorie.setValue(cat.nom, { emitEvent: false });
      }
    }
  }

  choisirCategorieFiltre(evenement: MatAutocompleteSelectedEvent): void {
    const cat = evenement.option.value as { id: string; nom: string } | null;
    if (!cat) {
      this.categorieFiltre.set(null);
      this.champRechercheCategorie.setValue('', { emitEvent: false });
    } else {
      this.categorieFiltre.set(cat.id);
      this.champRechercheCategorie.setValue(cat.nom, { emitEvent: false });
    }
  }

  effacerFiltreCategorie(): void {
    this.categorieFiltre.set(null);
    this.champRechercheCategorie.setValue('', { emitEvent: true });
  }

  choisirCategorieNouveau(evenement: MatAutocompleteSelectedEvent): void {
    const cat = evenement.option.value as { id: string; nom: string } | null;
    if (!cat) {
      this.categorieIdNouveau.setValue(null);
      this.champRechercheCategorieNouveau.setValue('', { emitEvent: false });
    } else {
      this.categorieIdNouveau.setValue(cat.id);
      this.champRechercheCategorieNouveau.setValue(cat.nom, { emitEvent: false });
    }
  }

  basculerRayonEtChoisir(ing: IngredientResponse): void {
    this.categorieFiltre.set(ing.categorieId ?? null);
    const catNom = this.categorieNomDe(ing);
    if (catNom) {
      this.champRechercheCategorie.setValue(catNom, { emitEvent: false });
    } else {
      this.champRechercheCategorie.setValue('', { emitEvent: false });
    }
    this.choisirIngredientDirect(ing);
  }

  activerPropositionNouvelIngredient(nomInitial?: string): void {
    const nom = (
      nomInitial ||
      (typeof this.champRecherche.value === 'string' ? this.champRecherche.value : '') ||
      this.texteRecherche()
    ).trim();
    this.nomNouveau.setValue(nom);
    const catActuelle = this.categorieFiltre();
    this.categorieIdNouveau.setValue(catActuelle ?? null);
    if (catActuelle) {
      const cat = this.categories().find((c) => c.id === catActuelle);
      this.champRechercheCategorieNouveau.setValue(cat ? cat.nom : '', { emitEvent: false });
    } else {
      this.champRechercheCategorieNouveau.setValue('', { emitEvent: false });
    }
    const uniteActuelle = (this.formulaire.controls.unite.value as Unite) ?? 'KG';
    this.uniteNouveau.setValue(uniteActuelle);
    this.modeNouvelIngredient.set(true);
    this.ingredientSelectionne.set(null);
    this.formulaire.controls.ingredientId.setValue('NOUVEAU');
    this.mettreAJourValidateursPrix(null);
    this.erreur.set('');
  }

  annulerPropositionNouvelIngredient(): void {
    this.modeNouvelIngredient.set(false);
    this.formulaire.controls.ingredientId.setValue('');
    this.nomNouveau.reset();
    this.categorieIdNouveau.reset();
    this.champRechercheCategorieNouveau.reset();
  }

  private chargerIngredients(): void {
    this.chargementIngredients.set(true);
    this.ingredientService.getAll().subscribe({
      next: (ingredients) => {
        const tries = [...ingredients].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
        this.tousLesIngredients.set(tries);
        this.chargementIngredients.set(false);
        this.enrichirIngredientSelectionne(tries);
      },
      error: () => {
        this.chargementIngredients.set(false);
      },
    });
  }

  private enrichirIngredientSelectionne(ingredients: IngredientResponse[]): void {
    const sel = this.ingredientSelectionne();
    const prod = this.donnees.produit;
    const cibleId = sel?.id || prod?.ingredientId;
    if (!cibleId) {
      return;
    }

    const full = ingredients.find((i) => i.id === cibleId);
    if (full) {
      let catNom = full.categorieNom || sel?.categorieNom || prod?.categorieNom;
      if (!catNom && (full.categorieId || sel?.categorieId || prod?.categorieId)) {
        const catId = full.categorieId || sel?.categorieId || prod?.categorieId;
        const cat = this.categoriesApi().find((c) => c.id === catId);
        if (cat) {
          catNom = cat.nom;
        }
      }

      this.ingredientSelectionne.set({
        ...full,
        categorieNom: catNom ?? null,
      });

      if (this.aPhotoCatalogue()) {
        this.photo = null;
      }
      this.mettreAJourValidateursPrix(this.prixPlafond());
    }
  }

  private mettreAJourValidateursPrix(plafond: number | null): void {
    const validateurs = [Validators.required, Validators.min(1)];
    if (plafond !== null && plafond > 0) {
      validateurs.push(Validators.max(plafond));
    }
    this.formulaire.controls.prixIndicatif.setValidators(validateurs);
    this.formulaire.controls.prixIndicatif.updateValueAndValidity();
  }

  choisirIngredient(evenement: MatAutocompleteSelectedEvent): void {
    const ingredient = evenement.option.value as IngredientResponse;
    if (!ingredient) {
      return;
    }
    this.choisirIngredientDirect(ingredient);
  }

  choisirIngredientDirect(ingredient: IngredientResponse): void {
    this.modeNouvelIngredient.set(false);
    const catNom = this.categorieNomDe(ingredient);
    this.ingredientSelectionne.set({
      ...ingredient,
      categorieNom: catNom,
    });
    this.champRecherche.setValue(ingredient.nom, { emitEvent: false });
    this.formulaire.controls.ingredientId.setValue(ingredient.id);

    // Pré-remplissage de l'unité par défaut si l'ingrédient en a une
    if (ingredient.unite) {
      this.formulaire.controls.unite.setValue(ingredient.unite);
    }

    if (this.aPhotoCatalogue()) {
      this.photo = null;
    }
    this.mettreAJourValidateursPrix(this.prixPlafond());
    this.erreur.set('');
  }

  changerIngredient(): void {
    this.modeNouvelIngredient.set(false);
    this.ingredientSelectionne.set(null);
    this.photo = null;
    this.formulaire.controls.ingredientId.setValue('');
    this.champRecherche.setValue('');
    this.mettreAJourValidateursPrix(null);
  }

  /** Libellé court de l'unité choisie pour le suffixe. */
  protected uniteCourte(): string {
    const unite = this.modeNouvelIngredient()
      ? this.uniteNouveau.value
      : this.formulaire.controls.unite.value;
    return unite
      ? (UNITES.find((u) => u.valeur === unite)?.libelle.replace(/.*\((.*)\)/, '$1') ?? '')
      : '';
  }

  enregistrer(): void {
    this.erreur.set('');

    // --- CAS A : Proposition d'un nouvel ingrédient ---
    if (this.modeNouvelIngredient()) {
      if (this.nomNouveau.invalid) {
        this.nomNouveau.markAsTouched();
        this.erreur.set("Veuillez renseigner le nom du nouvel ingrédient.");
        return;
      }

      // Synchronisation de l'unité
      this.formulaire.controls.unite.setValue(this.uniteNouveau.value);

      if (this.formulaire.invalid) {
        this.formulaire.markAllAsTouched();
        const ctrlPrix = this.formulaire.controls.prixIndicatif;
        if (ctrlPrix.invalid) {
          this.erreur.set("Veuillez renseigner un prix indicatif valide (ex. 500 FCFA).");
        } else if (this.formulaire.controls.quantite.invalid) {
          this.erreur.set("Veuillez renseigner une quantité disponible valide (ex. 10 kg).");
        } else {
          this.erreur.set("Veuillez renseigner tous les champs obligatoires.");
        }
        return;
      }

      this.enCours.set(true);
      const nomIng = this.nomNouveau.value.trim();
      const uniteIng = this.uniteNouveau.value;
      const catIdIng = this.categorieIdNouveau.value;

      this.ingredientService
        .creer({
          nom: nomIng,
          unite: uniteIng,
          categorieId: catIdIng || undefined,
        })
        .subscribe({
          next: (nouvelIng) => {
            this.tousLesIngredients.update((liste) => [...liste, nouvelIng]);

            const valeurs = this.formulaire.getRawValue();
            const requete: ProduitProducteurRequest = {
              ingredientId: nouvelIng.id,
              prixIndicatif: Number(valeurs.prixIndicatif),
              quantite: Number(valeurs.quantite),
              unite: uniteIng,
              imageUrl: valeurs.imageUrl?.trim() || null,
            };

            this.produitService.ajouter(requete).subscribe({
              next: (produit) => {
                if (this.photo) {
                  this.produitService.envoyerImage(produit.id, this.photo).subscribe({
                    next: () => {
                      this.notification.succes(
                        `Votre offre a été créée et l'ingrédient « ${nouvelIng.nom} » a été soumis aux administrateurs.`,
                      );
                      this.fenetre.close(produit);
                    },
                    error: () => {
                      this.notification.succes(
                        `Votre offre a été créée et l'ingrédient « ${nouvelIng.nom} » a été soumis aux administrateurs.`,
                      );
                      this.fenetre.close(produit);
                    },
                  });
                } else {
                  this.notification.succes(
                    `Votre offre a été créée et l'ingrédient « ${nouvelIng.nom} » a été soumis aux administrateurs.`,
                  );
                  this.fenetre.close(produit);
                }
              },
              error: (err: unknown) => {
                this.enCours.set(false);
                this.erreur.set(messageErreur(err, "Impossible d'enregistrer l'offre du produit."));
              },
            });
          },
          error: (err: unknown) => {
            this.enCours.set(false);
            this.erreur.set(messageErreur(err, "Impossible d'enregistrer le nouvel ingrédient."));
          },
        });
      return;
    }

    // --- CAS B : Ingrédient sélectionné existant ---
    // Si aucun ingrédient n'est explicitement sélectionné mais que le producteur a saisi un nom
    if (!this.formulaire.controls.ingredientId.value) {
      const val = this.champRecherche.value;
      const texte = (typeof val === 'string' ? val : (val?.nom ?? '')).trim().toLowerCase();
      if (texte) {
        const match = this.tousLesIngredients().find(
          (i) => i.nom.toLowerCase() === texte || i.nom.toLowerCase().startsWith(texte),
        );
        if (match) {
          this.choisirIngredientDirect(match);
        }
      }
    }

    if (!this.formulaire.controls.ingredientId.value) {
      this.erreur.set("Veuillez sélectionner un ingrédient ou proposer un nouvel ingrédient.");
      return;
    }

    if (this.formulaire.invalid) {
      this.formulaire.markAllAsTouched();
      const ctrlPrix = this.formulaire.controls.prixIndicatif;
      if (ctrlPrix.hasError('max')) {
        this.erreur.set(
          `Le prix indicatif ne peut pas dépasser ${this.prixPlafond()} FCFA pour cet ingrédient.`,
        );
      } else if (ctrlPrix.invalid) {
        this.erreur.set("Veuillez renseigner un prix indicatif valide (ex. 500 FCFA).");
      } else if (this.formulaire.controls.quantite.invalid) {
        this.erreur.set("Veuillez renseigner une quantité disponible valide (ex. 10 kg).");
      } else {
        this.erreur.set("Veuillez renseigner tous les champs obligatoires.");
      }
      return;
    }

    this.enCours.set(true);

    const valeurs = this.formulaire.getRawValue();
    const requete: ProduitProducteurRequest = {
      ingredientId: valeurs.ingredientId!,
      prixIndicatif: Number(valeurs.prixIndicatif),
      quantite: Number(valeurs.quantite),
      unite: valeurs.unite as Unite,
      imageUrl: valeurs.imageUrl?.trim() || null,
    };

    const existant = this.donnees.produit;
    const appel = existant
      ? this.produitService.modifier(existant.id, requete)
      : this.produitService.ajouter(requete);

    appel.subscribe({
      next: (produit) => {
        // Téléversement d'une photo personnalisée uniquement si l'ingrédient n'a pas déjà de photo de référence
        if (this.photo && !this.aPhotoCatalogue()) {
          this.produitService.envoyerImage(produit.id, this.photo).subscribe({
            next: () => {
              this.fenetre.close(produit);
            },
            error: () => {
              // Si la photo échoue, le produit reste enregistré
              this.fenetre.close(produit);
            },
          });
        } else {
          this.fenetre.close(produit);
        }
      },
      error: (err: unknown) => {
        this.enCours.set(false);
        this.erreur.set(messageErreur(err, "Impossible d'enregistrer le produit."));
      },
    });
  }
}
