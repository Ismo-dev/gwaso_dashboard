import { Component, inject } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { IngredientResponse } from '../../models/ingredient.model';
import { IngredientFormulaire } from '../ingredient-formulaire/ingredient-formulaire';

export interface DonneesIngredientDialog {
  /** Ingrédient à modifier ; absent pour une création. */
  ingredient?: IngredientResponse;
  /** Nom pré-rempli lors d'une création rapide. */
  nomInitial?: string;
}

/**
 * Fenêtre « Nouvel ingrédient » / « Modifier l'ingrédient » : le formulaire réutilisable dans une fenêtre.
 * Elle renvoie l'ingrédient enregistré, ou undefined si l'utilisateur annule.
 */
@Component({
  imports: [MatDialogTitle, MatDialogContent, IngredientFormulaire],
  selector: 'app-ingredient-dialog',
  templateUrl: './ingredient-dialog.html',
})
export class IngredientDialog {
  protected fenetre = inject(MatDialogRef<IngredientDialog, IngredientResponse>);
  protected donnees = inject<DonneesIngredientDialog>(MAT_DIALOG_DATA);
}
