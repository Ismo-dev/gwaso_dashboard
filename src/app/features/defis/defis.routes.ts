import { Routes } from '@angular/router';

/** Pages de la fonctionnalité « defis », chargées seulement quand on les ouvre. */
export const DEFIS_ROUTES: Routes = [
  {
    path: '',
    title: 'Défis',
    loadComponent: () => import('./pages/defis-liste/defis-liste').then((m) => m.DefisListe),
  },
  {
    // Avant « :id » : sinon « nouveau » serait lu comme un identifiant
    path: 'nouveau',
    data: { filAriane: 'Nouveau défi' },
    title: 'Nouveau défi',
    loadComponent: () =>
      import('./pages/defi-formulaire/defi-formulaire').then((m) => m.DefiFormulaire),
  },
  {
    path: ':id/modifier',
    data: { filAriane: 'Modifier' },
    title: 'Modifier le défi',
    loadComponent: () =>
      import('./pages/defi-formulaire/defi-formulaire').then((m) => m.DefiFormulaire),
  },
  {
    path: ':id',
    data: { filAriane: 'Détail' },
    title: 'Détail du défi',
    loadComponent: () => import('./pages/defi-detail/defi-detail').then((m) => m.DefiDetail),
  },
];
