import { Routes } from '@angular/router';
import { adminGuard } from './core/guards/admin.guard';
import { droitGuard } from './core/guards/droit.guard';
import { inviteGuard } from './core/guards/invite.guard';

/**
 * Plan du site.
 * - `title` devient le titre de l'onglet (voir TitrePageService).
 * - `data.filAriane` donne le libellé dans le fil d'Ariane (voir FilArianeService).
 * - `data.droit` : droit du profil nécessaire pour ouvrir la page (voir droitGuard).
 * Les fonctionnalités sont chargées à la demande (loadChildren) pour alléger le premier chargement.
 */
export const routes: Routes = [
  {
    path: 'connexion',
    title: 'Connexion',
    canActivate: [inviteGuard],
    loadComponent: () => import('./features/auth/pages/login/login').then((m) => m.Login),
  },
  {
    // Toutes les pages ci-dessous sont réservées aux administrateurs et partagent le même squelette
    path: '',
    loadComponent: () =>
      import('./shared/components/admin-layout/admin-layout').then((m) => m.AdminLayout),
    canActivate: [adminGuard],
    data: { filAriane: 'Tableau de bord' },
    children: [
      {
        path: '',
        title: 'Tableau de bord',
        loadComponent: () =>
          import('./features/tableau-de-bord/pages/accueil/accueil').then((m) => m.Accueil),
      },
      {
        path: 'recettes',
        canActivate: [droitGuard],
        data: { filAriane: 'Recettes', droit: 'RECETTE_VALIDER' },
        loadChildren: () =>
          import('./features/recettes/recettes.routes').then((m) => m.RECETTES_ROUTES),
      },
      {
        path: 'videos',
        canActivate: [droitGuard],
        data: { filAriane: 'Vidéos', droit: 'VIDEO_MODERER' },
        loadChildren: () => import('./features/videos/videos.routes').then((m) => m.VIDEOS_ROUTES),
      },
      {
        path: 'utilisateurs',
        canActivate: [droitGuard],
        data: { filAriane: 'Utilisateurs', droit: 'UTILISATEUR_GERER' },
        loadChildren: () =>
          import('./features/utilisateurs/utilisateurs.routes').then((m) => m.UTILISATEURS_ROUTES),
      },
      {
        path: 'defis',
        canActivate: [droitGuard],
        data: { filAriane: 'Défis', droit: 'DEFI_VALIDER' },
        loadChildren: () => import('./features/defis/defis.routes').then((m) => m.DEFIS_ROUTES),
      },
      {
        // Annuaire des producteurs : même liste que l'application (route publique côté API)
        path: 'annuaire',
        title: 'Annuaire des producteurs',
        data: { filAriane: 'Annuaire des producteurs' },
        loadComponent: () =>
          import('./features/producteurs/pages/annuaire/annuaire').then((m) => m.Annuaire),
      },
      {
        // Espace Producteur : gestion du catalogue et des stocks (réservé aux producteurs validés)
        path: 'espace-producteur',
        canActivate: [droitGuard],
        data: { filAriane: 'Mon Catalogue', droit: 'PRODUIT_GERER' },
        loadChildren: () =>
          import('./features/espace-producteur/espace-producteur.routes').then(
            (m) => m.ESPACE_PRODUCTEUR_ROUTES,
          ),
      },
      {
        path: 'categories',
        canActivate: [droitGuard],
        data: { filAriane: 'Catégories', droit: 'CATALOGUE_GERER' },
        loadChildren: () =>
          import('./features/categories/categories.routes').then((m) => m.CATEGORIES_ROUTES),
      },
      {
        path: 'ingredients',
        canActivate: [droitGuard],
        data: { filAriane: 'Ingrédients', droit: 'CATALOGUE_GERER' },
        loadChildren: () =>
          import('./features/ingredients/ingredients.routes').then((m) => m.INGREDIENTS_ROUTES),
      },
      {
        path: 'ustensiles',
        canActivate: [droitGuard],
        data: { filAriane: 'Ustensiles', droit: 'CATALOGUE_GERER' },
        loadChildren: () =>
          import('./features/ustensiles/ustensiles.routes').then((m) => m.USTENSILES_ROUTES),
      },
      {
        path: 'notifications',
        title: 'Notifications',
        data: { filAriane: 'Notifications' },
        loadComponent: () =>
          import('./features/notifications/pages/notifications/notifications').then(
            (m) => m.Notifications,
          ),
      },
      {
        path: 'mon-profil',
        title: 'Mon profil',
        data: { filAriane: 'Mon profil' },
        loadComponent: () =>
          import('./features/compte/pages/mon-profil/mon-profil').then((m) => m.MonProfil),
      },
      {
        path: 'profils',
        canActivate: [droitGuard],
        data: { filAriane: 'Profils et droits', droit: 'PROFIL_GERER' },
        loadChildren: () =>
          import('./features/profils/profils.routes').then((m) => m.PROFILS_ROUTES),
      },
    ],
  },
  {
    path: '**',
    title: 'Page introuvable',
    loadComponent: () =>
      import('./shared/components/page-introuvable/page-introuvable').then(
        (m) => m.PageIntrouvable,
      ),
  },
];
