import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { ChoixProfilDialog, DonneesChoixProfil } from './choix-profil-dialog';

/** Demande quel profil donner ; renvoie son identifiant, ou undefined si l'admin annule. */
export function choisirProfil(dialog: MatDialog, donnees: DonneesChoixProfil): Promise<string | undefined> {
  return firstValueFrom(
    dialog
      .open<ChoixProfilDialog, DonneesChoixProfil, string>(ChoixProfilDialog, {
        data: donnees,
        width: '480px',
        maxWidth: 'calc(100vw - 32px)',
      })
      .afterClosed(),
  );
}
