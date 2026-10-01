import { Pagination } from '../../../core/models/page-response.model';

export type StatutRecette =
  'BROUILLON' | 'EN_ATTENTE_VALIDATION' | 'PUBLIEE' | 'REJETEE' | 'ARCHIVEE';

export type Difficulte = 'FACILE' | 'MOYEN' | 'DIFFICILE';

/** Ordre de la liste (TriRecette côté backend). */
export type TriRecette = 'RECENTES' | 'ANCIENNES' | 'NOM_CROISSANT' | 'NOM_DECROISSANT';

/** RecetteResponseDTO côté backend. */
export interface RecetteResponse {
  id: string;
  nom: string;
  description: string | null;
  photoUrl: string | null;
  dureeMin: number | null;
  nbPersonnes: number | null;
  prixMin: number | null;
  prixMax: number | null;
  estMalienne: boolean;
  telechargeable: boolean;
  difficulte: Difficulte;
  statut: StatutRecette;
  motifRejet: string | null;
  dateCreation: string;
  datePublication: string | null;
  categorieId: string | null;
  categorieNom: string | null;
  auteurId: string | null;
  auteurNom: string | null;
  valideParAdminId: string | null;
  valideParAdminNom: string | null;
}

/** NomRecetteResponseDTO côté backend : autre nom sous lequel le plat est connu (ex. Tigadèguèna). */
export interface NomRecetteResponse {
  id: string;
  recetteId: string;
  nom: string;
}

/**
 * RecetteRequestDTO côté backend (création / modification).
 * Le budget (prixMin / prixMax) n'est pas saisi : l'API le calcule à partir des ingrédients.
 */
export interface RecetteRequest {
  nom: string;
  description?: string | null;
  dureeMin: number;
  nbPersonnes?: number | null;
  estMalienne?: boolean;
  telechargeable?: boolean;
  difficulte?: Difficulte;
  categorieId: string;
  /** À la création : les autres noms du même plat (ex. « Tigadèguèna » pour le mafé). */
  autresNoms?: string[];
}

/** RecetteIngredientRequestDTO côté backend : ajout d'un ingrédient à une recette. */
export interface RecetteIngredientRequest {
  recetteId: string;
  ingredientId: string;
  quantite: number;
  unite: string;
}

/** EtapeRequestDTO côté backend. L'ordre doit être unique dans la recette. */
export interface EtapeRequest {
  recetteId: string;
  ordre: number;
  titre: string;
  instructions: string;
  dureeMinutes?: number | null;
}

/** ValidationRecetteRequestDTO côté backend (rejet d'une recette). */
export interface ValidationRecetteRequest {
  motifRejet: string;
}

/** Filtres de GET /recettes (réservé à l'admin). */
export interface FiltresRecettes extends Pagination {
  recherche?: string;
  statut?: StatutRecette;
  categorieId?: string;
  auteurId?: string;
  tri?: TriRecette;
}

/** RecetteIngredientResponseDTO côté backend : un ingrédient et sa quantité dans la recette. */
export interface RecetteIngredientResponse {
  id: string;
  recetteId: string;
  recetteNom: string;
  ingredientId: string;
  ingredientNom: string;
  ingredientPhotoUrl: string | null;
  quantite: number | null;
  unite: string | null;
}

/** EtapeResponseDTO côté backend : une étape de préparation. */
export interface EtapeResponse {
  id: string;
  recetteId: string;
  recetteNom: string;
  ordre: number;
  titre: string | null;
  instructions: string | null;
  dureeMinutes: number | null;
  audioFrCacheUrl: string | null;
  audioBambaraCacheUrl: string | null;
  videoUrl: string | null;
  photoUrl: string | null;
}

/** EtapeIngredientResponseDTO côté backend : ingrédient utilisé dans une étape précise. */
export interface EtapeIngredientResponse {
  id: string;
  etapeId: string;
  etapeOrdre: number;
  ingredientId: string;
  ingredientNom: string;
  quantite: number;
  unite: string;
}

/** EtapeIngredientRequestDTO côté backend. */
export interface EtapeIngredientRequest {
  etapeId: string;
  ingredientId: string;
  quantite: number;
  unite: string;
}

/** EtapeUstensileResponseDTO côté backend : ustensile utilisé dans une étape précise. */
export interface EtapeUstensileResponse {
  id: string;
  etapeId: string;
  etapeOrdre: number;
  ustensileId: string;
  ustensileNom: string;
  quantite: number | null;
  /** Alternatives proposées POUR CETTE ÉTAPE (« si vous n'en avez pas »). */
  alternatives: EtapeUstensileAlternativeResponse[];
}

/** EtapeUstensileAlternativeResponseDTO côté backend : alternative propre à l'ustensile d'une étape. */
export interface EtapeUstensileAlternativeResponse {
  id: string;
  etapeUstensileId: string;
  alternativeId: string;
  alternativeNom: string;
  alternativeDescription: string | null;
  alternativeImageUrl: string | null;
}

/** EtapeUstensileRequestDTO côté backend. */
export interface EtapeUstensileRequest {
  etapeId: string;
  ustensileId: string;
  quantite?: number | null;
}
