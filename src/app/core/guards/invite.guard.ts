import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from '../services/session.service';

/** Page réservée aux visiteurs non connectés (connexion) : un admin déjà connecté va à l'accueil. */
export const inviteGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  const router = inject(Router);

  return session.peutOuvrirLeDashboard() ? router.createUrlTree(['/']) : true;
};
