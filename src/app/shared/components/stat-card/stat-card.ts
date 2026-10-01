import { Component, computed, input } from '@angular/core';
import { NgIcon } from '@ng-icons/core';

/** Une part de la barre de répartition. */
export interface SegmentStat {
  libelle: string;
  valeur: number;
  /** Couleur de la charte. */
  ton: 'cacao' | 'terre' | 'karite' | 'sable';
}

/**
 * Carte de chiffre clé. Utilisation :
 *   <app-stat-card libelle="Recettes publiées" [valeur]="128" icone="lucideBookOpen"
 *                  detail="12 en brouillon" [segments]="[...]" />
 * La barre de répartition est décorative : les mêmes chiffres sont dans la légende.
 */
@Component({
  imports: [NgIcon],
  selector: 'app-stat-card',
  styleUrl: './stat-card.scss',
  templateUrl: './stat-card.html',
})
export class StatCard {
  readonly libelle = input.required<string>();
  readonly valeur = input.required<number>();
  /** Icône Lucide (voir core/config/icones.ts). */
  readonly icone = input.required<string>();
  /** Précision sous le chiffre, ex. « 12 en brouillon ». */
  readonly detail = input('');
  /** Répartition affichée en barre sous le chiffre (facultatif). */
  readonly segments = input<SegmentStat[]>([]);

  protected total = computed(() => this.segments().reduce((t, s) => t + s.valeur, 0));
  /** Parts non vides, en pourcentage de la largeur. */
  protected parts = computed(() =>
    this.segments()
      .filter((s) => s.valeur > 0)
      .map((s) => ({ ...s, largeur: (s.valeur / this.total()) * 100 })),
  );
}
