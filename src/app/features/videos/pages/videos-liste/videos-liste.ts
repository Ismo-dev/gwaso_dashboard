import { Component, computed, effect, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatFormField, MatLabel, MatPrefix, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatOption, MatSelect } from '@angular/material/select';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { catchError, debounceTime, distinctUntilChanged, map, of, switchMap, tap } from 'rxjs';
import { PageResponse } from '../../../../core/models/page-response.model';
import { AValiderService } from '../../../../core/services/a-valider.service';
import { FiltreStatuts, OptionStatut, TonStatut } from '../../../../shared/components/filtre-statuts/filtre-statuts';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { Statistiques } from '../../../tableau-de-bord/models/statistiques.model';
import { StatistiquesService } from '../../../tableau-de-bord/services/statistiques.service';
import { CarteVideo } from '../../components/carte-video/carte-video';
import {
  FiltresVideos,
  LIBELLES_TYPE_VIDEO,
  StatutVideo,
  TypeVideo,
  VideoResponse,
} from '../../models/video.model';
import { ModerationVideo } from '../../services/moderation-video';
import { VideoService } from '../../services/video.service';

type FiltreStatut = StatutVideo | 'TOUTES';

interface Onglet {
  valeur: FiltreStatut;
  libelle: string;
  compteur?: keyof Statistiques['videos'];
  /** Tuile : couleur de la pastille, phrase d'aide, mise en avant quand il y a du travail. */
  ton?: TonStatut;
  aide?: string;
  prioritaire?: boolean;
}

/** Onglets dans l'ordre du travail de l'administrateur : d'abord ce qui attend une décision. */
const ONGLETS: Onglet[] = [
  { valeur: 'EN_ATTENTE_VALIDATION', libelle: 'À valider', compteur: 'enAttente', ton: 'attente', aide: "attendent votre décision", prioritaire: true },
  { valeur: 'PUBLIEE', libelle: 'Publiées', compteur: 'publiees', ton: 'succes', aide: "visibles par tous" },
  { valeur: 'DESACTIVEE', libelle: 'Retirées', compteur: 'desactivees', ton: 'neutre', aide: "retirées après publication" },
  { valeur: 'REJETEE', libelle: 'Refusées', compteur: 'rejetees', ton: 'erreur', aide: "refusées à la modération" },
  { valeur: 'BROUILLON', libelle: 'Brouillons', compteur: 'brouillons', ton: 'neutre', aide: "pas encore envoyées" },
  { valeur: 'TOUTES', libelle: 'Toutes', ton: 'info', aide: "toutes les vidéos" },
];

const TAILLES = [12, 24, 48];

interface EtatListe {
  chargement: boolean;
  erreur: boolean;
  page: PageResponse<VideoResponse> | null;
}

/**
 * Vidéos de la communauté : l'admin vérifie que c'est bien de la cuisine avant de publier.
 * Filtres (statut, recherche, type, page) dans l'adresse, comme pour les recettes.
 */
@Component({
  imports: [
    FiltreStatuts,
    ReactiveFormsModule,
    RouterLink,
    MatButton,
    MatIconButton,
    MatFormField,
    MatLabel,
    MatPrefix,
    MatSuffix,
    MatInput,
    MatSelect,
    MatOption,
    MatPaginator,
    NgIcon,
    PageHeader,
    EmptyState,
    CarteVideo,
  ],
  selector: 'app-videos-liste',
  styleUrl: './videos-liste.scss',
  templateUrl: './videos-liste.html',
})
export class VideosListe implements OnInit {
  private videoService = inject(VideoService);
  private statistiquesService = inject(StatistiquesService);
  private moderation = inject(ModerationVideo);
  private aValider = inject(AValiderService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  // ----- Paramètres de l'adresse -----
  readonly statut = input<string>();
  readonly recherche = input<string>();
  readonly type = input<string>();
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
  protected readonly types = Object.entries(LIBELLES_TYPE_VIDEO) as [TypeVideo, string][];

  protected statutActif = computed<FiltreStatut>(
    () => ONGLETS.find((o) => o.valeur === this.statut())?.valeur ?? 'EN_ATTENTE_VALIDATION',
  );
  protected typeActif = computed(() => this.types.find(([t]) => t === this.type())?.[0] ?? null);
  protected pageActive = computed(() => Math.max(Number(this.page() ?? 0) || 0, 0));
  protected tailleActive = computed(() => Number(this.taille() ?? TAILLES[0]) || TAILLES[0]);
  protected filtresActifs = computed(() => !!this.recherche() || !!this.typeActif());

  private rechargement = signal(0);
  private filtres = computed<FiltresVideos & { rechargement: number }>(() => ({
    statut: this.statutActif() === 'TOUTES' ? undefined : (this.statutActif() as StatutVideo),
    recherche: this.recherche(),
    type: this.typeActif() ?? undefined,
    page: this.pageActive(),
    taille: this.tailleActive(),
    rechargement: this.rechargement(),
  }));

  protected etat = signal<EtatListe>({ chargement: true, erreur: false, page: null });
  protected videos = computed(() => this.etat().page?.contenu ?? []);
  protected statistiques = signal<Statistiques | null>(null);
  protected actionEnCours = signal<string | null>(null);

  protected champRecherche = new FormControl('', { nonNullable: true });
  protected cartesSquelette = [1, 2, 3, 4, 5, 6, 7, 8];

  constructor() {
    // Chaque changement de filtre relance la recherche (switchMap annule la requête précédente)
    toObservable(this.filtres)
      .pipe(
        tap(() => this.etat.update((e) => ({ ...e, chargement: true, erreur: false }))),
        switchMap(({ rechargement, ...filtres }) =>
          this.videoService.rechercher(filtres).pipe(
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
    this.chargerStatistiques();
  }

  private chargerStatistiques(): void {
    this.statistiquesService.getStatistiques().subscribe({
      next: (statistiques) => {
        this.statistiques.set(statistiques);
        this.aValider.mettreAJour(statistiques.aValider);
      },
      error: () => this.statistiques.set(null),
    });
  }

  protected compteur(onglet: Onglet): number | null {
    const videos = this.statistiques()?.videos;
    return onglet.compteur && videos ? videos[onglet.compteur] : null;
  }

  protected libelleStatut(): string {
    return ONGLETS.find((o) => o.valeur === this.statutActif())?.libelle.toLowerCase() ?? '';
  }

  // ----- Filtres -----

  changerStatut(statut: FiltreStatut): void {
    this.naviguer({ statut, page: null });
  }

  changerType(type: TypeVideo | null): void {
    this.naviguer({ type, page: null });
  }

  changerPage(evenement: PageEvent): void {
    this.naviguer({
      page: evenement.pageIndex || null,
      taille: evenement.pageSize === TAILLES[0] ? null : evenement.pageSize,
    });
  }

  effacerFiltres(): void {
    this.naviguer({ recherche: null, type: null, page: null });
  }

  recharger(): void {
    this.rechargement.update((v) => v + 1);
  }

  // ----- Décisions depuis les cartes -----

  async publier(video: VideoResponse): Promise<void> {
    this.actionEnCours.set(video.id);
    this.apresAction(await this.moderation.publier(video));
  }

  async refuser(video: VideoResponse): Promise<void> {
    this.actionEnCours.set(video.id);
    this.apresAction(await this.moderation.refuser(video));
  }

  private apresAction(fait: boolean): void {
    this.actionEnCours.set(null);
    if (fait) {
      this.recharger();
      this.chargerStatistiques();
    }
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
