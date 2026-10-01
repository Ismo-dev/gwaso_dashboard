import { Routes } from '@angular/router';

/** Pages de la fonctionnalité « ustensiles », chargées seulement quand on les ouvre. */
export const USTENSILES_ROUTES: Routes = [
  {
    path: '',
    title: 'Ustensiles',
    loadComponent: () =>
      import('./pages/ustensiles-liste/ustensiles-liste').then((m) => m.UstensilesListe),
  },
];
