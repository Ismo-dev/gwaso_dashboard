import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api-response.model';
import { PageResponse, Pagination } from '../../../core/models/page-response.model';
import { versParams } from '../../../core/utils/http-params';
import {
  CommentaireResponse,
  FiltresVideos,
  VideoAdminResponse,
  VideoResponse,
} from '../models/video.model';

/** Appels à /videos utiles à la modération. */
@Service()
export class VideoService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/videos`;

  rechercher(filtres: FiltresVideos = {}): Observable<PageResponse<VideoResponse>> {
    return this.http
      .get<ApiResponse<PageResponse<VideoResponse>>>(`${this.url}/admin`, {
        params: versParams(filtres),
      })
      .pipe(map((reponse) => reponse.data));
  }

  /** Vidéo + informations sur son auteur. */
  getDetail(id: string): Observable<VideoAdminResponse> {
    return this.http
      .get<ApiResponse<VideoAdminResponse>>(`${this.url}/admin/${id}`)
      .pipe(map((reponse) => reponse.data));
  }

  valider(id: string): Observable<VideoResponse> {
    return this.http
      .put<ApiResponse<VideoResponse>>(`${this.url}/${id}/valider`, {})
      .pipe(map((reponse) => reponse.data));
  }

  rejeter(id: string, motif: string): Observable<VideoResponse> {
    return this.http
      .put<ApiResponse<VideoResponse>>(`${this.url}/${id}/rejeter`, { motif })
      .pipe(map((reponse) => reponse.data));
  }

  desactiver(id: string, motif: string): Observable<VideoResponse> {
    return this.http
      .put<ApiResponse<VideoResponse>>(`${this.url}/${id}/desactiver`, { motif })
      .pipe(map((reponse) => reponse.data));
  }

  reactiver(id: string): Observable<VideoResponse> {
    return this.http
      .put<ApiResponse<VideoResponse>>(`${this.url}/${id}/reactiver`, {})
      .pipe(map((reponse) => reponse.data));
  }

  /** Suppression définitive pour la communauté (l'auteur ne la voit plus non plus). */
  supprimer(id: string): Observable<void> {
    return this.http.delete<ApiResponse<null>>(`${this.url}/${id}`).pipe(map(() => undefined));
  }

  getCommentaires(
    id: string,
    pagination: Pagination = {},
  ): Observable<PageResponse<CommentaireResponse>> {
    return this.http
      .get<ApiResponse<PageResponse<CommentaireResponse>>>(`${this.url}/${id}/commentaires`, {
        params: versParams(pagination),
      })
      .pipe(map((reponse) => reponse.data));
  }

  supprimerCommentaire(commentaireId: string): Observable<void> {
    return this.http
      .delete<ApiResponse<null>>(`${this.url}/commentaires/${commentaireId}`)
      .pipe(map(() => undefined));
  }
}
