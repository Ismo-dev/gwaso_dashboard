import { Component, computed, inject, input, output } from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDivider } from '@angular/material/divider';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { AValiderService } from '../../../core/services/a-valider.service';
import { ConfirmationService } from '../../../core/services/confirmation.service';
import { FilArianeService } from '../../../core/services/fil-ariane.service';
import { SessionService } from '../../../core/services/session.service';
import { Avatar } from '../avatar/avatar';

interface ElementAValider {
  libelle: string;
  nombre: number;
  lien: string;
  parametres: Record<string, string>;
  icone: string;
}

/** Barre du haut : fil d'Ariane, éléments à valider, compte de l'administrateur. */
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
  ],
  selector: 'app-header',
  styleUrl: './header.scss',
  templateUrl: './header.html',
})
export class Header {
  protected session = inject(SessionService);
  protected filAriane = inject(FilArianeService);
  protected aValider = inject(AValiderService);
  private confirmation = inject(ConfirmationService);

  readonly mobile = input(false);
  readonly menuOuvert = input(false);
  readonly ouvrirMenu = output<void>();

  /** Contenu du menu de la cloche : uniquement ce qui attend réellement une décision. */
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
