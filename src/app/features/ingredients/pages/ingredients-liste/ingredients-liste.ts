import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormField, MatLabel, MatPrefix, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatOption, MatSelect } from '@angular/material/select';
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
import { catchError, firstValueFrom, forkJoin, of } from 'rxjs';
import { ConfirmationService } from '../../../../core/services/confirmation.service';
import { EcranService } from '../../../../core/services/ecran.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { pageDe, pageValide, TAILLES_PAGE } from '../../../../core/utils/pagination';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { FichierPipe } from '../../../../shared/pipes/fichier.pipe';
import { UnitePipe } from '../../../../shared/pipes/unite.pipe';
import {
  CategoriesIngredientsDialog,
  DonneesCategoriesIngredientsDialog,
} from '../../components/categories-ingredients-dialog/categories-ingredients-dialog';
import {
  DonneesIngredientDialog,
  IngredientDialog,
} from '../../components/ingredient-dialog/ingredient-dialog';

import { CategorieIngredientResponse } from '../../models/categorie-ingredient.model';
import { CategorieIngredientService } from '../../services/categorie-ingredient.service';

import { estValide, IngredientResponse, Unite, UNITES } from '../../models/ingredient.model';
import {
  PropositionCatalogue,
  PropositionsCatalogue,
} from '../../../../shared/components/propositions-catalogue/propositions-catalogue';

import { IngredientService } from '../../services/ingredient.service';

/**
 * Ingrédients : catalogue d'ingrédients de référence avec leur unité, prix indicatif et rayon.
 */
@Component({
  imports: [
    FormsModule,
    DecimalPipe,
    NgTemplateOutlet,
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
    MatButton,
    MatIconButton,
    MatFormField,
    MatLabel,
    MatPrefix,
    MatSuffix,
    MatInput,
    MatSelect,
    MatOption,
    MatTooltip,
    NgIcon,
    PageHeader,
    EmptyState,
    PropositionsCatalogue,
    FichierPipe,
    UnitePipe,
  ],
  providers: [CategorieIngredientService],
  selector: 'app-ingredients-liste',
  styleUrl: './ingredients-liste.scss',
  templateUrl: './ingredients-liste.html',
})
export class IngredientsListe implements OnInit {
  private ingredientService = inject(IngredientService);
  private categorieIngredientService = inject(CategorieIngredientService);
  private dialog = inject(MatDialog);
  private confirmation = inject(ConfirmationService);
  private notification = inject(NotificationService);
  protected ecran = inject(EcranService);

  protected readonly unites = UNITES;

  protected ingredients = signal<IngredientResponse[]>([]);
  protected categories = signal<CategorieIngredientResponse[]>([]);
  protected chargement = signal(true);
  protected erreur = signal(false);
  protected recherche = signal('');
  protected uniteFiltre = signal<Unite | null>(null);
  protected categorieFiltre = signal<string | null>(null);

  /** Catégories avec comptage des ingrédients associés */
  protected categoriesAvecComptes = computed(() => {
    const ings = this.ingredients();
    const cats = this.categories();
    const map = new Map<string, { id: string; nom: string; compte: number }>();

    // Initialisation avec les catégories existantes
    for (const c of cats) {
      map.set(c.id, { id: c.id, nom: c.nom, compte: 0 });
    }

    let sansRayonCompte = 0;
    for (const i of ings) {
      if (i.categorieId && map.has(i.categorieId)) {
        map.get(i.categorieId)!.compte++;
      } else {
        sansRayonCompte++;
      }
    }

    const liste = Array.from(map.values()).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    if (sansRayonCompte > 0) {
      liste.push({ id: 'sans-rayon', nom: 'Non classifié (sans rayon)', compte: sansRayonCompte });
    }
    return liste;
  });

  protected ingredientsFiltres = computed(() => {
    const terme = this.recherche().trim().toLowerCase();
    const unite = this.uniteFiltre();
    return this.ingredientsValides().filter(
      (i) => (!terme || i.nom.toLowerCase().includes(terme)) && (!unite || i.unite === unite),
    );
  });

  protected filtresActifs = computed(
    () => !!this.recherche().trim() || !!this.uniteFiltre() || !!this.categorieFiltre(),
  );

