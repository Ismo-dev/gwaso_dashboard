import { inject, Service, signal } from '@angular/core';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

export interface ElementFilAriane {
  libelle: string;
  /** Adresse du lien ; absente pour la page courante. */
  lien?: string;
}

/**
 * Fil d'Ariane (« Tableau de bord › Recettes › Tô sauce gombo »), construit à partir
 * de la donnée `filAriane` des routes : { path: 'recettes', data: { filAriane: 'Recettes' } }.
 * Une page de détail peut remplacer le dernier libellé par le vrai nom de l'élément
 * avec definirPageCourante().
 */
@Service()
export class FilArianeService {
  private router = inject(Router);

  readonly elements = signal<ElementFilAriane[]>([]);

  constructor() {
    this.router.events
      .pipe(filter((evenement) => evenement instanceof NavigationEnd))
      .subscribe(() => {
        this.elements.set(this.construire(this.router.routerState.snapshot.root));
      });
  }

  /** Remplace le libellé de la page courante (ex. le nom de la recette affichée). */
  definirPageCourante(libelle: string): void {
    this.elements.update((elements) =>
      elements.map((element, index) => (index === elements.length - 1 ? { libelle } : element)),
    );
  }

  private construire(racine: ActivatedRouteSnapshot): ElementFilAriane[] {
    const elements: ElementFilAriane[] = [];
    const segments: string[] = [];
    let route: ActivatedRouteSnapshot | null = racine;

    while (route) {
      segments.push(...route.url.map((segment) => segment.path));
      // routeConfig.data : seulement la donnée écrite sur CETTE route (pas celle héritée du parent)
      const libelle: unknown = route.routeConfig?.data?.['filAriane'];
      if (typeof libelle === 'string') {
        elements.push({ libelle, lien: '/' + segments.join('/') });
      }
      route = route.firstChild;
    }

    // La page courante n'est pas un lien
    if (elements.length > 0) {
      elements[elements.length - 1] = { libelle: elements[elements.length - 1].libelle };
    }
    return elements;
  }
}
