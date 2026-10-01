import { Routes } from '@angular/router';

/** Pages de la fonctionnalité « categories », chargées seulement quand on les ouvre. */
export const CATEGORIES_ROUTES: Routes = [
  {
    path: '',
    title: 'Catégories',
    loadComponent: () =>
      import('./pages/categories-liste/categories-liste').then((m) => m.CategoriesListe),
  },
];
