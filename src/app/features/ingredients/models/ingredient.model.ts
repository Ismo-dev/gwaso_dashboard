export type Unite =
  | 'G'
  | 'KG'
  | 'ML'
  | 'L'
  | 'PIECE'
  | 'CUILLERE_SOUPE'
  | 'CUILLERE_CAFE'
  | 'PINCEE'
  | 'BOL'
  | 'TASSE'
  | 'SACHET';

/** Unités proposées dans les formulaires, dans l'ordre d'usage le plus courant. */
export const UNITES: { valeur: Unite; libelle: string }[] = [
  { valeur: 'KG', libelle: 'Kilogramme (kg)' },
  { valeur: 'G', libelle: 'Gramme (g)' },
  { valeur: 'L', libelle: 'Litre (L)' },
  { valeur: 'ML', libelle: 'Millilitre (ml)' },
  { valeur: 'PIECE', libelle: 'Pièce' },
  { valeur: 'CUILLERE_SOUPE', libelle: 'Cuillère à soupe' },
  { valeur: 'CUILLERE_CAFE', libelle: 'Cuillère à café' },
  { valeur: 'PINCEE', libelle: 'Pincée' },
  { valeur: 'BOL', libelle: 'Bol' },
  { valeur: 'TASSE', libelle: 'Tasse' },
  { valeur: 'SACHET', libelle: 'Sachet' },
];

/**
 * Statut d'un ingrédient ou d'un ustensile : un chef peut proposer ce qui manque au catalogue,
 * l'administration valide ou refuse.
 */
export type StatutCatalogue = 'EN_ATTENTE' | 'VALIDE' | 'REFUSE';

/** Champs communs à un ingrédient et à un ustensile proposés par un chef. */
export interface PropositionChef {
  statut?: StatutCatalogue;
  motifRefus?: string | null;
  proposeParId?: string | null;
  proposeParNom?: string | null;
}

/** IngredientResponseDTO côté backend. */
export interface IngredientResponse extends PropositionChef {
  id: string;
  nom: string;
  photoUrl: string | null;
  unite: Unite | null;
  prixMin: number | null;
  prixMax: number | null;
  categorieId?: string | null;
  categorieNom?: string | null;
}

/** L'élément fait partie du catalogue validé (les anciens n'ont pas de statut). */
export function estValide(element: PropositionChef): boolean {
  return !element.statut || element.statut === 'VALIDE';
}

/** IngredientRequestDTO côté backend. */
export interface IngredientRequest {
  nom: string;
  photoUrl?: string;
  unite: Unite;
  prixMin?: number | null;
  prixMax?: number | null;
  categorieId?: string | null;
}
