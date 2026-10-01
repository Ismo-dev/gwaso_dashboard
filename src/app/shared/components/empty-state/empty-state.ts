import { Component, input } from '@angular/core';
import { NgIcon } from '@ng-icons/core';

type Ton = 'neutre' | 'succes' | 'erreur';

/**
 * Message affiché quand il n'y a rien à montrer (liste vide, aucun résultat, erreur).
 * Utilisation : <app-empty-state titre="Aucune recette" message="..." icone="lucideBookOpen" />
 * On peut ajouter un bouton entre les balises.
 */
@Component({
  imports: [NgIcon],
  selector: 'app-empty-state',
  styleUrl: './empty-state.scss',
  templateUrl: './empty-state.html',
})
export class EmptyState {
  readonly titre = input.required<string>();
  readonly message = input('');
  /** Icône Lucide (voir core/config/icones.ts). */
  readonly icone = input('lucideInbox');
  /** succes : « tout est à jour » ; erreur : chargement impossible. */
  readonly ton = input<Ton>('neutre');
}
