import { DatePipe } from '@angular/common';
import {
  Component,
  computed,
  effect,
  inject,
  input,
  OnInit,
  signal,
  untracked,
} from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { catchError, map, Observable, of } from 'rxjs';
import { EcranService } from '../../../../core/services/ecran.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { Avatar } from '../../../../shared/components/avatar/avatar';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { DepuisPipe } from '../../../../shared/pipes/depuis.pipe';
import { FichierPipe } from '../../../../shared/pipes/fichier.pipe';
import { DefiService } from '../../../defis/services/defi.service';
import { IngredientService } from '../../../ingredients/services/ingredient.service';
import { RecetteService } from '../../../recettes/services/recette.service';
import { LIBELLES_TYPE_COMPTE } from '../../../utilisateurs/models/utilisateur.model';
import { UtilisateurService } from '../../../utilisateurs/services/utilisateur.service';
import { formaterDuree } from '../../../videos/models/video.model';
import { VideoService } from '../../../videos/services/video.service';
import { estPropositionUstensile, INFOS_TYPES, lienCible, NotificationResponse } from '../../models/notification.model';
import { IngredientResponse } from '../../../ingredients/models/ingredient.model';
//import { IngredientService } from '../../../ingredients/services/ingredient.service';
import { UstensileResponse } from '../../../ustensiles/models/ustensile.model';
import { UstensileService } from '../../../ustensiles/services/ustensile.service';
import { NotificationsService } from '../../services/notifications.service';
import { nomsCategories } from '../../../recettes/models/recette.model';

const TAILLE_PAGE = 20;

/** Aperçu de l'élément concerné, sous une forme commune à tous les types. */
interface Apercu {
  titre: string;
  sousTitre: string | null;
  image: string | null;
  /** Vidéo sans miniature : on montre la première image du fichier. */
  video: string | null;
  statut: string | null;
  details: string[];
}

/** Groupe de notifications d'une même journée. */
interface Journee {
  libelle: string;
  notifications: NotificationResponse[];
}

/**
 * Notifications : ce qui s'est passé sur Gwaso et qui demande (ou non) une décision.
 * Liste à gauche, détail à droite (sur téléphone : l'une puis l'autre).
 * La notification choisie est dans l'adresse (?id=...) et passe en « lue » à l'ouverture.
 */
