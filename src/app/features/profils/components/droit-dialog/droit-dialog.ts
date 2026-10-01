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
import { messageErreur } from '../../../../core/utils/erreurs';
import { DroitResponse } from '../../models/profil.model';
import { ProfilService } from '../../services/profil.service';

export interface DonneesDroitDialog {
  /** Droit à modifier ; absent pour une création. */
  droit?: DroitResponse;
}

/** Code d'un droit : lettres majuscules, chiffres et « _ », ex. RECETTE_VALIDER. */
const FORMAT_CODE = /^[A-Z][A-Z0-9_]*$/;

/**
 * Création ou modification d'un droit.
 * Elle renvoie le droit enregistré, ou undefined si l'utilisateur annule.
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
  ],
  selector: 'app-droit-dialog',
  styleUrl: './droit-dialog.scss',
  templateUrl: './droit-dialog.html',
})
export class DroitDialog {
  private profilService = inject(ProfilService);
  private fenetre = inject(MatDialogRef<DroitDialog, DroitResponse>);
  protected donnees = inject<DonneesDroitDialog>(MAT_DIALOG_DATA);

  protected formulaire = inject(FormBuilder).nonNullable.group({
    action: [
      this.donnees.droit?.action ?? '',
      [Validators.required, Validators.pattern(FORMAT_CODE), Validators.maxLength(60)],
    ],
    description: [this.donnees.droit?.description ?? '', Validators.maxLength(255)],
  });

  protected enCours = signal(false);
  protected erreur = signal('');

  /** Met le code en majuscules et remplace les espaces par « _ » pendant la saisie. */
  normaliserCode(): void {
    const champ = this.formulaire.controls.action;
    const normalise = champ.value.toUpperCase().replace(/[\s-]+/g, '_');
    if (normalise !== champ.value) {
      champ.setValue(normalise);
    }
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
      action: valeurs.action,
      description: valeurs.description.trim() || undefined,
    };
    const droit = this.donnees.droit;
    const appel = droit
      ? this.profilService.modifierDroit(droit.id, requete)
      : this.profilService.creerDroit(requete);

    appel.subscribe({
      next: (resultat) => this.fenetre.close(resultat),
      error: (erreur: unknown) => {
        this.enCours.set(false);
        this.erreur.set(messageErreur(erreur, "Impossible d'enregistrer le droit."));
      },
    });
  }
}
