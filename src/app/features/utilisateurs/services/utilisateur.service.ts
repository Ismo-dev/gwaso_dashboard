import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api-response.model';
import { StatutCompte, StatutRole } from '../../../core/models/enums.model';
import { PageResponse } from '../../../core/models/page-response.model';
import { versParams } from '../../../core/utils/http-params';
import {
  AdminRequest,
  AdminResponse,
  ChefCuisinierRequest,
  ChefCuisinierResponse,
  CuisinierRequest,
  CuisinierResponse,
  DemandeStatutResponse,
  LivreurFicheResponse,
  FiltresComptesAValider,
  FiltresUtilisateurs,
  ProducteurRequest,
  ProducteurResponse,
  ProduitProducteurResponse,
  UtilisateurResume,
} from '../models/utilisateur.model';

/** Appels à /utilisateurs : comptes, validation des chefs et producteurs, administrateurs. */
@Service()
export class UtilisateurService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/utilisateurs`;

  // ----- Tous les utilisateurs -----

  rechercher(filtres: FiltresUtilisateurs = {}): Observable<PageResponse<UtilisateurResume>> {
    return this.http
      .get<ApiResponse<PageResponse<UtilisateurResume>>>(this.url, { params: versParams(filtres) })
      .pipe(map((reponse) => reponse.data));
  }

  /** Activer, suspendre ou désactiver un compte. */
  changerStatutCompte(id: string, statut: StatutCompte): Observable<UtilisateurResume> {
    return this.http
      .put<ApiResponse<UtilisateurResume>>(`${this.url}/${id}/statut-compte`, { statut })
      .pipe(map((reponse) => reponse.data));
  }

  // ----- Modification d'un compte par l'administrateur -----

  modifierCuisinier(id: string, requete: CuisinierRequest): Observable<CuisinierResponse> {
    return this.http
      .put<ApiResponse<CuisinierResponse>>(`${this.url}/cuisiniers/${id}`, requete)
      .pipe(map((reponse) => reponse.data));
  }

  modifierChef(id: string, requete: ChefCuisinierRequest): Observable<ChefCuisinierResponse> {
    return this.http
      .put<ApiResponse<ChefCuisinierResponse>>(`${this.url}/chefs/${id}`, requete)
      .pipe(map((reponse) => reponse.data));
  }

  modifierProducteur(id: string, requete: ProducteurRequest): Observable<ProducteurResponse> {
    return this.http
      .put<ApiResponse<ProducteurResponse>>(`${this.url}/producteurs/${id}`, requete)
      .pipe(map((reponse) => reponse.data));
  }

  // ----- Cuisiniers qui demandent à devenir chef ou producteur -----

  getDemandesStatut(statut?: StatutRole): Observable<DemandeStatutResponse[]> {
    return this.http
      .get<ApiResponse<DemandeStatutResponse[]>>(`${environment.apiUrl}/demandes-statut`, { params: versParams({ statut }) })
      .pipe(map((reponse) => reponse.data));
  }

  getDemandesDe(utilisateurId: string): Observable<DemandeStatutResponse[]> {
    return this.http
      .get<ApiResponse<DemandeStatutResponse[]>>(`${environment.apiUrl}/demandes-statut/utilisateur/${utilisateurId}`)
      .pipe(map((reponse) => reponse.data));
  }

  /** Le cuisinier devient chef cuisinier ou producteur (même compte). */
  validerDemande(demandeId: string, profilId?: string): Observable<DemandeStatutResponse> {
    return this.http
      .put<ApiResponse<DemandeStatutResponse>>(`${environment.apiUrl}/demandes-statut/${demandeId}/valider`, {}, {
        params: versParams({ profilId }),
      })
      .pipe(map((reponse) => reponse.data));
  }

  refuserDemande(demandeId: string, motifRejet: string): Observable<DemandeStatutResponse> {
    return this.http
      .put<ApiResponse<DemandeStatutResponse>>(`${environment.apiUrl}/demandes-statut/${demandeId}/rejeter`, { motifRejet })
      .pipe(map((reponse) => reponse.data));
  }

  // ----- Produits d'un producteur -----

  getProduits(producteurId: string): Observable<ProduitProducteurResponse[]> {
    return this.http
      .get<ApiResponse<ProduitProducteurResponse[]>>(`${environment.apiUrl}/producteurs/produits/producteur/${producteurId}`)
      .pipe(map((reponse) => reponse.data));
  }

  retirerProduit(produitId: string): Observable<void> {
    return this.http
      .delete<ApiResponse<null>>(`${environment.apiUrl}/producteurs/produits/${produitId}`)
      .pipe(map(() => undefined));
  }

  /** Donne un autre profil (actif, du même type de compte) à un utilisateur. */
  changerProfil(id: string, profilId: string): Observable<UtilisateurResume> {
    return this.http
      .put<ApiResponse<UtilisateurResume>>(`${this.url}/${id}/profil`, { profilId })
      .pipe(map((reponse) => reponse.data));
  }

  getCuisinier(id: string): Observable<CuisinierResponse> {
    return this.http
      .get<ApiResponse<CuisinierResponse>>(`${this.url}/cuisiniers/${id}`)
      .pipe(map((reponse) => reponse.data));
  }

  // ----- Chefs cuisiniers -----

  getChefs(filtres: FiltresComptesAValider = {}): Observable<PageResponse<ChefCuisinierResponse>> {
    return this.http
      .get<ApiResponse<PageResponse<ChefCuisinierResponse>>>(`${this.url}/chefs`, {
        params: versParams(filtres),
      })
      .pipe(map((reponse) => reponse.data));
  }

  getChef(id: string): Observable<ChefCuisinierResponse> {
    return this.http
      .get<ApiResponse<ChefCuisinierResponse>>(`${this.url}/chefs/${id}`)
      .pipe(map((reponse) => reponse.data));
  }

  validerChef(id: string): Observable<ChefCuisinierResponse> {
    return this.http
      .put<ApiResponse<ChefCuisinierResponse>>(`${this.url}/chefs/${id}/valider`, {})
      .pipe(map((reponse) => reponse.data));
  }

  rejeterChef(id: string, motifRejet: string): Observable<ChefCuisinierResponse> {
    return this.http
      .put<ApiResponse<ChefCuisinierResponse>>(`${this.url}/chefs/${id}/rejeter`, { motifRejet })
      .pipe(map((reponse) => reponse.data));
  }

  // ----- Producteurs / fournisseurs -----

  getProducteurs(
    filtres: FiltresComptesAValider = {},
  ): Observable<PageResponse<ProducteurResponse>> {
    return this.http
      .get<ApiResponse<PageResponse<ProducteurResponse>>>(`${this.url}/producteurs`, {
        params: versParams(filtres),
      })
      .pipe(map((reponse) => reponse.data));
  }

  getProducteur(id: string): Observable<ProducteurResponse> {
    return this.http
      .get<ApiResponse<ProducteurResponse>>(`${this.url}/producteurs/${id}`)
      .pipe(map((reponse) => reponse.data));
  }

  validerProducteur(id: string): Observable<ProducteurResponse> {
    return this.http
      .put<ApiResponse<ProducteurResponse>>(`${this.url}/producteurs/${id}/valider`, {})
      .pipe(map((reponse) => reponse.data));
  }

  rejeterProducteur(id: string, motifRejet: string): Observable<ProducteurResponse> {
    return this.http
      .put<ApiResponse<ProducteurResponse>>(`${this.url}/producteurs/${id}/rejeter`, { motifRejet })
      .pipe(map((reponse) => reponse.data));
  }

  getLivreur(id: string): Observable<LivreurFicheResponse> {
    return this.http
      .get<ApiResponse<LivreurFicheResponse>>(`${this.url}/livreurs/${id}`)
      .pipe(map((reponse) => reponse.data));
  }

  // ----- Création de comptes par l'administrateur -----

  creerCuisinier(requete: CuisinierRequest): Observable<CuisinierResponse> {
    return this.http
      .post<ApiResponse<CuisinierResponse>>(`${this.url}/cuisiniers`, requete)
      .pipe(map((reponse) => reponse.data));
  }

  /** Le chef est créé « en attente » : on peut le valider juste après. */
  creerChef(requete: ChefCuisinierRequest): Observable<ChefCuisinierResponse> {
    return this.http
      .post<ApiResponse<ChefCuisinierResponse>>(`${this.url}/chefs`, requete)
      .pipe(map((reponse) => reponse.data));
  }

  /** Justificatif d'un chef ou d'un producteur (photo ou PDF) : renvoie l'adresse à mettre dans preuveUrl. */
  envoyerJustificatif(fichier: File): Observable<string> {
    const formulaire = new FormData();
    formulaire.append('file', fichier);
    return this.http
      .post<ApiResponse<{ url: string }>>(`${environment.apiUrl}/fichiers/justificatifs`, formulaire)
      .pipe(map((reponse) => reponse.data.url));
  }

  /** Le producteur est créé « en attente » : on peut le valider juste après. */
  creerProducteur(requete: ProducteurRequest): Observable<ProducteurResponse> {
    return this.http
      .post<ApiResponse<ProducteurResponse>>(`${this.url}/producteurs`, requete)
      .pipe(map((reponse) => reponse.data));
  }

  // ----- Administrateurs -----

  getAdmins(filtres: FiltresComptesAValider = {}): Observable<PageResponse<AdminResponse>> {
    return this.http
      .get<ApiResponse<PageResponse<AdminResponse>>>(`${this.url}/admins`, {
        params: versParams(filtres),
      })
      .pipe(map((reponse) => reponse.data));
  }

  creerAdmin(requete: AdminRequest): Observable<AdminResponse> {
    return this.http
      .post<ApiResponse<AdminResponse>>(`${this.url}/admins`, requete)
      .pipe(map((reponse) => reponse.data));
  }

  getAdmin(id: string): Observable<AdminResponse> {
    return this.http
      .get<ApiResponse<AdminResponse>>(`${this.url}/admins/${id}`)
      .pipe(map((reponse) => reponse.data));
  }

  modifierAdmin(id: string, requete: AdminRequest): Observable<AdminResponse> {
    return this.http
      .put<ApiResponse<AdminResponse>>(`${this.url}/admins/${id}`, requete)
      .pipe(map((reponse) => reponse.data));
  }

  /** Photo de profil d'un utilisateur (formulaire multipart, champ « file »). */
  envoyerPhoto(id: string, fichier: File): Observable<void> {
    const formulaire = new FormData();
    formulaire.append('file', fichier);
    return this.http
      .post<ApiResponse<unknown>>(`${environment.apiUrl}/fichiers/utilisateurs/${id}/photo`, formulaire)
      .pipe(map(() => undefined));
  }

  supprimerAdmin(id: string): Observable<void> {
    return this.http
      .delete<ApiResponse<null>>(`${this.url}/admins/${id}`)
      .pipe(map(() => undefined));
  }
}
