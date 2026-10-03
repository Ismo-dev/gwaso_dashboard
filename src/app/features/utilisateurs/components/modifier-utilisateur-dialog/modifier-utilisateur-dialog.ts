import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatOption, MatSelect } from '@angular/material/select';
import { Observable } from 'rxjs';
import { messageErreur } from '../../../../core/utils/erreurs';
import { FicheUtilisateur, LIBELLES_NIVEAU, NiveauCuisine } from '../../models/utilisateur.model';
import { UtilisateurService } from '../../services/utilisateur.service';

/** Il faut un email ou un téléphone pour se connecter ; l'email est obligatoire pour un administrateur. */
function contactValide(role: FicheUtilisateur['role']) {
  return (groupe: AbstractControl): ValidationErrors | null => {
    const email = (groupe.get('email')?.value ?? '').trim();
    const telephone = (groupe.get('telephone')?.value ?? '').trim();
    if (role === 'ADMIN') {
      return email ? null : { emailAdmin: true };
    }
    return email || telephone ? null : { contact: true };
  };
}

/**
 * Modification d'un compte par l'administrateur : identité, contact, et selon le type niveau ou localité.
 * Le mot de passe et le justificatif ne sont pas touchés. Renvoie true si le compte a été modifié.
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
    MatError,
    MatInput,
    MatSelect,
    MatOption,
    MatProgressSpinner,
  ],
  selector: 'app-modifier-utilisateur-dialog',
  styleUrl: './modifier-utilisateur-dialog.scss',
  templateUrl: './modifier-utilisateur-dialog.html',
})
export class ModifierUtilisateurDialog {
  private utilisateurService = inject(UtilisateurService);
  private fenetre = inject(MatDialogRef<ModifierUtilisateurDialog, boolean>);
  protected fiche = inject<FicheUtilisateur>(MAT_DIALOG_DATA);

  protected readonly niveaux = Object.entries(LIBELLES_NIVEAU) as [NiveauCuisine, string][];

  protected formulaire = inject(FormBuilder).nonNullable.group(
    {
      prenom: [this.fiche.prenom, [Validators.required, Validators.maxLength(60)]],
      nom: [this.fiche.nom, [Validators.required, Validators.maxLength(60)]],
      email: [this.fiche.email ?? '', [Validators.email, Validators.maxLength(120)]],
      telephone: [this.fiche.telephone ?? '', [Validators.pattern(/^\+?[0-9 ]{8,20}$/)]],
      niveau: [(this.fiche.niveau ?? 'DEBUTANT') as NiveauCuisine],
      localite: [this.fiche.localite ?? '', this.fiche.role === 'PRODUCTEUR' ? [Validators.required, Validators.maxLength(100)] : []],
    },
    { validators: contactValide(this.fiche.role) },
  );

  protected enCours = signal(false);
  protected erreur = signal('');

  enregistrer(): void {
    if (this.formulaire.invalid) {
      this.formulaire.markAllAsTouched();
      this.erreur.set(
        this.formulaire.hasError('emailAdmin')
          ? "L'email est obligatoire pour un administrateur (il sert à se connecter au dashboard)."
          : this.formulaire.hasError('contact')
            ? 'Gardez au moins un email ou un téléphone : il sert à se connecter.'
            : 'Certains champs sont à corriger. Ils sont signalés en rouge.',
      );
      return;
    }
    const v = this.formulaire.getRawValue();
    const commun = {
      prenom: v.prenom.trim(),
      nom: v.nom.trim(),
      email: v.email.trim() || undefined,
      telephone: v.telephone.replace(/\s/g, '') || undefined,
    };
    const id = this.fiche.id;
    let appel: Observable<unknown>;
    switch (this.fiche.role) {
      case 'ADMIN':
        appel = this.utilisateurService.modifierAdmin(id, commun);
        break;
      case 'CHEF':
        // Le justificatif est renvoyé tel quel : il n'est pas modifié ici
        appel = this.utilisateurService.modifierChef(id, { ...commun, preuveUrl: this.fiche.preuveUrl ?? '' });
        break;
      case 'PRODUCTEUR':
        appel = this.utilisateurService.modifierProducteur(id, {
          ...commun,
          localite: v.localite.trim(),
          preuveUrl: this.fiche.preuveUrl ?? '',
        });
        break;
      default:
        appel = this.utilisateurService.modifierCuisinier(id, { ...commun, niveau: v.niveau });
    }
    this.enCours.set(true);
    this.erreur.set('');
    appel.subscribe({
      next: () => this.fenetre.close(true),
      error: (erreur: unknown) => {
        this.enCours.set(false);
        this.erreur.set(messageErreur(erreur, "Les modifications n'ont pas pu être enregistrées."));
      },
    });
  }
}
