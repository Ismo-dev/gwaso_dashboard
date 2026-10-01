import { Component, computed, input } from '@angular/core';

/**
 * Affiche un texte riche enregistré par l'éditeur (gras, listes, couleurs de la charte).
 * Angular nettoie automatiquement le HTML affiché ; le serveur l'a déjà nettoyé à l'enregistrement.
 *
 * Utilisation : <app-texte-riche [html]="recette.description" />
 *               <app-texte-riche [html]="etape.instructions" [lignesMax]="3" />  (aperçu raccourci)
 */
@Component({
  imports: [],
  selector: 'app-texte-riche',
  styleUrl: './texte-riche.scss',
  templateUrl: './texte-riche.html',
})
export class TexteRiche {
  readonly html = input<string | null>(null);
  /** Nombre de lignes affichées au maximum (aperçu), ou null pour tout afficher. */
  readonly lignesMax = input<number | null>(null);

  /** Un ancien texte brut est affiché avec ses retours à la ligne. */
  protected contenu = computed(() => {
    const valeur = this.html() ?? '';
    if (/<\/?[a-z][\s\S]*>/i.test(valeur)) {
      return valeur;
    }
    return valeur
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
  });
}
