import { Routes } from '@angular/router';

/** Pages de la fonctionnalité « videos », chargées seulement quand on les ouvre. */
export const VIDEOS_ROUTES: Routes = [
  {
    path: '',
    title: 'Vidéos',
    loadComponent: () => import('./pages/videos-liste/videos-liste').then((m) => m.VideosListe),
  },
  {
    // Placée avant « :id » : sinon « fil » serait lu comme un identifiant de vidéo
    path: 'fil',
    data: { filAriane: 'Fil' },
    title: 'Fil des vidéos',
    loadComponent: () => import('./pages/videos-fil/videos-fil').then((m) => m.VideosFil),
  },
  {
    path: ':id',
    data: { filAriane: 'Détail' },
    title: 'Détail de la vidéo',
    loadComponent: () => import('./pages/video-detail/video-detail').then((m) => m.VideoDetail),
  },
];