  /** Ingrédients sans prix : à compléter pour que l'estimation du budget des recettes soit juste. */
  protected sansPrix = computed(
    () => this.ingredientsValides().filter((i) => i.prixMin === null && i.prixMax === null).length,
  );

  // ----- Propositions des chefs -----

  /** Éléments validés : le catalogue proprement dit (les propositions sont à part, les refus masqués). */
  protected ingredientsValides = computed(() => this.ingredients().filter(estValide));

  protected propositions = computed<PropositionCatalogue[]>(() =>
    this.ingredients()
      .filter((e) => e.statut === 'EN_ATTENTE')
      .map((e) => ({
        id: e.id,
        nom: e.nom,
        photoUrl: e.photoUrl,
        proposeParNom: e.proposeParNom ?? null,
        detail: e.unite ? `unité : ${UNITES.find((u) => u.valeur === e.unite)?.libelle ?? e.unite}` : null,
      })),
  );

  /** Proposition en cours de validation ou de refus. */
  protected propositionEnCours = signal<string | null>(null);

  completerProposition(p: PropositionCatalogue): void {
    const element = this.ingredients().find((e) => e.id === p.id);
    if (element) {
      void this.modifier(element);
    }
  }

  validerProposition(p: PropositionCatalogue): void {
    this.propositionEnCours.set(p.id);
    this.ingredientService.valider(p.id).subscribe({
      next: (valide) => {
        this.remplacer(valide);
        this.propositionEnCours.set(null);
        this.notification.succes(`L'ingrédient « ${valide.nom} » rejoint le catalogue.`);
      },
      error: () => this.propositionEnCours.set(null),
    });
  }

  async refuserProposition(p: PropositionCatalogue): Promise<void> {
    const motif = await this.confirmation.demanderMotif({
      titre: `Refuser « ${p.nom} » ?`,
      message: `${p.proposeParNom ?? 'Le chef'} verra le motif et devra le remplacer dans ses recettes.`,
      libelle: 'Motif du refus',
      aide: 'Ex. : il existe déjà sous le nom « Gombo sec ».',
      texteConfirmer: 'Refuser',
    });
    if (!motif) {
      return;
    }
    this.propositionEnCours.set(p.id);
    this.ingredientService.refuser(p.id, motif).subscribe({
      next: (refuse) => {
        this.remplacer(refuse);
        this.propositionEnCours.set(null);
        this.notification.succes(`Proposition « ${refuse.nom} » refusée.`);
      },
      error: () => this.propositionEnCours.set(null),
    });
  }

  private remplacer(element: IngredientResponse): void {
    this.ingredients.update((liste) => liste.map((e) => (e.id === element.id ? element : e)));
  }


  // ----- Pagination (la liste est chargée en entier, on la découpe ici) -----
  protected readonly taillesPage = TAILLES_PAGE;
  protected readonly colonnes = ['ingredient', 'categorie', 'unite', 'prix', 'actions'];
  private pageDemandee = signal(0);
  protected taille = signal(TAILLES_PAGE[0]);
  protected page = computed(() =>
    pageValide(this.pageDemandee(), this.taille(), this.ingredientsFiltres().length),
  );
  protected elementsPage = computed(() =>
    pageDe(this.ingredientsFiltres(), this.page(), this.taille()),
  );

  protected lignesSquelette = [1, 2, 3, 4, 5, 6];

  ngOnInit(): void {
    this.charger();
  }

  rechercher(texte: string): void {
    this.recherche.set(texte);
    this.pageDemandee.set(0);
  }

  filtrerUnite(unite: Unite | null): void {
    this.uniteFiltre.set(unite);
    this.pageDemandee.set(0);
  }

  filtrerCategorie(categorieId: string | null): void {
    this.categorieFiltre.set(categorieId);
    this.pageDemandee.set(0);
  }

