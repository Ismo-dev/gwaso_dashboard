import { TypeCompte, StatutCompte, StatutRole } from '../../../core/models/enums.model';
import { Pagination } from '../../../core/models/page-response.model';

export type NiveauCuisine = 'DEBUTANT' | 'INTERMEDIAIRE' | 'EXPERT';

/** Libellé de chaque type de compte. */
/**
 * Justificatifs attendus pour chaque statut : affichés au demandeur (application)
 * et à l'administrateur (création de compte, carte de demande), pour parler de la même chose.
 */
export const JUSTIFICATIFS_ATTENDUS: Record<'CHEF' | 'PRODUCTEUR', string> = {
  CHEF: 'diplôme, attestation de formation, carte professionnelle…',
  PRODUCTEUR: 'photo du jardin, du champ, de l’étal ou de la boutique, carte de coopérative, registre de commerce…',
};

export const LIBELLES_TYPE_COMPTE: Record<TypeCompte, string> = {
  ADMIN: 'Administrateur',
  CUISINIER: 'Cuisinier',
  CHEF: 'Chef cuisinier',
  PRODUCTEUR: 'Producteur',
  LIVREUR: 'Livreur',
};

/** Icône Lucide de chaque type de compte. */
export const ICONES_TYPE_COMPTE: Record<TypeCompte, string> = {
  ADMIN: 'lucideShieldCheck',
  CUISINIER: 'lucideCookingPot',
  CHEF: 'lucideChefHat',
  PRODUCTEUR: 'lucideStore',
  LIVREUR: 'lucideBike',
};

/** Ce que chaque type de compte demande à la création (le type ne donne aucun droit). */
export const AIDES_TYPE_COMPTE: Record<TypeCompte, string> = {
  ADMIN: "Équipe Gwaso : se connecte au dashboard selon les droits de son profil",
  CUISINIER: 'Membre de la communauté (niveau en cuisine)',
  CHEF: 'Chef cuisinier (justificatif obligatoire)',
  PRODUCTEUR: 'Vend ses produits (localité et justificatif)',
  LIVREUR: 'Livre pour un fournisseur, qui l’ajoute depuis son espace',
};

/** Ordre d'affichage des types de compte. */
export const ORDRE_TYPES_COMPTE: TypeCompte[] = ['ADMIN', 'CUISINIER', 'CHEF', 'PRODUCTEUR', 'LIVREUR'];

/** Types créés depuis le dashboard : un livreur est ajouté par son fournisseur, dans son espace. */
export const TYPES_COMPTE_CREABLES: TypeCompte[] = ['ADMIN', 'CUISINIER', 'CHEF', 'PRODUCTEUR'];

export const LIBELLES_NIVEAU: Record<NiveauCuisine, string> = {
  DEBUTANT: 'Débutant',
  INTERMEDIAIRE: 'Intermédiaire',
  EXPERT: 'Expert',
};

/** Demande de statut (chef ou producteur) en attente de validation, affichée en carte. */
export interface DemandeStatut {
  /** Identifiant du compte concerné. */
  id: string;
  /**
   * compte : compte chef / producteur créé en attente (ancienne inscription ou création par un admin) ;
   * cuisinier : un cuisinier demande à devenir chef / producteur (demandeId = la demande).
   */
  origine: 'compte' | 'cuisinier';
  demandeId: string | null;
  motivation: string | null;
  type: 'CHEF' | 'PRODUCTEUR';
  nom: string;
  prenom: string;
  email: string | null;
  telephone: string | null;
  photoProfil: string | null;
  preuveUrl: string | null;
  localite: string | null;
  /** Fournisseur : position de sa localité sur la carte. */
  latitude?: number | null;
  longitude?: number | null;
  dateInscription: string;
}

/** Fiche d'un utilisateur, quel que soit son rôle (champs absents = sans objet pour ce rôle). */
export interface FicheUtilisateur {
  id: string;
  role: TypeCompte;
  nom: string;
  prenom: string;
  email: string | null;
  telephone: string | null;
  photoProfil: string | null;
  statutCompte: StatutCompte;
  dateInscription: string;
  profilId: string | null;
  profilNom: string | null;
  niveau?: NiveauCuisine | null;
  localite?: string | null;
  /** Fournisseur : position de sa localité sur la carte. */
  latitude?: number | null;
  longitude?: number | null;
  preuveUrl?: string | null;
  statutRole?: StatutRole;
  motifRejet?: string | null;
  dateValidation?: string | null;
  valideParAdminNom?: string | null;
  /** Livreur : pièce d'identité, paiement et fournisseur pour qui il livre. */
  pieceIdentiteUrl?: string | null;
  numeroMobileMoney?: string | null;
  operateur?: OperateurMobileMoney | null;
  disponible?: boolean;
  fournisseurId?: string | null;
  fournisseurNom?: string | null;
}

/** UtilisateurResumeDTO côté backend : une ligne de la liste de tous les utilisateurs. */
export interface UtilisateurResume {
  id: string;
  nom: string;
  prenom: string;
  email: string | null;
  telephone: string | null;
  photoProfil: string | null;
  role: TypeCompte;
  statutCompte: StatutCompte;
  dateInscription: string;
  profilId: string | null;
  profilNom: string | null;
}

/** AdminResponseDTO côté backend. */
export interface AdminResponse {
  id: string;
  nom: string;
  prenom: string;
  email: string | null;
  telephone: string | null;
  photoProfil: string | null;
  statut: StatutCompte;
  dateInscription: string;
  profilId: string | null;
  profilNom: string | null;
}

