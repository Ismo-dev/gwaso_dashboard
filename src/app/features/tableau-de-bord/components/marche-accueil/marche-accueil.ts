import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { ClassementMarche, StatistiquesMarche } from '../../models/statistiques.model';
import { StatistiquesService } from '../../services/statistiques.service';

/** Périodes proposées, en jours (aujourd'hui compris). */
const PERIODES = [7, 30, 90] as const;
const CLE_PERIODE = 'gwaso.accueil.periodeMarche';

/** Une colonne du graphique des ventes. */
interface Colonne {
  date: Date;
  ventes: number;
  commandes: number;
  /** Hauteur en % de l'axe. */
  hauteur: number;
}

/**
 * Le marché sur l'accueil (droit MARCHE_GERER) : chiffres de la période, ce qui se passe maintenant,
 * ventes jour par jour, meilleurs produits et fournisseurs.
 */
@Component({
  imports: [
    DatePipe,
    RouterLink,
    MatButton,
    MatButtonToggleGroup,
    MatButtonToggle,
    NgIcon,
    EmptyState,
  ],
  selector: 'app-marche-accueil',
  styleUrl: './marche-accueil.scss',
  templateUrl: './marche-accueil.html',
})
export class MarcheAccueil implements OnInit {
  private service = inject(StatistiquesService);

  protected readonly periodes = PERIODES;
  protected jours = signal<number>(lirePeriode());
  protected stats = signal<StatistiquesMarche | null>(null);
  protected chargement = signal(true);
  protected erreur = signal(false);
  /** Colonne survolée ou sélectionnée au clavier (infobulle). */
  protected survol = signal<number | null>(null);

  /** Graduation haute de l'axe : un nombre rond au-dessus du meilleur jour. */
  protected axeMax = computed(() =>
    arrondiHaut(Math.max(0, ...(this.stats()?.parJour ?? []).map((j) => j.ventes))),
  );

  /** Trois graduations : 0, la moitié, le haut. */
  protected graduations = computed(() => {
    const max = this.axeMax();
    return [max, max / 2, 0];
  });

  protected colonnes = computed<Colonne[]>(() => {
    const max = this.axeMax();
    return (this.stats()?.parJour ?? []).map((j) => ({
      date: new Date(`${j.date}T00:00:00`),
      ventes: j.ventes,
      commandes: j.commandes,
      hauteur: max > 0 ? (j.ventes / max) * 100 : 0,
    }));
  });

  /** Dates écrites sous l'axe : la première, celle du milieu, aujourd'hui. */
  protected reperes = computed(() => {
    const c = this.colonnes();
    return c.length < 3
      ? c.map((x) => x.date)
      : [c[0].date, c[Math.floor(c.length / 2)].date, c[c.length - 1].date];
  });

  protected aucuneVente = computed(() => (this.stats()?.argent.ventes ?? 0) === 0);

  /** Phrase du graphique pour les lecteurs d'écran (le tableau donne le détail). */
  protected resumeGraphique = computed(() => {
    const c = this.colonnes();
    if (!c.length) return '';
    const meilleur = c.reduce((a, b) => (b.ventes > a.ventes ? b : a));
    return `Ventes par jour sur ${c.length} jours. Meilleur jour : ${meilleur.date.toLocaleDateString(
      'fr-FR',
      {
        day: 'numeric',
        month: 'long',
      },
    )}, ${fcfa(meilleur.ventes)}.`;
  });

  protected readonly fcfa = fcfa;
  protected readonly compact = compact;

  ngOnInit(): void {
    this.charger();
  }

  protected choisir(jours: number): void {
    this.jours.set(jours);
    try {
      localStorage.setItem(CLE_PERIODE, String(jours));
    } catch {
      // Stockage indisponible : la période ne sera simplement pas retenue
    }
    this.charger();
  }

  protected charger(): void {
    this.chargement.set(true);
    this.erreur.set(false);
    this.service.getStatistiquesMarche(this.jours()).subscribe({
      next: (s) => {
        this.stats.set(s);
        this.chargement.set(false);
      },
      error: () => {
        this.erreur.set(true);
        this.chargement.set(false);
      },
    });
  }

  /** « 1 h 20 », « 45 min », « 2 j 3 h ». */
  protected duree(minutes: number): string {
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    if (h < 24) return minutes % 60 ? `${h} h ${String(minutes % 60).padStart(2, '0')}` : `${h} h`;
    return `${Math.floor(h / 24)} j ${h % 24} h`;
  }

  /** Largeur de la barre d'un classement, relative au premier. */
  protected part(liste: ClassementMarche[], ligne: ClassementMarche): number {
    const max = liste[0]?.montant ?? 0;
    return max > 0 ? Math.max(2, (ligne.montant / max) * 100) : 0;
  }

  protected pluriel(nombre: number, mot: string): string {
    return `${nombre.toLocaleString('fr-FR')} ${nombre > 1 ? `${mot}s` : mot}`;
  }
}

function lirePeriode(): number {
  try {
    const v = Number(localStorage.getItem(CLE_PERIODE));
    return (PERIODES as readonly number[]).includes(v) ? v : 30;
  } catch {
    return 30;
  }
}

/** « 125 000 FCFA ». */
function fcfa(montant: number): string {
  return `${Math.round(montant).toLocaleString('fr-FR')} FCFA`;
}

/** Graduation : « 0 », « 5 000 », « 20 k », « 1,5 M ». */
function compact(montant: number): string {
  if (montant >= 1_000_000)
    return `${(montant / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M`;
  if (montant >= 10_000)
    return `${(montant / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} k`;
  return montant.toLocaleString('fr-FR');
}

/** Le plus petit nombre rond (1, 2, 2,5 ou 5 × 10ⁿ) au-dessus de [v] ; 1 000 sans vente. */
function arrondiHaut(v: number): number {
  if (v <= 0) return 1000;
  const puissance = 10 ** Math.floor(Math.log10(v));
  for (const pas of [1, 2, 2.5, 5, 10]) {
    if (pas * puissance >= v) return pas * puissance;
  }
  return 10 * puissance;
}
