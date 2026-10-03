import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from '../services/session.service';

/** Laisse passer uniquement un compte connecté dont le profil a le droit ACCES_DASHBOARD ; sinon, connexion. */
export const adminGuard: CanActivateFn = (route, state) => {
  const session = inject(SessionService);
  const router = inject(Router);

  if (session.peutOuvrirLeDashboard()) {
    return true;
  }
  // On retient la page demandée pour y revenir après la connexion
  return router.createUrlTree(['/connexion'], { queryParams: { retour: state.url } });
};
