import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api-response.model';
import { AuthResponse, UtilisateurConnecte } from '../../../core/models/auth.model';
import { ChangerMotDePasseRequest, LoginRequest } from '../models/auth.model';

/** Appels à /auth : connexion, profil de l'utilisateur connecté, mot de passe. */
@Service()
export class AuthService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/auth`;

  connecter(requete: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<ApiResponse<AuthResponse>>(`${this.url}/login`, requete)
      .pipe(map((reponse) => reponse.data));
  }

  moi(): Observable<UtilisateurConnecte> {
    return this.http
      .get<ApiResponse<UtilisateurConnecte>>(`${this.url}/moi`)
      .pipe(map((reponse) => reponse.data));
  }

  changerMotDePasse(requete: ChangerMotDePasseRequest): Observable<void> {
    return this.http
      .put<ApiResponse<null>>(`${this.url}/mot-de-passe`, requete)
      .pipe(map(() => undefined));
  }
}
