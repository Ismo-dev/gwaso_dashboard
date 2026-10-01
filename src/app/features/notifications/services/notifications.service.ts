import { HttpClient } from '@angular/common/http';
import { inject, Service, signal } from '@angular/core';
import { map, Observable, tap } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api-response.model';
import { PageResponse } from '../../../core/models/page-response.model';
import { versParams } from '../../../core/utils/http-params';
import { FiltresNotifications, NotificationResponse } from '../models/notification.model';

/**
 * Notifications reçues par l'administrateur (ce qui s'est passé sur Gwaso).
 * À ne pas confondre avec NotificationService (core) qui affiche les messages éphémères (toasts).
 */
@Service()
export class NotificationsService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/notifications`;

  /** Nombre de non lues, partagé par la cloche de l'en-tête et la page. */
  readonly nombreNonLues = signal(0);

  rechercher(filtres: FiltresNotifications = {}): Observable<PageResponse<NotificationResponse>> {
    return this.http
      .get<ApiResponse<PageResponse<NotificationResponse>>>(this.url, { params: versParams(filtres) })
      .pipe(map((reponse) => reponse.data));
  }

  getById(id: string): Observable<NotificationResponse> {
    return this.http
      .get<ApiResponse<NotificationResponse>>(`${this.url}/${id}`)
      .pipe(map((reponse) => reponse.data));
  }

  rafraichirNombre(): void {
    this.http
      .get<ApiResponse<number>>(`${this.url}/nombre-non-lues`)
      .subscribe({ next: (reponse) => this.nombreNonLues.set(reponse.data), error: () => undefined });
  }

  marquerLue(id: string): Observable<NotificationResponse> {
    return this.http.put<ApiResponse<NotificationResponse>>(`${this.url}/${id}/lue`, {}).pipe(
      map((reponse) => reponse.data),
      tap(() => this.rafraichirNombre()),
    );
  }

  toutMarquerLu(): Observable<void> {
    return this.http.put<ApiResponse<null>>(`${this.url}/lues`, {}).pipe(
      map(() => undefined),
      tap(() => this.nombreNonLues.set(0)),
    );
  }
}
