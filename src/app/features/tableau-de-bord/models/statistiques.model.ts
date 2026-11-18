/** StatistiquesDTO côté backend (GET /admin/statistiques). */
export interface Statistiques {
  utilisateurs: {
    total: number;
    admins: number;
    cuisiniers: number;
    chefs: number;
    producteurs: number;
    comptesSuspendus: number;
    comptesInactifs: number;
  };
  /** Éléments qui attendent une décision de l'administrateur. */
  aValider: {
    chefs: number;
    producteurs: number;
    recettes: number;
    defis: number;
    videos: number;
  };
  recettes: {
    publiees: number;
    brouillons: number;
    enAttente: number;
    rejetees: number;
    archivees: number;
  };
  videos: {
    publiees: number;
    brouillons: number;
    enAttente: number;
    rejetees: number;
    desactivees: number;
  };
  defis: {
    proposes: number;
    valides: number;
    enCours: number;
    termines: number;
  };
}

/** Un produit ou un fournisseur classé, avec ce qu'il a vendu sur la période (FCFA). */
export interface ClassementMarche {
  nom: string;
  montant: number;
  commandes: number;
}

/** StatistiquesMarcheDTO (GET /admin/statistiques/marche?jours=) : montants en FCFA. */
export interface StatistiquesMarche {
  jours: number;
  commandes: {
    passees: number;
    payees: number;
    livrees: number;
    annulees: number;
    /** Part des commandes terminées remises au client, de 0 à 100 ; null sans commande terminée. */
    tauxReussite: number | null;
    /** Du paiement à la remise, en minutes ; null sans livraison. */
    delaiMoyenMin: number | null;
  };
  argent: {
    ventes: number;
    panierMoyen: number;
    commissionGwaso: number;
    rembourse: number;
  };
  maintenant: {
    enCours: number;
    sansLivreur: number;
    litigesOuverts: number;
    fournisseursActifs: number;
    livreursDisponibles: number;
    livreursIndependants: number;
  };
  /** Chaque jour de la période, du plus ancien à aujourd'hui (date « AAAA-MM-JJ »). */
  parJour: { date: string; commandes: number; ventes: number }[];
  topProduits: ClassementMarche[];
  topFournisseurs: ClassementMarche[];
}
