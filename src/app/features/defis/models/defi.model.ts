import { Pagination } from '../../../core/models/page-response.model';

/**
 * Cycle de vie d'un défi : PROPOSE (par un chef) → VALIDE ou REJETE (admin) ;
 * VALIDE → EN_COURS → TERMINE ; ANNULE à tout moment. Un défi créé par un admin est validé directement.
 */
export type StatutDefi = 'PROPOSE' | 'VALIDE' | 'REJETE' | 'EN_COURS' | 'TERMINE' | 'ANNULE';

/** DefiResponseDTO côté backend. */
export interface DefiResponse {
  id: string;
  nom: string;
  /** Textes mis en forme (HTML simple) : afficher avec <app-texte-riche>. */
  description: string | null;
  regles: string | null;
  dateDebut: string;
  dateFin: string;
  conditionsParticipation: string | null;
  criteresClassement: string | null;
  statut: StatutDefi;
  dateValidation: string | null;
  motifRejet: string | null;
  classementPublie: boolean;
  datePublicationClassement: string | null;
  recetteId: string | null;
  recetteNom: string | null;
  /** Null pour un défi créé par l'administration. */
  chefCuisinierId: string | null;
  chefCuisinierNom: string | null;
  valideParAdminId: string | null;
  valideParAdminNom: string | null;
}

/** DefiRequestDTO côté backend (création / modification). Dates au format AAAA-MM-JJ. */
export interface DefiRequest {
  nom: string;
  description: string;
  regles?: string | null;
  dateDebut: string;
  dateFin: string;
  conditionsParticipation?: string | null;
  criteresClassement?: string | null;
  recetteId: string;
}

/** ParticipationDefiResponseDTO côté backend : un cuisinier inscrit au défi. */
export interface ParticipationDefiResponse {
  id: string;
  cuisinierId: string;
  cuisinierNom: string;
  cuisinierPrenom: string | null;
  cuisinierPhotoProfil: string | null;
  defiId: string;
  defiNom: string;
  dateParticipation: string;
  dateSoumission: string | null;
  /** Photo ou vidéo envoyée comme preuve. */
  preuveUrl: string | null;
  score: number | null;
  classement: number | null;
}

/** Filtres de GET /defis. */
export interface FiltresDefis extends Pagination {
  recherche?: string;
  statut?: StatutDefi;
}

/** Une preuve vidéo se reconnaît à son extension (sinon c'est une photo). */
export function estVideo(url: string | null): boolean {
  return !!url && /\.(mp4|mov|webm|mkv|m4v)(\?|$)/i.test(url);
}
