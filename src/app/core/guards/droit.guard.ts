import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { NotificationService } from '../services/notification.service';
import { SessionService } from '../services/session.service';

/**
 * Page réservée à un droit : data: { droit: 'RECETTE_VALIDER' } sur la route.
 * Sans ce droit, on revient au tableau de bord avec un message.
 */
export const droitGuard: CanActivateFn = (route) => {
  const session = inject(SessionService);
  const droit = route.data['droit'] as string | undefined;
  if (!droit || session.aLeDroit(droit)) {
    return true;
  }
  inject(NotificationService).avertissement("Votre profil ne donne pas accès à cette page.");
  return inject(Router).createUrlTree(['/']);
};
