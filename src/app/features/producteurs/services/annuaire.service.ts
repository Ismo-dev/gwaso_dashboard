import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api-response.model';
import { PageResponse } from '../../../core/models/page-response.model';
import { versParams } from '../../../core/utils/http-params';
import { FiltresAnnuaire, ProducteurAnnuaire } from '../models/annuaire.model';

/** Annuaire public des producteurs validés (GET /producteurs/annuaire). */
@Service()
export class AnnuaireService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/producteurs/annuaire`;

  rechercher(filtres: FiltresAnnuaire = {}): Observable<PageResponse<ProducteurAnnuaire>> {
    return this.http
      .get<ApiResponse<PageResponse<ProducteurAnnuaire>>>(this.url, { params: versParams(filtres) })
      .pipe(map((reponse) => reponse.data));
  }

  getLocalites(): Observable<string[]> {
    return this.http.get<ApiResponse<string[]>>(`${this.url}/localites`).pipe(map((reponse) => reponse.data));
  }
}
