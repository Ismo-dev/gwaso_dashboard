import { HttpClient } from '@angular/common/http';
import { computed, inject, Service, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import { CompteursAValider } from '../models/a-valider.model';
import { SessionService } from './session.service';

/**
 * Compteurs « à valider » affichés dans le menu et la cloche de notifications.
 * Après une validation ou un rejet, appeler rafraichir() pour mettre les compteurs à jour.
 */
@Service()
export class AValiderService {
  private http = inject(HttpClient);
  private session = inject(SessionService);

  readonly compteurs = signal<CompteursAValider | null>(null);

  readonly total = computed(() => {
    const c = this.compteurs();
    return c ? c.recettes + c.videos + c.defis + c.chefs + c.producteurs : 0;
  });

  rafraichir(): void {
    // Ne pas appeler l'API de statistiques admin si l'utilisateur n'a aucun droit de modération
    if (
      !this.session.aLeDroit('UTILISATEUR_GERER') &&
      !this.session.aLeDroit('RECETTE_VALIDER') &&
      !this.session.aLeDroit('VIDEO_MODERER') &&
      !this.session.aLeDroit('DEFI_VALIDER')
    ) {
      return;
    }

    this.http
      .get<ApiResponse<{ aValider: CompteursAValider }>>(`${environment.apiUrl}/admin/statistiques`)
      .subscribe({
        next: (reponse) => this.compteurs.set(reponse.data.aValider),
        error: () => undefined,
      });
  }

  /** Met à jour les compteurs quand une page a déjà chargé les statistiques (évite un second appel). */
  mettreAJour(compteurs: CompteursAValider): void {
    this.compteurs.set(compteurs);
  }
}
