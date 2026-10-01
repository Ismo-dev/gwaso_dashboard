import { inject, Service } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

const NOM_APPLICATION = 'Gwaso Admin';

/**
 * Donne un titre d'onglet à chaque page à partir de la propriété `title` des routes.
 * Exemple : { path: 'recettes', title: 'Recettes' } affiche « Recettes | Gwaso Admin ».
 */
@Service()
export class TitrePageService extends TitleStrategy {
  private title = inject(Title);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const titre = this.buildTitle(snapshot);
    this.title.setTitle(titre ? `${titre} | ${NOM_APPLICATION}` : NOM_APPLICATION);
  }
}
