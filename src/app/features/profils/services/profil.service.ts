import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api-response.model';
import {
  DroitRequest,
  DroitResponse,
  ProfilDroitsResponse,
  ProfilRequest,
  ProfilResponse,
} from '../models/profil.model';

/** Appels à /profils : profils d'accès et droits associés. */
@Service()
export class ProfilService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/profils`;

  // ----- Profils -----

  getAll(): Observable<ProfilResponse[]> {
    return this.http
      .get<ApiResponse<ProfilResponse[]>>(this.url)
      .pipe(map((reponse) => reponse.data));
  }

  creer(requete: ProfilRequest): Observable<ProfilResponse> {
    return this.http
      .post<ApiResponse<ProfilResponse>>(this.url, requete)
      .pipe(map((reponse) => reponse.data));
  }

  modifier(id: string, requete: ProfilRequest): Observable<ProfilResponse> {
    return this.http
      .put<ApiResponse<ProfilResponse>>(`${this.url}/${id}`, requete)
      .pipe(map((reponse) => reponse.data));
  }

  supprimer(id: string): Observable<void> {
    return this.http.delete<ApiResponse<null>>(`${this.url}/${id}`).pipe(map(() => undefined));
  }

  /** Désactivé : plus proposé pour les nouveaux comptes, ses droits ne sont plus donnés. */
  changerActivation(id: string, actif: boolean): Observable<ProfilResponse> {
    return this.http
      .put<ApiResponse<ProfilResponse>>(`${this.url}/${id}/activation`, { actif })
      .pipe(map((reponse) => reponse.data));
  }

  /** Désactivé : le droit reste dans le catalogue et les profils, mais n'est donné à personne. */
  changerActivationDroit(id: string, actif: boolean): Observable<DroitResponse> {
    return this.http
      .put<ApiResponse<DroitResponse>>(`${this.url}/droits/${id}/activation`, { actif })
      .pipe(map((reponse) => reponse.data));
  }

  // ----- Droits -----

  getDroits(): Observable<DroitResponse[]> {
    return this.http
      .get<ApiResponse<DroitResponse[]>>(`${this.url}/droits`)
      .pipe(map((reponse) => reponse.data));
  }

  creerDroit(requete: DroitRequest): Observable<DroitResponse> {
    return this.http
      .post<ApiResponse<DroitResponse>>(`${this.url}/droits`, requete)
      .pipe(map((reponse) => reponse.data));
  }

  modifierDroit(id: string, requete: DroitRequest): Observable<DroitResponse> {
    return this.http
      .put<ApiResponse<DroitResponse>>(`${this.url}/droits/${id}`, requete)
      .pipe(map((reponse) => reponse.data));
  }

  supprimerDroit(id: string): Observable<void> {
    return this.http
      .delete<ApiResponse<null>>(`${this.url}/droits/${id}`)
      .pipe(map(() => undefined));
  }

  getDroitsDuProfil(profilId: string): Observable<ProfilDroitsResponse[]> {
    return this.http
      .get<ApiResponse<ProfilDroitsResponse[]>>(`${this.url}/${profilId}/droits`)
      .pipe(map((reponse) => reponse.data));
  }

  /** Remplace la liste complète des droits d'un profil. */
  modifierDroitsDuProfil(profilId: string, droitIds: string[]): Observable<ProfilDroitsResponse[]> {
    return this.http
      .put<ApiResponse<ProfilDroitsResponse[]>>(`${this.url}/${profilId}/droits`, { droitIds })
      .pipe(map((reponse) => reponse.data));
  }
}
