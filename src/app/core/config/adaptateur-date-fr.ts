import { Service } from '@angular/core';
import { NativeDateAdapter } from '@angular/material/core';

/**
 * Dates saisies au clavier à la française : « 15/10/2026 », « 15-10-2026 » ou « 15.10.2026 ».
 * L'adaptateur de Material s'appuie sur Date.parse, qui lit « 10/03 » comme le 3 octobre (format américain).
 */
@Service({ autoProvided: false })
export class AdaptateurDateFr extends NativeDateAdapter {
  override parse(valeur: unknown, formatLecture?: unknown): Date | null {
    if (typeof valeur === 'string') {
      const morceaux = valeur.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
      if (morceaux) {
        const [, jour, mois, annee] = morceaux.map(Number);
        const date = new Date(annee, mois - 1, jour);
        // 31/02 donnerait le 3 mars : on refuse plutôt une date qui n'existe pas
        return date.getMonth() === mois - 1 ? date : this.invalid();
      }
    }
    return super.parse(valeur, formatLecture);
  }
}
