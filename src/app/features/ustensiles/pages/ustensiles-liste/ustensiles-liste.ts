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
  DonneesUstensileDialog,
  UstensileDialog,
} from '../../components/ustensile-dialog/ustensile-dialog';
import { UstensileResponse } from '../../models/ustensile.model';
import { UstensileService } from '../../services/ustensile.service';

/** Ustensiles de cuisine : même présentation que les catégories (répétition, CRAP). */
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
  selector: 'app-ustensiles-liste',
  styleUrl: './ustensiles-liste.scss',
  templateUrl: './ustensiles-liste.html',
})
export class UstensilesListe implements OnInit {
  private ustensileService = inject(UstensileService);
  private dialog = inject(MatDialog);
  private confirmation = inject(ConfirmationService);
  private notification = inject(NotificationService);
  protected ecran = inject(EcranService);

  protected ustensiles = signal<UstensileResponse[]>([]);
  protected chargement = signal(true);
  protected erreur = signal(false);
  protected recherche = signal('');

  protected ustensilesFiltres = computed(() => {
    const terme = this.recherche().trim().toLowerCase();
    return terme
      ? this.ustensiles().filter(
          (u) =>
            u.nom.toLowerCase().includes(terme) ||
            (u.description ?? '').toLowerCase().includes(terme),
        )
      : this.ustensiles();
  });

  // ----- Pagination de la grille (12 cartes = des rangées complètes de 2, 3, 4 ou 6) -----
  protected readonly taillesPage = [12, 24, 48];
  private pageDemandee = signal(0);
  protected taille = signal(12);
  protected page = computed(() =>
    pageValide(this.pageDemandee(), this.taille(), this.ustensilesFiltres().length),
  );
  protected elementsPage = computed(() =>
    pageDe(this.ustensilesFiltres(), this.page(), this.taille()),
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

  protected cartesSquelette = [1, 2, 3, 4, 5, 6, 7, 8];

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set(false);
    this.ustensileService.getAll().subscribe({
      next: (ustensiles) => {
        this.ustensiles.set(this.trier(ustensiles));
        this.chargement.set(false);
      },
      error: () => {
        this.erreur.set(true);
        this.chargement.set(false);
      },
    });
  }

  async nouveau(): Promise<void> {
    const ustensile = await this.ouvrirDialogue({});
    if (ustensile) {
      this.ustensiles.update((liste) => this.trier([...liste, ustensile]));
      this.notification.succes(`L'ustensile « ${ustensile.nom} » est créé.`);
    }
  }

  async modifier(ustensile: UstensileResponse): Promise<void> {
    const resultat = await this.ouvrirDialogue({ ustensile });
    if (resultat) {
      this.ustensiles.update((liste) =>
        this.trier(liste.map((u) => (u.id === resultat.id ? resultat : u))),
      );
      this.notification.succes(`L'ustensile « ${resultat.nom} » est enregistré.`);
    }
  }

  async supprimer(ustensile: UstensileResponse): Promise<void> {
    const confirme = await this.confirmation.demander({
      titre: `Supprimer l'ustensile « ${ustensile.nom} » ?`,
      message:
        "Il ne sera plus proposé dans les étapes des recettes. Les étapes qui l'utilisent déjà ne sont pas modifiées.",
      texteConfirmer: "Supprimer l'ustensile",
      danger: true,
    });
    if (!confirme) {
      return;
    }
    this.ustensileService.supprimer(ustensile.id).subscribe({
      next: () => {
        this.ustensiles.update((liste) => liste.filter((u) => u.id !== ustensile.id));
        this.notification.succes(`L'ustensile « ${ustensile.nom} » est supprimé.`);
      },
    });
  }

  private ouvrirDialogue(donnees: DonneesUstensileDialog): Promise<UstensileResponse | undefined> {
    const fenetre = this.dialog.open<UstensileDialog, DonneesUstensileDialog, UstensileResponse>(
      UstensileDialog,
      {
        data: donnees,
        width: '560px',
        maxWidth: 'calc(100vw - 2rem)',
      },
    );
    return firstValueFrom(fenetre.afterClosed());
  }

  private trier(ustensiles: UstensileResponse[]): UstensileResponse[] {
    return [...ustensiles].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  }
}
