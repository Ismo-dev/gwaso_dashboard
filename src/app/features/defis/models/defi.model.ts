import { TypeCompte } from '../../../core/models/enums.model';
import { Pagination } from '../../../core/models/page-response.model';

/**
 * Cycle de vie d'un défi : PROPOSE (par un chef) → VALIDE ou REJETE (admin).
 * Ensuite le statut suit les dates, sans action de l'admin : VALIDE → EN_COURS le jour du début,
 * → TERMINE après le jour de fin. Seule l'annulation (ANNULE) est manuelle.
 * Un défi créé par un admin est validé directement.
 */
export type StatutDefi = 'PROPOSE' | 'VALIDE' | 'REJETE' | 'EN_COURS' | 'TERMINE' | 'ANNULE';

/** Comment on participe : REALISATION (photo, vidéo d'un plat), REPONSE (devinette) ou QUIZ (questions chronométrées). */
export type ModeParticipation = 'REALISATION' | 'REPONSE' | 'QUIZ';

/**
 * Ce que les participants voient pour répondre : rien de plus, des ingrédients du catalogue
 * (« quel plat avec ces ingrédients ? ») ou un ustensile en photo (« quel est cet ustensile ? »).
 */
export type ElementsDefi = 'AUCUN' | 'INGREDIENTS' | 'USTENSILES';

export const LIBELLES_ELEMENTS: Record<ElementsDefi, { titre: string; aide: string; icone: string }> = {
  AUCUN: { titre: 'Rien de plus', aide: 'La question et les photos du défi suffisent', icone: 'lucideCircleHelp' },
  INGREDIENTS: { titre: 'Des ingrédients', aide: 'On les montre en photo : quel plat peut-on faire ?', icone: 'lucideCarrot' },
  USTENSILES: { titre: 'Un ustensile', aide: 'On montre sa photo, sans son nom : comment s’appelle-t-il ?', icone: 'lucideUtensilsCrossed' },
};

/** Ingrédient ou ustensile montré aux participants (ElementDefiDTO). Nom null : ustensile à deviner. */
export interface ElementDefi {
  id: string | null;
  nom: string | null;
  photoUrl: string | null;
}

export const LIBELLES_MODE: Record<ModeParticipation, string> = {
  REALISATION: 'Réalisation (photo ou vidéo)',
  REPONSE: 'Réponse (devinette)',
  QUIZ: 'Quiz (questions chronométrées)',
};

/** Points d'une bonne réponse quand l'auteur n'en précise pas. */
export const POINTS_PAR_DEFAUT = 10;

/** Temps proposés pour une question de quiz, en secondes. */
export const DUREES_QUESTION = [10, 15, 20, 30, 45, 60, 90, 120];

/** Question de quiz (QuestionDefiDTO) : réponses visibles par l'auteur et les admins seulement. */
export interface QuestionDefi {
  id: string;
  ordre: number;
  enonce: string;
  dureeSecondes: number;
  points: number;
  reponsesAcceptees: string[];
  /** Choix proposés ; vide = réponse libre. */
  propositions: string[];
}

/** QuestionDefiRequestDTO. */
export interface QuestionDefiRequest {
  enonce: string;
  dureeSecondes: number;
  points: number;
  reponsesAcceptees: string[];
  propositions: string[];
}

/** TypeDefiResponseDTO côté backend : « Recette imposée », « Plat libre », « Devinette »... */
export interface TypeDefiResponse {
  id: string;
  nom: string;
  description: string | null;
  /** true : le défi doit être lié à une recette. */
  recetteObligatoire: boolean;
  modeParticipation: ModeParticipation;
  elements: ElementsDefi;
}

export interface TypeDefiRequest {
  nom: string;
  description: string | null;
  recetteObligatoire: boolean;
  modeParticipation: ModeParticipation;
  elements: ElementsDefi;
}

