import { PropositionChef } from '../../ingredients/models/ingredient.model';

/** UstensileResponseDTO côté backend. */
export interface UstensileResponse extends PropositionChef {
  id: string;
  nom: string;
  photoUrl: string | null;
  description: string | null;
}

/** UstensileRequestDTO côté backend. */
export interface UstensileRequest {
  nom: string;
  photoUrl?: string;
  description?: string;
}

/**
 * AlternativeUstensileResponseDTO côté backend : un objet qui peut remplacer un ustensile
 * (ex. une bouteille en verre à la place d'un rouleau à pâtisserie).
 * Les alternatives forment un petit catalogue à part ; chaque étape de recette choisit les siennes.
 */
export interface AlternativeUstensileResponse {
  id: string;
  nom: string;
  imageUrl: string | null;
  description: string | null;
}

/** AlternativeUstensileRequestDTO côté backend. */
export interface AlternativeUstensileRequest {
  nom: string;
  imageUrl?: string;
  description?: string;
}
