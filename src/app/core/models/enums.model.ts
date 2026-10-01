/** Valeurs partagées par plusieurs fonctionnalités (mêmes noms que les enums Java). */
export type Role = 'ADMIN' | 'CUISINIER' | 'CHEF' | 'PRODUCTEUR';

export type StatutCompte = 'ACTIF' | 'INACTIF' | 'SUSPENDU' | 'SUPPRIME';

/** Validation du rôle d'un chef ou d'un producteur par un administrateur. */
export type StatutRole = 'EN_ATTENTE' | 'VALIDE' | 'REJETE';
