import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api-response.model';
import { PageResponse } from '../../../core/models/page-response.model';
import { versParams } from '../../../core/utils/http-params';
import {
  LangueAudio,
  EtapeIngredientRequest,
  EtapeIngredientResponse,
  EtapeRequest,
  EtapeResponse,
  EtapeUstensileAlternativeResponse,
  EtapeUstensileRequest,
  EtapeUstensileResponse,
  FiltresRecettes,
  NomRecetteResponse,
  RecetteIngredientRequest,
  RecetteIngredientResponse,
  RecetteRequest,
  RecetteResponse,
} from '../models/recette.model';

/** Appels à /recettes utiles à l'administration. */
@Service()
export class RecetteService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/recettes`;

  rechercher(filtres: FiltresRecettes = {}): Observable<PageResponse<RecetteResponse>> {
    return this.http
      .get<ApiResponse<PageResponse<RecetteResponse>>>(this.url, { params: versParams(filtres) })
      .pipe(map((reponse) => reponse.data));
  }

  getEnAttente(): Observable<RecetteResponse[]> {
    return this.http
      .get<ApiResponse<RecetteResponse[]>>(`${this.url}/en-attente`)
      .pipe(map((reponse) => reponse.data));
  }

  getById(id: string): Observable<RecetteResponse> {
    return this.http
      .get<ApiResponse<RecetteResponse>>(`${this.url}/${id}`)
      .pipe(map((reponse) => reponse.data));
  }

  getIngredients(id: string): Observable<RecetteIngredientResponse[]> {
    return this.http
      .get<ApiResponse<RecetteIngredientResponse[]>>(`${this.url}/${id}/ingredients`)
      .pipe(map((reponse) => reponse.data));
  }

  getEtapes(id: string): Observable<EtapeResponse[]> {
    return this.http
      .get<ApiResponse<EtapeResponse[]>>(`${environment.apiUrl}/etapes/recette/${id}`)
      .pipe(map((reponse) => reponse.data));
  }

  valider(id: string): Observable<RecetteResponse> {
    return this.http
      .put<ApiResponse<RecetteResponse>>(`${this.url}/${id}/valider`, {})
      .pipe(map((reponse) => reponse.data));
  }

  rejeter(id: string, motifRejet: string): Observable<RecetteResponse> {
    return this.http
      .put<ApiResponse<RecetteResponse>>(`${this.url}/${id}/rejeter`, { motifRejet })
      .pipe(map((reponse) => reponse.data));
  }

  supprimer(id: string): Observable<void> {
    return this.http.delete<ApiResponse<null>>(`${this.url}/${id}`).pipe(map(() => undefined));
  }

  // ----- Création et modification (l'administrateur peut aussi écrire des recettes) -----

  /** Crée la recette en brouillon ; l'auteur est l'administrateur connecté. */
  creer(requete: RecetteRequest): Observable<RecetteResponse> {
    return this.http
      .post<ApiResponse<RecetteResponse>>(this.url, requete)
      .pipe(map((reponse) => reponse.data));
  }

  modifier(id: string, requete: RecetteRequest): Observable<RecetteResponse> {
    return this.http
      .put<ApiResponse<RecetteResponse>>(`${this.url}/${id}`, requete)
      .pipe(map((reponse) => reponse.data));
  }

  /** Soumet la recette. Pour un administrateur, elle est publiée directement. */
  soumettre(id: string): Observable<RecetteResponse> {
    return this.http
      .put<ApiResponse<RecetteResponse>>(`${this.url}/${id}/soumettre`, {})
      .pipe(map((reponse) => reponse.data));
  }

  /** Retire une recette publiée de l'application (statut ARCHIVEE) ; le motif est montré à l'auteur. */
  archiver(id: string, motif: string): Observable<RecetteResponse> {
    return this.http
      .put<ApiResponse<RecetteResponse>>(`${this.url}/${id}/archiver`, { motifRejet: motif })
      .pipe(map((reponse) => reponse.data));
  }

  envoyerPhoto(id: string, fichier: File): Observable<void> {
    const formulaire = new FormData();
    formulaire.append('file', fichier);
    return this.http
      .post<ApiResponse<unknown>>(`${environment.apiUrl}/fichiers/recettes/${id}/photo`, formulaire)
      .pipe(map(() => undefined));
  }

  // ----- Autres noms du plat -----

  getNoms(id: string): Observable<NomRecetteResponse[]> {
    return this.http
      .get<ApiResponse<NomRecetteResponse[]>>(`${this.url}/${id}/noms`)
      .pipe(map((reponse) => reponse.data));
  }

  ajouterNom(recetteId: string, nom: string): Observable<NomRecetteResponse> {
    return this.http
      .post<ApiResponse<NomRecetteResponse>>(`${this.url}/noms`, { recetteId, nom })
      .pipe(map((reponse) => reponse.data));
  }

  retirerNom(nomId: string): Observable<void> {
    return this.http
      .delete<ApiResponse<null>>(`${this.url}/noms/${nomId}`)
      .pipe(map(() => undefined));
  }

  // ----- Ingrédients de la recette -----

  ajouterIngredient(requete: RecetteIngredientRequest): Observable<RecetteIngredientResponse> {
    return this.http
      .post<ApiResponse<RecetteIngredientResponse>>(`${this.url}/ingredients`, requete)
      .pipe(map((reponse) => reponse.data));
  }

  retirerIngredient(recetteIngredientId: string): Observable<void> {
    return this.http
      .delete<ApiResponse<null>>(`${this.url}/ingredients/${recetteIngredientId}`)
      .pipe(map(() => undefined));
  }

  // ----- Étapes -----

  creerEtape(requete: EtapeRequest): Observable<EtapeResponse> {
    return this.http
      .post<ApiResponse<EtapeResponse>>(`${environment.apiUrl}/etapes`, requete)
      .pipe(map((reponse) => reponse.data));
  }

  modifierEtape(id: string, requete: EtapeRequest): Observable<EtapeResponse> {
    return this.http
      .put<ApiResponse<EtapeResponse>>(`${environment.apiUrl}/etapes/${id}`, requete)
      .pipe(map((reponse) => reponse.data));
  }

  // ----- Contenu d'une étape : ingrédients, ustensiles, photo, vidéo -----

  getIngredientsEtape(etapeId: string): Observable<EtapeIngredientResponse[]> {
    return this.http
      .get<ApiResponse<EtapeIngredientResponse[]>>(
        `${environment.apiUrl}/etapes/${etapeId}/ingredients`,
      )
      .pipe(map((reponse) => reponse.data));
  }

  ajouterIngredientEtape(requete: EtapeIngredientRequest): Observable<EtapeIngredientResponse> {
    return this.http
      .post<ApiResponse<EtapeIngredientResponse>>(
        `${environment.apiUrl}/etapes/ingredients`,
        requete,
      )
      .pipe(map((reponse) => reponse.data));
  }

  retirerIngredientEtape(etapeIngredientId: string): Observable<void> {
    return this.http
      .delete<ApiResponse<null>>(`${environment.apiUrl}/etapes/ingredients/${etapeIngredientId}`)
      .pipe(map(() => undefined));
  }

  getUstensilesEtape(etapeId: string): Observable<EtapeUstensileResponse[]> {
    return this.http
      .get<ApiResponse<EtapeUstensileResponse[]>>(
        `${environment.apiUrl}/etapes/${etapeId}/ustensiles`,
      )
      .pipe(map((reponse) => reponse.data));
  }

  ajouterUstensileEtape(requete: EtapeUstensileRequest): Observable<EtapeUstensileResponse> {
    return this.http
      .post<ApiResponse<EtapeUstensileResponse>>(`${environment.apiUrl}/etapes/ustensiles`, requete)
      .pipe(map((reponse) => reponse.data));
  }

  retirerUstensileEtape(etapeUstensileId: string): Observable<void> {
    return this.http
      .delete<ApiResponse<null>>(`${environment.apiUrl}/etapes/ustensiles/${etapeUstensileId}`)
      .pipe(map(() => undefined));
  }

  /** Propose une alternative à l'ustensile d'une étape (vaut seulement pour cette étape). */
  ajouterAlternativeUstensileEtape(
    etapeUstensileId: string,
    alternativeId: string,
  ): Observable<EtapeUstensileAlternativeResponse> {
    return this.http
      .post<ApiResponse<EtapeUstensileAlternativeResponse>>(
        `${environment.apiUrl}/etapes/ustensiles/alternatives`,
        { etapeUstensileId, alternativeId },
      )
      .pipe(map((reponse) => reponse.data));
  }

  retirerAlternativeUstensileEtape(id: string): Observable<void> {
    return this.http
      .delete<ApiResponse<null>>(`${environment.apiUrl}/etapes/ustensiles/alternatives/${id}`)
      .pipe(map(() => undefined));
  }

  envoyerPhotoEtape(etapeId: string, fichier: File): Observable<void> {
    return this.envoyerFichier(`${environment.apiUrl}/fichiers/etapes/${etapeId}/photo`, fichier);
  }

  /** Audio d'explication d'une étape (FR ou BAMBARA) : enregistré au micro ou choisi sur l'ordinateur. */
  envoyerAudioEtape(etapeId: string, langue: LangueAudio, fichier: Blob, nom: string): Observable<void> {
    const formulaire = new FormData();
    formulaire.append('file', fichier, nom);
    return this.http
      .post<ApiResponse<unknown>>(`${environment.apiUrl}/fichiers/etapes/${etapeId}/audio`, formulaire, {
        params: { langue },
      })
      .pipe(map(() => undefined));
  }

  supprimerAudioEtape(etapeId: string, langue: LangueAudio): Observable<void> {
    return this.http
      .delete<ApiResponse<null>>(`${environment.apiUrl}/fichiers/etapes/${etapeId}/audio`, { params: { langue } })
      .pipe(map(() => undefined));
  }

  envoyerVideoEtape(etapeId: string, fichier: File): Observable<void> {
    return this.envoyerFichier(`${environment.apiUrl}/fichiers/etapes/${etapeId}/video`, fichier);
  }

  private envoyerFichier(url: string, fichier: File): Observable<void> {
    const formulaire = new FormData();
    formulaire.append('file', fichier);
    return this.http.post<ApiResponse<unknown>>(url, formulaire).pipe(map(() => undefined));
  }

  supprimerEtape(id: string): Observable<void> {
    return this.http
      .delete<ApiResponse<null>>(`${environment.apiUrl}/etapes/${id}`)
      .pipe(map(() => undefined));
  }
}
