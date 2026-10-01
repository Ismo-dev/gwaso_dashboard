import { Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { DemandeMotif } from '../../../core/models/confirmation.model';

/** Longueur minimale d'un motif : il doit être utile à l'auteur. */
const LONGUEUR_MIN = 10;
const LONGUEUR_MAX = 500;

/**
 * Boîte qui demande un motif écrit avant une action (rejet, désactivation...).
 * On ne l'utilise jamais directement : on passe par ConfirmationService.demanderMotif(...).
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
  ],
  selector: 'app-motif-dialog',
  styleUrl: './motif-dialog.scss',
  templateUrl: './motif-dialog.html',
})
export class MotifDialog {
  protected demande = inject<DemandeMotif>(MAT_DIALOG_DATA);
  private fenetre = inject(MatDialogRef<MotifDialog, string>);

  protected readonly longueurMax = LONGUEUR_MAX;
  protected readonly longueurMin = LONGUEUR_MIN;

  protected motif = new FormControl('', {
    nonNullable: true,
    validators: [
      Validators.required,
      Validators.minLength(LONGUEUR_MIN),
      Validators.maxLength(LONGUEUR_MAX),
    ],
  });

  confirmer(): void {
    if (this.motif.invalid) {
      this.motif.markAsTouched();
      return;
    }
    this.fenetre.close(this.motif.value.trim());
  }
}