@Component({
  imports: [
    RouterLink,
    DatePipe,
    MatButton,
    MatButtonToggleGroup,
    MatButtonToggle,
    NgIcon,
    PageHeader,
    EmptyState,
    Avatar,
    StatusBadge,
    DepuisPipe,
    FichierPipe,
  ],
  selector: 'app-notifications',
  styleUrl: './notifications.scss',
  templateUrl: './notifications.html',
})
export class Notifications implements OnInit {
  protected service = inject(NotificationsService);
  private videoService = inject(VideoService);
  private recetteService = inject(RecetteService);
  private defiService = inject(DefiService);
  private utilisateurService = inject(UtilisateurService);
  private ingredientService = inject(IngredientService);
  private ustensileService = inject(UstensileService);
  private toast = inject(NotificationService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  protected ecran = inject(EcranService);

  /** Notification ouverte (?id=...). */
  readonly id = input<string>();

  protected readonly infos = INFOS_TYPES;
  protected readonly libellesRole = LIBELLES_TYPE_COMPTE;

  protected filtre = signal<'toutes' | 'nonLues'>('toutes');
  protected notifications = signal<NotificationResponse[]>([]);
  protected chargement = signal(true);
  protected erreur = signal(false);
  private page = 0;
  protected toutCharge = signal(false);

  protected choisie = signal<NotificationResponse | null>(null);
  protected apercu = signal<Apercu | null>(null);
  protected chargementApercu = signal(false);
  protected lien = computed(() => {
    const n = this.choisie();
    return n ? lienCible(n) : null;
  });

  /** Notifications regroupées par jour : Aujourd'hui, Hier, puis la date. */
  protected journees = computed<Journee[]>(() => {
    const groupes = new Map<string, NotificationResponse[]>();
    for (const n of this.notifications()) {
      const libelle = this.libelleJour(n.dateCreation);
      groupes.set(libelle, [...(groupes.get(libelle) ?? []), n]);
    }
    return [...groupes.entries()].map(([libelle, notifications]) => ({ libelle, notifications }));
  });

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => (id ? this.ouvrir(id) : this.choisie.set(null)));
    });
  }

  ngOnInit(): void {
    this.charger(true);
    this.service.rafraichirNombre();
  }

  // ===================== Liste =====================

  changerFiltre(filtre: 'toutes' | 'nonLues'): void {
    this.filtre.set(filtre);
    this.charger(true);
  }

  charger(depuisLeDebut: boolean): void {
    if (depuisLeDebut) {
      this.page = 0;
      this.toutCharge.set(false);
    }
    this.chargement.set(true);
    this.erreur.set(false);
    this.service
      .rechercher({ nonLues: this.filtre() === 'nonLues', page: this.page, taille: TAILLE_PAGE })
      .subscribe({
        next: (page) => {
          this.notifications.update((liste) =>
            depuisLeDebut ? page.contenu : [...liste, ...page.contenu],
          );
          this.toutCharge.set(page.page + 1 >= page.totalPages);
          this.page = page.page + 1;
          this.chargement.set(false);
        },
        error: () => {
          this.erreur.set(true);
          this.chargement.set(false);
        },
      });
  }

  toutMarquerLu(): void {
    this.service.toutMarquerLu().subscribe({
      next: () => {
        this.notifications.update((liste) => liste.map((n) => ({ ...n, lue: true })));
        this.toast.succes('Toutes les notifications sont marquées comme lues.');
        if (this.filtre() === 'nonLues') {
          this.charger(true);
        }
      },
    });
  }

  choisir(n: NotificationResponse): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { id: n.id },
      queryParamsHandling: 'merge',
    });
  }

  fermer(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { id: null },
      queryParamsHandling: 'merge',
    });
  }

  // ===================== Détail =====================

  private ouvrir(id: string): void {
    const connue = this.notifications().find((n) => n.id === id);
    if (connue) {
      this.afficher(connue);
    }
    this.service.getById(id).subscribe({
      next: (n) => {
        if (!connue) {
          this.afficher(n);
        }
        if (!n.lue) {
          this.service.marquerLue(id).subscribe((lue) => {
            this.notifications.update((liste) => liste.map((x) => (x.id === id ? lue : x)));
            this.choisie.set(lue);
          });
        }
      },
      error: () => this.toast.erreur("Cette notification n'existe plus."),
    });
  }

  private afficher(n: NotificationResponse): void {
    this.choisie.set(n);
    this.apercu.set(null);
    if (!n.cibleId) {
      return;
    }
    this.chargementApercu.set(true);
    this.lireApercu(n)
      .pipe(catchError(() => of(null)))
      .subscribe((apercu) => {
        // L'admin a peut-être déjà ouvert une autre notification
        if (this.choisie()?.id === n.id) {
          this.apercu.set(apercu);
          this.chargementApercu.set(false);
        }
      });
  }

  /** Charge l'élément concerné et le met sous une forme commune. */
  private lireApercu(n: NotificationResponse): Observable<Apercu | null> {
    const id = n.cibleId!;
    switch (n.type) {
      case 'VIDEO_A_VALIDER':
      case 'VIDEO_PUBLIEE':
      case 'VIDEO_REFUSEE':
        return this.videoService.getDetail(id).pipe(
          map(({ video }) => ({
            titre: video.titre,
            sousTitre: video.description,
            image: video.miniatureUrl,
            video: video.miniatureUrl ? null : video.videoUrl,
            statut: video.statut,
            details: [formaterDuree(video.dureeSecondes), video.recetteNom ?? ''].filter(Boolean),
          })),
        );
      case 'RECETTE_A_VALIDER':
      case 'RECETTE_PUBLIEE':
      case 'RECETTE_REFUSEE':
      case 'RECETTE_RETIREE':
      case 'NOUVEL_AVIS':
      case 'REPONSE_AVIS':
        return this.recetteService.getById(id).pipe(
          map((r) => ({
            titre: r.nom,
            sousTitre: nomsCategories(r),
            image: r.photoUrl,
            video: null,
            statut: r.statut,
            details: [
              r.dureeMin ? `${r.dureeMin} min` : '',
              r.nbPersonnes ? `${r.nbPersonnes} personnes` : '',
            ].filter(Boolean),
          })),
        );
      case 'DEFI_A_VALIDER':
      case 'PARTICIPATION_DEFI':
      case 'DEFI_TERMINE':
      case 'DEFI_PUBLIE':
      case 'DEFI_REFUSE':
      case 'CLASSEMENT_PUBLIE':
        return this.defiService.getById(id).pipe(
          map((d) => ({
            titre: d.nom,
            sousTitre: d.typeDefiNom,
            image: d.photoCouvertureUrl,
            video: null,
            statut: d.statut,
            details: [
              `Du ${new Date(d.dateDebut).toLocaleDateString('fr')} au ${new Date(d.dateFin).toLocaleDateString('fr')}`,
              `${d.nbParticipants} participant${d.nbParticipants > 1 ? 's' : ''}`,
            ],
          })),
        );
      case 'DEMANDE_CHEF':
      case 'DEMANDE_PRODUCTEUR':
        if (n.acteurRole === 'CUISINIER') {
          // Cuisinier qui demande à devenir chef / producteur
          return this.utilisateurService
            .getCuisinier(id)
            .pipe(
              map((c) =>
                this.apercuCompte(
                  `${c.prenom} ${c.nom}`,
                  c.email ?? c.telephone,
                  c.photoProfil,
                  'EN_ATTENTE',
                  [
                    n.type === 'DEMANDE_CHEF'
                      ? 'Cuisinier → chef cuisinier'
                      : 'Cuisinier → producteur',
                  ],
                ),
              ),
            );
        }
        return n.type === 'DEMANDE_CHEF'
          ? this.utilisateurService
              .getChef(id)
              .pipe(
                map((c) =>
                  this.apercuCompte(
                    `${c.prenom} ${c.nom}`,
                    c.email ?? c.telephone,
                    c.photoProfil,
                    c.statutRole,
                    ['Chef cuisinier'],
                  ),
                ),
              )
          : this.utilisateurService
              .getProducteur(id)
              .pipe(
                map((p) =>
                  this.apercuCompte(
                    `${p.prenom} ${p.nom}`,
                    p.email ?? p.telephone,
                    p.photoProfil,
                    p.statutRole,
                    ['Producteur', p.localite ?? ''],
                  ),
                ),
              );
      case 'ADMIN_AJOUTE':
        return this.utilisateurService
          .getAdmin(id)
          .pipe(
            map((a) =>
              this.apercuCompte(
                `${a.prenom} ${a.nom}`,
                a.email ?? a.telephone,
                a.photoProfil,
                a.statut,
                ['Administrateur'],
              ),
            ),
          );
      case 'CATALOGUE_A_VALIDER': {
        const ustensile = estPropositionUstensile(n);
        const element$: Observable<{ element: IngredientResponse | UstensileResponse; detail: string | null }> =
          ustensile
            ? this.ustensileService.getById(id).pipe(map((u) => ({ element: u, detail: u.description })))
            : this.ingredientService
                .getById(id)
                .pipe(map((i) => ({ element: i, detail: i.unite ? `Unité : ${i.unite}` : null })));
        return element$.pipe(
          map(({ element, detail }) => ({
            titre: element.nom,
            sousTitre: element.proposeParNom ? `Proposé par ${element.proposeParNom}` : null,
            image: element.photoUrl,
            video: null,
            statut: element.statut === 'REFUSE' ? 'REJETE' : (element.statut ?? 'VALIDE'),
            details: [ustensile ? 'Ustensile' : 'Ingrédient', detail ?? ''].filter(Boolean),
          })),
        );
      }
      case 'INSCRIPTION':
        return this.utilisateurService
          .getCuisinier(id)
          .pipe(
            map((c) =>
              this.apercuCompte(
                `${c.prenom} ${c.nom}`,
                c.email ?? c.telephone,
                c.photoProfil,
                c.statut,
                ['Cuisinier'],
              ),
            ),
          );
      // Décision sur une demande ou une proposition : le message suffit
      default:
        return of(null);
    }
  }

  private apercuCompte(
    nom: string,
    contact: string | null,
    photo: string | null,
    statut: string | null,
    details: string[],
  ): Apercu {
    return {
      titre: nom,
      sousTitre: contact,
      image: photo,
      video: null,
      statut,
      details: details.filter(Boolean),
    };
  }

  private libelleJour(date: string): string {
    const jour = new Date(date);
    const aujourdhui = new Date();
    const hier = new Date();
    hier.setDate(aujourdhui.getDate() - 1);
    if (jour.toDateString() === aujourdhui.toDateString()) {
      return "Aujourd'hui";
    }
    if (jour.toDateString() === hier.toDateString()) {
      return 'Hier';
    }
    return jour.toLocaleDateString('fr', { weekday: 'long', day: 'numeric', month: 'long' });
  }
}
