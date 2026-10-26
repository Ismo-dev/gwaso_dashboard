import { Component, inject } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { UstensileResponse } from '../../models/ustensile.model';
import { UstensileFormulaire } from '../ustensile-formulaire/ustensile-formulaire';

export interface DonneesUstensileDialog {
  /** Ustensile à modifier ; absent pour une création. */
  ustensile?: UstensileResponse;
  /** Nom pré-rempli lors d'une création rapide. */
  nomInitial?: string;
}

/**
 * Fenêtre « Nouvel ustensile » / « Modifier l'ustensile » : le formulaire réutilisable dans une fenêtre.
 * Elle renvoie l'ustensile enregistré, ou undefined si l'utilisateur annule.
 */
@Component({
  imports: [MatDialogTitle, MatDialogContent, UstensileFormulaire],
  selector: 'app-ustensile-dialog',
  templateUrl: './ustensile-dialog.html',
})
export class UstensileDialog {
  protected fenetre = inject(MatDialogRef<UstensileDialog, UstensileResponse>);
  protected donnees = inject<DonneesUstensileDialog>(MAT_DIALOG_DATA);
}
