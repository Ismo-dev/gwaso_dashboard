import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api-response.model';
import { Statistiques } from '../models/statistiques.model';

@Service()
export class StatistiquesService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/admin/statistiques`;

  getStatistiques(): Observable<Statistiques> {
    return this.http.get<ApiResponse<Statistiques>>(this.url).pipe(map((reponse) => reponse.data));
  }
}
