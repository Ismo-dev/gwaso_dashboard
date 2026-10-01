import { Component, computed, input } from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { DroitAffiche, grouperDroits, libelleDroit } from '../../models/profil.model';

/**
 * Droits d'un profil en lecture seule, regroupés par domaine (Recettes, Vidéos, Défis...).
 * Chaque droit est écrit en clair (sa description), avec son code en petit.
 */
@Component({
  imports: [NgIcon],
  selector: 'app-droits-lecture',
  styleUrl: './droits-lecture.scss',
  templateUrl: './droits-lecture.html',
})
export class DroitsLecture {
  readonly droits = input.required<DroitAffiche[]>();
  /** Affichage serré (colonne étroite) : sans les codes. */
  readonly compact = input(false);

  protected groupes = computed(() => grouperDroits(this.droits()));
  protected readonly libelleDroit = libelleDroit;
}
