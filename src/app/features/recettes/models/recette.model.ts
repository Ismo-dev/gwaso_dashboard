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
  /** Accroche sous le nom (« Riz au poisson façon sénégalaise »). */
  sousTitre: string | null;
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
  /** Catégorie principale (la première) ; voir aussi `categories`. */
  categorieId: string | null;
  categorieNom: string | null;
  /** Toutes les catégories de la recette (une recette peut en avoir plusieurs), la principale en premier. */
  categories: CategorieRecette[];
  auteurId: string | null;
  auteurNom: string | null;
  valideParAdminId: string | null;
  valideParAdminNom: string | null;
}

/** CategorieRecetteDTO côté backend : une catégorie de la recette. */
export interface CategorieRecette {
  id: string;
  nom: string;
}

/** Nombre maximal de catégories par recette (limite de l'API). */
export const MAX_CATEGORIES_RECETTE = 5;

/** Les catégories d'une recette en une ligne (« Plats · Fêtes »), ou null si elle n'en a aucune. */
export function nomsCategories(
  recette: Pick<RecetteResponse, 'categories' | 'categorieNom'>,
): string | null {
  const noms = recette.categories?.length
    ? recette.categories.map((c) => c.nom)
    : [recette.categorieNom];
  return noms.filter(Boolean).join(' · ') || null;
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
  sousTitre?: string | null;
  description?: string | null;
  dureeMin: number;
  nbPersonnes?: number | null;
  estMalienne?: boolean;
  telechargeable?: boolean;
  difficulte?: Difficulte;
  /** Une à cinq catégories ; la première devient la catégorie principale. */
  categorieIds: string[];
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

/** Langue d'un audio d'étape : la préparation guidée lit l'un ou l'autre. */
export type LangueAudio = 'FR' | 'BAMBARA';

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
