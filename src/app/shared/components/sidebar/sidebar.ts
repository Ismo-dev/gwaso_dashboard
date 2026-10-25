import { Component, computed, inject, input, output } from '@angular/core';
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
  /** Droit du profil nécessaire pour voir le lien (absent : tous). */
  droit?: string;
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

  private readonly toutesLesSections: SectionMenu[] = [
    {
      titre: 'Pilotage',
      liens: [{ libelle: 'Tableau de bord', lien: '/', icone: 'lucideLayoutDashboard' }],
    },
    {
      titre: 'Modération',
      liens: [
        { libelle: 'Recettes', lien: '/recettes', icone: 'lucideBookOpen', droit: 'RECETTE_VALIDER', compteur: 'recettes' },
        { libelle: 'Vidéos', lien: '/videos', icone: 'lucideClapperboard', droit: 'VIDEO_MODERER', compteur: 'videos' },
        { libelle: 'Défis', lien: '/defis', icone: 'lucideTrophy', droit: 'DEFI_VALIDER', compteur: 'defis' },
      ],
    },
    {
      titre: 'Communauté',
      liens: [
        { libelle: 'Utilisateurs', lien: '/utilisateurs', icone: 'lucideUsers', droit: 'UTILISATEUR_GERER' },
        { libelle: 'Annuaire', lien: '/annuaire', icone: 'lucideStore' },
      ],
    },
    {
      titre: 'Producteur',
      liens: [
        { libelle: 'Mon Catalogue', lien: '/espace-producteur', icone: 'lucideShoppingBasket', droit: 'PRODUIT_GERER' },
      ],
    },
    {
      titre: 'Catalogue',
      liens: [
        { libelle: 'Catégories', lien: '/categories', icone: 'lucideLayoutGrid', droit: 'CATALOGUE_GERER' },
        { libelle: 'Ingrédients', lien: '/ingredients', icone: 'lucideCarrot', droit: 'CATALOGUE_GERER' },
        { libelle: 'Ustensiles', lien: '/ustensiles', icone: 'lucideCookingPot', droit: 'CATALOGUE_GERER' },
      ],
    },
    {
      titre: 'Paramètres',
      liens: [{ libelle: 'Profils et droits', lien: '/profils', icone: 'lucideShieldCheck', droit: 'PROFIL_GERER' }],
    },
  ];

  /** Menu selon les droits du profil : un lien sans droit n'apparaît pas, une section vide non plus. */
  protected readonly sections = computed<SectionMenu[]>(() => {
    this.session.utilisateur();
    return this.toutesLesSections
      .map((section) => ({ ...section, liens: section.liens.filter((l) => !l.droit || this.session.aLeDroit(l.droit)) }))
      .filter((section) => section.liens.length > 0);
  });

  /** Nombre d'éléments à valider pour un lien (0 si aucun compteur). */
  protected nombre(lien: LienMenu): number {
    const compteurs = this.aValider.compteurs();
    return lien.compteur && compteurs ? compteurs[lien.compteur] : 0;
  }
}
