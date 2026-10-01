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
import { UstensileResponse } from '../../models/ustensile.model';
import { UstensileService } from '../../services/ustensile.service';

export interface DonneesUstensileDialog {
  /** Ustensile à modifier ; absent pour une création. */
  ustensile?: UstensileResponse;
  /** Nom pré-rempli lors d'une création rapide (ex. depuis l'éditeur d'étape). */
  nomInitial?: string;
}

/**
 * Création ou modification d'un ustensile (nom, description, photo).
 * Elle renvoie l'ustensile enregistré, ou undefined si l'utilisateur annule.
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
  selector: 'app-ustensile-dialog',
  styleUrl: './ustensile-dialog.scss',
  templateUrl: './ustensile-dialog.html',
})
export class UstensileDialog {
  private ustensileService = inject(UstensileService);
  private fenetre = inject(MatDialogRef<UstensileDialog, UstensileResponse>);
  protected donnees = inject<DonneesUstensileDialog>(MAT_DIALOG_DATA);

  protected formulaire = inject(FormBuilder).nonNullable.group({
    nom: [this.donnees.ustensile?.nom ?? this.donnees.nomInitial ?? '', [Validators.required, Validators.maxLength(80)]],
    description: [this.donnees.ustensile?.description ?? '', Validators.maxLength(255)],
  });

  protected enregistre = signal<UstensileResponse | null>(this.donnees.ustensile ?? null);
  protected photo: File | null = null;
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
    const existant = this.enregistre();
    const sauvegarde = existant
      ? this.ustensileService.modifier(existant.id, requete)
      : this.ustensileService.creer(requete);

    let sauvegardeFaite = false;
    sauvegarde
      .pipe(
        switchMap((ustensile) => {
          sauvegardeFaite = true;
          this.enregistre.set(ustensile);
          return this.envoyerPhoto(ustensile);
        }),
      )
      .subscribe({
        next: (ustensile) => this.fenetre.close(ustensile),
        error: (erreur: unknown) => {
          this.enCours.set(false);
          this.erreur.set(
            sauvegardeFaite
              ? "L'ustensile est enregistré, mais la photo n'a pas pu être envoyée. Cliquez à nouveau sur Enregistrer pour réessayer."
              : messageErreur(erreur, "Impossible d'enregistrer l'ustensile."),
          );
        },
      });
  }

  private envoyerPhoto(ustensile: UstensileResponse): Observable<UstensileResponse> {
    if (!this.photo) {
      return of(ustensile);
    }
    return this.ustensileService
      .envoyerImage(ustensile.id, this.photo)
      .pipe(switchMap(() => this.ustensileService.getById(ustensile.id)));
  }
}
