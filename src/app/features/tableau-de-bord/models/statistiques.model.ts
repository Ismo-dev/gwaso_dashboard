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
