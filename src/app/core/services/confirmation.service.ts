import { inject, Service } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { ConfirmDialog } from '../../shared/components/confirm-dialog/confirm-dialog';
import { MotifDialog } from '../../shared/components/motif-dialog/motif-dialog';
import { DemandeConfirmation, DemandeMotif } from '../models/confirmation.model';

/**
 * Boîtes de dialogue de confirmation, à utiliser AVANT toute action importante ou destructrice.
 *
 * Exemples :
 *   const ok = await this.confirmation.demander({ titre: 'Supprimer ?', message: '...', danger: true });
 *   const motif = await this.confirmation.demanderMotif({ titre: 'Rejeter ?', message: '...', libelle: 'Motif' });
 *   if (motif) { ... }   // null si l'utilisateur a annulé
 */
@Service()
export class ConfirmationService {
  private dialog = inject(MatDialog);

  async demander(demande: DemandeConfirmation): Promise<boolean> {
    const fenetre = this.dialog.open(ConfirmDialog, {
      data: demande,
      width: '460px',
      maxWidth: 'calc(100vw - 2rem)',
      // Rôle « alertdialog » : les lecteurs d'écran annoncent qu'une décision est attendue
      role: 'alertdialog',
      autoFocus: 'dialog',
    });
    // Fermeture par Échap ou clic à côté = réponse « non »
    const reponse = await firstValueFrom(fenetre.afterClosed());
    return reponse === true;
  }

  /** Demande un motif écrit (rejet, désactivation...). Renvoie le motif, ou null si annulé. */
  async demanderMotif(demande: DemandeMotif): Promise<string | null> {
    const fenetre = this.dialog.open(MotifDialog, {
      data: demande,
      width: '520px',
      maxWidth: 'calc(100vw - 2rem)',
      autoFocus: 'first-tabbable',
    });
    const motif = await firstValueFrom(fenetre.afterClosed());
    return typeof motif === 'string' ? motif : null;
  }
}
