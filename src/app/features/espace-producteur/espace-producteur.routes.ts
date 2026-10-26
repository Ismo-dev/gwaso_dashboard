import { Routes } from '@angular/router';

/** Pages de l'Espace Producteur (chargées à la demande). */
export const ESPACE_PRODUCTEUR_ROUTES: Routes = [
  {
    path: '',
    title: 'Mon Catalogue de Produits',
    loadComponent: () =>
      import('./pages/produits-liste/produits-liste').then((m) => m.ProduitsListe),
  },
];
