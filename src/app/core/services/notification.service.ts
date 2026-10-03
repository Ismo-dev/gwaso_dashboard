import { inject, Service } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DonneesToast, Toast, TypeToast } from '../../shared/components/toast/toast';

const DUREES: Record<TypeToast, number> = {
  succes: 4000,
  info: 4000,
  avertissement: 6000,
  erreur: 8000,
};


@Service()
export class NotificationService {
  private snackBar = inject(MatSnackBar);

  succes(message: string): void {
    this.afficher('succes', message);
  }

  info(message: string): void {
    this.afficher('info', message);
  }

  avertissement(message: string): void {
    this.afficher('avertissement', message);
  }

  erreur(message: string): void {
    this.afficher('erreur', message);
  }

  private afficher(type: TypeToast, message: string): void {
    this.snackBar.openFromComponent<Toast, DonneesToast>(Toast, {
      data: { type, message, duree: DUREES[type] },
      duration: DUREES[type],
      // Téléphone : centré en haut de l'écran ; ordinateur : en haut à droite, sous l'en-tête
      horizontalPosition: matchMedia('(max-width: 767.98px)').matches ? 'center' : 'end',
      verticalPosition: 'top',
      panelClass: 'gw-toast',
      politeness: type === 'erreur' ? 'assertive' : 'polite',
    });
  }
}
