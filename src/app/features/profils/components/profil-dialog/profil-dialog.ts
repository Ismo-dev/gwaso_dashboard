import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
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
import { ProfilResponse } from '../../models/profil.model';
import { ProfilService } from '../../services/profil.service';

export interface DonneesProfilDialog {
  /** Profil à modifier ; absent pour une création. */
  profil?: ProfilResponse;
  /** Tous les profils : pour dire lequel est aujourd'hui celui des inscriptions. */
  profils: ProfilResponse[];
}

/**
 * Création ou modification d'un profil : un nom, une description, et s'il est le profil des inscriptions.
 * Un profil n'a pas de type de compte : on le donne à qui on veut, ses droits font tout.
 * La boîte enregistre elle-même : en cas d'erreur, elle reste ouverte et garde la saisie.
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
    MatCheckbox,
  ],
  selector: 'app-profil-dialog',
  styleUrl: './profil-dialog.scss',
  templateUrl: './profil-dialog.html',
})
export class ProfilDialog {
  private profilService = inject(ProfilService);
  private fenetre = inject(MatDialogRef<ProfilDialog, ProfilResponse>);
  protected donnees = inject<DonneesProfilDialog>(MAT_DIALOG_DATA);

  protected formulaire = inject(FormBuilder).nonNullable.group({
    nom: [this.donnees.profil?.nom ?? '', [Validators.required, Validators.maxLength(60)]],
    description: [this.donnees.profil?.description ?? '', Validators.maxLength(255)],
    inscription: [this.donnees.profil?.inscription ?? false],
  });

  /** Profil des inscriptions aujourd'hui (autre que celui modifié). */
  protected inscriptionActuelle =
    this.donnees.profils.find((p) => p.inscription && p.id !== this.donnees.profil?.id) ?? null;
  /** Le profil des inscriptions ne perd pas sa marque ici : on la donne à un autre profil. */
  protected inscriptionVerrouillee = !!this.donnees.profil?.inscription;

  constructor() {
    if (this.inscriptionVerrouillee) {
      this.formulaire.controls.inscription.disable();
    }
  }

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
      inscription: valeurs.inscription,
    };
    const profil = this.donnees.profil;
    const appel = profil ? this.profilService.modifier(profil.id, requete) : this.profilService.creer(requete);

    appel.subscribe({
      next: (resultat) => this.fenetre.close(resultat),
      error: (erreur: unknown) => {
        this.enCours.set(false);
        this.erreur.set(messageErreur(erreur, "Impossible d'enregistrer le profil."));
      },
    });
  }
}
