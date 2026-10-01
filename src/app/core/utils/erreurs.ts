import { HttpErrorResponse } from '@angular/common/http';

/**
 * Message à montrer à l'utilisateur après une erreur de l'API.
 * L'API renvoie { statut: 'KO', message: '...' } : on affiche ce message s'il existe.
 *
 * Exemple : this.erreur.set(messageErreur(erreur, "Impossible d'enregistrer la catégorie."));
 */
export function messageErreur(erreur: unknown, messageParDefaut: string): string {
  if (erreur instanceof HttpErrorResponse) {
    if (erreur.status === 0) {
      return 'Le serveur ne répond pas. Vérifiez votre connexion.';
    }
    const message: unknown = erreur.error?.message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }
  return messageParDefaut;
}
