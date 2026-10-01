import { Component, computed, input, model, signal } from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { FichierPipe } from '../../../../shared/pipes/fichier.pipe';

/** Élément du catalogue proposé (ingrédient ou ustensile). */
export interface ElementCatalogue {
  id: string;
  nom: string;
  photoUrl: string | null;
}

/**
 * Choix d'ingrédients ou d'ustensiles du catalogue, en vignettes photo (on choisit en voyant ce que verront
 * les participants). Un élément sans photo ne peut pas être choisi : les participants ne verraient rien.
 */
@Component({
  imports: [NgIcon, FichierPipe],
  selector: 'app-choix-elements',
  styleUrl: './choix-elements.scss',
  templateUrl: './choix-elements.html',
})
export class ChoixElements {
  readonly elements = input.required<ElementCatalogue[]>();
  /** Identifiants choisis (liaison à double sens). */
  readonly selection = model<string[]>([]);
  readonly max = input(12);
  /** Libellé pour les lecteurs d'écran : « Ingrédients à montrer »... */
  readonly libelle = input.required<string>();

  protected recherche = signal('');
  protected filtres = computed(() => {
    const terme = this.recherche().trim().toLowerCase();
    // Ceux avec photo d'abord : ce sont les seuls qu'on peut choisir
    return this.elements()
      .filter((e) => !terme || e.nom.toLowerCase().includes(terme))
      .sort((a, b) => Number(!a.photoUrl) - Number(!b.photoUrl) || a.nom.localeCompare(b.nom, 'fr'));
  });
  protected plein = computed(() => this.selection().length >= this.max());

  basculer(element: ElementCatalogue): void {
    if (!element.photoUrl) {
      return;
    }
    const choisis = this.selection();
    if (choisis.includes(element.id)) {
      this.selection.set(choisis.filter((id) => id !== element.id));
    } else if (!this.plein()) {
      this.selection.set([...choisis, element.id]);
    }
  }
}
