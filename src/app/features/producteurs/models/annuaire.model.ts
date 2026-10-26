import { Pagination } from '../../../core/models/page-response.model';

/** Un produit d'un producteur : un ingrédient du catalogue, son prix indicatif et la quantité disponible. */
export interface ProduitAnnuaire {
  id: string;
  ingredientId: string;
  ingredientNom: string;
  ingredientPhotoUrl: string | null;
  /** Photo propre au produit (sinon on montre celle de l'ingrédient). */
  imageUrl: string | null;
  prixIndicatif: number | null;
  quantite: number | null;
  unite: string | null;
  categorieId?: string | null;
  categorieNom?: string | null;
}

/** AnnuaireProducteurDTO côté backend : un producteur validé et ce qu'il vend. */
export interface ProducteurAnnuaire {
  id: string;
  nom: string;
  prenom: string;
  photoProfil: string | null;
  localite: string | null;
  telephone: string | null;
  email: string | null;
  produits: ProduitAnnuaire[];
}

export interface FiltresAnnuaire extends Pagination {
  /** Nom, localité ou produit (« gombo » retrouve ceux qui en vendent). */
  recherche?: string;
  ingredientId?: string;
  categorieId?: string;
  localite?: string;
}
