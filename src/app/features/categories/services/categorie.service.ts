import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api-response.model';
import { CategorieRequest, CategorieResponse } from '../models/categorie.model';

/** Appels à /categories (liste publique, écriture réservée à l'admin). */
@Service()
export class CategorieService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/categories`;

  getAll(): Observable<CategorieResponse[]> {
    return this.http
      .get<ApiResponse<CategorieResponse[]>>(this.url)
      .pipe(map((reponse) => reponse.data));
  }

  getById(id: string): Observable<CategorieResponse> {
    return this.http
      .get<ApiResponse<CategorieResponse>>(`${this.url}/${id}`)
      .pipe(map((reponse) => reponse.data));
  }

  creer(requete: CategorieRequest): Observable<CategorieResponse> {
    return this.http
      .post<ApiResponse<CategorieResponse>>(this.url, requete)
      .pipe(map((reponse) => reponse.data));
  }

  modifier(id: string, requete: CategorieRequest): Observable<CategorieResponse> {
    return this.http
      .put<ApiResponse<CategorieResponse>>(`${this.url}/${id}`, requete)
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
        `${environment.apiUrl}/fichiers/categories/${id}/image`,
        formulaire,
      )
      .pipe(map(() => undefined));
  }
}
