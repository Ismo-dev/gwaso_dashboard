/** Valeurs partagées par plusieurs fonctionnalités (mêmes noms que les enums Java). */
/**
 * Type de compte = la classe du compte côté API (Admin, Cuisinier, ChefCuisinier, ProducteurFournisseur).
 * Il dit quelles informations demander (niveau, localité, justificatif). Il ne donne AUCUN droit :
 * ce que la personne peut faire dépend uniquement des droits de son profil.
 */
export type TypeCompte = 'ADMIN' | 'CUISINIER' | 'CHEF' | 'PRODUCTEUR' | 'LIVREUR';

export type StatutCompte = 'ACTIF' | 'INACTIF' | 'SUSPENDU' | 'SUPPRIME';

/** Validation du rôle d'un chef ou d'un producteur par un administrateur. */
export type StatutRole = 'EN_ATTENTE' | 'VALIDE' | 'REJETE';
