import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { Observable, of, switchMap } from 'rxjs';
import { messageErreur } from '../../../../core/utils/erreurs';
import { ImageUpload } from '../../../../shared/components/image-upload/image-upload';
import { CategorieResponse } from '../../models/categorie.model';
import { CategorieService } from '../../services/categorie.service';

export interface DonneesCategorieDialog {
  /** Catégorie à modifier ; absente pour une création. */
  categorie?: CategorieResponse;
}

/**
 * Création ou modification d'une catégorie (nom, description, image).
 * La boîte enregistre elle-même, puis envoie l'image si une nouvelle a été choisie.
 * Elle renvoie la catégorie enregistrée, ou undefined si l'utilisateur annule.
 */
@Component({
  imports: [
    ReactiveFormsModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatButton,
    MatFormField,
    MatLabel,
    MatInput,
    MatHint,
    MatError,
    MatProgressSpinner,
    ImageUpload,
  ],
  selector: 'app-categorie-dialog',
  styleUrl: './categorie-dialog.scss',
  templateUrl: './categorie-dialog.html',
})
export class CategorieDialog {
  private categorieService = inject(CategorieService);
  private fenetre = inject(MatDialogRef<CategorieDialog, CategorieResponse>);
  protected donnees = inject<DonneesCategorieDialog>(MAT_DIALOG_DATA);

  protected formulaire = inject(FormBuilder).nonNullable.group({
    nom: [this.donnees.categorie?.nom ?? '', [Validators.required, Validators.maxLength(80)]],
    description: [this.donnees.categorie?.description ?? '', Validators.maxLength(255)],
  });

  /** Catégorie déjà enregistrée (existante, ou créée pendant cette saisie). */
  protected enregistree = signal<CategorieResponse | null>(this.donnees.categorie ?? null);
  protected image: File | null = null;
  protected enCours = signal(false);
  protected erreur = signal('');

  enregistrer(): void {
    if (this.formulaire.invalid) {
      this.formulaire.markAllAsTouched();
      return;
    }
    this.enCours.set(true);
    this.erreur.set('');

    const valeurs = this.formulaire.getRawValue();
    const requete = {
      nom: valeurs.nom.trim(),
      description: valeurs.description.trim() || undefined,
    };
    const existante = this.enregistree();
    const sauvegarde = existante
      ? this.categorieService.modifier(existante.id, requete)
      : this.categorieService.creer(requete);

    // Deux étapes : 1. enregistrer la catégorie  2. envoyer l'image (si une image a été choisie)
    let sauvegardeFaite = false;
    sauvegarde
      .pipe(
        switchMap((categorie) => {
          sauvegardeFaite = true;
          this.enregistree.set(categorie);
          return this.envoyerImage(categorie);
        }),
      )
      .subscribe({
        next: (categorie) => this.fenetre.close(categorie),
        error: (erreur: unknown) => {
          this.enCours.set(false);
          this.erreur.set(
            sauvegardeFaite
              ? "La catégorie est enregistrée, mais l'image n'a pas pu être envoyée. Cliquez à nouveau sur Enregistrer pour réessayer."
              : messageErreur(erreur, "Impossible d'enregistrer la catégorie."),
          );
        },
      });
  }

  /** Envoie l'image choisie, puis relit la catégorie pour obtenir l'adresse de l'image. */
  private envoyerImage(categorie: CategorieResponse): Observable<CategorieResponse> {
    if (!this.image) {
      return of(categorie);
    }
    return this.categorieService
      .envoyerImage(categorie.id, this.image)
      .pipe(switchMap(() => this.categorieService.getById(categorie.id)));
  }
}
