/** CategorieResponseDTO côté backend. */
export interface CategorieResponse {
  id: string;
  nom: string;
  description: string | null;
  imageUrl: string | null;
}

/** CategorieRequestDTO côté backend. */
export interface CategorieRequest {
  nom: string;
  description?: string;
  imageUrl?: string;
}
