import { Pipe, PipeTransform } from '@angular/core';

/** Libellé lisible des unités de mesure envoyées par l'API. */
const LIBELLES: Record<string, string> = {
  G: 'g',
  KG: 'kg',
  ML: 'ml',
  L: 'L',
  PIECE: 'pièce(s)',
  CUILLERE_SOUPE: 'c. à soupe',
  CUILLERE_CAFE: 'c. à café',
  PINCEE: 'pincée(s)',
  BOL: 'bol(s)',
  TASSE: 'tasse(s)',
  SACHET: 'sachet(s)',
};

/** Utilisation : {{ ingredient.unite | unite }}  →  « c. à soupe » */
@Pipe({
  name: 'unite',
})
export class UnitePipe implements PipeTransform {
  transform(unite: string | null | undefined): string {
    return unite ? (LIBELLES[unite] ?? unite.toLowerCase()) : '';
  }
}
