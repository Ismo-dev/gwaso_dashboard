import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api-response.model';
import { PageResponse } from '../../../core/models/page-response.model';
import { versParams } from '../../../core/utils/http-params';
import {
  DefiRequest,
  DefiResponse,
  FiltresDefis,
  ParticipationDefiResponse,
  PhotoDefiResponse,
  TypeDefiRequest,
  TypeDefiResponse,
} from '../models/defi.model';

/** Appels à /defis utiles à l'administration. */
@Service()
export class DefiService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/defis`;

  rechercher(filtres: FiltresDefis = {}): Observable<PageResponse<DefiResponse>> {
    return this.http
      .get<ApiResponse<PageResponse<DefiResponse>>>(this.url, { params: versParams(filtres) })
      .pipe(map((reponse) => reponse.data));
  }

  getById(id: string): Observable<DefiResponse> {
    return this.http
      .get<ApiResponse<DefiResponse>>(`${this.url}/${id}`)
      .pipe(map((reponse) => reponse.data));
  }

  /** Un défi créé par l'administrateur est validé directement. */
  creer(requete: DefiRequest): Observable<DefiResponse> {
    return this.http
      .post<ApiResponse<DefiResponse>>(this.url, requete)
      .pipe(map((reponse) => reponse.data));
  }

  modifier(id: string, requete: DefiRequest): Observable<DefiResponse> {
    return this.http
      .put<ApiResponse<DefiResponse>>(`${this.url}/${id}`, requete)
      .pipe(map((reponse) => reponse.data));
  }

  supprimer(id: string): Observable<void> {
    return this.http.delete<ApiResponse<null>>(`${this.url}/${id}`).pipe(map(() => undefined));
  }

  /** Décision sur un défi proposé par un chef. Le motif est obligatoire pour un refus. */
  decider(id: string, approuve: boolean, motif?: string): Observable<DefiResponse> {
    return this.http
      .put<ApiResponse<DefiResponse>>(`${this.url}/${id}/valider`, { approuve, motif })
      .pipe(map((reponse) => reponse.data));
  }

  /** Seule action manuelle sur le statut : les autres changements suivent les dates. */
  annuler(id: string): Observable<DefiResponse> {
    return this.http
      .put<ApiResponse<DefiResponse>>(`${this.url}/${id}/annuler`, {})
      .pipe(map((reponse) => reponse.data));
  }

  // ----- Photos -----

  getPhotos(id: string): Observable<PhotoDefiResponse[]> {
    return this.http
      .get<ApiResponse<PhotoDefiResponse[]>>(`${this.url}/${id}/photos`)
      .pipe(map((reponse) => reponse.data));
  }

  ajouterPhoto(id: string, fichier: File): Observable<PhotoDefiResponse> {
    const donnees = new FormData();
    donnees.append('file', fichier);
    return this.http
      .post<ApiResponse<PhotoDefiResponse>>(`${this.url}/${id}/photos`, donnees)
      .pipe(map((reponse) => reponse.data));
  }

  supprimerPhoto(photoId: string): Observable<void> {
    return this.http.delete<ApiResponse<null>>(`${this.url}/photos/${photoId}`).pipe(map(() => undefined));
  }

  // ----- Types de défi -----

  getTypes(): Observable<TypeDefiResponse[]> {
    return this.http
      .get<ApiResponse<TypeDefiResponse[]>>(`${this.url}/types`)
      .pipe(map((reponse) => reponse.data));
  }

  creerType(requete: TypeDefiRequest): Observable<TypeDefiResponse> {
    return this.http
      .post<ApiResponse<TypeDefiResponse>>(`${this.url}/types`, requete)
      .pipe(map((reponse) => reponse.data));
  }

  modifierType(id: string, requete: TypeDefiRequest): Observable<TypeDefiResponse> {
    return this.http
      .put<ApiResponse<TypeDefiResponse>>(`${this.url}/types/${id}`, requete)
      .pipe(map((reponse) => reponse.data));
  }

  supprimerType(id: string): Observable<void> {
    return this.http.delete<ApiResponse<null>>(`${this.url}/types/${id}`).pipe(map(() => undefined));
  }

  // ----- Participants et classement -----

  /** Participants, du meilleur score au plus faible (les non notés à la fin). */
  getParticipants(id: string): Observable<ParticipationDefiResponse[]> {
    return this.http
      .get<ApiResponse<ParticipationDefiResponse[]>>(`${this.url}/${id}/classement`)
      .pipe(map((reponse) => reponse.data));
  }

  noter(participationId: string, score: number): Observable<ParticipationDefiResponse> {
    return this.http
      .put<ApiResponse<ParticipationDefiResponse>>(
        `${this.url}/participations/${participationId}/evaluer`,
        { score },
      )
      .pipe(map((reponse) => reponse.data));
  }

  /** Calcule les rangs à partir des scores et rend le classement public (défi terminé). */
  publierClassement(id: string): Observable<DefiResponse> {
    return this.http
      .put<ApiResponse<DefiResponse>>(`${this.url}/${id}/classement/publier`, {})
      .pipe(map((reponse) => reponse.data));
  }
}
