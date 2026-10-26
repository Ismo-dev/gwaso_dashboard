import { DatePipe, LowerCasePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { AValiderService } from '../../../../core/services/a-valider.service';
import { SessionService } from '../../../../core/services/session.service';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { StatCard } from '../../../../shared/components/stat-card/stat-card';
import { DepuisPipe } from '../../../../shared/pipes/depuis.pipe';
import { FichierPipe } from '../../../../shared/pipes/fichier.pipe';
import { RecetteResponse, nomsCategories } from '../../../recettes/models/recette.model';
import { RecetteService } from '../../../recettes/services/recette.service';
import { Statistiques } from '../../models/statistiques.model';
import { StatistiquesService } from '../../services/statistiques.service';
import { AccueilProducteur } from '../../../espace-producteur/components/accueil-producteur/accueil-producteur';

/** Une file de travail « à traiter » (recettes, vidéos, défis, comptes). */
interface FileATraiter {
  /** Droit nécessaire pour ouvrir la page de la file. */
  droit: string;
  libelle: string;
  description: string;
  nombre: number;
  icone: string;
  lien: string;
  parametres: Record<string, string>;
}

/** Un statut dans la barre de répartition des recettes. */
interface PartRecettes {
  libelle: string;
  nombre: number;
  pourcentage: number;
  classe: string;
}

/** Nombre de recettes en attente affichées sur l'accueil. */
const NB_APERCU = 5;

/**
 * Page d'accueil : ce qui attend une décision (en premier), puis l'activité de la plateforme.
 * Hiérarchie : 1. À traiter  2. Chiffres clés  3. Détail des recettes en attente.
 */
@Component({
  imports: [
    RouterLink,
    MatButton,
    NgIcon,
    StatCard,
    EmptyState,
    DatePipe,
    LowerCasePipe,
    DepuisPipe,
    FichierPipe,
    AccueilProducteur,
  ],
  selector: 'app-accueil',
  styleUrl: './accueil.scss',
  templateUrl: './accueil.html',
})
export class Accueil implements OnInit {
  protected readonly nomsCategories = nomsCategories;
  private statistiquesService = inject(StatistiquesService);
  private recetteService = inject(RecetteService);
  private aValider = inject(AValiderService);
  protected session = inject(SessionService);

  /** Détecte si l'utilisateur connecté est un producteur (n'a pas les droits de modération admin). */
  protected estProducteur = computed(() => {
    const user = this.session.utilisateur();
    return user?.role === 'PRODUCTEUR' || (!this.session.aLeDroit('UTILISATEUR_GERER') && this.session.aLeDroit('PRODUIT_GERER'));
  });

  protected statistiques = signal<Statistiques | null>(null);
  protected recettesEnAttente = signal<RecetteResponse[]>([]);
  protected chargement = signal(true);
  protected erreur = signal(false);
  protected aujourdhui = new Date();

  /** Salutation selon l'heure : « Bonjour » ou « Bonsoir ». */
  /** « 1 cuisinier », « 3 cuisiniers » : accord simple au pluriel. */
  protected pluriel(nombre: number, mot: string): string {
    return nombre > 1 ? `${mot}s` : mot;
  }

  protected salutation = computed(() => (this.aujourdhui.getHours() < 18 ? 'Bonjour' : 'Bonsoir'));

  protected totalATraiter = computed(() => {
    const s = this.statistiques();
    return s ? this.files().reduce((total, file) => total + file.nombre, 0) : 0;
  });

  /** Files qui ont du travail, pour la barre de répartition. */
  protected filesNonVides = computed(() => this.files().filter((f) => f.nombre > 0));

  /** Ce que dit la barre, pour les lecteurs d'écran. */
  protected resumeRepartition = computed(
    () =>
      'Répartition : ' +
      this.filesNonVides()
        .map((f) => `${f.nombre} ${f.libelle.toLowerCase()}`)
        .join(', '),
  );

  /** Files de travail, les plus chargées en premier. */
  protected files = computed<FileATraiter[]>(() => {
    const s = this.statistiques();
    if (!s) {
      return [];
    }
    const files: FileATraiter[] = [
      {
        droit: 'RECETTE_VALIDER',
        libelle: 'Recettes',
        description: 'Proposées par la communauté',
        nombre: s.aValider.recettes,
        icone: 'lucideBookOpen',
        lien: '/recettes',
        parametres: { statut: 'EN_ATTENTE_VALIDATION' },
      },
      {
        droit: 'VIDEO_MODERER',
        libelle: 'Vidéos',
        description: 'Tutoriels et astuces',
        nombre: s.aValider.videos,
        icone: 'lucideClapperboard',
        lien: '/videos',
        parametres: {},
      },
      {
        droit: 'UTILISATEUR_GERER',
        libelle: 'Chefs cuisiniers',
        description: 'Demandes de statut',
        nombre: s.aValider.chefs,
        icone: 'lucideChefHat',
        lien: '/utilisateurs',
        parametres: {},
      },
      {
        droit: 'UTILISATEUR_GERER',
        libelle: 'Producteurs',
        description: 'Demandes de statut',
        nombre: s.aValider.producteurs,
        icone: 'lucideStore',
        lien: '/utilisateurs',
        parametres: {},
      },
      {
        droit: 'DEFI_VALIDER',
        libelle: 'Défis',
        description: 'Proposés par les chefs',
        nombre: s.aValider.defis,
        icone: 'lucideTrophy',
        lien: '/defis',
        parametres: {},
      },
    ];
    // Seulement ce que le profil permet de traiter
    return files.filter((f) => this.session.aLeDroit(f.droit)).sort((a, b) => b.nombre - a.nombre);
  });

  /** Répartition des recettes par statut (barre empilée + légende chiffrée). */
  protected repartition = computed<PartRecettes[]>(() => {
    const r = this.statistiques()?.recettes;
    if (!r) {
      return [];
    }
    const parts = [
      { libelle: 'Publiées', nombre: r.publiees, classe: 'part-publiees' },
      { libelle: 'En attente', nombre: r.enAttente, classe: 'part-attente' },
      { libelle: 'Brouillons', nombre: r.brouillons, classe: 'part-brouillons' },
      { libelle: 'Rejetées', nombre: r.rejetees, classe: 'part-rejetees' },
      { libelle: 'Archivées', nombre: r.archivees, classe: 'part-archivees' },
    ];
    const total = parts.reduce((somme, part) => somme + part.nombre, 0);
    return parts.map((part) => ({
      ...part,
      pourcentage: total > 0 ? Math.round((part.nombre / total) * 100) : 0,
    }));
  });

  protected totalRecettes = computed(() =>
    this.repartition().reduce((somme, part) => somme + part.nombre, 0),
  );

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    if (this.estProducteur()) {
      this.chargement.set(false);
      return;
    }

    this.chargement.set(true);
    this.erreur.set(false);

    this.statistiquesService.getStatistiques().subscribe({
      next: (statistiques) => {
        this.statistiques.set(statistiques);
        // Les compteurs du menu profitent du même appel
        this.aValider.mettreAJour(statistiques.aValider);
        this.chargement.set(false);
      },
      error: () => {
        this.erreur.set(true);
        this.chargement.set(false);
      },
    });

    if (!this.session.aLeDroit('RECETTE_VALIDER')) {
      return;
    }
    this.recetteService.getEnAttente().subscribe({
      // Les plus anciennes d'abord : elles attendent depuis le plus longtemps
      next: (recettes) =>
        this.recettesEnAttente.set(
          [...recettes]
            .sort((a, b) => new Date(a.dateCreation).getTime() - new Date(b.dateCreation).getTime())
            .slice(0, NB_APERCU),
        ),
      error: () => this.recettesEnAttente.set([]),
    });
  }
}
