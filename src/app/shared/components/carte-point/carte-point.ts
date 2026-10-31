import { Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { NgIcon } from '@ng-icons/core';

/**
 * Petite carte OpenStreetMap centrée sur un point (point de retrait d'un producteur…), avec un lien pour l'agrandir.
 * Utilisation : <app-carte-point [latitude]="12.63" [longitude]="-8.00" libelle="Point de retrait de Fanta" />
 * Aucune bibliothèque : la carte est celle d'openstreetmap.org, intégrée dans un cadre.
 */
@Component({
  imports: [NgIcon],
  selector: 'app-carte-point',
  styleUrl: './carte-point.scss',
  templateUrl: './carte-point.html',
})
export class CartePoint {
  private sanitizer = inject(DomSanitizer);

  readonly latitude = input.required<number>();
  readonly longitude = input.required<number>();
  /** Titre du cadre, lu par les lecteurs d'écran. */
  readonly libelle = input('Carte');

  /** Environ 1 km autour du point : le quartier reste lisible. */
  private static readonly MARGE = 0.006;

  protected urlCarte = computed(() => {
    const lat = this.latitude();
    const lng = this.longitude();
    const m = CartePoint.MARGE;
    const zone = [lng - m, lat - m, lng + m, lat + m].map((v) => v.toFixed(5)).join(',');
    // Adresse construite ici à partir de deux nombres : on peut l'autoriser dans le cadre
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.openstreetmap.org/export/embed.html?bbox=${zone}&layer=mapnik&marker=${lat},${lng}`,
    );
  });

  protected lienAgrandir = computed(
    () =>
      `https://www.openstreetmap.org/?mlat=${this.latitude()}&mlon=${this.longitude()}#map=17/${this.latitude()}/${this.longitude()}`,
  );
}
