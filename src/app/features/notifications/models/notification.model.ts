import { TypeCompte } from '../../../core/models/enums.model';
import { Pagination } from '../../../core/models/page-response.model';

/** Ce qui s'est passé (TypeNotification côté backend). */
export type TypeNotification =
  | 'INSCRIPTION'
  | 'DEMANDE_CHEF'
  | 'DEMANDE_PRODUCTEUR'
  | 'ADMIN_AJOUTE'
  | 'RECETTE_A_VALIDER'
  | 'VIDEO_A_VALIDER'
  | 'DEFI_A_VALIDER'
  | 'PARTICIPATION_DEFI'
  | 'DEFI_TERMINE'
  | 'INGREDIENT_PROPOSE';

/** NotificationResponseDTO côté backend. */
export interface NotificationResponse {
  id: string;
  type: TypeNotification;
  titre: string;
  message: string | null;
  acteurId: string | null;
  acteurNom: string | null;
  acteurPrenom: string | null;
  acteurPhotoProfil: string | null;
  acteurRole: TypeCompte | null;
  /** Élément concerné : recette, vidéo, défi ou compte selon le type. */
  cibleId: string | null;
  dateCreation: string;
  dateLecture: string | null;
  lue: boolean;
}

export interface FiltresNotifications extends Pagination {
  nonLues?: boolean;
}

/** Ce que le dashboard affiche pour chaque type : catégorie, icône, couleur et action. */
export interface InfosType {
  categorie: string;
  icone: string;
  ton: 'terre' | 'karite' | 'cacao' | 'vert';
  /** Libellé du bouton qui mène à l'élément. */
  action: string;
  /** true : une décision de l'administrateur est attendue. */
  aDecider: boolean;
}

export const INFOS_TYPES: Record<TypeNotification, InfosType> = {
  INSCRIPTION: { categorie: 'Nouveau membre', icone: 'lucideUserPlus', ton: 'vert', action: 'Voir le compte', aDecider: false },
  DEMANDE_CHEF: { categorie: 'Demande de statut', icone: 'lucideChefHat', ton: 'terre', action: 'Examiner la demande', aDecider: true },
  DEMANDE_PRODUCTEUR: { categorie: 'Demande de statut', icone: 'lucideStore', ton: 'terre', action: 'Examiner la demande', aDecider: true },
  ADMIN_AJOUTE: { categorie: 'Administration', icone: 'lucideShieldCheck', ton: 'cacao', action: 'Voir le compte', aDecider: false },
  RECETTE_A_VALIDER: { categorie: 'Recette à valider', icone: 'lucideBookOpen', ton: 'terre', action: 'Examiner la recette', aDecider: true },
  VIDEO_A_VALIDER: { categorie: 'Vidéo à valider', icone: 'lucideClapperboard', ton: 'terre', action: 'Regarder la vidéo', aDecider: true },
  DEFI_A_VALIDER: { categorie: 'Défi proposé', icone: 'lucideTrophy', ton: 'terre', action: 'Examiner le défi', aDecider: true },
  PARTICIPATION_DEFI: { categorie: 'Participation', icone: 'lucideUsers', ton: 'karite', action: 'Voir le défi', aDecider: false },
  DEFI_TERMINE: { categorie: 'Défi terminé', icone: 'lucideMedal', ton: 'karite', action: 'Voir le classement', aDecider: false },
  INGREDIENT_PROPOSE: { categorie: 'Ingrédient proposé', icone: 'lucideCarrot', ton: 'terre', action: 'Consulter le catalogue', aDecider: true },
};

/** Page du dashboard où se trouve l'élément concerné (null s'il n'y en a pas). */
export function lienCible(n: NotificationResponse): { lien: string[]; parametres?: Record<string, string> } | null {
  if (!n.cibleId) {
    return null;
  }
  switch (n.type) {
    case 'RECETTE_A_VALIDER':
      return { lien: ['/recettes', n.cibleId] };
    case 'VIDEO_A_VALIDER':
      return { lien: ['/videos', n.cibleId] };
    case 'DEFI_A_VALIDER':
    case 'PARTICIPATION_DEFI':
    case 'DEFI_TERMINE':
      return { lien: ['/defis', n.cibleId] };
    case 'INGREDIENT_PROPOSE':
      return { lien: ['/ingredients'] };
    // Un cuisinier qui demande à devenir chef / producteur reste cuisinier tant que ce n'est pas validé :
    // on ouvre la fiche avec son type actuel
    case 'DEMANDE_CHEF':
      return { lien: ['/utilisateurs', n.cibleId], parametres: { role: n.acteurRole ?? 'CHEF' } };
    case 'DEMANDE_PRODUCTEUR':
      return { lien: ['/utilisateurs', n.cibleId], parametres: { role: n.acteurRole ?? 'PRODUCTEUR' } };
    case 'ADMIN_AJOUTE':
      return { lien: ['/utilisateurs', n.cibleId], parametres: { role: 'ADMIN' } };
    case 'INSCRIPTION':
      return { lien: ['/utilisateurs', n.cibleId], parametres: { role: 'CUISINIER' } };
  }
}
