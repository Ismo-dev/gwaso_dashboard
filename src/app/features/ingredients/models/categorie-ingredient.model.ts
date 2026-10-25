/** CategorieIngredientResponseDTO côté backend : rayon / catégorie d'ingrédient. */
export interface CategorieIngredientResponse {
  id: string;
  nom: string;
  description: string | null;
}

/** CategorieIngredientRequestDTO côté backend. */
export interface CategorieIngredientRequest {
  nom: string;
  description?: string;
}
