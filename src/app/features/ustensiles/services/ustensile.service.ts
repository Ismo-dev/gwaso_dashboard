import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api-response.model';
import {
  AlternativeUstensileRequest,
  AlternativeUstensileResponse,
  UstensileRequest,
  UstensileResponse,
} from '../models/ustensile.model';

/** Appels à /ustensiles (liste publique, écriture réservée à l'admin). */
@Service()
export class UstensileService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/ustensiles`;

  getAll(): Observable<UstensileResponse[]> {
    return this.http
      .get<ApiResponse<UstensileResponse[]>>(this.url)
      .pipe(map((reponse) => reponse.data));
  }

  getById(id: string): Observable<UstensileResponse> {
    return this.http
      .get<ApiResponse<UstensileResponse>>(`${this.url}/${id}`)
      .pipe(map((reponse) => reponse.data));
  }

  creer(requete: UstensileRequest): Observable<UstensileResponse> {
    return this.http
      .post<ApiResponse<UstensileResponse>>(this.url, requete)
      .pipe(map((reponse) => reponse.data));
  }

  modifier(id: string, requete: UstensileRequest): Observable<UstensileResponse> {
    return this.http
      .put<ApiResponse<UstensileResponse>>(`${this.url}/${id}`, requete)
      .pipe(map((reponse) => reponse.data));
  }

  supprimer(id: string): Observable<void> {
    return this.http.delete<ApiResponse<null>>(`${this.url}/${id}`).pipe(map(() => undefined));
  }

  // ----- Catalogue des alternatives (« si vous n'avez pas cet ustensile ») -----
  // Le lien avec un ustensile se fait étape par étape : voir RecetteService.ajouterAlternativeUstensileEtape.

  /** Catalogue de toutes les alternatives existantes. */
  getCatalogueAlternatives(): Observable<AlternativeUstensileResponse[]> {
    return this.http
      .get<ApiResponse<AlternativeUstensileResponse[]>>(`${this.url}/alternatives`)
      .pipe(map((reponse) => reponse.data));
  }

  creerAlternative(requete: AlternativeUstensileRequest): Observable<AlternativeUstensileResponse> {
    return this.http
      .post<ApiResponse<AlternativeUstensileResponse>>(`${this.url}/alternatives`, requete)
      .pipe(map((reponse) => reponse.data));
  }

  /** Envoie l'image (formulaire multipart, champ « file »). */
  envoyerImage(id: string, fichier: File): Observable<void> {
    const formulaire = new FormData();
    formulaire.append('file', fichier);
    return this.http
      .post<ApiResponse<unknown>>(
        `${environment.apiUrl}/fichiers/ustensiles/${id}/photo`,
        formulaire,
      )
      .pipe(map(() => undefined));
  }

  /** Valide la proposition d'un chef : elle rejoint le catalogue. */
  valider(id: string): Observable<UstensileResponse> {
    return this.http
      .put<ApiResponse<UstensileResponse>>(`${this.url}/${id}/valider`, {})
      .pipe(map((reponse) => reponse.data));
  }

  /** Refuse la proposition d'un chef ; le motif lui est montré. */
  refuser(id: string, motif: string): Observable<UstensileResponse> {
    return this.http
      .put<ApiResponse<UstensileResponse>>(`${this.url}/${id}/refuser`, { motif })
      .pipe(map((reponse) => reponse.data));
  }
}
