import { Pipe, PipeTransform } from '@angular/core';

const MINUTE = 60_000;
const HEURE = 60 * MINUTE;
const JOUR = 24 * HEURE;

/**
 * Date relative, plus rapide à lire dans une liste.
 * Utilisation : {{ recette.dateCreation | depuis }}  →  « il y a 3 jours »
 */
@Pipe({
  name: 'depuis',
})
export class DepuisPipe implements PipeTransform {
  transform(date: string | null | undefined): string {
    if (!date) {
      return '';
    }
    const ecart = Date.now() - new Date(date).getTime();

    if (ecart < MINUTE) {
      return "à l'instant";
    }
    if (ecart < HEURE) {
      return `il y a ${Math.floor(ecart / MINUTE)} min`;
    }
    if (ecart < JOUR) {
      return `il y a ${Math.floor(ecart / HEURE)} h`;
    }
    const jours = Math.floor(ecart / JOUR);
    if (jours === 1) {
      return 'hier';
    }
    if (jours < 30) {
      return `il y a ${jours} jours`;
    }
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }
}
