/** Résultat paginé renvoyé par l'API (classe PageResponse côté backend). */
export interface PageResponse<T> {
  contenu: T[];
  page: number;
  taille: number;
  totalElements: number;
  totalPages: number;
}

/** Paramètres de pagination envoyés à l'API (la première page vaut 0). */
export interface Pagination {
  page?: number;
  taille?: number;
}
