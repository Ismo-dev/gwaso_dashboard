import { Routes } from '@angular/router';

/** Pages de la fonctionnalité « ingredients », chargées seulement quand on les ouvre. */
export const INGREDIENTS_ROUTES: Routes = [
  {
    path: '',
    title: 'Ingrédients',
    loadComponent: () =>
      import('./pages/ingredients-liste/ingredients-liste').then((m) => m.IngredientsListe),
  },
];
