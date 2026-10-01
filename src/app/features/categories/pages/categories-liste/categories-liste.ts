import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormField, MatLabel, MatPrefix, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { NgIcon } from '@ng-icons/core';
import { firstValueFrom } from 'rxjs';
import { ConfirmationService } from '../../../../core/services/confirmation.service';
import { EcranService } from '../../../../core/services/ecran.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { pageDe, pageValide } from '../../../../core/utils/pagination';
import { CarteCatalogue } from '../../../../shared/components/carte-catalogue/carte-catalogue';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import {
  CategorieDialog,
  DonneesCategorieDialog,
} from '../../components/categorie-dialog/categorie-dialog';
import { CategorieResponse } from '../../models/categorie.model';
import { CategorieService } from '../../services/categorie.service';

/** Catégories de recettes : grille visuelle, recherche, création et modification en boîte de dialogue. */
@Component({
  imports: [
    FormsModule,
    MatButton,
    MatIconButton,
    MatFormField,
    MatLabel,
    MatPrefix,
    MatSuffix,
    MatInput,
    MatPaginator,
    NgIcon,
    PageHeader,
    EmptyState,
    CarteCatalogue,
  ],
  selector: 'app-categories-liste',
  styleUrl: './categories-liste.scss',
  templateUrl: './categories-liste.html',
})
export class CategoriesListe implements OnInit {
  private categorieService = inject(CategorieService);
  private dialog = inject(MatDialog);
  private confirmation = inject(ConfirmationService);
  private notification = inject(NotificationService);
  protected ecran = inject(EcranService);

  protected categories = signal<CategorieResponse[]>([]);
  protected chargement = signal(true);
  protected erreur = signal(false);
  protected recherche = signal('');

  /** Filtre local : le catalogue est petit, inutile d'interroger le serveur à chaque lettre. */
  protected categoriesFiltrees = computed(() => {
    const terme = this.recherche().trim().toLowerCase();
    return terme
      ? this.categories().filter(
          (c) =>
            c.nom.toLowerCase().includes(terme) ||
            (c.description ?? '').toLowerCase().includes(terme),
        )
      : this.categories();
  });

  // ----- Pagination de la grille (12 cartes = des rangées complètes de 2, 3, 4 ou 6) -----
  protected readonly taillesPage = [12, 24, 48];
  private pageDemandee = signal(0);
  protected taille = signal(12);
  protected page = computed(() =>
    pageValide(this.pageDemandee(), this.taille(), this.categoriesFiltrees().length),
  );
  protected elementsPage = computed(() =>
    pageDe(this.categoriesFiltrees(), this.page(), this.taille()),
  );

  /** Une nouvelle recherche ramène à la première page. */
  rechercher(texte: string): void {
    this.recherche.set(texte);
    this.pageDemandee.set(0);
  }

  changerPage(evenement: PageEvent): void {
    this.taille.set(evenement.pageSize);
    this.pageDemandee.set(evenement.pageIndex);
  }

  protected cartesSquelette = [1, 2, 3, 4, 5, 6];

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set(false);
    this.categorieService.getAll().subscribe({
      next: (categories) => {
        this.categories.set(this.trier(categories));
        this.chargement.set(false);
      },
      error: () => {
        this.erreur.set(true);
        this.chargement.set(false);
      },
    });
  }

  async nouvelle(): Promise<void> {
    const categorie = await this.ouvrirDialogue({});
    if (categorie) {
      this.categories.update((liste) => this.trier([...liste, categorie]));
      this.notification.succes(`La catégorie « ${categorie.nom} » est créée.`);
    }
  }

  async modifier(categorie: CategorieResponse): Promise<void> {
    const resultat = await this.ouvrirDialogue({ categorie });
    if (resultat) {
      this.categories.update((liste) =>
        this.trier(liste.map((c) => (c.id === resultat.id ? resultat : c))),
      );
      this.notification.succes(`La catégorie « ${resultat.nom} » est enregistrée.`);
    }
  }

  async supprimer(categorie: CategorieResponse): Promise<void> {
    const confirme = await this.confirmation.demander({
      titre: `Supprimer la catégorie « ${categorie.nom} » ?`,
      message:
        'Elle ne sera plus proposée aux auteurs. Les recettes déjà classées dedans ne sont pas supprimées.',
      texteConfirmer: 'Supprimer la catégorie',
      danger: true,
    });
    if (!confirme) {
      return;
    }
    this.categorieService.supprimer(categorie.id).subscribe({
      next: () => {
        this.categories.update((liste) => liste.filter((c) => c.id !== categorie.id));
        this.notification.succes(`La catégorie « ${categorie.nom} » est supprimée.`);
      },
    });
  }

  private ouvrirDialogue(donnees: DonneesCategorieDialog): Promise<CategorieResponse | undefined> {
    const fenetre = this.dialog.open<CategorieDialog, DonneesCategorieDialog, CategorieResponse>(
      CategorieDialog,
      {
        data: donnees,
        width: '560px',
        maxWidth: 'calc(100vw - 2rem)',
      },
    );
    return firstValueFrom(fenetre.afterClosed());
  }

  private trier(categories: CategorieResponse[]): CategorieResponse[] {
    return [...categories].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  }
}
