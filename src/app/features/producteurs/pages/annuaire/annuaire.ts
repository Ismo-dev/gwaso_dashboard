import { Component, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormField, MatLabel, MatPrefix, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { NgIcon } from '@ng-icons/core';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { SessionService } from '../../../../core/services/session.service';
import { Avatar } from '../../../../shared/components/avatar/avatar';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { CategorieIngredientResponse } from '../../../ingredients/models/categorie-ingredient.model';
import { CategorieIngredientService } from '../../../ingredients/services/categorie-ingredient.service';
import { IngredientResponse } from '../../../ingredients/models/ingredient.model';
import { IngredientService } from '../../../ingredients/services/ingredient.service';
import {
  DonneesFicheProducteurDialog,
  FicheProducteurDialog,
} from '../../components/fiche-producteur-dialog/fiche-producteur-dialog';
import { ProducteurAnnuaire } from '../../models/annuaire.model';
import { AnnuaireService } from '../../services/annuaire.service';

const TAILLE_PAGE = 12;

/**
 * Annuaire des producteurs : les producteurs validés et les catégories de ce qu'ils vendent.
 * On cherche par nom, localité ou produit, et on filtre par ingrédient, catégorie ou localité.
 * Un clic sur « Voir la fiche » permet de consulter tous les produits et détails.
 */
@Component({
  imports: [
    ReactiveFormsModule,
    MatButton,
    MatIconButton,
    MatFormField,
    MatLabel,
    MatPrefix,
    MatSuffix,
    MatInput,
    MatSelect,
    MatOption,
    NgIcon,
    PageHeader,
    EmptyState,
    Avatar,
  ],
  providers: [CategorieIngredientService],
  selector: 'app-annuaire',
  styleUrl: './annuaire.scss',
  templateUrl: './annuaire.html',
})
export class Annuaire implements OnInit {
  private annuaireService = inject(AnnuaireService);
  private ingredientService = inject(IngredientService);
  private categorieIngredientService = inject(CategorieIngredientService);
  private dialog = inject(MatDialog);
  protected session = inject(SessionService);

  protected recherche = new FormControl('', { nonNullable: true });
  protected ingredient = new FormControl<string | null>(null);
  protected categorie = new FormControl<string | null>(null);
  protected localite = new FormControl<string | null>(null);

  protected ingredients = signal<IngredientResponse[]>([]);
  protected categories = signal<CategorieIngredientResponse[]>([]);
  protected localites = signal<string[]>([]);

  protected producteurs = signal<ProducteurAnnuaire[]>([]);
  protected total = signal(0);
  protected chargement = signal(true);
  protected erreur = signal(false);
  protected toutCharge = signal(true);
  private page = 0;

  constructor() {
    this.recherche.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.charger(true));
    this.ingredient.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.charger(true));
    this.categorie.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.charger(true));
    this.localite.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.charger(true));
  }

  ngOnInit(): void {
    this.charger(true);
    this.ingredientService.getAll().subscribe({
      next: (liste) => this.ingredients.set([...liste].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))),
    });
    this.categorieIngredientService.getAll().subscribe({
      next: (liste) => this.categories.set([...liste].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))),
    });
    this.annuaireService.getLocalites().subscribe({ next: (liste) => this.localites.set(liste) });
  }

  charger(depuisLeDebut: boolean): void {
    if (depuisLeDebut) {
      this.page = 0;
    }
    this.chargement.set(true);
    this.erreur.set(false);
    this.annuaireService
      .rechercher({
        recherche: this.recherche.value.trim() || undefined,
        ingredientId: this.ingredient.value ?? undefined,
        categorieId: this.categorie.value ?? undefined,
        localite: this.localite.value ?? undefined,
        page: this.page,
        taille: TAILLE_PAGE,
      })
      .subscribe({
        next: (page) => {
          this.producteurs.update((liste) => (depuisLeDebut ? page.contenu : [...liste, ...page.contenu]));
          this.total.set(page.totalElements);
          this.toutCharge.set(page.page + 1 >= page.totalPages);
          this.page = page.page + 1;
          this.chargement.set(false);
        },
        error: () => {
          this.erreur.set(true);
          this.chargement.set(false);
        },
      });
  }

  effacerFiltres(): void {
    this.recherche.setValue('', { emitEvent: false });
    this.ingredient.setValue(null, { emitEvent: false });
    this.categorie.setValue(null, { emitEvent: false });
    this.localite.setValue(null, { emitEvent: false });
    this.charger(true);
  }

  protected filtresActifs(): boolean {
    return !!this.recherche.value || !!this.ingredient.value || !!this.categorie.value || !!this.localite.value;
  }

  /** Extrait les catégories uniques des produits d'un producteur avec le nombre d'articles. */
  protected categoriesDuProducteurAvecCompte(
    p: ProducteurAnnuaire,
  ): { id: string; nom: string; compte: number }[] {
    const map = new Map<string, { id: string; nom: string; compte: number }>();
    const ings = this.ingredients();
    const catsApi = this.categories();

    for (const prod of p.produits) {
      let nom = prod.categorieNom;
      let id = prod.categorieId;

      if (!nom && prod.ingredientId) {
        const ingTrouve = ings.find((i) => i.id === prod.ingredientId);
        if (ingTrouve) {
          nom = ingTrouve.categorieNom ?? null;
          id = ingTrouve.categorieId ?? id;
        }
      }

      if (!nom && id) {
        const catTrouvee = catsApi.find((c) => c.id === id);
        if (catTrouvee) {
          nom = catTrouvee.nom;
        }
      }

      if (!nom) {
        nom = 'Autres denrées';
        id = id || 'autres-denrees';
      }

      const cle = id || nom;
      const existant = map.get(cle);
      if (existant) {
        existant.compte++;
      } else {
        map.set(cle, { id: id || cle, nom, compte: 1 });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  }

  /** Extrait les catégories uniques des produits d'un producteur. */
  protected categoriesDuProducteur(p: ProducteurAnnuaire): string[] {
    return this.categoriesDuProducteurAvecCompte(p).map((c) => c.nom);
  }

  /** Ouvre la fiche complète d'un producteur avec tous ses produits en détail. */
  ouvrirFiche(producteur: ProducteurAnnuaire): void {
    this.dialog.open<FicheProducteurDialog, DonneesFicheProducteurDialog>(
      FicheProducteurDialog,
      {
        data: {
          producteur,
          categorieInitialeId: this.categorie.value,
        },
        width: '720px',
        maxWidth: 'calc(100vw - 2rem)',
      },
    );
  }
}
