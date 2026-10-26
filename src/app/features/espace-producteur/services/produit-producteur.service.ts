import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api-response.model';
import {
  ProduitProducteurRequest,
  ProduitProducteurResponse,
} from '../models/produit.model';

/**
 * Service pour la gestion des produits par le producteur connecté (/producteurs/produits).
 */
@Service()
export class ProduitProducteurService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/producteurs/produits`;

  /** Récupère la liste de tous les produits du producteur actuellement connecté. */
  getMesProduits(): Observable<ProduitProducteurResponse[]> {
    return this.http
      .get<ApiResponse<ProduitProducteurResponse[]>>(`${this.url}/mes-produits`)
      .pipe(map((reponse) => reponse.data));
  }

  /** Récupère un produit spécifique par son identifiant UUID. */
  getById(id: string): Observable<ProduitProducteurResponse> {
    return this.http
      .get<ApiResponse<ProduitProducteurResponse>>(`${this.url}/${id}`)
      .pipe(map((reponse) => reponse.data));
  }

  /** Met en vente un nouvel ingrédient ou réactive une offre existante. */
  ajouter(dto: ProduitProducteurRequest): Observable<ProduitProducteurResponse> {
    return this.http
      .post<ApiResponse<ProduitProducteurResponse>>(this.url, dto)
      .pipe(map((reponse) => reponse.data));
  }

  /** Met à jour le prix indicatif, la quantité ou l'image d'un produit. */
  modifier(
    id: string,
    dto: ProduitProducteurRequest,
  ): Observable<ProduitProducteurResponse> {
    return this.http
      .put<ApiResponse<ProduitProducteurResponse>>(`${this.url}/${id}`, dto)
      .pipe(map((reponse) => reponse.data));
  }

  /** Supprime logiquement un produit du catalogue producteur. */
  supprimer(id: string): Observable<void> {
    return this.http
      .delete<ApiResponse<null>>(`${this.url}/${id}`)
      .pipe(map(() => undefined));
  }

  /** Envoie une photo personnalisée pour l'offre du producteur. */
  envoyerImage(id: string, fichier: File): Observable<void> {
    const formulaire = new FormData();
    formulaire.append('file', fichier);
    return this.http
      .post<ApiResponse<unknown>>(`${environment.apiUrl}/fichiers/produits/${id}/photo`, formulaire)
      .pipe(map(() => undefined));
  }
}
