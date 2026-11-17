import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api-response.model';
import { PageResponse, Pagination } from '../../../core/models/page-response.model';
import { versParams } from '../../../core/utils/http-params';
import {
  AvisCommandeResponse,
  CommandeAdmin,
  CommandeAdminDetail,
  FiltreCommandes,
  LivreurPropose,
  DecisionLitigeRequest,
  LitigeResponse,
  ParametresMarche,
  StatutLitige,
} from '../models/marche.model';

/** Administration du marché (droit MARCHE_GERER) : commandes, réglages, litiges, avis. */
@Service()
export class MarcheService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/admin`;

  getParametres(): Observable<ParametresMarche> {
    return this.http
      .get<ApiResponse<ParametresMarche>>(`${this.url}/marche/parametres`)
      .pipe(map((reponse) => reponse.data));
  }

  modifierParametres(parametres: ParametresMarche): Observable<ParametresMarche> {
    return this.http
      .put<ApiResponse<ParametresMarche>>(`${this.url}/marche/parametres`, parametres)
      .pipe(map((reponse) => reponse.data));
  }

  /** statut OUVERT : les plus anciens d'abord ; sans statut : tous. */
  getLitiges(
    filtres: Pagination & { statut?: StatutLitige },
  ): Observable<PageResponse<LitigeResponse>> {
    return this.http
      .get<ApiResponse<PageResponse<LitigeResponse>>>(`${this.url}/litiges`, {
        params: versParams(filtres),
      })
      .pipe(map((reponse) => reponse.data));
  }

  /** Rembourse (rien, une partie ou tout), clôture la commande et lance les versements. */
  decider(id: string, requete: DecisionLitigeRequest): Observable<LitigeResponse> {
    return this.http
      .put<ApiResponse<LitigeResponse>>(`${this.url}/litiges/${id}/decision`, requete)
      .pipe(map((reponse) => reponse.data));
  }

  /** Tous les avis, masqués compris, les plus récents d'abord. */
  getAvis(filtres: Pagination): Observable<PageResponse<AvisCommandeResponse>> {
    return this.http
      .get<ApiResponse<PageResponse<AvisCommandeResponse>>>(`${this.url}/avis-commandes`, {
        params: versParams(filtres),
      })
      .pipe(map((reponse) => reponse.data));
  }

  changerVisibilite(id: string, visible: boolean): Observable<AvisCommandeResponse> {
    return this.http
      .patch<ApiResponse<AvisCommandeResponse>>(`${this.url}/avis-commandes/${id}/visibilite`, {
        visible,
      })
      .pipe(map((reponse) => reponse.data));
  }

  /** Commandes d'un onglet ; recherche sur la référence, le client (nom, téléphone) ou le fournisseur. */
  getCommandes(
    filtres: Pagination & { filtre: FiltreCommandes; recherche?: string },
  ): Observable<PageResponse<CommandeAdmin>> {
    return this.http
      .get<ApiResponse<PageResponse<CommandeAdmin>>>(`${this.url}/commandes`, {
        params: versParams(filtres),
      })
      .pipe(map((reponse) => reponse.data));
  }

  /** Nombre de commandes de chaque onglet. */
  getCompteursCommandes(): Observable<Record<FiltreCommandes, number>> {
    return this.http
      .get<ApiResponse<{ compteurs: Record<FiltreCommandes, number> }>>(
        `${this.url}/commandes/compteurs`,
      )
      .pipe(map((reponse) => reponse.data.compteurs));
  }

  /** Nombre de litiges ouverts et au total. */
  getCompteursLitiges(): Observable<Record<string, number>> {
    return this.http
      .get<ApiResponse<{ compteurs: Record<string, number> }>>(`${this.url}/litiges/compteurs`)
      .pipe(map((reponse) => reponse.data.compteurs));
  }

  getCommande(id: string): Observable<CommandeAdminDetail> {
    return this.http
      .get<ApiResponse<CommandeAdminDetail>>(`${this.url}/commandes/${id}`)
      .pipe(map((reponse) => reponse.data));
  }

  /** Livreurs validés et disponibles : ceux du fournisseur d'abord, puis les indépendants, du plus proche au plus loin. */
  getLivreursProposes(livraisonId: string): Observable<LivreurPropose[]> {
    return this.http
      .get<ApiResponse<LivreurPropose[]>>(`${this.url}/livraisons/${livraisonId}/livreurs-proposes`)
      .pipe(map((reponse) => reponse.data));
  }

  /** Confie la course au livreur choisi ; fournisseur, client et livreur sont prévenus. */
  affecterLivreur(livraisonId: string, livreurId: string): Observable<unknown> {
    return this.http
      .put<ApiResponse<unknown>>(`${this.url}/livraisons/${livraisonId}/livreur`, { livreurId })
      .pipe(map((reponse) => reponse.data));
  }

  /** Commande payée sans livreur : stock rendu au fournisseur, client remboursé. */
  annulerCommande(id: string): Observable<void> {
    return this.http
      .post<ApiResponse<void>>(`${this.url}/commandes/${id}/annuler`, {})
      .pipe(map(() => undefined));
  }
}
