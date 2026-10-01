import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Vérifie qu'un prix minimum ne dépasse pas le prix maximum.
 * À placer sur le groupe qui contient les deux champs :
 *   fb.group({ prixMin: [...], prixMax: [...] }, { validators: fourchetteDePrix('prixMin', 'prixMax') })
 * Erreur produite : { fourchette: true }
 */
export function fourchetteDePrix(champMin: string, champMax: string): ValidatorFn {
  return (groupe: AbstractControl): ValidationErrors | null => {
    const min: unknown = groupe.get(champMin)?.value;
    const max: unknown = groupe.get(champMax)?.value;
    if (typeof min === 'number' && typeof max === 'number' && min > max) {
      return { fourchette: true };
    }
    return null;
  };
}