  changerPage(evenement: PageEvent): void {
    this.taille.set(evenement.pageSize);
    this.pageDemandee.set(evenement.pageIndex);
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set(false);

    forkJoin({
      ingredients: this.ingredientService.getAll(),
      categories: this.categorieIngredientService.getAll().pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ ingredients, categories }) => {
        const catMap = new Map(categories.map((c) => [c.id, c.nom]));
        const enrichis = ingredients.map((i) => ({
          ...i,
          categorieNom: i.categorieNom || (i.categorieId ? catMap.get(i.categorieId) ?? null : null),
        }));
        this.categories.set(categories.sort((a, b) => a.nom.localeCompare(b.nom, 'fr')));
        this.ingredients.set(this.trier(enrichis));
        this.chargement.set(false);
      },
      error: () => {
        this.erreur.set(true);
        this.chargement.set(false);
      },
    });
  }

  effacerFiltres(): void {
    this.recherche.set('');
    this.uniteFiltre.set(null);
    this.categorieFiltre.set(null);
    this.pageDemandee.set(0);
  }

  async nouveau(): Promise<void> {
    const ingredient = await this.ouvrirDialogue({});
    if (ingredient) {
      const cat = this.categories().find((c) => c.id === ingredient.categorieId);
      const enrichi: IngredientResponse = {
        ...ingredient,
        categorieNom: ingredient.categorieNom || cat?.nom || null,
      };
      this.ingredients.update((liste) => this.trier([...liste, enrichi]));
      this.notification.succes(`L'ingrédient « ${ingredient.nom} » est créé.`);
    }
  }

  async modifier(ingredient: IngredientResponse): Promise<void> {
    const resultat = await this.ouvrirDialogue({ ingredient });
    if (resultat) {
      const cat = this.categories().find((c) => c.id === resultat.categorieId);
      const enrichi: IngredientResponse = {
        ...resultat,
        categorieNom: resultat.categorieNom || cat?.nom || null,
      };
      this.ingredients.update((liste) =>
        this.trier(liste.map((i) => (i.id === enrichi.id ? enrichi : i))),
      );
      this.notification.succes(`L'ingrédient « ${resultat.nom} » est enregistré.`);
    }
  }

  async gererRayons(): Promise<void> {
    const fenetre = this.dialog.open<
      CategoriesIngredientsDialog,
      DonneesCategoriesIngredientsDialog,
      CategorieIngredientResponse[]
    >(CategoriesIngredientsDialog, {
      data: {
        categories: this.categories(),
        ingredients: this.ingredients(),
      },
      width: '680px',
      maxWidth: 'calc(100vw - 2rem)',
    });

    const categoriesAjour = await firstValueFrom(fenetre.afterClosed());
    if (categoriesAjour) {
      this.categories.set(categoriesAjour);
      // Re-synchronisation des noms de catégories
      const catMap = new Map(categoriesAjour.map((c) => [c.id, c.nom]));
      this.ingredients.update((liste) =>
        liste.map((i) => ({
          ...i,
          categorieNom: i.categorieId ? catMap.get(i.categorieId) ?? null : null,
        })),
      );
    }
  }

  async supprimer(ingredient: IngredientResponse): Promise<void> {
    const confirme = await this.confirmation.demander({
      titre: `Supprimer l'ingrédient « ${ingredient.nom} » ?`,
      message:
        "Il ne sera plus proposé aux auteurs. Les recettes qui l'utilisent déjà ne sont pas modifiées.",
      texteConfirmer: "Supprimer l'ingrédient",
      danger: true,
    });
    if (!confirme) {
      return;
    }
    this.ingredientService.supprimer(ingredient.id).subscribe({
      next: () => {
        this.ingredients.update((liste) => liste.filter((i) => i.id !== ingredient.id));
        this.notification.succes(`L'ingrédient « ${ingredient.nom} » est supprimé.`);
      },
    });
  }

  private ouvrirDialogue(
    donnees: DonneesIngredientDialog,
  ): Promise<IngredientResponse | undefined> {
    const fenetre = this.dialog.open<IngredientDialog, DonneesIngredientDialog, IngredientResponse>(
      IngredientDialog,
      { data: donnees, width: '600px', maxWidth: 'calc(100vw - 2rem)' },
    );
    return firstValueFrom(fenetre.afterClosed());
  }

  private trier(ingredients: IngredientResponse[]): IngredientResponse[] {
    return [...ingredients].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  }
}
