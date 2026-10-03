import { DecimalPipe } from '@angular/common';
import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import { NgIcon } from '@ng-icons/core';
import { ConfirmationService } from '../../../../core/services/confirmation.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { messageErreur } from '../../../../core/utils/erreurs';
import { FichierPipe } from '../../../../shared/pipes/fichier.pipe';
import { UnitePipe } from '../../../../shared/pipes/unite.pipe';
import { ProduitProducteurResponse } from '../../models/utilisateur.model';
import { UtilisateurService } from '../../services/utilisateur.service';

/** Ce que le producteur vend (ingrédients du catalogue, prix indicatif, quantité). L'admin peut retirer un produit. */
@Component({
  imports: [DecimalPipe, MatIconButton, MatTooltip, NgIcon, FichierPipe, UnitePipe],
  selector: 'app-produits-producteur',
  styleUrl: './produits-producteur.scss',
  templateUrl: './produits-producteur.html',
})
export class ProduitsProducteur {
  private utilisateurService = inject(UtilisateurService);
  private confirmation = inject(ConfirmationService);
  private notification = inject(NotificationService);

  readonly producteurId = input.required<string>();

  protected produits = signal<ProduitProducteurResponse[]>([]);
  protected chargement = signal(true);

  constructor() {
    effect(() => {
      const id = this.producteurId();
      untracked(() => this.charger(id));
    });
  }

  private charger(id: string): void {
    this.chargement.set(true);
    this.utilisateurService.getProduits(id).subscribe({
      next: (produits) => {
        this.produits.set(produits);
        this.chargement.set(false);
      },
      error: () => {
        this.produits.set([]);
        this.chargement.set(false);
      },
    });
  }

  async retirer(produit: ProduitProducteurResponse): Promise<void> {
    const confirme = await this.confirmation.demander({
      titre: `Retirer « ${produit.ingredientNom} » ?`,
      message: "Ce produit ne sera plus proposé dans l'annuaire des producteurs.",
      texteConfirmer: 'Retirer le produit',
      danger: true,
    });
    if (!confirme) {
      return;
    }
    this.utilisateurService.retirerProduit(produit.id).subscribe({
      next: () => {
        this.produits.update((liste) => liste.filter((p) => p.id !== produit.id));
        this.notification.succes(`« ${produit.ingredientNom} » est retiré.`);
      },
      error: (erreur: unknown) => this.notification.erreur(messageErreur(erreur, "Le produit n'a pas pu être retiré.")),
    });
  }
}
