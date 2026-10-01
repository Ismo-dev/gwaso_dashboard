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
import { firstValueFrom } from 'rxjs';
import { ConfirmationService } from '../../../../core/services/confirmation.service';
import { EcranService } from '../../../../core/services/ecran.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { pageDe, pageValide, TAILLES_PAGE } from '../../../../core/utils/pagination';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { FichierPipe } from '../../../../shared/pipes/fichier.pipe';
import { UnitePipe } from '../../../../shared/pipes/unite.pipe';
import {
  DonneesIngredientDialog,
  IngredientDialog,
} from '../../components/ingredient-dialog/ingredient-dialog';
import { IngredientResponse, Unite, UNITES } from '../../models/ingredient.model';
import { IngredientService } from '../../services/ingredient.service';

/**
 * Ingrédients : liste en lignes alignées (photo, nom, unité, prix), car ici le prix
 * et l'unité comptent autant que l'image.
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
    FichierPipe,
    UnitePipe,
  ],
  selector: 'app-ingredients-liste',
  styleUrl: './ingredients-liste.scss',
  templateUrl: './ingredients-liste.html',
})
export class IngredientsListe implements OnInit {
  private ingredientService = inject(IngredientService);
  private dialog = inject(MatDialog);
  private confirmation = inject(ConfirmationService);
  private notification = inject(NotificationService);
  protected ecran = inject(EcranService);

  protected readonly unites = UNITES;

  protected ingredients = signal<IngredientResponse[]>([]);
  protected chargement = signal(true);
  protected erreur = signal(false);
  protected recherche = signal('');
  protected uniteFiltre = signal<Unite | null>(null);

  protected ingredientsFiltres = computed(() => {
    const terme = this.recherche().trim().toLowerCase();
    const unite = this.uniteFiltre();
    return this.ingredients().filter(
      (i) => (!terme || i.nom.toLowerCase().includes(terme)) && (!unite || i.unite === unite),
    );
  });

  protected filtresActifs = computed(() => !!this.recherche().trim() || !!this.uniteFiltre());
  /** Ingrédients sans prix : à compléter pour que l'estimation du budget des recettes soit juste. */
  protected sansPrix = computed(
    () => this.ingredients().filter((i) => i.prixMin === null && i.prixMax === null).length,
  );

  // ----- Pagination (la liste est chargée en entier, on la découpe ici) -----
  protected readonly taillesPage = TAILLES_PAGE;
  protected readonly colonnes = ['ingredient', 'unite', 'prix', 'actions'];
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

  // Un nouveau filtre ramène toujours à la première page
  rechercher(texte: string): void {
    this.recherche.set(texte);
    this.pageDemandee.set(0);
  }

  filtrerUnite(unite: Unite | null): void {
    this.uniteFiltre.set(unite);
    this.pageDemandee.set(0);
  }

  changerPage(evenement: PageEvent): void {
    this.taille.set(evenement.pageSize);
    this.pageDemandee.set(evenement.pageIndex);
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set(false);
    this.ingredientService.getAll().subscribe({
      next: (ingredients) => {
        this.ingredients.set(this.trier(ingredients));
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
    this.pageDemandee.set(0);
  }

  async nouveau(): Promise<void> {
    const ingredient = await this.ouvrirDialogue({});
    if (ingredient) {
      this.ingredients.update((liste) => this.trier([...liste, ingredient]));
      this.notification.succes(`L'ingrédient « ${ingredient.nom} » est créé.`);
    }
  }

  async modifier(ingredient: IngredientResponse): Promise<void> {
    const resultat = await this.ouvrirDialogue({ ingredient });
    if (resultat) {
      this.ingredients.update((liste) =>
        this.trier(liste.map((i) => (i.id === resultat.id ? resultat : i))),
      );
      this.notification.succes(`L'ingrédient « ${resultat.nom} » est enregistré.`);
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
