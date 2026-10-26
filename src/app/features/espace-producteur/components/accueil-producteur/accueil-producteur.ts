import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltip } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { catchError, firstValueFrom, forkJoin, of } from 'rxjs';
import { ConfirmationService } from '../../../../core/services/confirmation.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { SessionService } from '../../../../core/services/session.service';
import { messageErreur } from '../../../../core/utils/erreurs';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { StatCard } from '../../../../shared/components/stat-card/stat-card';
import { FichierPipe } from '../../../../shared/pipes/fichier.pipe';
import { UnitePipe } from '../../../../shared/pipes/unite.pipe';
import { IngredientService } from '../../../ingredients/services/ingredient.service';
import {
  DonneesProduitDialog,
  ProduitDialog,
} from '../produit-dialog/produit-dialog';
import { ProduitProducteurResponse } from '../../models/produit.model';
import { ProduitProducteurService } from '../../services/produit-producteur.service';

/**
 * Tableau de bord dédié aux producteurs / fournisseurs locaux.
 */
@Component({
  imports: [
    RouterLink,
    DatePipe,
    DecimalPipe,
    MatButton,
    MatIconButton,
    MatTooltip,
    NgIcon,
    StatCard,
    EmptyState,
    FichierPipe,
    UnitePipe,
  ],
  selector: 'app-accueil-producteur',
  styleUrl: './accueil-producteur.scss',
  templateUrl: './accueil-producteur.html',
})
export class AccueilProducteur implements OnInit {
  protected session = inject(SessionService);
  private produitService = inject(ProduitProducteurService);
  private ingredientService = inject(IngredientService);
  private dialog = inject(MatDialog);
  private confirmation = inject(ConfirmationService);
  private notification = inject(NotificationService);

  protected produits = signal<ProduitProducteurResponse[]>([]);
  protected chargement = signal(true);
  protected erreur = signal(false);
  protected aujourdhui = new Date();

  protected utilisateur = computed(() => this.session.utilisateur());

  /** Salutation selon l'heure du jour. */
  protected salutation = computed(() =>
    this.aujourdhui.getHours() < 18 ? 'Bonjour' : 'Bonsoir',
  );

  // ----- Indicateurs clés (KPIs) du producteur -----
  protected totalProduits = computed(() => this.produits().length);

  protected produitsEnStock = computed(
    () => this.produits().filter((p) => p.quantite > 5).length,
  );

  protected stocksCritiques = computed(() =>
    this.produits().filter((p) => p.quantite <= 5),
  );

  protected valeurTotaleStock = computed(() =>
    this.produits().reduce((total, p) => total + p.prixIndicatif * p.quantite, 0),
  );

  /** Catégories / rayons actuellement actifs dans les offres du producteur. */
  protected categoriesActives = computed(() => {
    const prods = this.produits();
    const map = new Map<string, { id: string; nom: string; compte: number }>();
    for (const p of prods) {
      const nom = p.categorieNom || 'Autres denrées';
      const id = p.categorieId || nom;
      const existant = map.get(nom);
      if (existant) {
        existant.compte++;
      } else {
        map.set(nom, { id, nom, compte: 1 });
      }
    }
    return Array.from(map.values());
  });

  /** Aperçu des 4 derniers produits mis à jour. */
  protected derniersProduits = computed(() => this.produits().slice(0, 4));

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set(false);

    forkJoin({
      produits: this.produitService.getMesProduits(),
      ingredients: this.ingredientService.getAll().pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ produits, ingredients }) => {
        const map = new Map(ingredients.map((i) => [i.id, i]));
        const enrichis = produits.map((p) => {
          const ing = map.get(p.ingredientId);
          return {
            ...p,
            ingredientPhotoUrl: p.ingredientPhotoUrl || ing?.photoUrl || null,
            categorieNom: p.categorieNom || ing?.categorieNom || null,
            categorieId: p.categorieId || ing?.categorieId || null,
          };
        });
        this.produits.set(enrichis);
        this.chargement.set(false);
      },
      error: () => {
        this.erreur.set(true);
        this.chargement.set(false);
      },
    });
  }

  async ajouterProduit(): Promise<void> {
    const produit = await this.ouvrirDialogue({});
    if (produit) {
      this.produits.update((liste) => [produit, ...liste.filter((p) => p.id !== produit.id)]);
      this.notification.succes(`« ${produit.ingredientNom} » est ajouté à votre catalogue.`);
    }
  }

  async modifierProduit(produit: ProduitProducteurResponse): Promise<void> {
    const resultat = await this.ouvrirDialogue({ produit });
    if (resultat) {
      this.produits.update((liste) =>
        liste.map((p) => (p.id === resultat.id ? resultat : p)),
      );
      this.notification.succes(`L'offre pour « ${resultat.ingredientNom} » a été mise à jour.`);
    }
  }

  async supprimerProduit(produit: ProduitProducteurResponse): Promise<void> {
    const confirme = await this.confirmation.demander({
      titre: `Retirer « ${produit.ingredientNom} » ?`,
      message: "Ce produit ne sera plus disponible dans l'annuaire des cuisiniers.",
      texteConfirmer: 'Retirer de la vente',
      danger: true,
    });
    if (!confirme) {
      return;
    }
    this.produitService.supprimer(produit.id).subscribe({
      next: () => {
        this.produits.update((liste) => liste.filter((p) => p.id !== produit.id));
        this.notification.succes(`« ${produit.ingredientNom} » est retiré.`);
      },
      error: (err: unknown) => {
        this.notification.erreur(
          messageErreur(err, "Impossible de retirer le produit."),
        );
      },
    });
  }

  private ouvrirDialogue(
    donnees: DonneesProduitDialog,
  ): Promise<ProduitProducteurResponse | undefined> {
    const fenetre = this.dialog.open<
      ProduitDialog,
      DonneesProduitDialog,
      ProduitProducteurResponse
    >(ProduitDialog, {
      data: donnees,
      width: '620px',
      maxWidth: 'calc(100vw - 2rem)',
      autoFocus: false,
    });
    return firstValueFrom(fenetre.afterClosed());
  }
}
