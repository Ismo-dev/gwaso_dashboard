import { HttpClient, HttpEventType } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { filter, map, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api-response.model';
import { PageResponse, Pagination } from '../../../core/models/page-response.model';
import { versParams } from '../../../core/utils/http-params';
import {
  CommentaireResponse,
  EnvoiVideo,
  FiltresVideos,
  ReactionResponse,
  VideoAdminResponse,
  VideoRequest,
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

  // ----- Publication par l'administrateur -----

  /** Crée la vidéo en brouillon (l'auteur est l'administrateur connecté). */
  creer(requete: VideoRequest): Observable<VideoResponse> {
    return this.http
      .post<ApiResponse<VideoResponse>>(this.url, requete)
      .pipe(map((reponse) => reponse.data));
  }

  modifier(id: string, requete: VideoRequest): Observable<VideoResponse> {
    return this.http
      .put<ApiResponse<VideoResponse>>(`${this.url}/${id}`, requete)
      .pipe(map((reponse) => reponse.data));
  }

  /** Envoie le fichier vidéo en indiquant la progression (les vidéos peuvent être lourdes). */
  envoyerFichier(id: string, fichier: File): Observable<EnvoiVideo> {
    const formulaire = new FormData();
    formulaire.append('file', fichier);
    return this.http
      .post<ApiResponse<VideoResponse>>(`${this.url}/${id}/fichier`, formulaire, {
        reportProgress: true,
        observe: 'events',
      })
      .pipe(
        filter(
          (evenement) =>
            evenement.type === HttpEventType.UploadProgress ||
            evenement.type === HttpEventType.Response,
        ),
        map((evenement): EnvoiVideo => {
          if (evenement.type === HttpEventType.Response) {
            return { etape: 'termine', video: evenement.body!.data };
          }
          const total = evenement.total ?? fichier.size;
          return { etape: 'progression', pourcentage: Math.round((evenement.loaded / total) * 100) };
        }),
      );
  }

  envoyerMiniature(id: string, image: File): Observable<VideoResponse> {
    const formulaire = new FormData();
    formulaire.append('file', image);
    return this.http
      .post<ApiResponse<VideoResponse>>(`${this.url}/${id}/miniature`, formulaire)
      .pipe(map((reponse) => reponse.data));
  }

  /** Publication : pour un administrateur, la vidéo est en ligne tout de suite. */
  publier(id: string): Observable<VideoResponse> {
    return this.http
      .put<ApiResponse<VideoResponse>>(`${this.url}/${id}/publier`, {})
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

  commenter(id: string, contenu: string): Observable<CommentaireResponse> {
    return this.http
      .post<ApiResponse<CommentaireResponse>>(`${this.url}/${id}/commentaires`, { contenu })
      .pipe(map((reponse) => reponse.data));
  }

  // ----- J'aime (l'administrateur réagit comme n'importe quel membre) -----

  getMesReactions(id: string): Observable<ReactionResponse> {
    return this.http
      .get<ApiResponse<ReactionResponse>>(`${this.url}/${id}/mes-reactions`)
      .pipe(map((reponse) => reponse.data));
  }

  aimer(id: string): Observable<ReactionResponse> {
    return this.http
      .put<ApiResponse<ReactionResponse>>(`${this.url}/${id}/reactions/AIME`, {})
      .pipe(map((reponse) => reponse.data));
  }

  nePlusAimer(id: string): Observable<ReactionResponse> {
    return this.http
      .delete<ApiResponse<ReactionResponse>>(`${this.url}/${id}/reactions/AIME`)
      .pipe(map((reponse) => reponse.data));
  }

  supprimerCommentaire(commentaireId: string): Observable<void> {
    return this.http
      .delete<ApiResponse<null>>(`${this.url}/commentaires/${commentaireId}`)
      .pipe(map(() => undefined));
  }
}
