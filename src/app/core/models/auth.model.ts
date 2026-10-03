import { TypeCompte, StatutCompte, StatutRole } from './enums.model';

/** Utilisateur connecté (UtilisateurConnecteDTO côté backend). */
export interface UtilisateurConnecte {
  id: string;
  nom: string;
  prenom: string;
  email: string | null;
  telephone: string | null;
  photoProfil: string | null;
  role: TypeCompte;
  statutCompte: StatutCompte;
  statutRole: StatutRole | null;
  profilId: string | null;
  profilNom: string | null;
  droits: string[];
}

/**
 * Réponse de la connexion et du renouvellement (AuthResponseDTO côté backend).
 * - token : jeton d'accès, court (quelques minutes), envoyé à chaque requête ;
 * - refreshToken : jeton de renouvellement, long (30 jours), sert uniquement à obtenir une nouvelle paire.
 */
export interface AuthResponse {
  token: string;
  type: string;
  expireLe: string;
  refreshToken: string;
  refreshExpireLe: string;
  utilisateur: UtilisateurConnecte;
}
