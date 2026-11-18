import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api-response.model';
import { Statistiques, StatistiquesMarche } from '../models/statistiques.model';

@Service()
export class StatistiquesService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/admin/statistiques`;

  getStatistiques(): Observable<Statistiques> {
    return this.http.get<ApiResponse<Statistiques>>(this.url).pipe(map((reponse) => reponse.data));
  }

  /** Marché sur les [jours] derniers jours (droit MARCHE_GERER). */
  getStatistiquesMarche(jours: number): Observable<StatistiquesMarche> {
    return this.http
      .get<ApiResponse<StatistiquesMarche>>(`${this.url}/marche`, { params: { jours } })
      .pipe(map((reponse) => reponse.data));
  }
}
