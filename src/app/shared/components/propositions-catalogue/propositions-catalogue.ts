import { Component, input, output } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { NgIcon } from '@ng-icons/core';
import { FichierPipe } from '../../pipes/fichier.pipe';

/** Ce que la liste affiche d'une proposition (ingrédient ou ustensile). */
export interface PropositionCatalogue {
  id: string;
  nom: string;
  photoUrl: string | null;
  proposeParNom: string | null;
  /** Précision sous le nom (« Unité : pièce », description de l'ustensile...). */
  detail: string | null;
}

/**
 * Propositions des chefs en attente : à compléter (prix, photo), valider ou refuser.
 * Le chef peut déjà les utiliser ; sa recette ne se publie qu'une fois ses propositions validées.
 *
 * Utilisation : <app-propositions-catalogue quoi="ingrédient" [propositions]="..." (valider)="..." />
 */
@Component({
  imports: [MatButton, NgIcon, FichierPipe],
  selector: 'app-propositions-catalogue',
  styleUrl: './propositions-catalogue.scss',
  templateUrl: './propositions-catalogue.html',
})
export class PropositionsCatalogue<T extends PropositionCatalogue> {
  /** « ingrédient » ou « ustensile ». */
  readonly quoi = input.required<string>();
  readonly propositions = input.required<T[]>();
  /** Identifiant de la proposition en cours de traitement (boutons désactivés). */
  readonly enCours = input<string | null>(null);

  readonly completer = output<T>();
  readonly valider = output<T>();
  readonly refuser = output<T>();
}
