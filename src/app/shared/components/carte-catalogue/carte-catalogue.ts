import { Component, input, output } from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import { NgIcon } from '@ng-icons/core';
import { FichierPipe } from '../../pipes/fichier.pipe';

/**
 * Carte d'un élément du catalogue (catégorie, ustensile...) : image, nom, description, actions.
 * Utilisation :
 *   <app-carte-catalogue [titre]="c.nom" [description]="c.description" [image]="c.imageUrl"
 *                        iconeVide="lucideLayoutGrid" (modifier)="..." (supprimer)="..." />
 */
@Component({
  imports: [MatButton, MatIconButton, MatTooltip, NgIcon, FichierPipe],
  selector: 'app-carte-catalogue',
  styleUrl: './carte-catalogue.scss',
  templateUrl: './carte-catalogue.html',
})
export class CarteCatalogue {
  readonly titre = input.required<string>();
  readonly description = input<string | null>(null);
  readonly image = input<string | null>(null);
  /** Icône affichée quand il n'y a pas d'image. */
  readonly iconeVide = input('lucideImageOff');
  /** paysage : catégories ; carre : ustensiles, ingrédients. */
  readonly format = input<'paysage' | 'carre'>('paysage');

  readonly modifier = output<void>();
  readonly supprimer = output<void>();
}
