import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { NgIcon } from '@ng-icons/core';
import { PageResponse } from '../../../../core/models/page-response.model';
import { ConfirmationService } from '../../../../core/services/confirmation.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { AvisCommandeResponse } from '../../models/marche.model';
import { MarcheService } from '../../services/marche.service';

const TAILLES = [20, 50, 100];

/**
 * Avis des clients sur les fournisseurs et les livreurs, les plus récents d'abord.
 * Un avis masqué n'est plus affiché et ne compte plus dans la note moyenne.
 */
@Component({
  imports: [DatePipe, MatButton, MatPaginator, NgIcon, PageHeader, EmptyState],
  selector: 'app-avis-liste',
  styleUrl: './avis-liste.scss',
  templateUrl: './avis-liste.html',
})
export class AvisListe implements OnInit {
  private marcheService = inject(MarcheService);
  private confirmation = inject(ConfirmationService);
  private notification = inject(NotificationService);

  protected readonly tailles = TAILLES;
  protected readonly etoiles = [1, 2, 3, 4, 5];
  protected readonly lignesSquelette = [1, 2, 3];

  protected page = signal(0);
  protected taille = signal(TAILLES[0]);
  protected chargement = signal(true);
  protected erreur = signal(false);
  protected resultat = signal<PageResponse<AvisCommandeResponse> | null>(null);
  /** Avis en cours de masquage ou de réaffichage (bouton désactivé). */
  protected enCours = signal<string | null>(null);

  protected avis = computed(() => this.resultat()?.contenu ?? []);

  ngOnInit(): void {
    this.charger();
  }

  changerPage(evenement: PageEvent): void {
    this.taille.set(evenement.pageSize);
    this.page.set(evenement.pageIndex);
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set(false);
    this.marcheService.getAvis({ page: this.page(), taille: this.taille() }).subscribe({
      next: (resultat) => {
        this.resultat.set(resultat);
        this.chargement.set(false);
      },
      error: () => {
        this.erreur.set(true);
        this.chargement.set(false);
      },
    });
  }

  async basculer(avis: AvisCommandeResponse): Promise<void> {
    const masquer = avis.visible;
    if (masquer) {
      const confirme = await this.confirmation.demander({
        titre: 'Masquer cet avis ?',
        message:
          'Il ne sera plus affiché et ne comptera plus dans la note moyenne. Vous pourrez le réafficher plus tard.',
        texteConfirmer: "Masquer l'avis",
        danger: true,
      });
      if (!confirme) {
        return;
      }
    }
    this.enCours.set(avis.id);
    this.marcheService.changerVisibilite(avis.id, !masquer).subscribe({
      next: (modifie) => {
        this.resultat.update((page) =>
          page
            ? { ...page, contenu: page.contenu.map((a) => (a.id === modifie.id ? modifie : a)) }
            : page,
        );
        this.enCours.set(null);
        this.notification.succes(masquer ? 'Avis masqué.' : 'Avis réaffiché.');
      },
      error: () => this.enCours.set(null),
    });
  }
}
