import { Role, StatutRole } from '../../../core/models/enums.model';

/**
 * Accès donné par un profil : à quoi sert le compte (dashboard ou application) et quelles
 * informations demander à sa création. Côté API, c'est le champ « role » du profil.
 * Chaque utilisateur a un seul profil ; un profil par accès.
 */
export const ACCES_PROFIL: Record<Role, { libelle: string; aide: string; icone: string }> = {
  ADMIN: {
    libelle: "Dashboard d'administration",
    aide: 'Gère la plateforme depuis ce dashboard',
    icone: 'lucideShieldCheck',
  },
  CUISINIER: {
    libelle: 'Application · cuisinier',
    aide: 'Suit les recettes, participe aux défis',
    icone: 'lucideCookingPot',
  },
  CHEF: {
    libelle: 'Application · chef cuisinier',
    aide: 'Publie ses recettes, propose des défis',
    icone: 'lucideChefHat',
  },
  PRODUCTEUR: {
    libelle: 'Application · producteur',
    aide: 'Vend ses produits locaux',
    icone: 'lucideStore',
  },
};

/** Ordre d'affichage des accès. */
export const ORDRE_ACCES: Role[] = ['ADMIN', 'CHEF', 'CUISINIER', 'PRODUCTEUR'];

/** ProfilResponseDTO côté backend. */
export interface ProfilResponse {
  id: string;
  nom: string;
  description: string | null;
  /** Accès donné par le profil (null pour un ancien profil à compléter). */
  role: Role | null;
  nbDroits: number;
  nbUtilisateurs: number;
}

/** ProfilRequestDTO côté backend. */
export interface ProfilRequest {
  nom: string;
  description?: string;
  role: Role;
}

/** DroitResponseDTO côté backend. */
export interface DroitResponse {
  id: string;
  action: string;
  description: string | null;
}

/** DroitRequestDTO côté backend. */
export interface DroitRequest {
  action: string;
  description?: string;
}

/** ProfilDroitsResponseDTO côté backend : un droit attribué à un profil. */
export interface ProfilDroitsResponse {
  id: string;
  profilId: string;
  profilNom: string;
  droitId: string;
  droitAction: string;
  droitDescription: string | null;
  dateAttribution: string;
  statut: StatutRole | null;
}
