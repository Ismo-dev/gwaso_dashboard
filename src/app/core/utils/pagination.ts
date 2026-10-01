/** Tailles de page proposées sous les tableaux et les grilles. */
export const TAILLES_PAGE = [10, 20, 50];


export function pageDe<T>(liste: T[], page: number, taille: number): T[] {
  return liste.slice(page * taille, (page + 1) * taille);
}

export function pageValide(page: number, taille: number, total: number): number {
  const derniere = Math.max(Math.ceil(total / taille) - 1, 0);
  return Math.min(page, derniere);
}
