import { Unite } from '../../ingredients/models/ingredient.model';

/** Réglages du marché (ParametreMarcheResponseDTO / ParametreMarcheRequestDTO côté backend). */
export interface ParametresMarche {
  rayonInitialKm: number;
  pasRayonKm: number;
  rayonMaxKm: number;
  delaiRechercheMin: number;
  delaiPaiementMin: number;
  /** Conservé par l'API, mais pas utilisé par le calcul du prix de livraison. */
  prixMinLivraison: number;
  prixBaseLivraison: number;
  prixParKm: number;
  tauxCommissionLivraison: number;
}

export type MotifLitige =
  'MANQUANT' | 'QUANTITE_INSUFFISANTE' | 'ABIME' | 'MAUVAIS_PRODUIT' | 'NON_LIVRE';
export type StatutLitige = 'OUVERT' | 'RESOLU';
export type DecisionLitige = 'REMBOURSEMENT_TOTAL' | 'REMBOURSEMENT_PARTIEL' | 'REJETE';
/** Qui supporte d'abord le remboursement d'un litige « non livré ». */
export type ChargeLitige = 'FOURNISSEUR' | 'LIVREUR';

export const MOTIFS_LITIGE: Record<MotifLitige, string> = {
  MANQUANT: 'Produit manquant',
  QUANTITE_INSUFFISANTE: 'Quantité insuffisante',
  ABIME: 'Produit abîmé',
  MAUVAIS_PRODUIT: 'Mauvais produit',
  NON_LIVRE: 'Commande non livrée',
};

export const DECISIONS_LITIGE: Record<DecisionLitige, string> = {
  REMBOURSEMENT_TOTAL: 'Remboursement total',
  REMBOURSEMENT_PARTIEL: 'Remboursement partiel',
  REJETE: 'Réclamation rejetée',
};

/** LitigeResponseDTO côté backend. */
export interface LitigeResponse {
  id: string;
  commandeId: string;
  referenceCommande: string;
  statutCommande: string;
  motif: MotifLitige;
  description: string | null;
  photoUrl: string | null;
  statut: StatutLitige;
  decision: DecisionLitige | null;
  montantRembourse: number | null;
  /** Ce que le client a payé (produits + livraison) : le remboursement ne peut pas le dépasser. */
  montantPaye: number | null;
  dateOuverture: string;
  dateResolution: string | null;
  clientNom: string | null;
  fournisseurNom: string | null;
  /** Produits concernés (vide pour une commande non livrée ou sans précision). */
  lignes?: LigneLitige[];
  photos?: string[];
  /** Somme des produits concernés, ou tout le payé pour une commande non livrée. */
  montantDemande?: number | null;
  reponseFournisseur?: string | null;
  /** null tant que le fournisseur n'a pas répondu. */
  fournisseurAccepte?: boolean | null;
  dateReponse?: string | null;
}

/** LigneLitigeResponseDTO côté backend. */
export interface LigneLitige {
  ligneCommandeId: string;
  ingredientNom: string;
  unite: Unite | null;
  quantite: number;
  montant: number;
}

/** DecisionLitigeRequestDTO côté backend. */
export interface DecisionLitigeRequest {
  decision: DecisionLitige;
  /** Obligatoire pour un remboursement partiel. */
  montantRembourse?: number;
  /** Seulement pour un litige « non livré ». */
  aChargeDe?: ChargeLitige;
}

export type CibleAvis = 'FOURNISSEUR' | 'LIVREUR';

/** AvisCommandeResponseDTO côté backend. */
export interface AvisCommandeResponse {
  id: string;
  referenceCommande: string;
  cible: CibleAvis;
  note: number;
  commentaire: string | null;
  visible: boolean;
  dateAvis: string;
  auteurPrenom: string;
}

// ─────────────────────────── Commandes ───────────────────────────

/** Onglets de la liste (FiltreCommandesAdmin côté backend). */
export type FiltreCommandes =
  'SANS_LIVREUR' | 'EN_ATTENTE' | 'EN_COURS' | 'A_SURVEILLER' | 'TERMINEES' | 'ANNULEES' | 'TOUTES';

