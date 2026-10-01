import { Component, input } from '@angular/core';
import { MatProgressSpinner } from '@angular/material/progress-spinner';

/** Indicateur de chargement. Utilisation : <app-loader texte="Chargement des recettes…" /> */
@Component({
  imports: [MatProgressSpinner],
  selector: 'app-loader',
  styleUrl: './loader.scss',
  templateUrl: './loader.html',
})
export class Loader {
  readonly texte = input('Chargement…');
}