/** PhotoDefiResponseDTO côté backend. */
export interface PhotoDefiResponse {
  id: string;
  defiId: string;
  url: string;
  dateAjout: string;
}

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
  typeDefiId: string | null;
  typeDefiNom: string | null;
  modeParticipation: ModeParticipation | null;
  /** Devinette : la bonne réponse (visible par l'auteur et les admins seulement). */
  reponseAttendue: string | null;
  recetteId: string | null;
  recetteNom: string | null;
  /** Null pour un défi créé par l'administration. */
  chefCuisinierId: string | null;
  chefCuisinierNom: string | null;
  valideParAdminId: string | null;
  valideParAdminNom: string | null;
  /** true : ce sont les admins qui notent ; false : c'est le chef auteur du défi. */
  noteParAdmin: boolean;
  nbParticipants: number;
  photoCouvertureUrl: string | null;
  elements: ElementsDefi | null;
  ingredients: ElementDefi[];
  ustensiles: ElementDefi[];
  /** Devinette : autres bonnes réponses (« tigadèguèna » pour « mafé »), auteur et admins seulement. */
  autresReponses: string[];
  /** Devinette : points d'une bonne réponse ; quiz : total des points. */
  points: number | null;
  /** Quiz : nombre de questions et temps total en secondes. */
  nbQuestions: number;
  dureeQuizSecondes: number;
  /** Quiz : questions avec leurs réponses (auteur et admins seulement). */
  questions: QuestionDefi[];
}

/** DefiRequestDTO côté backend (création / modification). Dates au format AAAA-MM-JJ. */
export interface DefiRequest {
  nom: string;
  typeDefiId: string;
  description: string;
  regles?: string | null;
  dateDebut: string;
  dateFin: string;
  conditionsParticipation?: string | null;
  criteresClassement?: string | null;
  /** Obligatoire seulement si le type l'exige. */
  recetteId?: string | null;
  reponseAttendue?: string | null;
  /** Devinette « quel plat avec ces ingrédients ? ». */
  ingredientIds?: string[];
  /** Devinette « quel est cet ustensile ? ». */
  ustensileIds?: string[];
  /** Devinette : autres bonnes réponses. */
  autresReponses?: string[];
  /** Devinette : points d'une bonne réponse. */
  points?: number | null;
  /** Quiz : les questions dans l'ordre. */
  questions?: QuestionDefiRequest[];
}

/** ParticipationDefiResponseDTO côté backend : un membre inscrit au défi (cuisinier, chef, producteur ou admin). */
export interface ParticipationDefiResponse {
  id: string;
  participantId: string;
  participantNom: string;
  participantPrenom: string | null;
  participantPhotoProfil: string | null;
  participantRole: TypeCompte | null;
  defiId: string;
  defiNom: string;
  dateParticipation: string;
  dateSoumission: string | null;
  /** Photo ou vidéo envoyée comme preuve. */
  preuveUrl: string | null;
  /** Devinette : la réponse proposée. */
  reponse: string | null;
  score: number | null;
  classement: number | null;
  /** Devinette corrigée automatiquement : réponse juste ou non. */
  reponseCorrecte: boolean | null;
  /** Quiz : bonnes réponses et temps total (millisecondes). */
  bonnesReponses: number | null;
  tempsTotalMs: number | null;
}

/** Filtres de GET /defis. */
export interface FiltresDefis extends Pagination {
  recherche?: string;
  statut?: StatutDefi;
  /** Défis proposés par ce chef. */
  chefId?: string;
}

/** Une preuve vidéo se reconnaît à son extension (sinon c'est une photo). */
export function estVideo(url: string | null): boolean {
  return !!url && /\.(mp4|mov|webm|mkv|m4v)(\?|$)/i.test(url);
}

/** Icône d'un type de défi : recette imposée, devinette, quiz ou plat libre. */
export function iconeType(
  type: Pick<TypeDefiResponse, 'recetteObligatoire' | 'modeParticipation'> & { elements?: ElementsDefi | null } | null,
): string {
  if (type?.elements === 'INGREDIENTS' || type?.elements === 'USTENSILES') {
    return LIBELLES_ELEMENTS[type.elements].icone;
  }
  if (type?.modeParticipation === 'REPONSE') {
    return 'lucideCircleHelp';
  }
  if (type?.modeParticipation === 'QUIZ') {
    return 'lucideListChecks';
  }
  return type?.recetteObligatoire ? 'lucideBookOpen' : 'lucideCookingPot';
}
