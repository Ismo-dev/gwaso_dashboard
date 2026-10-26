import { Unite } from '../../ingredients/models/ingredient.model';

/** ProduitProducteurRequestDTO côté backend : mise en vente ou modification d'un produit. */
export interface ProduitProducteurRequest {
  ingredientId: string;
  prixIndicatif: number;
  quantite: number;
  unite: Unite;
  imageUrl?: string | null;
}

/** ProduitProducteurResponseDTO côté backend : produit vendu par le producteur. */
export interface ProduitProducteurResponse {
  id: string;
  producteurId: string;
  producteurNom: string;
  producteurLocalite: string | null;
  producteurTelephone: string | null;
  ingredientId: string;
  ingredientNom: string;
  ingredientPhotoUrl?: string | null;
  categorieId?: string | null;
  categorieNom?: string | null;
  prixIndicatif: number;
  quantite: number;
  unite: Unite;
  imageUrl: string | null;
}
