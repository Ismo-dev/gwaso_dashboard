
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';

import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';

import { MatError, MatFormField, MatHint, MatLabel, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatAutocomplete, MatAutocompleteSelectedEvent, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { NgIcon } from '@ng-icons/core';
import { Observable, of, startWith, switchMap } from 'rxjs';
import { messageErreur } from '../../../../core/utils/erreurs';
import { fourchetteDePrix } from '../../../../core/utils/validateurs';
import { ImageUpload } from '../../../../shared/components/image-upload/image-upload';
import { CategorieIngredientResponse } from '../../models/categorie-ingredient.model';
import { CategorieIngredientService } from '../../services/categorie-ingredient.service';
import { IngredientRequest, IngredientResponse, Unite, UNITES } from '../../models/ingredient.model';
import { IngredientService } from '../../services/ingredient.service';
import { IngredientFormulaire } from '../ingredient-formulaire/ingredient-formulaire';


export interface DonneesIngredientDialog {
  /** Ingrédient à modifier ; absent pour une création. */
  ingredient?: IngredientResponse;
  /** Nom pré-rempli lors d'une création rapide. */
  nomInitial?: string;
}

/**
 * Création ou modification d'un ingrédient (nom, rayon/catégorie, unité, prix indicatif, photo).
 * Le prix sert à estimer le budget des recettes : il est exprimé en FCFA pour une unité.
 */
@Component({
  imports: [
    ReactiveFormsModule,
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
    NgIcon,
    MatProgressSpinner,
    ImageUpload,
  ],
  providers: [CategorieIngredientService],
  selector: 'app-ingredient-dialog',
  templateUrl: './ingredient-dialog.html',
})

export class IngredientDialog implements OnInit {
  private ingredientService = inject(IngredientService);
  private categorieIngredientService = inject(CategorieIngredientService);
  private fenetre = inject(MatDialogRef<IngredientDialog, IngredientResponse>);
  protected donnees = inject<DonneesIngredientDialog>(MAT_DIALOG_DATA);

  protected readonly unites = UNITES;
  protected categories = signal<CategorieIngredientResponse[]>([]);

  /** Recherche autocomplétée de rayon / catégorie */
  protected champRechercheCategorie = new FormControl<CategorieIngredientResponse | string | null>('');
  protected texteRechercheCategorie = signal('');

  protected categoriesFiltrees = computed(() => {
    const terme = this.texteRechercheCategorie().trim().toLowerCase();
    const liste = this.categories();
    if (!terme) {
      return liste;
    }
    return liste.filter((c) => c.nom.toLowerCase().includes(terme));
  });

  afficherNomCategorie = (cat: CategorieIngredientResponse | string | null): string => {
    if (!cat) {
      return '';
    }
    return typeof cat === 'string' ? cat : cat.nom;
  };

  protected formulaire = inject(FormBuilder).group(
    {
      nom: [this.donnees.ingredient?.nom ?? this.donnees.nomInitial ?? '', [Validators.required, Validators.maxLength(80)]],
      categorieId: [this.donnees.ingredient?.categorieId ?? null],
      unite: [this.donnees.ingredient?.unite ?? null, Validators.required],
      prixMin: [this.donnees.ingredient?.prixMin ?? null, Validators.min(0)],
      prixMax: [this.donnees.ingredient?.prixMax ?? null, Validators.min(0)],
    },
    { validators: fourchetteDePrix('prixMin', 'prixMax') },
  );

  protected enregistre = signal<IngredientResponse | null>(this.donnees.ingredient ?? null);
  protected photo: File | null = null;
  protected enCours = signal(false);
  protected erreur = signal('');

  ngOnInit(): void {
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
          this.formulaire.controls.categorieId.setValue(null);
        } else {
          const match = this.categories().find((c) => c.nom.toLowerCase() === texte.trim().toLowerCase());
          this.formulaire.controls.categorieId.setValue(match ? match.id : null);
        }
      });

    this.categorieIngredientService.getAll().subscribe({
      next: (liste) => {
        const triees = [...liste].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
        this.categories.set(triees);

        const catId = this.donnees.ingredient?.categorieId;
        if (catId) {
          const cat = triees.find((c) => c.id === catId);
          if (cat) {
            this.champRechercheCategorie.setValue(cat);
          }
        }
      },
    });
  }

  choisirCategorie(evenement: MatAutocompleteSelectedEvent): void {
    const valeur = evenement.option.value as CategorieIngredientResponse | null;
    if (valeur) {
      this.formulaire.controls.categorieId.setValue(valeur.id);
      this.champRechercheCategorie.setValue(valeur);
    } else {
      this.formulaire.controls.categorieId.setValue(null);
      this.champRechercheCategorie.setValue('');
    }
  }

  effacerCategorie(): void {
    this.champRechercheCategorie.setValue('');
    this.formulaire.controls.categorieId.setValue(null);
  }

  /** Libellé court de l'unité choisie, pour le suffixe « FCFA / kg ». */
  protected uniteCourte(): string {
    const unite = this.formulaire.controls.unite.value;
    return unite
      ? (UNITES.find((u) => u.valeur === unite)?.libelle.replace(/.*\((.*)\)/, '$1') ?? '')
      : '';
  }

  enregistrer(): void {
    if (this.formulaire.invalid) {
      this.formulaire.markAllAsTouched();
      return;
    }
    this.enCours.set(true);
    this.erreur.set('');

    const valeurs = this.formulaire.getRawValue();
    const requete: IngredientRequest = {
      nom: (valeurs.nom ?? '').trim(),
      categorieId: valeurs.categorieId || null,
      unite: valeurs.unite as Unite,
      prixMin: valeurs.prixMin,
      prixMax: valeurs.prixMax,
    };
    const existant = this.enregistre();
    const sauvegarde = existant
      ? this.ingredientService.modifier(existant.id, requete)
      : this.ingredientService.creer(requete);

    let sauvegardeFaite = false;
    sauvegarde
      .pipe(
        switchMap((ingredient) => {
          sauvegardeFaite = true;
          this.enregistre.set(ingredient);
          return this.envoyerPhoto(ingredient);
        }),
      )
      .subscribe({
        next: (ingredient) => this.fenetre.close(ingredient),
        error: (erreur: unknown) => {
          this.enCours.set(false);
          this.erreur.set(
            sauvegardeFaite
              ? "L'ingrédient est enregistré, mais la photo n'a pas pu être envoyée. Cliquez à nouveau sur Enregistrer pour réessayer."
              : messageErreur(erreur, "Impossible d'enregistrer l'ingrédient."),
          );
        },
      });
  }

  private envoyerPhoto(ingredient: IngredientResponse): Observable<IngredientResponse> {
    if (!this.photo) {
      return of(ingredient);
    }
    return this.ingredientService
      .envoyerImage(ingredient.id, this.photo)
      .pipe(switchMap(() => this.ingredientService.getById(ingredient.id)));
  }

// export class IngredientDialog {
//   protected fenetre = inject(MatDialogRef<IngredientDialog, IngredientResponse>);
//   protected donnees = inject<DonneesIngredientDialog>(MAT_DIALOG_DATA);

 }
