/**
 * Enveloppe renvoyée par toutes les routes de l'API (classe Response côté backend).
 *
 * Dans les services, `.pipe(map((reponse) => reponse.data))` retire cette enveloppe :
 * la page reçoit directement la recette, la liste... au lieu de { statut, message, data }.
 */
export interface ApiResponse<T> {
  statut: 'OK' | 'KO';
  message: string;
  data: T;
}
