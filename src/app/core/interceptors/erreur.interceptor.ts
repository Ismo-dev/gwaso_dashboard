import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { NotificationService } from '../services/notification.service';

/**
 * Traitement commun des erreurs HTTP, pour ne pas le répéter dans chaque page :
 * - 0, 403, 500+ : message d'erreur général (toast).
 * - 401 : rien ici. L'intercepteur d'authentification renouvelle la session et rejoue la requête ;
 *   si c'est impossible, SessionService ramène à la page de connexion avec un message.
 * Les autres erreurs (400, 404, 409) sont affichées par la page, près du formulaire concerné.
 */
export const erreurInterceptor: HttpInterceptorFn = (req, next) => {
  const notification = inject(NotificationService);

  return next(req).pipe(
    catchError((erreur: HttpErrorResponse) => {
      if (erreur.status === 0) {
        notification.erreur('Le serveur ne répond pas. Vérifiez votre connexion.');
      } else if (erreur.status === 403) {
        notification.erreur("Vous n'avez pas le droit d'effectuer cette action.");
      } else if (erreur.status >= 500) {
        // Le serveur renvoie une référence (réf. XXXX) qui permet de retrouver le détail dans son journal
        notification.erreur(
          erreur.error?.message ?? 'Une erreur est survenue sur le serveur. Réessayez plus tard.',
        );
      }

      return throwError(() => erreur);
    }),
  );
};
