import { Component, input } from '@angular/core';

/**
 * En-tête commun à toutes les pages : surtitre optionnel, titre, description et actions.
 * Toutes les pages commencent de la même façon (répétition, CRAP).
 *
 * Utilisation :
 *   <app-page-header titre="Recettes" description="Examinez les recettes proposées.">
 *     <button matButton="filled">Nouvelle catégorie</button>
 *   </app-page-header>
 */
@Component({
  imports: [],
  selector: 'app-page-header',
  styleUrl: './page-header.scss',
  templateUrl: './page-header.html',
})
export class PageHeader {
  readonly titre = input.required<string>();
  readonly description = input('');
  /** Petit texte au-dessus du titre (ex. « Modération »). */
  readonly surtitre = input('');
}
