import { Component, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogTitle,
} from '@angular/material/dialog';
import { NgIcon } from '@ng-icons/core';
import { DemandeConfirmation } from '../../../core/models/confirmation.model';

/**
 * Contenu de la boîte de confirmation. On ne l'utilise jamais directement :
 * on passe par ConfirmationService.demander(...).
 */
@Component({
  imports: [MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose, MatButton, NgIcon],
  selector: 'app-confirm-dialog',
  styleUrl: './confirm-dialog.scss',
  templateUrl: './confirm-dialog.html',
})
export class ConfirmDialog {
  /** Titre, message et textes des boutons envoyés par ConfirmationService. */
  protected demande = inject<DemandeConfirmation>(MAT_DIALOG_DATA);
}
