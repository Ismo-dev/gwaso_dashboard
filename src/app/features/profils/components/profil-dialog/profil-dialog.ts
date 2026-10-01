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
import { toSignal } from '@angular/core/rxjs-interop';
import { NgIcon } from '@ng-icons/core';
import { Role } from '../../../../core/models/enums.model';
import { ACCES_PROFIL, ORDRE_ACCES, ProfilResponse } from '../../models/profil.model';
import { ProfilService } from '../../services/profil.service';

export interface DonneesProfilDialog {
  /** Profil à modifier ; absent pour une création. */
  profil?: ProfilResponse;
  /** Tous les profils : un accès déjà pris par un autre profil n'est pas proposé. */
  profils: ProfilResponse[];
}

/**
 * Création ou modification d'un profil : nom, description et accès donné
 * (dashboard, ou application en tant que cuisinier, chef ou producteur).
 * Chaque utilisateur a un seul profil ; ses droits sont ceux du profil.
 * La boîte enregistre elle-même : en cas d'erreur, elle reste ouverte et garde la saisie.
 * Elle renvoie le profil enregistré, ou undefined si l'utilisateur annule.
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
    NgIcon,
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
    role: [(this.donnees.profil?.role ?? null) as Role | null, Validators.required],
  });

  protected readonly acces = ACCES_PROFIL;
  protected readonly ordreAcces = ORDRE_ACCES;
  protected accesChoisi = toSignal(this.formulaire.controls.role.valueChanges, {
    initialValue: this.formulaire.controls.role.value,
  });

  /** Création alors que chaque accès a déjà son profil : on explique au lieu de tout griser. */
  protected toutPris = !this.donnees.profil && ORDRE_ACCES.every((role) => !!this.pris(role));

  /** Profil qui utilise déjà cet accès (null s'il est libre). */
  protected pris(role: Role): ProfilResponse | null {
    return (
      this.donnees.profils.find((p) => p.role === role && p.id !== this.donnees.profil?.id) ?? null
    );
  }

  protected enCours = signal(false);
  protected erreur = signal('');

  enregistrer(): void {
    if (this.formulaire.invalid) {
      this.formulaire.markAllAsTouched();
      if (this.formulaire.controls.role.invalid) {
        this.erreur.set('Choisissez l’accès donné par ce profil.');
      }
      return;
    }
    this.enCours.set(true);
    this.erreur.set('');

    const valeurs = this.formulaire.getRawValue();
    const requete = {
      nom: valeurs.nom.trim(),
      description: valeurs.description.trim() || undefined,
      role: valeurs.role as Role,
    };
    const profil = this.donnees.profil;
    const appel = profil
      ? this.profilService.modifier(profil.id, requete)
      : this.profilService.creer(requete);

    appel.subscribe({
      next: (resultat) => this.fenetre.close(resultat),
      error: (erreur: unknown) => {
        this.enCours.set(false);
        this.erreur.set(messageErreur(erreur, "Impossible d'enregistrer le profil."));
      },
    });
  }
}
