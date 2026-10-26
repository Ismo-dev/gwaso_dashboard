import { Component, computed, model } from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatOption } from '@angular/material/core';
import { MatFormField, MatHint, MatLabel, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatSelect } from '@angular/material/select';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { MatTooltip } from '@angular/material/tooltip';
import { NgIcon } from '@ng-icons/core';
import { DUREES_QUESTION, POINTS_PAR_DEFAUT } from '../../models/defi.model';
import { ListeReponses } from '../liste-reponses/liste-reponses';

/** Question en cours d'édition (la clé sert au suivi des cartes). */
export interface QuestionEdition {
  cle: number;
  enonce: string;
  dureeSecondes: number;
  points: number;
  reponsesAcceptees: string[];
  /** Vide = le participant tape sa réponse ; sinon il choisit. */
  propositions: string[];
  choixMultiple: boolean;
}

let compteur = 0;

export function nouvelleQuestion(partielle: Partial<QuestionEdition> = {}): QuestionEdition {
  return {
    cle: ++compteur,
    enonce: '',
    dureeSecondes: 30,
    points: POINTS_PAR_DEFAUT,
    reponsesAcceptees: [],
    propositions: [],
    choixMultiple: false,
    ...partielle,
  };
}

/**
 * Questions d'un quiz : énoncé, temps pour répondre (secondes), points, une ou plusieurs bonnes réponses
 * et, en option, des propositions à choisir.
 */
@Component({
  imports: [MatFormField, MatLabel, MatHint, MatSuffix, MatInput, MatSelect, MatOption, MatSlideToggle, MatButton, MatIconButton, MatTooltip, NgIcon, ListeReponses],
  selector: 'app-editeur-questions',
  styleUrl: './editeur-questions.scss',
  templateUrl: './editeur-questions.html',
})
export class EditeurQuestions {
  readonly questions = model<QuestionEdition[]>([]);
  protected readonly durees = DUREES_QUESTION;
  protected readonly max = 30;

  protected dureeTotale = computed(() => this.questions().reduce((t, q) => t + q.dureeSecondes, 0));
  protected pointsTotal = computed(() => this.questions().reduce((t, q) => t + (q.points || 0), 0));

  ajouter(): void {
    this.questions.set([...this.questions(), nouvelleQuestion()]);
  }

  modifier(cle: number, changement: Partial<QuestionEdition>): void {
    this.questions.set(this.questions().map((q) => (q.cle === cle ? { ...q, ...changement } : q)));
  }

  retirer(cle: number): void {
    this.questions.set(this.questions().filter((q) => q.cle !== cle));
  }

  deplacer(index: number, sens: -1 | 1): void {
    const liste = [...this.questions()];
    const cible = index + sens;
    if (cible < 0 || cible >= liste.length) {
      return;
    }
    [liste[index], liste[cible]] = [liste[cible], liste[index]];
    this.questions.set(liste);
  }

  formatDuree(secondes: number): string {
    if (secondes < 60) {
      return `${secondes} s`;
    }
    const minutes = Math.floor(secondes / 60);
    const reste = secondes % 60;
    return reste ? `${minutes} min ${reste} s` : `${minutes} min`;
  }
}
