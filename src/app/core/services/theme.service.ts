import { computed, Service, signal } from '@angular/core';

/** Clair, sombre, ou comme le système (réglage de l'ordinateur ou du téléphone). */
export type ChoixTheme = 'clair' | 'sombre' | 'systeme';

/** Même clé que le petit script d'index.html, qui applique le thème avant le démarrage d'Angular. */
const CLE = 'gwaso.theme';

/**
 * Thème du dashboard. Le choix est posé sur <html data-theme="light|dark"> ;
 * sans choix (« système »), l'attribut est retiré et la feuille de style suit prefers-color-scheme.
 */
@Service()
export class ThemeService {
  private readonly requeteSombre = matchMedia('(prefers-color-scheme: dark)');
  private readonly systemeSombre = signal(this.requeteSombre.matches);

  readonly choix = signal<ChoixTheme>(lireChoix());

  /** Le thème réellement affiché. */
  readonly sombre = computed(() =>
    this.choix() === 'systeme' ? this.systemeSombre() : this.choix() === 'sombre',
  );

  constructor() {
    this.requeteSombre.addEventListener('change', (e) => this.systemeSombre.set(e.matches));
    appliquer(this.choix());
  }

  choisir(choix: ChoixTheme): void {
    this.choix.set(choix);
    appliquer(choix);
    try {
      if (choix === 'systeme') localStorage.removeItem(CLE);
      else localStorage.setItem(CLE, choix);
    } catch {
      // Stockage indisponible : le choix vaut pour cette visite
    }
  }
}

function lireChoix(): ChoixTheme {
  try {
    const v = localStorage.getItem(CLE);
    return v === 'clair' || v === 'sombre' ? v : 'systeme';
  } catch {
    return 'systeme';
  }
}

function appliquer(choix: ChoixTheme): void {
  const racine = document.documentElement;
  if (choix === 'systeme') racine.removeAttribute('data-theme');
  else racine.setAttribute('data-theme', choix === 'sombre' ? 'dark' : 'light');
}