/** CuisinierResponseDTO côté backend. */
export interface CuisinierResponse {
  id: string;
  nom: string;
  prenom: string;
  email: string | null;
  telephone: string | null;
  photoProfil: string | null;
  niveau: NiveauCuisine | null;
  statut: StatutCompte;
  dateInscription: string;
  profilId: string | null;
  profilNom: string | null;
}

/** ChefCuisinierResponseDTO côté backend. */
export interface ChefCuisinierResponse {
  id: string;
  nom: string;
  prenom: string;
  email: string | null;
  telephone: string | null;
  photoProfil: string | null;
  preuveUrl: string | null;
  motifRejet: string | null;
  statutRole: StatutRole;
  dateValidation: string | null;
  valideParAdminId: string | null;
  valideParAdminNom: string | null;
  statutCompte: StatutCompte;
  dateInscription: string;
  profilId: string | null;
  profilNom: string | null;
}

/** ProducteurResponseDTO côté backend. */
export interface ProducteurResponse {
  id: string;
  nom: string;
  prenom: string;
  email: string | null;
  telephone: string | null;
  photoProfil: string | null;
  localite: string | null;
  latitude: number | null;
  longitude: number | null;
  preuveUrl: string | null;
  motifRejet: string | null;
  statutRole: StatutRole;
  dateValidation: string | null;
  valideParAdminId: string | null;
  valideParAdminNom: string | null;
  statutCompte: StatutCompte;
  dateInscription: string;
  profilId: string | null;
  profilNom: string | null;
}

/** AdminRequestDTO côté backend (création / modification d'un administrateur). */
export interface AdminRequest {
  nom: string;
  prenom: string;
  email?: string;
  telephone?: string;
  motDePasse?: string;
  photoProfil?: string;
}

/** CuisinierRequestDTO côté backend. */
export interface CuisinierRequest {
  nom: string;
  prenom: string;
  email?: string;
  telephone?: string;
  /** Obligatoire à la création, facultatif en modification (inchangé s'il est absent). */
  motDePasse?: string;
  niveau: NiveauCuisine;
}

/** ChefCuisinierRequestDTO côté backend. */
export interface ChefCuisinierRequest {
  nom: string;
  prenom: string;
  email?: string;
  telephone?: string;
  /** Obligatoire à la création, facultatif en modification (inchangé s'il est absent). */
  motDePasse?: string;
  /** Obligatoire : adresse renvoyée par POST /fichiers/justificatifs. */
  preuveUrl: string;
}

/** ProducteurRequestDTO côté backend. */
export interface ProducteurRequest {
  nom: string;
  prenom: string;
  email?: string;
  telephone?: string;
  /** Obligatoire à la création, facultatif en modification (inchangé s'il est absent). */
  motDePasse?: string;
  localite: string;
  /** Obligatoire : adresse renvoyée par POST /fichiers/justificatifs. */
  preuveUrl: string;
}

/** ValidationRoleRequestDTO côté backend (rejet d'un chef ou d'un producteur). */
export interface ValidationRoleRequest {
  motifRejet: string;
}

/** Filtres de GET /utilisateurs. */
export interface FiltresUtilisateurs extends Pagination {
  recherche?: string;
  role?: TypeCompte;
  statut?: StatutCompte;
}

/** Filtres de GET /utilisateurs/chefs et /utilisateurs/producteurs. */
export interface FiltresComptesAValider extends Pagination {
  recherche?: string;
  statut?: StatutCompte;
  statutRole?: StatutRole;
}

/** DemandeStatutResponseDTO : un cuisinier demande à devenir chef cuisinier ou producteur. */
export interface DemandeStatutResponse {
  id: string;
  type: 'CHEF' | 'PRODUCTEUR';
  statut: StatutRole;
  preuveUrl: string;
  localite: string | null;
  latitude: number | null;
  longitude: number | null;
  motivation: string | null;
  motifRejet: string | null;
  dateDemande: string;
  dateDecision: string | null;
  decideParNom: string | null;
  demandeurId: string;
  demandeurNom: string;
  demandeurPrenom: string;
  demandeurEmail: string | null;
  demandeurTelephone: string | null;
  demandeurPhotoProfil: string | null;
}

/** ProduitProducteurResponseDTO : un ingrédient que le producteur vend. */
export interface ProduitProducteurResponse {
  id: string;
  producteurId: string;
  ingredientId: string;
  ingredientNom: string;
  prixIndicatif: number | null;
  quantite: number | null;
  unite: string;
  imageUrl: string | null;
}

/** Lien OpenStreetMap centré sur un point (point de retrait d'un fournisseur). */
export function lienCarte(latitude: number, longitude: number): string {
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`;
}

export type OperateurMobileMoney = 'ORANGE_MONEY' | 'MOOV_MONEY';

export const LIBELLES_OPERATEUR: Record<OperateurMobileMoney, string> = {
  ORANGE_MONEY: 'Orange Money',
  MOOV_MONEY: 'Moov Money',
};

/** LivreurFicheResponseDTO côté backend : un livreur, ajouté par son fournisseur. */
export interface LivreurFicheResponse {
  id: string;
  nom: string;
  prenom: string;
  email: string | null;
  telephone: string | null;
  photoProfil: string | null;
  statutCompte: StatutCompte;
  dateInscription: string;
  profilId: string | null;
  profilNom: string | null;
  statutRole: StatutRole;
  motifRejet: string | null;
  pieceIdentiteUrl: string | null;
  numeroMobileMoney: string | null;
  operateur: OperateurMobileMoney | null;
  disponible: boolean;
  fournisseurId: string | null;
  fournisseurNom: string | null;
}
