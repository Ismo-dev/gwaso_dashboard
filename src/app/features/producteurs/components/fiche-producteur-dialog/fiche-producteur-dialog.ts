import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
} from '@angular/material/dialog';
import { MatFormField, MatLabel, MatPrefix, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { SessionService } from '../../../../core/services/session.service';
import { Avatar } from '../../../../shared/components/avatar/avatar';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { FichierPipe } from '../../../../shared/pipes/fichier.pipe';
import { UnitePipe } from '../../../../shared/pipes/unite.pipe';
import { ProducteurAnnuaire, ProduitAnnuaire } from '../../models/annuaire.model';

export interface DonneesFicheProducteurDialog {
  producteur: ProducteurAnnuaire;
  categorieInitialeId?: string | null;
}

/**
 * Dialogue modal affichant la fiche complète d'un producteur :
 * coordonnées, détails de tous les produits, prix indicatifs, stocks et filtres par catégorie.
 */
@Component({
  imports: [
    FormsModule,
    RouterLink,
    DecimalPipe,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatButton,
    MatIconButton,
    MatFormField,
    MatLabel,
    MatPrefix,
    MatSuffix,
    MatInput,
    NgIcon,
    Avatar,
    EmptyState,
    FichierPipe,
    UnitePipe,
  ],
  selector: 'app-fiche-producteur-dialog',
  styleUrl: './fiche-producteur-dialog.scss',
  templateUrl: './fiche-producteur-dialog.html',
})
export class FicheProducteurDialog {
  protected donnees = inject<DonneesFicheProducteurDialog>(MAT_DIALOG_DATA);
  protected session = inject(SessionService);

  protected producteur = signal<ProducteurAnnuaire>(this.donnees.producteur);
  protected categorieFiltre = signal<string | null>(this.donnees.categorieInitialeId ?? null);
  protected recherche = signal('');

  /** Catégories uniques des produits du producteur avec le nombre d'articles. */
  protected categories = computed(() => {
    const prods = this.producteur().produits;
    const map = new Map<string, { id: string; nom: string; compte: number }>();
    for (const p of prods) {
      const id = p.categorieId || 'sans-categorie';
      const nom = p.categorieNom || 'Autres denrées';
      const existant = map.get(id);
      if (existant) {
        existant.compte++;
      } else {
        map.set(id, { id, nom, compte: 1 });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  });

  /** Produits filtrés par catégorie et recherche textuelle. */
  protected produitsFiltres = computed(() => {
    const terme = this.recherche().trim().toLowerCase();
    const catId = this.categorieFiltre();
    return this.producteur().produits.filter((p) => {
      const matchTerme = !terme || p.ingredientNom.toLowerCase().includes(terme);
      const matchCat =
        !catId ||
        (catId === 'sans-categorie' ? !p.categorieId : p.categorieId === catId);
      return matchTerme && matchCat;
    });
  });

  filtrerCategorie(catId: string | null): void {
    this.categorieFiltre.set(this.categorieFiltre() === catId ? null : catId);
  }
}
