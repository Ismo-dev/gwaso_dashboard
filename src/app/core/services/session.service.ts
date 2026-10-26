import { HttpBackend, HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Service, signal } from '@angular/core';
import { Router } from '@angular/router';
import { finalize, map, Observable, of, shareReplay, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import { AuthResponse, UtilisateurConnecte } from '../models/auth.model';
import { NotificationService } from './notification.service';

const CLE_SESSION = 'gwaso_session';

/** On renouvelle un peu avant l'expiration, pour ne jamais envoyer un jeton qui expire en route. */
const MARGE_MS = 30_000;

/**
 * Session de l'administrateur connecté : jeton d'accès (court) + jeton de renouvellement (long).
 *
 * - La session est copiée dans le localStorage pour survivre à un rafraîchissement de la page,
 *   et partagée entre les onglets (un renouvellement dans un onglet profite aux autres).
 * - Quand le jeton d'accès expire, renouveler() obtient une nouvelle paire sans redemander le mot de passe.
 * - On n'est déconnecté que si le jeton de renouvellement lui-même n'est plus valable
 *   (30 jours sans utilisation, déconnexion, mot de passe changé, compte suspendu).
 */
@Service()
export class SessionService {
  private router = inject(Router);
  private notification = inject(NotificationService);
  /** Client HTTP sans intercepteurs : le renouvellement ne doit pas repasser par l'intercepteur d'authentification. */
  private httpDirect = new HttpClient(inject(HttpBackend));

  private session = signal<AuthResponse | null>(this.lireSession());
  /** Renouvellement en cours : toutes les requêtes qui attendent partagent le même appel. */
  private renouvellementEnCours: Observable<string> | null = null;

  /** Utilisateur connecté, ou null. Utilisable directement dans les templates : session.utilisateur() */
  readonly utilisateur = computed(() => this.session()?.utilisateur ?? null);

  constructor() {
    // Un autre onglet a renouvelé la session ou s'est déconnecté : on suit
    window.addEventListener('storage', (evenement) => {
      if (evenement.key === CLE_SESSION) {
        this.session.set(this.lireSession());
      }
    });
  }

  enregistrer(reponse: AuthResponse): void {
    localStorage.setItem(CLE_SESSION, JSON.stringify(reponse));
    this.session.set(reponse);
  }

  /** Après une modification de « Mon profil » : le nom et la photo se mettent à jour partout. */
  mettreAJourUtilisateur(utilisateur: UtilisateurConnecte): void {
    const session = this.session();
    if (session) {
      this.enregistrer({ ...session, utilisateur });
    }
  }

  getToken(): string | null {
    return this.session()?.token ?? null;
  }

  /** Connecté = le jeton de renouvellement est encore valable (le jeton d'accès, lui, se renouvelle). */
  estConnecte(): boolean {
    const session = this.session();
    return !!session && new Date(session.refreshExpireLe).getTime() > Date.now();
  }

  /** Le profil de l'utilisateur connecté lui donne ce droit (codes : DROITS dans profil.model.ts). */
  aLeDroit(droit: string): boolean {
    return this.utilisateur()?.droits.includes(droit) ?? false;
  }

  /** Le dashboard s'ouvre avec le droit ACCES_DASHBOARD ou pour un producteur (PRODUIT_GERER). */
  peutOuvrirLeDashboard(): boolean {
    return (
      this.estConnecte() &&
      (this.aLeDroit('ACCES_DASHBOARD') ||
        this.aLeDroit('PRODUIT_GERER') ||
        this.utilisateur()?.role === 'PRODUCTEUR')
    );
  }

  /** Le jeton d'accès est expiré (ou va l'être dans quelques secondes) : il faut le renouveler. */
  jetonAExpire(): boolean {
    const session = this.session();
    return !session || new Date(session.expireLe).getTime() - MARGE_MS <= Date.now();
  }

  /**
   * Obtient un nouveau jeton d'accès grâce au jeton de renouvellement.
   * Si le renouvellement est refusé, la session est terminée et on revient à la connexion.
   */
  renouveler(): Observable<string> {
    if (this.renouvellementEnCours) {
      return this.renouvellementEnCours;
    }
    // Un autre onglet a peut-être déjà renouvelé : on relit le localStorage avant d'appeler l'API
    const stockee = this.lireSession();
    if (stockee && stockee.refreshToken !== this.session()?.refreshToken) {
      this.session.set(stockee);
      if (!this.jetonAExpire()) {
        return of(stockee.token);
      }
    }
    const refreshToken = this.session()?.refreshToken;
    if (!refreshToken) {
      this.terminer('Votre session a expiré. Reconnectez-vous.');
      return throwError(() => new Error('Aucune session à renouveler'));
    }

    this.renouvellementEnCours = this.httpDirect
      .post<ApiResponse<AuthResponse>>(`${environment.apiUrl}/auth/refresh`, { refreshToken })
      .pipe(
        map((reponse) => reponse.data),
        tap({
          next: (reponse) => this.enregistrer(reponse),
          error: (erreur: HttpErrorResponse) => {
            // Serveur injoignable : on garde la session, on réessaiera plus tard
            if (erreur.status !== 0) {
              this.terminer(erreur.error?.message ?? 'Votre session a expiré. Reconnectez-vous.');
            }
          },
        }),
        map((reponse) => reponse.token),
        finalize(() => (this.renouvellementEnCours = null)),
        shareReplay(1),
      );
    return this.renouvellementEnCours;
  }

  /** Déconnexion volontaire : le jeton de renouvellement est aussi annulé côté serveur. */
  deconnecter(): void {
    const refreshToken = this.session()?.refreshToken;
    if (refreshToken) {
      // Au mieux : même si l'appel échoue, la session locale est effacée
      this.httpDirect
        .post(`${environment.apiUrl}/auth/logout`, { refreshToken })
        .subscribe({ error: () => undefined });
    }
    this.effacer();
  }

  /** Fin de session imposée (renouvellement refusé) : message, puis page de connexion. */
  private terminer(message: string): void {
    if (this.session()) {
      this.notification.avertissement(message);
    }
    this.effacer();
  }

  private effacer(): void {
    localStorage.removeItem(CLE_SESSION);
    this.session.set(null);
    const retour = this.router.url.startsWith('/connexion') ? undefined : this.router.url;
    this.router.navigate(['/connexion'], { queryParams: retour ? { retour } : {} });
  }

  private lireSession(): AuthResponse | null {
    try {
      const texte = localStorage.getItem(CLE_SESSION);
      const session = texte ? (JSON.parse(texte) as AuthResponse) : null;
      // Ancienne session (avant les jetons de renouvellement) : on l'oublie, il suffit de se reconnecter
      if (session && !session.refreshToken) {
        localStorage.removeItem(CLE_SESSION);
        return null;
      }
      return session;
    } catch {
      return null;
    }
  }
}
