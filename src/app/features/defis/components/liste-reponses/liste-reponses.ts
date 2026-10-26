import { Component, input, model, signal } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatFormField, MatHint, MatLabel, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { NgIcon } from '@ng-icons/core';

/** Sans accents ni majuscules ni ponctuation : « Mafé » et « mafe » sont la même réponse. */
export function normaliserReponse(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Liste de réponses saisies une à une (Entrée ou « + ») et affichées en puces retirables :
 * autres bonnes réponses d'une devinette, bonnes réponses ou propositions d'une question de quiz.
 */
@Component({
  imports: [MatFormField, MatLabel, MatHint, MatSuffix, MatInput, MatIconButton, NgIcon],
  selector: 'app-liste-reponses',
  styleUrl: './liste-reponses.scss',
  templateUrl: './liste-reponses.html',
})
export class ListeReponses {
  readonly valeurs = model<string[]>([]);
  readonly libelle = input.required<string>();
  readonly placeholder = input('');
  readonly aide = input('Entrée pour ajouter');
  readonly max = input(10);
  /** Puces mises en avant (ex. la bonne réponse parmi les propositions). */
  readonly enAvant = input<string[]>([]);

  protected saisie = signal('');

  ajouter(): void {
    const texte = this.saisie().trim();
    if (!texte || this.valeurs().length >= this.max()) {
      return;
    }
    const cle = normaliserReponse(texte);
    if (!this.valeurs().some((v) => normaliserReponse(v) === cle)) {
      this.valeurs.set([...this.valeurs(), texte]);
    }
    this.saisie.set('');
  }

  retirer(valeur: string): void {
    this.valeurs.set(this.valeurs().filter((v) => v !== valeur));
  }

  estEnAvant(valeur: string): boolean {
    const cle = normaliserReponse(valeur);
    return this.enAvant().some((v) => normaliserReponse(v) === cle);
  }
}
