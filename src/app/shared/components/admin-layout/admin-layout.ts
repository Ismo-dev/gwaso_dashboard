import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { MatSidenav, MatSidenavContainer, MatSidenavContent } from '@angular/material/sidenav';
import { RouterOutlet } from '@angular/router';
import { AValiderService } from '../../../core/services/a-valider.service';
import { EcranService } from '../../../core/services/ecran.service';
import { SessionService } from '../../../core/services/session.service';
import { AuthService } from '../../../features/auth/services/auth.service';
import { Header } from '../header/header';
import { Sidebar } from '../sidebar/sidebar';

const CLE_MENU_COMPACT = 'gw_menu_compact';

/**
 * Squelette de toutes les pages de l'administration.
 * - Ordinateur : menu fixe à gauche, que l'on peut réduire à ses icônes.
 * - Tablette : menu réduit à ses icônes (plus de place pour le contenu).
 * - Téléphone : menu caché, ouvert en tiroir par le bouton ☰.
 * Dans tous les cas, seul le contenu défile.
 */
@Component({
  imports: [RouterOutlet, MatSidenavContainer, MatSidenav, MatSidenavContent, Sidebar, Header],
  selector: 'app-admin-layout',
  styleUrl: './admin-layout.scss',
  templateUrl: './admin-layout.html',
})
export class AdminLayout implements OnInit {
  protected ecran = inject(EcranService);
  private aValider = inject(AValiderService);
  private session = inject(SessionService);
  private authService = inject(AuthService);

  /** Choix de l'utilisateur sur ordinateur (mémorisé dans le navigateur). */
  private prefereCompact = signal(this.lirePreference());

  /** Menu mobile ouvert. */
  protected menuMobileOuvert = signal(false);

  /** Menu réduit aux icônes : toujours sur tablette, au choix sur ordinateur. */
  protected compact = computed(
    () => this.ecran.tablette() || (this.ecran.bureau() && this.prefereCompact()),
  );

  constructor() {
    // En repassant sur grand écran, on referme le tiroir mobile
    effect(() => {
      if (!this.ecran.mobile()) {
        this.menuMobileOuvert.set(false);
      }
    });
  }

  ngOnInit(): void {
    // Compteurs « à valider » du menu et de la cloche
    this.aValider.rafraichir();
    // Droits relus : le menu suit les changements faits dans « Profils et droits » depuis la connexion
    this.authService.moi().subscribe({
      next: (utilisateur) => {
        this.session.mettreAJourUtilisateur(utilisateur);
        if (!this.session.peutOuvrirLeDashboard()) {
          this.session.deconnecter();
        }
      },
      error: () => undefined,
    });
  }

  basculerCompact(): void {
    const valeur = !this.prefereCompact();
    this.prefereCompact.set(valeur);
    try {
      localStorage.setItem(CLE_MENU_COMPACT, String(valeur));
    } catch {
      // Stockage indisponible (navigation privée) : le choix n'est simplement pas mémorisé
    }
  }

  ouvrirMenuMobile(): void {
    this.menuMobileOuvert.set(true);
  }

  fermerMenuMobile(): void {
    this.menuMobileOuvert.set(false);
  }

  private lirePreference(): boolean {
    try {
      return localStorage.getItem(CLE_MENU_COMPACT) === 'true';
    } catch {
      return false;
    }
  }
}
