import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDivider } from '@angular/material/divider';
import { MatFormField, MatLabel, MatPrefix, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { catchError, debounceTime, distinctUntilChanged, map, of, switchMap, tap } from 'rxjs';
import { PageResponse } from '../../../../core/models/page-response.model';
import { AValiderService } from '../../../../core/services/a-valider.service';
import { ConfirmationService } from '../../../../core/services/confirmation.service';
import { EcranService } from '../../../../core/services/ecran.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { SessionService } from '../../../../core/services/session.service';
import {
  FiltreStatuts,
  OptionStatut,
  TonStatut,
} from '../../../../shared/components/filtre-statuts/filtre-statuts';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { DepuisPipe } from '../../../../shared/pipes/depuis.pipe';
import { FichierPipe } from '../../../../shared/pipes/fichier.pipe';
import { CategorieResponse } from '../../../categories/models/categorie.model';
import { CategorieService } from '../../../categories/services/categorie.service';
import { Statistiques } from '../../../tableau-de-bord/models/statistiques.model';
import { StatistiquesService } from '../../../tableau-de-bord/services/statistiques.service';
import {
  FiltresRecettes,
  RecetteResponse,
  StatutRecette,
  TriRecette,
  nomsCategories,
} from '../../models/recette.model';
import { RecetteService } from '../../services/recette.service';

type FiltreStatut = StatutRecette | 'TOUTES';

interface Onglet {
  valeur: FiltreStatut;
  libelle: string;
  /** Compteur à lire dans les statistiques (absent pour « Toutes »). */
  compteur?: keyof Statistiques['recettes'];
  /** Tuile : couleur de la pastille, phrase d'aide, mise en avant quand il y a du travail. */
  ton?: TonStatut;
  aide?: string;
  prioritaire?: boolean;
}

/** Onglets de statut, dans l'ordre du travail de l'administrateur. */
const ONGLETS: Onglet[] = [
  {
    valeur: 'EN_ATTENTE_VALIDATION',
    libelle: 'À valider',
    compteur: 'enAttente',
    ton: 'attente',
    aide: 'attendent votre relecture',
    prioritaire: true,
  },
  {
    valeur: 'PUBLIEE',
    libelle: 'Publiées',
    compteur: 'publiees',
    ton: 'succes',
    aide: "dans l'application",
  },
  {
    valeur: 'REJETEE',
    libelle: 'Rejetées',
    compteur: 'rejetees',
    ton: 'erreur',
    aide: "à corriger par l'auteur",
  },
  {
    valeur: 'BROUILLON',
    libelle: 'Brouillons',
    compteur: 'brouillons',
    ton: 'neutre',
    aide: 'pas encore envoyées',
  },
  {
    valeur: 'ARCHIVEE',
    libelle: 'Archivées',
    compteur: 'archivees',
    ton: 'neutre',
    aide: "retirées de l'application",
  },
  { valeur: 'TOUTES', libelle: 'Toutes', ton: 'info', aide: 'toutes les recettes' },
];

const TRIS: { valeur: TriRecette; libelle: string }[] = [
  { valeur: 'RECENTES', libelle: 'Plus récentes' },
  { valeur: 'ANCIENNES', libelle: 'Plus anciennes' },
  { valeur: 'NOM_CROISSANT', libelle: 'Nom (A → Z)' },
  { valeur: 'NOM_DECROISSANT', libelle: 'Nom (Z → A)' },
];

const DIFFICULTES: Record<string, string> = {
  FACILE: 'Facile',
  MOYEN: 'Moyenne',
  DIFFICILE: 'Difficile',
};

const TAILLE_PAR_DEFAUT = 10;

/** Résultat d'un chargement de la liste. */
interface EtatListe {
  chargement: boolean;
  erreur: boolean;
  page: PageResponse<RecetteResponse> | null;
}

/**
 * Liste des recettes : l'outil principal de modération.
 *
 * Les filtres (statut, recherche, catégorie, tri, page) sont stockés dans l'adresse
 * (?statut=PUBLIEE&page=2...) : en revenant d'une fiche recette, on retrouve la liste telle qu'on l'a laissée.
 * Grâce à withComponentInputBinding(), ces paramètres arrivent directement dans les input() ci-dessous.
 */
@Component({
  imports: [
    FiltreStatuts,
    ReactiveFormsModule,
    RouterLink,
    DatePipe,
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
    MatTooltip,
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
    NgIcon,
    PageHeader,
    StatusBadge,
    EmptyState,
    DepuisPipe,
    FichierPipe,
  ],
  selector: 'app-recettes-liste',
  styleUrl: './recettes-liste.scss',
  templateUrl: './recettes-liste.html',
})
export class RecettesListe implements OnInit {
  protected readonly nomsCategories = nomsCategories;
  protected session = inject(SessionService);
  private recetteService = inject(RecetteService);
  private categorieService = inject(CategorieService);
  private statistiquesService = inject(StatistiquesService);
  private confirmation = inject(ConfirmationService);
  private notification = inject(NotificationService);
  private aValider = inject(AValiderService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  protected ecran = inject(EcranService);

  // ----- Paramètres de l'adresse (texte ou absents) -----
  readonly statut = input<string>();
  readonly recherche = input<string>();
  readonly categorie = input<string>();
  readonly tri = input<string>();
  readonly page = input<string>();
  readonly taille = input<string>();

  protected readonly onglets = ONGLETS;

  /** Tuiles de statut : le nombre d'éléments de chaque statut, et le filtre. « Tous » : le total. */
  protected optionsStatut = computed<OptionStatut[]>(() => {
    const options: OptionStatut[] = ONGLETS.map((o) => ({
      valeur: o.valeur,
      libelle: o.libelle,
      aide: o.aide,
      ton: o.ton,
      prioritaire: o.prioritaire,
      compte: this.compteur(o),
    }));
    // « Tous » n'a pas de compteur propre : c'est la somme des autres, quand ils sont tous connus
    const comptes = ONGLETS.filter((o) => o.compteur).map((o) => this.compteur(o));
    const total = comptes.every((c) => c !== null)
      ? comptes.reduce<number>((s, c) => s + (c ?? 0), 0)
      : null;
    return options.map((o, i) =>
      ONGLETS[i].compteur || o.ton !== 'info' ? o : { ...o, compte: total },
    );
  });
  protected readonly tris = TRIS;
  protected readonly difficultes = DIFFICULTES;

  // ----- Filtres lus depuis l'adresse, avec leurs valeurs par défaut -----
  protected statutActif = computed<FiltreStatut>(
    () =>
      ONGLETS.find((onglet) => onglet.valeur === this.statut())?.valeur ?? 'EN_ATTENTE_VALIDATION',
  );
  protected triActif = computed<TriRecette>(
    () => TRIS.find((tri) => tri.valeur === this.tri())?.valeur ?? 'RECENTES',
  );
  protected pageActive = computed(() => Math.max(Number(this.page() ?? 0) || 0, 0));
  protected tailleActive = computed(
    () => Number(this.taille() ?? TAILLE_PAR_DEFAUT) || TAILLE_PAR_DEFAUT,
  );
  protected filtresActifs = computed(() => !!this.recherche() || !!this.categorie());

  /** Incrémenté pour forcer un rechargement (après une validation par exemple). */
  private rechargement = signal(0);

  private filtres = computed<FiltresRecettes & { rechargement: number }>(() => ({
    statut: this.statutActif() === 'TOUTES' ? undefined : (this.statutActif() as StatutRecette),
    recherche: this.recherche(),
    categorieId: this.categorie(),
    tri: this.triActif(),
    page: this.pageActive(),
    taille: this.tailleActive(),
    rechargement: this.rechargement(),
  }));

  protected etat = signal<EtatListe>({ chargement: true, erreur: false, page: null });
  protected recettes = computed(() => this.etat().page?.contenu ?? []);

  protected statistiques = signal<Statistiques | null>(null);
  protected categories = signal<CategorieResponse[]>([]);

  /** Recette dont une action est en cours (ses boutons sont désactivés : pas de double envoi). */
  protected actionEnCours = signal<string | null>(null);

  /** Affichage : galerie de photos (par défaut) ou tableau ; retenu sur ce navigateur. */
  protected vue = signal<'galerie' | 'liste'>(RecettesListe.lireVue());

  private static lireVue(): 'galerie' | 'liste' {
    try {
      return localStorage.getItem('gw-recettes-vue') === 'liste' ? 'liste' : 'galerie';
    } catch {
      return 'galerie';
    }
  }

  changerVue(vue: 'galerie' | 'liste'): void {
    this.vue.set(vue);
    try {
      localStorage.setItem('gw-recettes-vue', vue);
    } catch {
      // Stockage indisponible (navigation privée) : le choix vaut pour cette visite
    }
  }

  /** Colonnes affichées selon la largeur de l'écran. */
  protected colonnes = computed(() =>
    this.ecran.tablette()
      ? ['recette', 'date', 'statut', 'actions']
      : ['recette', 'auteur', 'details', 'date', 'statut', 'actions'],
  );

  protected champRecherche = new FormControl('', { nonNullable: true });
  protected lignesSquelette = [1, 2, 3, 4, 5];

  constructor() {
    // Chaque changement de filtre relance la recherche. switchMap annule la requête précédente
    // si l'utilisateur change de filtre avant la réponse (pas de résultat « en retard »).
    toObservable(this.filtres)
      .pipe(
        tap(() => this.etat.update((etat) => ({ ...etat, chargement: true, erreur: false }))),
        switchMap(({ rechargement, ...filtres }) =>
          this.recetteService.rechercher(filtres).pipe(
            map((page): EtatListe => ({ chargement: false, erreur: false, page })),
            catchError(() => of<EtatListe>({ chargement: false, erreur: true, page: null })),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((etat) => this.etat.set(etat));

    // Recherche : on attend que l'utilisateur ait fini de taper (350 ms) avant de chercher
    this.champRecherche.valueChanges
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((texte) => this.naviguer({ recherche: texte.trim() || null, page: null }));

    // Le champ suit l'adresse (bouton « précédent » du navigateur, « Effacer les filtres »...)
    effect(() => this.champRecherche.setValue(this.recherche() ?? '', { emitEvent: false }));
  }

  ngOnInit(): void {
    this.chargerStatistiques();
    this.categorieService.getAll().subscribe({
      next: (categories) => this.categories.set(categories),
      error: () => this.categories.set([]),
    });
  }

  // ----- Filtres -----

  changerStatut(statut: FiltreStatut): void {
    this.naviguer({ statut, page: null });
  }

  changerCategorie(categorieId: string | null): void {
    this.naviguer({ categorie: categorieId, page: null });
  }

  changerTri(tri: TriRecette): void {
    this.naviguer({ tri: tri === 'RECENTES' ? null : tri, page: null });
  }

  changerPage(evenement: PageEvent): void {
    this.naviguer({
      page: evenement.pageIndex || null,
      taille: evenement.pageSize === TAILLE_PAR_DEFAUT ? null : evenement.pageSize,
    });
  }

  effacerFiltres(): void {
    this.naviguer({ recherche: null, categorie: null, page: null });
  }

  recharger(): void {
    this.rechargement.update((valeur) => valeur + 1);
  }

  /** Nombre affiché dans un onglet (null si inconnu). */
  protected compteur(onglet: Onglet): number | null {
    const recettes = this.statistiques()?.recettes;
    return onglet.compteur && recettes ? recettes[onglet.compteur] : null;
  }

  protected libelleStatut(): string {
    return (
      ONGLETS.find((onglet) => onglet.valeur === this.statutActif())?.libelle.toLowerCase() ?? ''
    );
  }

  // ----- Actions de modération -----

  async valider(recette: RecetteResponse): Promise<void> {
    const confirme = await this.confirmation.demander({
      titre: `Publier « ${recette.nom} » ?`,
      message:
        'La recette sera visible par tous les utilisateurs de Gwaso, sur l’application et le site.',
      texteConfirmer: 'Publier la recette',
    });
    if (!confirme) {
      return;
    }
    this.actionEnCours.set(recette.id);
    this.recetteService.valider(recette.id).subscribe({
      next: () => this.apresAction(`« ${recette.nom} » est maintenant publiée.`),
      error: () => this.actionEnCours.set(null),
    });
  }

  async rejeter(recette: RecetteResponse): Promise<void> {
    const motif = await this.confirmation.demanderMotif({
      titre: `Rejeter « ${recette.nom} » ?`,
      message:
        "La recette ne sera pas publiée. L'auteur pourra la corriger et la soumettre à nouveau.",
      libelle: 'Motif du rejet',
      aide: "Ce message sera montré à l'auteur : soyez précis et bienveillant.",
      texteConfirmer: 'Rejeter la recette',
    });
    if (!motif) {
      return;
    }
    this.actionEnCours.set(recette.id);
    this.recetteService.rejeter(recette.id, motif).subscribe({
      next: () => this.apresAction(`« ${recette.nom} » a été rejetée. L'auteur verra votre motif.`),
      error: () => this.actionEnCours.set(null),
    });
  }

  async supprimer(recette: RecetteResponse): Promise<void> {
    const confirme = await this.confirmation.demander({
      titre: `Supprimer « ${recette.nom} » ?`,
      message: 'La recette disparaîtra de Gwaso. Ses avis et favoris ne seront plus visibles.',
      texteConfirmer: 'Supprimer',
      danger: true,
    });
    if (!confirme) {
      return;
    }
    this.actionEnCours.set(recette.id);
    this.recetteService.supprimer(recette.id).subscribe({
      next: () => this.apresAction(`« ${recette.nom} » a été supprimée.`),
      error: () => this.actionEnCours.set(null),
    });
  }

  private apresAction(message: string): void {
    this.actionEnCours.set(null);
    this.notification.succes(message);
    this.recharger();
    this.chargerStatistiques();
    this.aValider.rafraichir();
  }

  private chargerStatistiques(): void {
    this.statistiquesService.getStatistiques().subscribe({
      next: (statistiques) => this.statistiques.set(statistiques),
      error: () => this.statistiques.set(null),
    });
  }

  /** Met à jour l'adresse ; null retire le paramètre. La liste se recharge toute seule. */
  private naviguer(parametres: Record<string, string | number | null>): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: parametres,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