export type StatutCommande =
  | 'EN_RECHERCHE_FOURNISSEUR'
  | 'AUCUN_FOURNISSEUR'
  | 'ATTENTE_PAIEMENT'
  | 'PAYEE'
  | 'EN_PREPARATION'
  | 'PRETE'
  | 'EN_LIVRAISON'
  | 'ECHEC_LIVRAISON'
  | 'LIVREE'
  | 'EN_LITIGE'
  | 'CLOTUREE'
  | 'ANNULEE'
  | 'EXPIREE'
  | 'REMBOURSEE';

export type StatutLivraison =
  | 'EN_RECHERCHE_LIVREUR'
  | 'AUCUN_LIVREUR'
  | 'ASSIGNEE'
  | 'EN_COURS'
  | 'LIVREE'
  | 'ECHEC'
  | 'REFUSEE_A_LA_PORTE';

export type StatutPaiement =
  | 'INITIE'
  | 'EN_ATTENTE_VALIDATION'
  | 'CONFIRME'
  | 'ECHOUE'
  | 'EXPIRE'
  | 'REMBOURSE_PARTIEL'
  | 'REMBOURSE';

export type StatutVersement = 'EN_ATTENTE' | 'GELE' | 'ENVOYE' | 'CONFIRME' | 'ECHOUE';

/** Couleur d'une étiquette de statut. */
export type TonEtiquette = 'attente' | 'succes' | 'erreur' | 'info' | 'neutre';

export const STATUTS_COMMANDE: Record<StatutCommande, { libelle: string; ton: TonEtiquette }> = {
  EN_RECHERCHE_FOURNISSEUR: { libelle: 'Cherche un fournisseur', ton: 'attente' },
  AUCUN_FOURNISSEUR: { libelle: 'Aucun fournisseur', ton: 'neutre' },
  ATTENTE_PAIEMENT: { libelle: 'Attend le paiement', ton: 'attente' },
  PAYEE: { libelle: 'Payée', ton: 'info' },
  EN_PREPARATION: { libelle: 'En préparation', ton: 'info' },
  PRETE: { libelle: 'Prête', ton: 'info' },
  EN_LIVRAISON: { libelle: 'En livraison', ton: 'info' },
  ECHEC_LIVRAISON: { libelle: 'Échec de livraison', ton: 'erreur' },
  LIVREE: { libelle: 'Livrée', ton: 'succes' },
  EN_LITIGE: { libelle: 'En litige', ton: 'erreur' },
  CLOTUREE: { libelle: 'Clôturée', ton: 'succes' },
  ANNULEE: { libelle: 'Annulée', ton: 'neutre' },
  EXPIREE: { libelle: 'Expirée', ton: 'neutre' },
  REMBOURSEE: { libelle: 'Remboursée', ton: 'neutre' },
};

export const STATUTS_LIVRAISON: Record<StatutLivraison, string> = {
  EN_RECHERCHE_LIVREUR: 'Cherche un livreur',
  AUCUN_LIVREUR: 'Aucun livreur trouvé',
  ASSIGNEE: 'Livreur en route vers le fournisseur',
  EN_COURS: 'En route vers le client',
  LIVREE: 'Livrée',
  ECHEC: 'Échec',
  REFUSEE_A_LA_PORTE: 'Refusée à la porte',
};

export const STATUTS_PAIEMENT: Record<StatutPaiement, string> = {
  INITIE: 'Demandé',
  EN_ATTENTE_VALIDATION: 'À valider sur le téléphone',
  CONFIRME: 'Payé',
  ECHOUE: 'Échoué',
  EXPIRE: 'Expiré',
  REMBOURSE_PARTIEL: 'Remboursé en partie',
  REMBOURSE: 'Remboursé',
};

