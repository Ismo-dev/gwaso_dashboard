import { Component, inject, input, output } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { CompteursAValider } from '../../../core/models/a-valider.model';
import { AValiderService } from '../../../core/services/a-valider.service';
import { SessionService } from '../../../core/services/session.service';
import { Avatar } from '../avatar/avatar';

interface LienMenu {
  libelle: string;
  lien: string;
  /** Nom d'une icône déclarée dans core/config/icones.ts */
  icone: string;
  /** Compteur « à valider » affiché à côté du lien. */
  compteur?: keyof CompteursAValider;
}

interface SectionMenu {
  titre: string;
  liens: LienMenu[];
}

/** Menu de navigation de l'administration. Pour ajouter une page : ajouter un lien ci-dessous. */
@Component({
  imports: [RouterLink, RouterLinkActive, MatIconButton, MatTooltip, NgIcon, Avatar],
  selector: 'app-sidebar',
  styleUrl: './sidebar.scss',
  templateUrl: './sidebar.html',
})
export class Sidebar {
  protected aValider = inject(AValiderService);
  protected session = inject(SessionService);

  /** Menu réduit aux icônes. */
  readonly compact = input(false);
  /** Affiché en tiroir sur téléphone. */
  readonly mobile = input(false);
  /** Le bouton « Réduire le menu » n'est proposé que sur ordinateur. */
  readonly peutReduire = input(false);

  readonly fermer = output<void>();
  readonly basculerCompact = output<void>();

  protected readonly sections: SectionMenu[] = [
    {
      titre: 'Pilotage',
      liens: [{ libelle: 'Tableau de bord', lien: '/', icone: 'lucideLayoutDashboard' }],
    },
    {
      titre: 'Modération',
      liens: [
        { libelle: 'Recettes', lien: '/recettes', icone: 'lucideBookOpen', compteur: 'recettes' },
        { libelle: 'Vidéos', lien: '/videos', icone: 'lucideClapperboard', compteur: 'videos' },
        { libelle: 'Défis', lien: '/defis', icone: 'lucideTrophy', compteur: 'defis' },
      ],
    },
    {
      titre: 'Communauté',
      liens: [{ libelle: 'Utilisateurs', lien: '/utilisateurs', icone: 'lucideUsers' }],
    },
    {
      titre: 'Catalogue',
      liens: [
        { libelle: 'Catégories', lien: '/categories', icone: 'lucideLayoutGrid' },
        { libelle: 'Ingrédients', lien: '/ingredients', icone: 'lucideCarrot' },
        { libelle: 'Ustensiles', lien: '/ustensiles', icone: 'lucideCookingPot' },
      ],
    },
    {
      titre: 'Paramètres',
      liens: [{ libelle: 'Profils et droits', lien: '/profils', icone: 'lucideShieldCheck' }],
    },
  ];

  /** Nombre d'éléments à valider pour un lien (0 si aucun compteur). */
  protected nombre(lien: LienMenu): number {
    const compteurs = this.aValider.compteurs();
    return lien.compteur && compteurs ? compteurs[lien.compteur] : 0;
  }
}
