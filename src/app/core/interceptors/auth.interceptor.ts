import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SessionService } from '../services/session.service';

/**
 * Routes de session : on n'y joint jamais le jeton d'accès.
 * Un ancien jeton (secret changé, expiré...) ne doit jamais empêcher de se connecter.
 */
const ROUTES_SESSION = ['/auth/login', '/auth/refresh', '/auth/logout', '/auth/inscription'];

/**
 * Ajoute le jeton d'accès aux appels de l'API et le renouvelle automatiquement :
 * 1. avant l'envoi, si le jeton est expiré (ou sur le point de l'être) ;
 * 2. en secours, si l'API répond 401 : on renouvelle puis on rejoue la requête une seule fois.
 * Si le renouvellement est refusé, SessionService ramène à la page de connexion.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const session = inject(SessionService);

  const estRouteSession = ROUTES_SESSION.some((route) =>
    req.url.startsWith(environment.apiUrl + route),
  );
  if (!req.url.startsWith(environment.apiUrl) || estRouteSession || !session.estConnecte()) {
    return next(req);
  }

  const avecJeton = (jeton: string | null): HttpRequest<unknown> =>
    jeton ? req.clone({ setHeaders: { Authorization: `Bearer ${jeton}` } }) : req;

  /** Jeton réellement envoyé avec la requête (pour savoir s'il a changé entre-temps). */
  let jetonEnvoye: string | null = null;
  const envoyer = (jeton: string | null) => {
    jetonEnvoye = jeton;
    return next(avecJeton(jeton));
  };

  const envoi$ = session.jetonAExpire()
    ? session.renouveler().pipe(switchMap(envoyer))
    : envoyer(session.getToken());

  return envoi$.pipe(
    catchError((erreur: unknown) => {
      if (!(erreur instanceof HttpErrorResponse) || erreur.status !== 401 || !session.estConnecte()) {
        return throwError(() => erreur);
      }
      // Une requête voisine a déjà renouvelé la session pendant que celle-ci était en route : on la rejoue
      const jetonActuel = session.getToken();
      if (jetonActuel && jetonActuel !== jetonEnvoye) {
        return next(avecJeton(jetonActuel));
      }
      // 401 alors qu'on pensait le jeton valable (secret changé côté serveur, horloge décalée...) :
      // on renouvelle et on rejoue la requête, une seule fois
      return session.renouveler().pipe(switchMap((jeton) => next(avecJeton(jeton))));
    }),
  );
};
