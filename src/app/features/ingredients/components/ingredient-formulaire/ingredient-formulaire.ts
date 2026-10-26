import {
  afterNextRender,
  Component,
  ElementRef,
  inject,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatError, MatFormField, MatHint, MatLabel, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatOption, MatSelect } from '@angular/material/select';
import { Observable, of, switchMap } from 'rxjs';
import { messageErreur } from '../../../../core/utils/erreurs';
import { fourchetteDePrix } from '../../../../core/utils/validateurs';
import { ImageUpload } from '../../../../shared/components/image-upload/image-upload';
import { IngredientResponse, Unite, UNITES } from '../../models/ingredient.model';
import { IngredientService } from '../../services/ingredient.service';

/**
 * Formulaire d'un ingrédient (nom, unité, prix indicatif, photo), sans fenêtre autour.
 * Utilisé dans la fenêtre « Nouvel ingrédient » et directement dans l'éditeur d'étape
 * (création sans ouvrir une fenêtre par-dessus le panneau).
 * Le prix sert à estimer le budget des recettes : il est exprimé en FCFA pour une unité.
 */
@Component({
  imports: [
    ReactiveFormsModule,
    MatButton,
    MatFormField,
    MatLabel,
    MatInput,
    MatHint,
    MatError,
    MatSuffix,
    MatSelect,
    MatOption,
    MatProgressSpinner,
    ImageUpload,
  ],
  selector: 'app-ingredient-formulaire',
  styleUrl: './ingredient-formulaire.scss',
  templateUrl: './ingredient-formulaire.html',
})
export class IngredientFormulaire implements OnInit {
  private ingredientService = inject(IngredientService);
  private hote = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Ingrédient à modifier ; absent pour une création. */
  readonly ingredient = input<IngredientResponse>();
  /** Nom pré-rempli lors d'une création rapide. */
  readonly nomInitial = input('');
  /** Texte du bouton principal (ex. « Créer et utiliser »). */
  readonly texteValider = input<string>();

  /** Ingrédient enregistré (photo comprise). */
  readonly enregistre = output<IngredientResponse>();
  /** Abandon : renvoie l'ingrédient s'il a déjà été créé (la photo a échoué), sinon null. */
  readonly annule = output<IngredientResponse | null>();

  protected readonly unites = UNITES;

  protected formulaire = inject(FormBuilder).group(
    {
      nom: ['', [Validators.required, Validators.maxLength(80)]],
      unite: [null as Unite | null, Validators.required],
      prixMin: [null as number | null, Validators.min(0)],
      prixMax: [null as number | null, Validators.min(0)],
    },
    { validators: fourchetteDePrix('prixMin', 'prixMax') },
  );

  protected sauve = signal<IngredientResponse | null>(null);
  protected photo: File | null = null;
  protected enCours = signal(false);
  protected erreur = signal('');

  constructor() {
    // Le curseur va directement dans le premier champ
    afterNextRender(() =>
      this.hote.nativeElement.querySelector<HTMLInputElement>('input')?.focus(),
    );
  }

  ngOnInit(): void {
    const existant = this.ingredient();
    this.sauve.set(existant ?? null);
    this.formulaire.patchValue({
      nom: existant?.nom ?? this.nomInitial(),
      unite: existant?.unite ?? null,
      prixMin: existant?.prixMin ?? null,
      prixMax: existant?.prixMax ?? null,
    });
  }

  /** Libellé court de l'unité choisie, pour le suffixe « FCFA / kg ». */
  protected uniteCourte(): string {
    const unite = this.formulaire.controls.unite.value;
    return unite
      ? (UNITES.find((u) => u.valeur === unite)?.libelle.replace(/.*\((.*)\)/, '$1') ?? '')
      : '';
  }

  annuler(): void {
    this.annule.emit(this.sauve());
  }

  enregistrer(): void {
    if (this.formulaire.invalid) {
      this.formulaire.markAllAsTouched();
      return;
    }
    this.enCours.set(true);
    this.erreur.set('');

    const valeurs = this.formulaire.getRawValue();
    const requete = {
      nom: (valeurs.nom ?? '').trim(),
      unite: valeurs.unite as Unite,
      prixMin: valeurs.prixMin,
      prixMax: valeurs.prixMax,
    };
    const existant = this.sauve();
    const sauvegarde = existant
      ? this.ingredientService.modifier(existant.id, requete)
      : this.ingredientService.creer(requete);

    let sauvegardeFaite = false;
    sauvegarde
      .pipe(
        switchMap((ingredient) => {
          sauvegardeFaite = true;
          this.sauve.set(ingredient);
          return this.envoyerPhoto(ingredient);
        }),
      )
      .subscribe({
        next: (ingredient) => {
          this.enCours.set(false);
          this.enregistre.emit(ingredient);
        },
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
}
