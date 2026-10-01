import { Component, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDivider } from '@angular/material/divider';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { interval, startWith } from 'rxjs';
import { AValiderService } from '../../../core/services/a-valider.service';
import { ConfirmationService } from '../../../core/services/confirmation.service';
import { FilArianeService } from '../../../core/services/fil-ariane.service';
import { SessionService } from '../../../core/services/session.service';
import {
  INFOS_TYPES,
  NotificationResponse,
} from '../../../features/notifications/models/notification.model';
import { NotificationsService } from '../../../features/notifications/services/notifications.service';
import { DepuisPipe } from '../../pipes/depuis.pipe';
import { Avatar } from '../avatar/avatar';

/** Le nombre de non lues est relu toutes les minutes. */
const RAFRAICHISSEMENT_MS = 60_000;

interface ElementAValider {
  libelle: string;
  nombre: number;
  lien: string;
  parametres: Record<string, string>;
  icone: string;
}

/** Barre du haut : fil d'Ariane, notifications, compte de l'administrateur. */
@Component({
  imports: [
    RouterLink,
    MatButton,
    MatIconButton,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    MatDivider,
    NgIcon,
    Avatar,
    DepuisPipe,
  ],
  selector: 'app-header',
  styleUrl: './header.scss',
  templateUrl: './header.html',
})
export class Header {
  protected session = inject(SessionService);
  protected filAriane = inject(FilArianeService);
  protected aValider = inject(AValiderService);
  protected notifications = inject(NotificationsService);
  private confirmation = inject(ConfirmationService);

  protected readonly infos = INFOS_TYPES;
  /** Les 5 dernières notifications, chargées à l'ouverture de la cloche. */
  protected dernieres = signal<NotificationResponse[]>([]);

  readonly mobile = input(false);
  readonly menuOuvert = input(false);
  readonly ouvrirMenu = output<void>();

  constructor() {
    interval(RAFRAICHISSEMENT_MS)
      .pipe(startWith(0), takeUntilDestroyed())
      .subscribe(() => this.notifications.rafraichirNombre());
  }

  chargerDernieres(): void {
    this.notifications.rechercher({ taille: 5 }).subscribe({
      next: (page) => this.dernieres.set(page.contenu),
      error: () => this.dernieres.set([]),
    });
  }

  /** Raccourcis de la cloche : uniquement ce qui attend réellement une décision. */
  protected elementsAValider = computed<ElementAValider[]>(() => {
    const c = this.aValider.compteurs();
    if (!c) {
      return [];
    }
    const elements: ElementAValider[] = [
      {
        libelle: 'Recettes',
        nombre: c.recettes,
        lien: '/recettes',
        parametres: { statut: 'EN_ATTENTE_VALIDATION' },
        icone: 'lucideBookOpen',
      },
      {
        libelle: 'Vidéos',
        nombre: c.videos,
        lien: '/videos',
        parametres: {},
        icone: 'lucideClapperboard',
      },
      { libelle: 'Défis', nombre: c.defis, lien: '/defis', parametres: {}, icone: 'lucideTrophy' },
      {
        libelle: 'Chefs cuisiniers',
        nombre: c.chefs,
        lien: '/utilisateurs',
        parametres: {},
        icone: 'lucideChefHat',
      },
      {
        libelle: 'Producteurs',
        nombre: c.producteurs,
        lien: '/utilisateurs',
        parametres: {},
        icone: 'lucideStore',
      },
    ];
    return elements.filter((element) => element.nombre > 0);
  });

  async deconnecter(): Promise<void> {
    const confirme = await this.confirmation.demander({
      titre: 'Se déconnecter ?',
      message: 'Vous devrez saisir à nouveau vos identifiants pour revenir.',
      texteConfirmer: 'Se déconnecter',
    });
    if (confirme) {
      this.session.deconnecter();
    }
  }
}
