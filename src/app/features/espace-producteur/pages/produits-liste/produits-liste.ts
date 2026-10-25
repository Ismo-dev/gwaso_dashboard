import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatDivider } from '@angular/material/divider';
import { MatFormField, MatLabel, MatPrefix, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import {
  MatCell,
  MatCellDef,
  MatColumnDef,
  MatHeaderCell,
  MatHeaderCellDef,
  MatHeaderRow,
  MatHeaderRowDef,
  MatRow,
  MatRowDef,
  MatTable,
} from '@angular/material/table';
import { MatTooltip } from '@angular/material/tooltip';
import { NgIcon } from '@ng-icons/core';
import { firstValueFrom } from 'rxjs';
import { ConfirmationService } from '../../../../core/services/confirmation.service';
import { EcranService } from '../../../../core/services/ecran.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { messageErreur } from '../../../../core/utils/erreurs';
import { pageDe, pageValide } from '../../../../core/utils/pagination';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { StatCard } from '../../../../shared/components/stat-card/stat-card';
import { FichierPipe } from '../../../../shared/pipes/fichier.pipe';
import { UnitePipe } from '../../../../shared/pipes/unite.pipe';
import { IngredientService } from '../../../ingredients/services/ingredient.service';
import {
  DonneesProduitDialog,
  ProduitDialog,
} from '../../components/produit-dialog/produit-dialog';
import { ProduitProducteurResponse } from '../../models/produit.model';
import { ProduitProducteurService } from '../../services/produit-producteur.service';
import { forkJoin, of, catchError } from 'rxjs';

export type TriProduit = 'NOM_CROISSANT' | 'NOM_DECROISSANT' | 'PRIX_CROISSANT' | 'PRIX_DECROISSANT' | 'STOCK_FAIBLE';

const TRIS: { valeur: TriProduit; libelle: string }[] = [
  { valeur: 'NOM_CROISSANT', libelle: 'Nom (A → Z)' },
  { valeur: 'NOM_DECROISSANT', libelle: 'Nom (Z → A)' },
  { valeur: 'PRIX_CROISSANT', libelle: 'Prix croissant' },
  { valeur: 'PRIX_DECROISSANT', libelle: 'Prix décroissant' },
  { valeur: 'STOCK_FAIBLE', libelle: 'Stock critique en premier' },
];

/**
 * Page de gestion du catalogue de produits du producteur connecté.
 * Suit la même identité visuelle et les mêmes standards ergonomiques que la partie administration.
 */
@Component({
  imports: [
    FormsModule,
    DecimalPipe,
    NgTemplateOutlet,
    MatButton,
    MatIconButton,
    MatFormField,
    MatLabel,
    MatPrefix,
    MatSuffix,
    MatInput,
    MatSelect,
    MatOption,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    MatDivider,
    MatPaginator,
    MatTable,
    MatColumnDef,
    MatHeaderCell,
    MatHeaderCellDef,
    MatCell,
    MatCellDef,
    MatHeaderRow,
    MatHeaderRowDef,
    MatRow,
    MatRowDef,
    MatTooltip,
    NgIcon,
    PageHeader,
    StatCard,
    EmptyState,
    FichierPipe,
    UnitePipe,
  ],
  selector: 'app-produits-liste',
  styleUrl: './produits-liste.scss',
  templateUrl: './produits-liste.html',
})
export class ProduitsListe implements OnInit {
  private produitService = inject(ProduitProducteurService);
  private ingredientService = inject(IngredientService);
  private dialog = inject(MatDialog);
  private confirmation = inject(ConfirmationService);
  private notification = inject(NotificationService);
  protected ecran = inject(EcranService);

  protected readonly tris = TRIS;

  protected produits = signal<ProduitProducteurResponse[]>([]);
  protected chargement = signal(true);
  protected erreur = signal(false);
  protected recherche = signal('');
  protected categorieFiltre = signal<string | null>(null);
  protected triActif = signal<TriProduit>('NOM_CROISSANT');

  /** Affichage : galerie (par défaut) ou tableau ; retenu sur ce navigateur. */
  protected vue = signal<'galerie' | 'liste'>(ProduitsListe.lireVue());

  private static lireVue(): 'galerie' | 'liste' {
    try {
      return localStorage.getItem('gw-produits-producteur-vue') === 'liste' ? 'liste' : 'galerie';
    } catch {
      return 'galerie';
    }
  }

  changerVue(vue: 'galerie' | 'liste'): void {
    this.vue.set(vue);
    try {
      localStorage.setItem('gw-produits-producteur-vue', vue);
    } catch {
      // Stockage indisponible (navigation privée)
    }
  }

  /** Colonnes affichées selon la largeur de l'écran. */
  protected colonnes = computed(() =>
    this.ecran.tablette()
      ? ['produit', 'prix', 'stock', 'actions']
      : ['produit', 'categorie', 'prix', 'stock', 'statut', 'actions'],
  );

  // ----- Indicateurs clés (KPIs) -----
  protected totalProduits = computed(() => this.produits().length);

  /** Produits avec stock normal (> 5 unités). */
  protected produitsEnStock = computed(
    () => this.produits().filter((p) => p.quantite > 5).length,
  );

  /** Produits dont le stock est faible (<= 5 unités). */
  protected stockFaibleCount = computed(
    () => this.produits().filter((p) => p.quantite <= 5).length,
  );

  /** Valeur estimée totale du stock en vente. */
  protected valeurTotaleStock = computed(() =>
    this.produits().reduce((total, p) => total + p.prixIndicatif * p.quantite, 0),
  );

  /** Catégories représentées dans le catalogue du producteur avec le nombre d'articles. */
  protected categoriesAvecComptes = computed(() => {
    const prods = this.produits();
    const map = new Map<string, { id: string; nom: string; compte: number }>();
    for (const p of prods) {
      const catId = p.categorieId || 'sans-categorie';
      const catNom = p.categorieNom || 'Autres denrées';
      const existant = map.get(catId);
      if (existant) {
        existant.compte++;
      } else {
        map.set(catId, { id: catId, nom: catNom, compte: 1 });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  });

  /** Filtrage et tri local. */
  protected produitsFiltres = computed(() => {
    const terme = this.recherche().trim().toLowerCase();
    const catId = this.categorieFiltre();
    const tri = this.triActif();

    const filtres = this.produits().filter((p) => {
      const matchTerme = !terme || p.ingredientNom.toLowerCase().includes(terme);
      const matchCat =
        !catId ||
        (catId === 'sans-categorie' ? !p.categorieId : p.categorieId === catId);
      return matchTerme && matchCat;
    });

    return filtres.sort((a, b) => {
      switch (tri) {
        case 'NOM_DECROISSANT':
          return b.ingredientNom.localeCompare(a.ingredientNom, 'fr');
        case 'PRIX_CROISSANT':
          return a.prixIndicatif - b.prixIndicatif;
        case 'PRIX_DECROISSANT':
          return b.prixIndicatif - a.prixIndicatif;
        case 'STOCK_FAIBLE':
          return a.quantite - b.quantite;
        case 'NOM_CROISSANT':
        default:
          return a.ingredientNom.localeCompare(b.ingredientNom, 'fr');
      }
    });
  });

  protected filtresActifs = computed(
    () => !!this.recherche().trim() || this.categorieFiltre() !== null || this.triActif() !== 'NOM_CROISSANT',
  );

  filtrerCategorie(catId: string | null): void {
    this.categorieFiltre.set(this.categorieFiltre() === catId ? null : catId);
    this.pageDemandee.set(0);
  }

  changerTri(tri: TriProduit): void {
    this.triActif.set(tri);
    this.pageDemandee.set(0);
  }

  effacerFiltres(): void {
    this.recherche.set('');
    this.categorieFiltre.set(null);
    this.triActif.set('NOM_CROISSANT');
    this.pageDemandee.set(0);
  }

  // ----- Pagination -----
  protected readonly taillesPage = [12, 24, 48];
  private pageDemandee = signal(0);
  protected taille = signal(12);
  protected page = computed(() =>
    pageValide(this.pageDemandee(), this.taille(), this.produitsFiltres().length),
  );
  protected elementsPage = computed(() =>
    pageDe(this.produitsFiltres(), this.page(), this.taille()),
  );

  protected lignesSquelette = [1, 2, 3, 4, 5];

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

  rechercher(texte: string): void {
    this.recherche.set(texte);
    this.pageDemandee.set(0);
  }

  changerPage(evenement: PageEvent): void {
    this.taille.set(evenement.pageSize);
    this.pageDemandee.set(evenement.pageIndex);
  }

  async ajouter(): Promise<void> {
    const produit = await this.ouvrirDialogue({});
    if (produit) {
      this.produits.update((liste) => [...liste, produit]);
      this.notification.succes(`« ${produit.ingredientNom} » est ajouté à votre catalogue.`);
    }
  }

  async modifier(produit: ProduitProducteurResponse): Promise<void> {
    const resultat = await this.ouvrirDialogue({ produit });
    if (resultat) {
      this.produits.update((liste) =>
        liste.map((p) => (p.id === resultat.id ? resultat : p)),
      );
      this.notification.succes(`Votre offre pour « ${resultat.ingredientNom} » est mise à jour.`);
    }
  }

  async supprimer(produit: ProduitProducteurResponse): Promise<void> {
    const confirme = await this.confirmation.demander({
      titre: `Retirer « ${produit.ingredientNom} » ?`,
      message: 'Ce produit ne sera plus visible par les cuisiniers dans l’annuaire.',
      texteConfirmer: 'Retirer de la vente',
      danger: true,
    });
    if (!confirme) {
      return;
    }
    this.produitService.supprimer(produit.id).subscribe({
      next: () => {
        this.produits.update((liste) => liste.filter((p) => p.id !== produit.id));
        this.notification.succes(`« ${produit.ingredientNom} » est retiré de votre catalogue.`);
      },
      error: (err: unknown) => {
        this.notification.erreur(
          messageErreur(err, "Le produit n'a pas pu être retiré."),
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
