import { Routes } from '@angular/router';
import { adminGuard } from './core/guards/admin.guard';
import { inviteGuard } from './core/guards/invite.guard';

/**
 * Plan du site.
 * - `title` devient le titre de l'onglet (voir TitrePageService).
 * - `data.filAriane` donne le libellé dans le fil d'Ariane (voir FilArianeService).
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
        data: { filAriane: 'Recettes' },
        loadChildren: () =>
          import('./features/recettes/recettes.routes').then((m) => m.RECETTES_ROUTES),
      },
      {
        path: 'videos',
        data: { filAriane: 'Vidéos' },
        loadChildren: () => import('./features/videos/videos.routes').then((m) => m.VIDEOS_ROUTES),
      },
      {
        path: 'utilisateurs',
        data: { filAriane: 'Utilisateurs' },
        loadChildren: () =>
          import('./features/utilisateurs/utilisateurs.routes').then((m) => m.UTILISATEURS_ROUTES),
      },
      {
        path: 'defis',
        data: { filAriane: 'Défis' },
        loadChildren: () => import('./features/defis/defis.routes').then((m) => m.DEFIS_ROUTES),
      },
      {
        path: 'categories',
        data: { filAriane: 'Catégories' },
        loadChildren: () =>
          import('./features/categories/categories.routes').then((m) => m.CATEGORIES_ROUTES),
      },
      {
        path: 'ingredients',
        data: { filAriane: 'Ingrédients' },
        loadChildren: () =>
          import('./features/ingredients/ingredients.routes').then((m) => m.INGREDIENTS_ROUTES),
      },
      {
        path: 'ustensiles',
        data: { filAriane: 'Ustensiles' },
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
        data: { filAriane: 'Profils et droits' },
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
