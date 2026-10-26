import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api-response.model';
import {
  CategorieIngredientRequest,
  CategorieIngredientResponse,
} from '../models/categorie-ingredient.model';

/**
 * Service pour les catégories d'ingrédients / denrées (GET /categories-ingredients).
 */
@Service()
export class CategorieIngredientService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/categories-ingredients`;

  getAll(): Observable<CategorieIngredientResponse[]> {
    return this.http
      .get<ApiResponse<CategorieIngredientResponse[]>>(this.url)
      .pipe(map((reponse) => reponse.data));
  }

  getById(id: string): Observable<CategorieIngredientResponse> {
    return this.http
      .get<ApiResponse<CategorieIngredientResponse>>(`${this.url}/${id}`)
      .pipe(map((reponse) => reponse.data));
  }

  creer(requete: CategorieIngredientRequest): Observable<CategorieIngredientResponse> {
    return this.http
      .post<ApiResponse<CategorieIngredientResponse>>(this.url, requete)
      .pipe(map((reponse) => reponse.data));
  }

  modifier(id: string, requete: CategorieIngredientRequest): Observable<CategorieIngredientResponse> {
    return this.http
      .put<ApiResponse<CategorieIngredientResponse>>(`${this.url}/${id}`, requete)
      .pipe(map((reponse) => reponse.data));
  }

  supprimer(id: string): Observable<void> {
    return this.http.delete<ApiResponse<null>>(`${this.url}/${id}`).pipe(map(() => undefined));
  }
}
