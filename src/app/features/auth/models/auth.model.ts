/** LoginRequestDTO côté backend. `identifiant` = email ou numéro de téléphone. */
export interface LoginRequest {
  identifiant: string;
  motDePasse: string;
}

/** ChangerMotDePasseRequestDTO côté backend. */
export interface ChangerMotDePasseRequest {
  ancienMotDePasse: string;
  nouveauMotDePasse: string;
}
