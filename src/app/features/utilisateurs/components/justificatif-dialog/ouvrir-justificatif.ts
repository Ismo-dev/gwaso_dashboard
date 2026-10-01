import { MatDialog } from '@angular/material/dialog';
import { JustificatifDialog } from './justificatif-dialog';

/** Ouvre le justificatif d'un chef ou d'un producteur dans une fenêtre. */
export function ouvrirJustificatif(dialog: MatDialog, url: string, nom: string): void {
  dialog.open(JustificatifDialog, {
    data: { url, nom },
    width: '760px',
    maxWidth: 'calc(100vw - 32px)',
    autoFocus: 'dialog',
  });
}
