import { StatutRole } from '../../../core/models/enums.model';

/** ProfilResponseDTO côté backend. */
export interface ProfilResponse {
  id: string;
  nom: string;
  description: string | null;
  /** Profil donné aux personnes qui s'inscrivent dans l'application. */
  inscription: boolean;
  /** Profil des administrateurs : tous les droits, ni supprimable ni désactivable. */
  systeme: boolean;
  /** false : désactivé (plus proposé, ses droits ne sont plus donnés). */
  actif: boolean;
  nbDroits: number;
  nbUtilisateurs: number;
}

/** ProfilRequestDTO côté backend. */
export interface ProfilRequest {
  nom: string;
  description?: string;
  inscription?: boolean;
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
  ACCES: { libelle: 'Dashboard', icone: 'lucideLayoutDashboard' },
  CATALOGUE: { libelle: 'Catalogue', icone: 'lucideLayoutGrid' },
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

/** Codes des droits utilisés par le dashboard (CatalogueDroits côté API). */
export const DROITS = {
  ACCES_DASHBOARD: 'ACCES_DASHBOARD',
  RECETTE_CREER: 'RECETTE_CREER',
  RECETTE_VALIDER: 'RECETTE_VALIDER',
  DEFI_PROPOSER: 'DEFI_PROPOSER',
  DEFI_VALIDER: 'DEFI_VALIDER',
  VIDEO_MODERER: 'VIDEO_MODERER',
  CATALOGUE_GERER: 'CATALOGUE_GERER',
  UTILISATEUR_GERER: 'UTILISATEUR_GERER',
  PROFIL_GERER: 'PROFIL_GERER',
  PRODUIT_GERER: 'PRODUIT_GERER',
} as const;

/** Droits que le profil système garde toujours (sinon plus personne ne pourrait administrer Gwaso). */
export const DROITS_INDISPENSABLES: string[] = [DROITS.ACCES_DASHBOARD, DROITS.PROFIL_GERER];
