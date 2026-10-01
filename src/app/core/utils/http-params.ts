import { HttpParams } from '@angular/common/http';

/**
 * Transforme un objet de filtres en paramètres d'URL, en ignorant les valeurs vides.
 * Exemple : { recherche: 'tô', statut: undefined, page: 0 } donne ?recherche=tô&page=0
 */
export function versParams(filtres: object = {}): HttpParams {
  let params = new HttpParams();
  for (const [cle, valeur] of Object.entries(filtres)) {
    if (valeur !== undefined && valeur !== null && valeur !== '') {
      params = params.set(cle, String(valeur));
    }
  }
  return params;
}
