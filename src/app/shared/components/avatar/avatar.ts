import { Component, computed, input } from '@angular/core';
import { FichierPipe } from '../../pipes/fichier.pipe';

type Taille = 'sm' | 'md' | 'lg';

/** Teintes de la charte, choisies selon le nom : chaque personne garde toujours la même couleur. */
const TEINTES = ['teinte-karite', 'teinte-cacao', 'teinte-terre', 'teinte-sable'];

/**
 * Photo de profil, ou initiales si la personne n'a pas de photo.
 * Utilisation : <app-avatar prenom="Awa" nom="Traoré" [photo]="utilisateur.photoProfil" taille="lg" />
 * L'avatar est décoratif : le nom doit être écrit à côté.
 */
@Component({
  imports: [FichierPipe],
  selector: 'app-avatar',
  styleUrl: './avatar.scss',
  templateUrl: './avatar.html',
})
export class Avatar {
  readonly prenom = input('');
  readonly nom = input('');
  readonly photo = input<string | null>(null);
  readonly taille = input<Taille>('md');

  protected initiales = computed(
    () => (this.prenom().charAt(0) + this.nom().charAt(0)).toUpperCase() || '?',
  );

  protected teinte = computed(() => {
    const texte = this.prenom() + this.nom();
    let somme = 0;
    for (const lettre of texte) {
      somme += lettre.charCodeAt(0);
    }
    return TEINTES[somme % TEINTES.length];
  });
}
