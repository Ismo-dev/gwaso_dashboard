import { Component, computed, inject } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MAT_SNACK_BAR_DATA, MatSnackBarRef } from '@angular/material/snack-bar';
import { NgIcon } from '@ng-icons/core';

export type TypeToast = 'succes' | 'info' | 'avertissement' | 'erreur';

export interface DonneesToast {
  type: TypeToast;
  message: string;
  /** Durée d'affichage en millisecondes (anime la barre du bas). */
  duree: number;
}

/** Titre et icône de chaque type : le sens est donné par le texte et l'icône, pas seulement la couleur. */
const APPARENCES: Record<TypeToast, { titre: string; icone: string }> = {
  succes: { titre: 'C’est fait', icone: 'lucideCircleCheck' },
  info: { titre: 'Information', icone: 'lucideCircleHelp' },
  avertissement: { titre: 'Attention', icone: 'lucideTriangleAlert' },
  erreur: { titre: 'Erreur', icone: 'lucideCircleAlert' },
};

/**
 * Contenu d'une notification (toast). On ne l'utilise jamais directement :
 * on passe par NotificationService (succes, info, avertissement, erreur).
 */
@Component({
  imports: [MatIconButton, NgIcon],
  selector: 'app-toast',
  styleUrl: './toast.scss',
  templateUrl: './toast.html',
})
export class Toast {
  protected donnees = inject<DonneesToast>(MAT_SNACK_BAR_DATA);
  private reference = inject(MatSnackBarRef<Toast>);

  protected apparence = computed(() => APPARENCES[this.donnees.type]);

  fermer(): void {
    this.reference.dismiss();
  }
}
