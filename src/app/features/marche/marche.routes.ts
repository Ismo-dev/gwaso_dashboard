import { Routes } from '@angular/router';

/** Pages de la fonctionnalité « marché » (droit MARCHE_GERER), chargées seulement quand on les ouvre. */
export const MARCHE_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'commandes' },
  {
    path: 'commandes',
    title: 'Commandes',
    data: { filAriane: 'Commandes' },
    loadComponent: () =>
      import('./pages/commandes-liste/commandes-liste').then((m) => m.CommandesListe),
  },
  {
    path: 'commandes/:id',
    title: 'Détail de la commande',
    data: { filAriane: 'Détail' },
    loadComponent: () =>
      import('./pages/commande-detail/commande-detail').then((m) => m.CommandeDetail),
  },
  {
    path: 'litiges',
    title: 'Litiges',
    data: { filAriane: 'Litiges' },
    loadComponent: () => import('./pages/litiges-liste/litiges-liste').then((m) => m.LitigesListe),
  },
  {
    path: 'avis',
    title: 'Avis des clients',
    data: { filAriane: 'Avis des clients' },
    loadComponent: () => import('./pages/avis-liste/avis-liste').then((m) => m.AvisListe),
  },
  {
    path: 'reglages',
    title: 'Réglages du marché',
    data: { filAriane: 'Réglages' },
    loadComponent: () =>
      import('./pages/reglages-marche/reglages-marche').then((m) => m.ReglagesMarche),
  },
];
