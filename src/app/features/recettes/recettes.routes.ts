import { Routes } from '@angular/router';

/** Pages de la fonctionnalité « recettes », chargées seulement quand on les ouvre. */
export const RECETTES_ROUTES: Routes = [
  {
    path: '',
    title: 'Recettes',
    loadComponent: () =>
      import('./pages/recettes-liste/recettes-liste').then((m) => m.RecettesListe),
  },
  {
    // Avant ':id', sinon « nouvelle » serait pris pour un identifiant
    path: 'nouvelle',
    data: { filAriane: 'Nouvelle recette' },
    title: 'Nouvelle recette',
    loadComponent: () =>
      import('./pages/recette-formulaire/recette-formulaire').then((m) => m.RecetteFormulaire),
  },
  {
    path: ':id/modifier',
    data: { filAriane: 'Modifier' },
    title: 'Modifier la recette',
    loadComponent: () =>
      import('./pages/recette-formulaire/recette-formulaire').then((m) => m.RecetteFormulaire),
  },
  {
    path: ':id',
    data: { filAriane: 'Détail' },
    title: 'Détail de la recette',
    loadComponent: () =>
      import('./pages/recette-detail/recette-detail').then((m) => m.RecetteDetail),
  },
];
