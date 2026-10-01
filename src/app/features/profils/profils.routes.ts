import { Routes } from '@angular/router';

/** Pages de la fonctionnalité « profils », chargées seulement quand on les ouvre. */
export const PROFILS_ROUTES: Routes = [
  {
    path: '',
    title: 'Profils et droits',
    loadComponent: () => import('./pages/profils-liste/profils-liste').then((m) => m.ProfilsListe),
  },
];
