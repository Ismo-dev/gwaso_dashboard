import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api-response.model';
import { IngredientRequest, IngredientResponse } from '../models/ingredient.model';

/** Appels à /ingredients (liste publique, écriture réservée à l'admin). */
@Service()
export class IngredientService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/ingredients`;

  getAll(): Observable<IngredientResponse[]> {
    return this.http
      .get<ApiResponse<IngredientResponse[]>>(this.url)
      .pipe(map((reponse) => reponse.data));
  }

  getById(id: string): Observable<IngredientResponse> {
    return this.http
      .get<ApiResponse<IngredientResponse>>(`${this.url}/${id}`)
      .pipe(map((reponse) => reponse.data));
  }

  creer(requete: IngredientRequest): Observable<IngredientResponse> {
    return this.http
      .post<ApiResponse<IngredientResponse>>(this.url, requete)
      .pipe(map((reponse) => reponse.data));
  }

  modifier(id: string, requete: IngredientRequest): Observable<IngredientResponse> {
    return this.http
      .put<ApiResponse<IngredientResponse>>(`${this.url}/${id}`, requete)
      .pipe(map((reponse) => reponse.data));
  }

  supprimer(id: string): Observable<void> {
    return this.http.delete<ApiResponse<null>>(`${this.url}/${id}`).pipe(map(() => undefined));
  }

  /** Envoie l'image (formulaire multipart, champ « file »). */
  envoyerImage(id: string, fichier: File): Observable<void> {
    const formulaire = new FormData();
    formulaire.append('file', fichier);
    return this.http
      .post<ApiResponse<unknown>>(
        `${environment.apiUrl}/fichiers/ingredients/${id}/photo`,
        formulaire,
      )
      .pipe(map(() => undefined));
  }

  /** Valide la proposition d'un chef : elle rejoint le catalogue. */
  valider(id: string): Observable<IngredientResponse> {
    return this.http
      .put<ApiResponse<IngredientResponse>>(`${this.url}/${id}/valider`, {})
      .pipe(map((reponse) => reponse.data));
  }

  /** Refuse la proposition d'un chef ; le motif lui est montré. */
  refuser(id: string, motif: string): Observable<IngredientResponse> {
    return this.http
      .put<ApiResponse<IngredientResponse>>(`${this.url}/${id}/refuser`, { motif })
      .pipe(map((reponse) => reponse.data));
  }
}
