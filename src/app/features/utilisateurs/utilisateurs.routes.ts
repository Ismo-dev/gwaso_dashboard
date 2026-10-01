import { Routes } from '@angular/router';

/** Pages de la fonctionnalité « utilisateurs », chargées seulement quand on les ouvre. */
export const UTILISATEURS_ROUTES: Routes = [
  {
    path: '',
    title: 'Utilisateurs',
    loadComponent: () =>
      import('./pages/utilisateurs-liste/utilisateurs-liste').then((m) => m.UtilisateursListe),
  },
  {
    path: ':id',
    data: { filAriane: 'Détail' },
    title: "Détail de l'utilisateur",
    loadComponent: () =>
      import('./pages/utilisateur-detail/utilisateur-detail').then((m) => m.UtilisateurDetail),
  },
];
