import { Role, StatutRole } from '../../../core/models/enums.model';

/**
 * Type de compte créé avec un profil : où la personne se connecte (dashboard ou application)
 * et quelles informations demander à la création. Côté API, c'est le champ « role » du profil.
 * Chaque utilisateur a un seul profil ; plusieurs profils peuvent avoir le même type
 * (ex. « Administrateur » et « Consultant » pour le dashboard).
 */
export const ACCES_PROFIL: Record<Role, { libelle: string; aide: string; icone: string }> = {
  ADMIN: {
    libelle: "Dashboard d'administration",
    aide: 'Gère la plateforme depuis ce dashboard',
    icone: 'lucideShieldCheck',
  },
  CUISINIER: {
    libelle: 'Application · cuisinier',
    aide: 'Suit les recettes, participe aux défis',
    icone: 'lucideCookingPot',
  },
  CHEF: {
    libelle: 'Application · chef cuisinier',
    aide: 'Publie ses recettes, propose des défis',
    icone: 'lucideChefHat',
  },
  PRODUCTEUR: {
    libelle: 'Application · producteur',
    aide: 'Vend ses produits locaux',
    icone: 'lucideStore',
  },
};

/** Ordre d'affichage des accès. */
export const ORDRE_ACCES: Role[] = ['ADMIN', 'CHEF', 'CUISINIER', 'PRODUCTEUR'];

/** ProfilResponseDTO côté backend. */
export interface ProfilResponse {
  id: string;
  nom: string;
  description: string | null;
  /** Type de compte créé avec ce profil (null pour un ancien profil pas encore relié). */
  role: Role | null;
  /** Profil donné aux inscriptions de ce type de compte (depuis l'application). */
  parDefaut: boolean;
  /** false : désactivé (plus proposé, ses droits ne sont plus donnés). */
  actif: boolean;
  nbDroits: number;
  nbUtilisateurs: number;
}

/** ProfilRequestDTO côté backend. */
export interface ProfilRequest {
  nom: string;
  description?: string;
  role: Role;
  parDefaut?: boolean;
}

/** DroitResponseDTO côté backend. */
export interface DroitResponse {
  id: string;
  action: string;
  description: string | null;
  /** false : désactivé (gardé dans le catalogue, donné à personne). */
  actif: boolean;
}

/** DroitRequestDTO côté backend. */
export interface DroitRequest {
  action: string;
  description?: string;
}

/** ProfilDroitsResponseDTO côté backend : un droit attribué à un profil. */
export interface ProfilDroitsResponse {
  id: string;
  profilId: string;
  profilNom: string;
  droitId: string;
  droitAction: string;
  droitDescription: string | null;
  droitActif: boolean;
  dateAttribution: string;
  statut: StatutRole | null;
}

/** Droit à afficher (catalogue ou droit d'un profil), réduit à ce qui sert à l'affichage. */
export interface DroitAffiche {
  id: string;
  action: string;
  description: string | null;
  actif: boolean;
}

/** Droits d'un même domaine (RECETTE_..., VIDEO_...). */
export interface GroupeDroits {
  cle: string;
  libelle: string;
  icone: string;
  droits: DroitAffiche[];
}

/** Domaines connus : le préfixe du code (avant le premier « _ ») donne le domaine. */
const DOMAINES: Record<string, { libelle: string; icone: string }> = {
  RECETTE: { libelle: 'Recettes', icone: 'lucideBookOpen' },
  VIDEO: { libelle: 'Vidéos', icone: 'lucideClapperboard' },
  DEFI: { libelle: 'Défis', icone: 'lucideTrophy' },
  UTILISATEUR: { libelle: 'Utilisateurs', icone: 'lucideUsers' },
  USER: { libelle: 'Utilisateurs', icone: 'lucideUsers' },
  PROFIL: { libelle: 'Profils et droits', icone: 'lucideShieldCheck' },
  PRODUIT: { libelle: 'Produits', icone: 'lucideStore' },
  CATEGORIE: { libelle: 'Catégories', icone: 'lucideLayoutGrid' },
  INGREDIENT: { libelle: 'Ingrédients', icone: 'lucideCarrot' },
  USTENSILE: { libelle: 'Ustensiles', icone: 'lucideUtensilsCrossed' },
  COMMENTAIRE: { libelle: 'Commentaires', icone: 'lucideMessageCircle' },
};

/** « RECETTE_VALIDER » → « Recette valider » (quand le droit n'a pas de description). */
export function libelleDroit(droit: Pick<DroitAffiche, 'action' | 'description'>): string {
  if (droit.description?.trim()) {
    return droit.description.trim();
  }
  const texte = droit.action.toLowerCase().replace(/_/g, ' ');
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

/** Regroupe les droits par domaine (ordre alphabétique des domaines, « Autres » à la fin). */
export function grouperDroits(droits: DroitAffiche[]): GroupeDroits[] {
  const groupes = new Map<string, GroupeDroits>();
  for (const droit of droits) {
    const prefixe = droit.action.split('_')[0].toUpperCase();
    const domaine = DOMAINES[prefixe];
    const cle = domaine ? domaine.libelle : 'AUTRES';
    if (!groupes.has(cle)) {
      groupes.set(cle, {
        cle,
        libelle: domaine?.libelle ?? 'Autres droits',
        icone: domaine?.icone ?? 'lucideKeyRound',
        droits: [],
      });
    }
    groupes.get(cle)!.droits.push(droit);
  }
  return [...groupes.values()]
    .map((g) => ({ ...g, droits: [...g.droits].sort((a, b) => libelleDroit(a).localeCompare(libelleDroit(b), 'fr')) }))
    .sort((a, b) => (a.cle === 'AUTRES' ? 1 : b.cle === 'AUTRES' ? -1 : a.libelle.localeCompare(b.libelle, 'fr')));
}
