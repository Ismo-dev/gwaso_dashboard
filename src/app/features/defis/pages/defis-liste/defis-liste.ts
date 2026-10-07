import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormField, MatLabel, MatPrefix, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { catchError, debounceTime, distinctUntilChanged, map, of, switchMap, tap } from 'rxjs';
import { PageResponse } from '../../../../core/models/page-response.model';
import { AValiderService } from '../../../../core/services/a-valider.service';
import { EcranService } from '../../../../core/services/ecran.service';
import { FiltreStatuts, OptionStatut, TonStatut } from '../../../../shared/components/filtre-statuts/filtre-statuts';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { FichierPipe } from '../../../../shared/pipes/fichier.pipe';
import { Statistiques } from '../../../tableau-de-bord/models/statistiques.model';
import { StatistiquesService } from '../../../tableau-de-bord/services/statistiques.service';
import { DefiResponse, FiltresDefis, StatutDefi } from '../../models/defi.model';
import { TypesDefiDialog } from '../../components/types-defi-dialog/types-defi-dialog';
import { DefiService } from '../../services/defi.service';

type FiltreStatut = StatutDefi | 'TOUS';

interface Onglet {
  valeur: FiltreStatut;
  libelle: string;
  compteur?: keyof Statistiques['defis'];
  /** Tuile : couleur de la pastille, phrase d'aide, mise en avant quand il y a du travail. */
  ton?: TonStatut;
  aide?: string;
  prioritaire?: boolean;
}

/** Onglets dans l'ordre de vie d'un défi : d'abord les propositions des chefs à examiner. */
const ONGLETS: Onglet[] = [
  { valeur: 'PROPOSE', libelle: 'À valider', compteur: 'proposes', ton: 'attente', aide: "proposés par les chefs", prioritaire: true },
  { valeur: 'VALIDE', libelle: 'À venir', compteur: 'valides', ton: 'info', aide: "validés, pas encore ouverts" },
  { valeur: 'EN_COURS', libelle: 'En cours', compteur: 'enCours', ton: 'succes', aide: "ouverts aux participants" },
  { valeur: 'TERMINE', libelle: 'Terminés', compteur: 'termines', ton: 'neutre', aide: "clos, classement à publier" },
  { valeur: 'REJETE', libelle: 'Refusés', ton: 'erreur', aide: "refusés" },
  { valeur: 'ANNULE', libelle: 'Annulés', ton: 'neutre', aide: "annulés" },
  { valeur: 'TOUS', libelle: 'Tous', ton: 'info', aide: "tous les défis" },
];

const TAILLES = [10, 20, 50];

interface EtatListe {
  chargement: boolean;
  erreur: boolean;
  page: PageResponse<DefiResponse> | null;
}

/**
 * Défis culinaires : examiner les propositions des chefs, suivre les défis en cours,
 * et créer ses propres défis. Filtres dans l'adresse, comme les autres listes.
 */
@Component({
  imports: [
    FiltreStatuts,
    ReactiveFormsModule,
    RouterLink,
    DatePipe,
    MatButton,
    MatIconButton,
    MatFormField,
    MatLabel,
    MatPrefix,
    MatSuffix,
    MatInput,
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
    EmptyState,
    StatusBadge,
    FichierPipe,
  ],
  selector: 'app-defis-liste',
  styleUrl: './defis-liste.scss',
  templateUrl: './defis-liste.html',
})
export class DefisListe implements OnInit {
  private defiService = inject(DefiService);
  private statistiquesService = inject(StatistiquesService);
  private aValider = inject(AValiderService);
  private router = inject(Router);
  private dialog = inject(MatDialog);
  private route = inject(ActivatedRoute);
  protected ecran = inject(EcranService);

