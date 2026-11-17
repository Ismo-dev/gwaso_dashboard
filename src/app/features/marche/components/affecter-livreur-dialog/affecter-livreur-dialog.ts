import { DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatRadioButton, MatRadioGroup } from '@angular/material/radio';
import { NgIcon } from '@ng-icons/core';
import { messageErreur } from '../../../../core/utils/erreurs';
import { LivreurPropose } from '../../models/marche.model';
import { MarcheService } from '../../services/marche.service';

/** Données de la boîte : la livraison à confier et la référence de la commande (pour le titre). */
export interface AffectationLivreur {
  livraisonId: string;
  reference: string;
}

/**
 * Confier à la main la course d'une commande payée que personne n'a prise : livreurs validés et disponibles,
 * ceux du fournisseur d'abord, puis les indépendants, du plus proche au plus loin.
 * Se ferme avec le nom du livreur choisi.
 */
@Component({
  imports: [
    DecimalPipe,
    MatButton,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogTitle,
    MatProgressSpinner,
    MatRadioButton,
    MatRadioGroup,
    NgIcon,
  ],
  selector: 'app-affecter-livreur-dialog',
  styleUrl: './affecter-livreur-dialog.scss',
  templateUrl: './affecter-livreur-dialog.html',
})
export class AffecterLivreurDialog implements OnInit {
  protected data = inject<AffectationLivreur>(MAT_DIALOG_DATA);
  private fenetre = inject<MatDialogRef<AffecterLivreurDialog, string>>(MatDialogRef);
  private marcheService = inject(MarcheService);

  protected livreurs = signal<LivreurPropose[]>([]);
  protected chargement = signal(true);
  protected erreurChargement = signal(false);
  protected choisi = signal<string | null>(null);
  protected enCours = signal(false);
  protected erreur = signal<string | null>(null);

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreurChargement.set(false);
    this.marcheService.getLivreursProposes(this.data.livraisonId).subscribe({
      next: (livreurs) => {
        this.livreurs.set(livreurs);
        this.chargement.set(false);
      },
      error: () => {
        this.erreurChargement.set(true);
        this.chargement.set(false);
      },
    });
  }

  confier(): void {
    const id = this.choisi();
    if (!id || this.enCours()) {
      return;
    }
    this.enCours.set(true);
    this.erreur.set(null);
    this.marcheService.affecterLivreur(this.data.livraisonId, id).subscribe({
      next: () => this.fenetre.close(this.livreurs().find((l) => l.id === id)?.nom ?? ''),
      error: (e) => {
        this.erreur.set(messageErreur(e, 'Impossible de confier la course.'));
        this.enCours.set(false);
      },
    });
  }
}
