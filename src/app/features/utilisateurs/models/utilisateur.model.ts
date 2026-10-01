import { Role, StatutCompte, StatutRole } from '../../../core/models/enums.model';
import { Pagination } from '../../../core/models/page-response.model';

export type NiveauCuisine = 'DEBUTANT' | 'INTERMEDIAIRE' | 'EXPERT';

/** Libellés affichés pour chaque rôle. */
export const LIBELLES_ROLE: Record<Role, string> = {
  ADMIN: 'Administrateur',
  CUISINIER: 'Cuisinier',
  CHEF: 'Chef cuisinier',
  PRODUCTEUR: 'Producteur',
};

/** Icône Lucide de chaque rôle. */
export const ICONES_ROLE: Record<Role, string> = {
  ADMIN: 'lucideShieldCheck',
  CUISINIER: 'lucideCookingPot',
  CHEF: 'lucideChefHat',
  PRODUCTEUR: 'lucideStore',
};

export const LIBELLES_NIVEAU: Record<NiveauCuisine, string> = {
  DEBUTANT: 'Débutant',
  INTERMEDIAIRE: 'Intermédiaire',
  EXPERT: 'Expert',
};

/** Demande de statut (chef ou producteur) en attente de validation, affichée en carte. */
export interface DemandeStatut {
  id: string;
  type: 'CHEF' | 'PRODUCTEUR';
  nom: string;
  prenom: string;
  email: string | null;
  telephone: string | null;
  photoProfil: string | null;
  preuveUrl: string | null;
  localite: string | null;
  dateInscription: string;
}

/** Fiche d'un utilisateur, quel que soit son rôle (champs absents = sans objet pour ce rôle). */
export interface FicheUtilisateur {
  id: string;
  role: Role;
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
  preuveUrl?: string | null;
  statutRole?: StatutRole;
  motifRejet?: string | null;
  dateValidation?: string | null;
  valideParAdminNom?: string | null;
}

/** UtilisateurResumeDTO côté backend : une ligne de la liste de tous les utilisateurs. */
export interface UtilisateurResume {
  id: string;
  nom: string;
  prenom: string;
  email: string | null;
  telephone: string | null;
  photoProfil: string | null;
  role: Role;
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
  motDePasse: string;
  niveau: NiveauCuisine;
}

/** ChefCuisinierRequestDTO côté backend. */
export interface ChefCuisinierRequest {
  nom: string;
  prenom: string;
  email?: string;
  telephone?: string;
  motDePasse: string;
}

/** ProducteurRequestDTO côté backend. */
export interface ProducteurRequest {
  nom: string;
  prenom: string;
  email?: string;
  telephone?: string;
  motDePasse: string;
  localite: string;
}

/** ValidationRoleRequestDTO côté backend (rejet d'un chef ou d'un producteur). */
export interface ValidationRoleRequest {
  motifRejet: string;
}

/** Filtres de GET /utilisateurs. */
export interface FiltresUtilisateurs extends Pagination {
  recherche?: string;
  role?: Role;
  statut?: StatutCompte;
}

/** Filtres de GET /utilisateurs/chefs et /utilisateurs/producteurs. */
export interface FiltresComptesAValider extends Pagination {
  recherche?: string;
  statut?: StatutCompte;
  statutRole?: StatutRole;
}