export const STATUTS_VERSEMENT: Record<StatutVersement, string> = {
  EN_ATTENTE: 'À envoyer',
  GELE: 'Gelé',
  ENVOYE: 'Envoyé',
  CONFIRME: 'Versé',
  ECHOUE: 'Échoué',
};

export const OPERATEURS: Record<string, string> = {
  ORANGE_MONEY: 'Orange Money',
  MOOV_MONEY: 'Moov Money',
};

export const AUTEURS_ANNULATION: Record<string, string> = {
  ACHETEUR: 'le client',
  FOURNISSEUR: 'le fournisseur',
  LIVREUR: 'le livreur',
  ADMIN: "l'équipe Gwaso",
};

/** LigneCommandeResponseDTO côté backend. */
export interface LigneCommande {
  id: string;
  ingredientId: string;
  ingredientNom: string;
  unite: Unite | null;
  quantiteDemandee: number;
  prixUnitaire: number;
  sousTotal: number;
}

/** CommandeAdminResponseDTO côté backend : une ligne de la liste. */
export interface CommandeAdmin {
  id: string;
  reference: string;
  statut: StatutCommande;
  dateCreation: string;
  clientNom: string;
  clientTelephone: string | null;
  /** null tant qu'aucun fournisseur n'a accepté. */
  fournisseurNom: string | null;
  lignes: LigneCommande[];
  montantProduits: number;
  /** Produits + livraison, fixé à l'acceptation. */
  montant: number | null;
  livraisonId: string | null;
  statutLivraison: StatutLivraison | null;
  prixLivraison: number | null;
  distanceLivraisonKm: number | null;
  livreurNom: string | null;
  statutPaiement: StatutPaiement | null;
  /** Payée sans livreur : l'administration peut en affecter un ou annuler en remboursant. */
  actionPossible: boolean;
}

/** CommandeAdminDetailResponseDTO côté backend : tout sur une commande, jamais le code de livraison. */
export interface CommandeAdminDetail {
  resume: CommandeAdmin;
  noteAcheteur: string | null;
  annuleePar: string | null;
  dateAcceptation: string | null;
  dateCloture: string | null;
  client: { nom: string; telephone: string | null; email: string | null; invite: boolean };
  fournisseur: { nom: string; telephone: string | null; localite: string | null } | null;
  destination: {
    latitude: number;
    longitude: number;
    contactNom: string | null;
    contactTelephone: string | null;
  } | null;
  livraison: {
    statut: StatutLivraison;
    mode: 'LIVREUR_DU_FOURNISSEUR' | 'LIVREUR_INDEPENDANT' | null;
    livreurNom: string | null;
    livreurTelephone: string | null;
    prix: number | null;
    distanceKm: number | null;
    dateAssignation: string | null;
    dateDepart: string | null;
    dateLivraison: string | null;
    motifEchec: string | null;
    photoPreuveUrl: string | null;
    nbEssaisCode: number | null;
  } | null;
  paiement: {
    reference: string;
    operateur: string | null;
    telephone: string | null;
    montant: number;
    statut: StatutPaiement;
    referenceAgregateur: string | null;
    motifEchec: string | null;
    dateInitiation: string | null;
    dateConfirmation: string | null;
    dateExpiration: string | null;
  } | null;
  versements: {
    beneficiaireNom: string;
    pour: 'FOURNISSEUR' | 'LIVREUR';
    montantBrut: number;
    commission: number;
    montantNet: number;
    statut: StatutVersement;
    dateDemande: string | null;
    dateExecution: string | null;
    nbTentatives: number | null;
    motifEchec: string | null;
  }[];
  litige: LitigeResponse | null;
  avis: AvisCommandeResponse[];
}

/** LivreurProposeResponseDTO côté backend. */
export interface LivreurPropose {
  id: string;
  nom: string;
  telephone: string | null;
  /** Livreur du fournisseur de la commande (sinon indépendant). */
  duFournisseur: boolean;
  /** De sa dernière position au fournisseur, en ligne droite ; null si inconnue. */
  distanceKm: number | null;
  datePosition: string | null;
}
