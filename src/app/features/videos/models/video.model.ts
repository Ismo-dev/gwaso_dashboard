import { TypeCompte, StatutCompte } from '../../../core/models/enums.model';
import { Pagination } from '../../../core/models/page-response.model';

export type StatutVideo =
  'BROUILLON' | 'EN_ATTENTE_VALIDATION' | 'PUBLIEE' | 'REJETEE' | 'DESACTIVEE';

export type TypeVideo = 'RECETTE' | 'ASTUCE' | 'TECHNIQUE' | 'GENERAL';

/** VideoResponseDTO côté backend. */
export interface VideoResponse {
  id: string;
  titre: string;
  description: string | null;
  type: TypeVideo;
  statut: StatutVideo;
  motifModeration: string | null;
  videoUrl: string | null;
  miniatureUrl: string | null;
  dureeSecondes: number | null;
  tailleOctets: number | null;
  recetteId: string | null;
  recetteNom: string | null;
  auteurId: string;
  auteurNom: string;
  auteurPrenom: string;
  auteurPhotoProfil: string | null;
  nbVues: number;
  nbJaime: number;
  nbCommentaires: number;
  nbPartages: number;
  nbTelechargements: number;
  dateCreation: string;
  dateModification: string | null;
  dateSoumission: string | null;
  datePublication: string | null;
  dateModeration: string | null;
  modereParNom: string | null;
}

/** AuteurVideoDTO côté backend : fiche de l'auteur vue par l'admin. */
export interface AuteurVideo {
  id: string;
  nom: string;
  prenom: string;
  email: string | null;
  telephone: string | null;
  photoProfil: string | null;
  role: TypeCompte;
  statutCompte: StatutCompte;
  dateInscription: string;
  nbVideosTotal: number;
  nbVideosPubliees: number;
  nbVideosRejetees: number;
  nbVideosDesactivees: number;
}

/** VideoAdminResponseDTO côté backend (GET /videos/admin/{id}). */
export interface VideoAdminResponse {
  video: VideoResponse;
  auteur: AuteurVideo;
}

/** CommentaireResponseDTO côté backend. */
export interface CommentaireResponse {
  id: string;
  videoId: string;
  contenu: string;
  utilisateurId: string;
  utilisateurNom: string;
  utilisateurPrenom: string;
  utilisateurPhotoProfil: string | null;
  dateCreation: string;
  dateModification: string | null;
}

/**
 * VideoRequestDTO côté backend. Avec une recette, le type devient RECETTE ;
 * sans recette, on choisit ASTUCE, TECHNIQUE ou GENERAL.
 */
export interface VideoRequest {
  titre: string;
  description?: string | null;
  type?: TypeVideo | null;
  recetteId?: string | null;
  dureeSecondes?: number | null;
}

/** Avancement d'un envoi de fichier : pourcentage, puis la vidéo mise à jour à la fin. */
export type EnvoiVideo = { etape: 'progression'; pourcentage: number } | { etape: 'termine'; video: VideoResponse };

/** ModerationVideoRequestDTO côté backend (rejet ou désactivation). */
export interface ModerationVideoRequest {
  motif: string;
}

/** Filtres de GET /videos/admin. */
export interface FiltresVideos extends Pagination {
  recherche?: string;
  statut?: StatutVideo;
  type?: TypeVideo;
  auteurId?: string;
  recetteId?: string;
}

/** Libellés des types de vidéo. */
export const LIBELLES_TYPE_VIDEO: Record<TypeVideo, string> = {
  RECETTE: 'Recette',
  ASTUCE: 'Astuce',
  TECHNIQUE: 'Technique',
  GENERAL: 'Général',
};

/** ReactionResponseDTO côté backend : mes réactions sur une vidéo et le total de « j'aime ». */
export interface ReactionResponse {
  videoId: string;
  reactions: ('AIME' | 'EPINGLE' | 'ENREGISTRE')[];
  nbJaime: number;
}

/** Durée lisible : 75 → « 1:15 ». */
export function formaterDuree(secondes: number | null): string {
  if (secondes === null || secondes < 0) {
    return '';
  }
  const minutes = Math.floor(secondes / 60);
  const reste = Math.floor(secondes % 60);
  return `${minutes}:${reste.toString().padStart(2, '0')}`;
}

/** Taille lisible : 15 728 640 → « 15 Mo ». */
export function formaterTaille(octets: number | null): string {
  if (!octets) {
    return '';
  }
  const mo = octets / (1024 * 1024);
  return mo >= 1 ? `${mo.toLocaleString('fr', { maximumFractionDigits: 1 })} Mo` : `${Math.round(octets / 1024)} Ko`;
}