  readonly statut = input<string>();
  readonly recherche = input<string>();
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
    const total = comptes.every((c) => c !== null) ? comptes.reduce<number>((s, c) => s + (c ?? 0), 0) : null;
    return options.map((o, i) => (ONGLETS[i].compteur || o.ton !== 'info' ? o : { ...o, compte: total }));
  });
  protected readonly tailles = TAILLES;

  protected statutActif = computed<FiltreStatut>(
    () => ONGLETS.find((o) => o.valeur === this.statut())?.valeur ?? 'PROPOSE',
  );
  protected pageActive = computed(() => Math.max(Number(this.page() ?? 0) || 0, 0));
  protected tailleActive = computed(() => Number(this.taille() ?? TAILLES[0]) || TAILLES[0]);

  private rechargement = signal(0);
  private filtres = computed<FiltresDefis & { rechargement: number }>(() => ({
    statut: this.statutActif() === 'TOUS' ? undefined : (this.statutActif() as StatutDefi),
    recherche: this.recherche(),
    page: this.pageActive(),
    taille: this.tailleActive(),
    rechargement: this.rechargement(),
  }));

  protected etat = signal<EtatListe>({ chargement: true, erreur: false, page: null });
  protected defis = computed(() => this.etat().page?.contenu ?? []);
  protected statistiques = signal<Statistiques | null>(null);

  protected colonnes = computed(() =>
    this.ecran.tablette()
      ? ['defi', 'periode', 'statut', 'actions']
      : ['defi', 'auteur', 'periode', 'statut', 'actions'],
  );

  protected champRecherche = new FormControl('', { nonNullable: true });
  protected lignesSquelette = [1, 2, 3, 4, 5];

  constructor() {
    toObservable(this.filtres)
      .pipe(
        tap(() => this.etat.update((e) => ({ ...e, chargement: true, erreur: false }))),
        switchMap(({ rechargement, ...filtres }) =>
          this.defiService.rechercher(filtres).pipe(
            map((page): EtatListe => ({ chargement: false, erreur: false, page })),
            catchError(() => of<EtatListe>({ chargement: false, erreur: true, page: null })),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((etat) => this.etat.set(etat));

    this.champRecherche.valueChanges
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((texte) => this.naviguer({ recherche: texte.trim() || null, page: null }));

    effect(() => this.champRecherche.setValue(this.recherche() ?? '', { emitEvent: false }));
  }

  ngOnInit(): void {
    this.statistiquesService.getStatistiques().subscribe({
      next: (statistiques) => {
        this.statistiques.set(statistiques);
        this.aValider.mettreAJour(statistiques.aValider);
      },
      error: () => this.statistiques.set(null),
    });
  }

  protected compteur(onglet: Onglet): number | null {
    const defis = this.statistiques()?.defis;
    return onglet.compteur && defis ? defis[onglet.compteur] : null;
  }

  /** « Dans 3 jours », « Encore 5 jours », « Terminé »... selon les dates du défi. */
  protected echeance(defi: DefiResponse): string {
    const jour = 24 * 60 * 60 * 1000;
    const aujourdhui = new Date(new Date().toDateString()).getTime();
    const debut = new Date(defi.dateDebut + 'T00:00:00').getTime();
    const fin = new Date(defi.dateFin + 'T00:00:00').getTime();
    if (aujourdhui < debut) {
      const n = Math.round((debut - aujourdhui) / jour);
      return n === 1 ? 'Commence demain' : `Commence dans ${n} jours`;
    }
    if (aujourdhui <= fin) {
      const n = Math.round((fin - aujourdhui) / jour);
      return n === 0 ? "Se termine aujourd'hui" : `Encore ${n} jour${n > 1 ? 's' : ''}`;
    }
    return 'Période terminée';
  }

  changerStatut(statut: FiltreStatut): void {
    this.naviguer({ statut, page: null });
  }

  changerPage(evenement: PageEvent): void {
    this.naviguer({
      page: evenement.pageIndex || null,
      taille: evenement.pageSize === TAILLES[0] ? null : evenement.pageSize,
    });
  }

  /** Types de défi : « Recette imposée », « Plat libre », « Devinette »... */
  gererTypes(): void {
    this.dialog.open(TypesDefiDialog, { width: '640px', maxWidth: 'calc(100vw - 32px)', autoFocus: false });
  }

  recharger(): void {
    this.rechargement.update((v) => v + 1);
  }

  private naviguer(parametres: Record<string, string | number | null>): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: parametres,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
