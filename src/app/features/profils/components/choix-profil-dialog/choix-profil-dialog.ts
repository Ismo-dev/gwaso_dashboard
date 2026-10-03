import { Component, inject, OnInit, signal } from '@angular/core';
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
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatOption, MatSelect } from '@angular/material/select';
import { ProfilResponse } from '../../models/profil.model';
import { ProfilService } from '../../services/profil.service';

export interface DonneesChoixProfil {
  titre: string;
  message: string;
  texteConfirmer: string;
  /** Mot cherché dans le nom des profils pour en proposer un (« chef », « producteur »...). */
  suggestion?: string;
}

/** Confirmation avec le choix du profil à donner (ses droits). Renvoie l'identifiant du profil, ou undefined. */
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
    MatSelect,
    MatOption,
  ],
  selector: 'app-choix-profil-dialog',
  styleUrl: './choix-profil-dialog.scss',
  templateUrl: './choix-profil-dialog.html',
})
export class ChoixProfilDialog implements OnInit {
  private profilService = inject(ProfilService);
  private fenetre = inject(MatDialogRef<ChoixProfilDialog, string>);
  protected donnees = inject<DonneesChoixProfil>(MAT_DIALOG_DATA);

  protected profils = signal<ProfilResponse[]>([]);
  protected profil = new FormControl('', { nonNullable: true, validators: Validators.required });

  ngOnInit(): void {
    this.profilService.getAll().subscribe({
      next: (profils) => {
        const actifs = profils.filter((p) => p.actif).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
        this.profils.set(actifs);
        const mot = this.donnees.suggestion?.toLowerCase();
        const normaliser = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
        const propose = mot ? actifs.find((p) => normaliser(p.nom).includes(mot)) : undefined;
        if (propose) {
          this.profil.setValue(propose.id);
        }
      },
    });
  }

  confirmer(): void {
    if (this.profil.invalid) {
      this.profil.markAsTouched();
      return;
    }
    this.fenetre.close(this.profil.value);
  }
}
