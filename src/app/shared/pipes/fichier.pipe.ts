import { Pipe, PipeTransform } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Adresse complète d'un fichier envoyé par l'API (photo, vidéo).
 * L'API renvoie « /api/v1/fichiers/images/xxx.jpg » : on ajoute l'adresse du serveur.
 * Utilisation : <img [src]="recette.photoUrl | fichier" />
 */
@Pipe({
  name: 'fichier',
})
export class FichierPipe implements PipeTransform {
  transform(chemin: string | null | undefined): string | null {
    if (!chemin) {
      return null;
    }
    return chemin.startsWith('http') ? chemin : environment.serverUrl + chemin;
  }
}
