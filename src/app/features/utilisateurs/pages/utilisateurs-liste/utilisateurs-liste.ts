import { DatePipe, NgTemplateOutlet } from '@angular/common';
import {
  MatCell,
  MatCellDef,
  MatColumnDef,
  MatHeaderCell,
  MatHeaderCellDef,
  MatHeaderRow,
  MatHeaderRowDef,
  MatRow,
  MatRowDef,
  MatTable,
} from '@angular/material/table';
import { Component, computed, effect, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatDialog } from '@angular/material/dialog';
import { MatFormField, MatLabel, MatPrefix, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatTooltip } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  firstValueFrom,
  forkJoin,
  map,
  Observable,
  of,
  switchMap,
  tap,
} from 'rxjs';
import { TypeCompte, StatutCompte } from '../../../../core/models/enums.model';
import { PageResponse } from '../../../../core/models/page-response.model';
import { AValiderService } from '../../../../core/services/a-valider.service';
import { ConfirmationService } from '../../../../core/services/confirmation.service';
import { EcranService } from '../../../../core/services/ecran.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { SessionService } from '../../../../core/services/session.service';
import { Avatar } from '../../../../shared/components/avatar/avatar';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { DepuisPipe } from '../../../../shared/pipes/depuis.pipe';
import { choisirProfil } from '../../../profils/components/choix-profil-dialog/ouvrir-choix-profil';
import { CarteDemande } from '../../components/carte-demande/carte-demande';
import {
  NouvelUtilisateurDialog,
  ResultatNouvelUtilisateur,
} from '../../components/nouvel-utilisateur-dialog/nouvel-utilisateur-dialog';
import {
  DemandeStatut,
  FiltresUtilisateurs,
  ICONES_TYPE_COMPTE,
  LIBELLES_TYPE_COMPTE,
  ORDRE_TYPES_COMPTE,
  UtilisateurResume,
} from '../../models/utilisateur.model';
import { UtilisateurService } from '../../services/utilisateur.service';

type Onglet = 'demandes' | 'membres';

const ROLES: TypeCompte[] = ['CUISINIER', 'CHEF', 'PRODUCTEUR', 'LIVREUR', 'ADMIN'];
const STATUTS: { valeur: StatutCompte; libelle: string }[] = [
  { valeur: 'ACTIF', libelle: 'Actif' },
  { valeur: 'SUSPENDU', libelle: 'Suspendu' },
  { valeur: 'INACTIF', libelle: 'Inactif' },
];
const TAILLE_PAR_DEFAUT = 10;
/** Les demandes sont peu nombreuses : on les charge toutes d'un coup. */
const TAILLE_DEMANDES = 100;

interface EtatMembres {
  chargement: boolean;
  erreur: boolean;
  page: PageResponse<UtilisateurResume> | null;
}

/**
 * Utilisateurs : deux usages bien séparés (loi de Hick).
 * 1. « Demandes à valider » : décider rapidement sur les chefs et producteurs en attente,
 *    et sur les cuisiniers qui demandent à le devenir.
 * 2. « Tous les membres » : retrouver un compte et gérer son statut.
 * L'onglet et les filtres sont dans l'adresse (?onglet=membres&role=CHEF...).
 */
@Component({
  imports: [
    ReactiveFormsModule,
    RouterLink,
    DatePipe,
    NgTemplateOutlet,
    MatTable,
    MatColumnDef,
    MatHeaderCell,
    MatHeaderCellDef,
    MatCell,
    MatCellDef,
    MatHeaderRow,
    MatHeaderRowDef,
    MatRow,
    MatRowDef,
    MatButton,
    MatIconButton,
    MatButtonToggleGroup,
    MatButtonToggle,
    MatFormField,
    MatLabel,
    MatPrefix,
    MatSuffix,
    MatInput,
    MatSelect,
    MatOption,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    MatTooltip,
    MatPaginator,
    NgIcon,
    PageHeader,
    EmptyState,
    StatusBadge,
    Avatar,
    DepuisPipe,
    CarteDemande,
  ],
  selector: 'app-utilisateurs-liste',
  styleUrl: './utilisateurs-liste.scss',
  templateUrl: './utilisateurs-liste.html',
})
export class UtilisateursListe implements OnInit {
  private utilisateurService = inject(UtilisateurService);
  private confirmation = inject(ConfirmationService);
  private notification = inject(NotificationService);
  private aValider = inject(AValiderService);
  private session = inject(SessionService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private dialog = inject(MatDialog);
  /** Filtre par type de compte (la classe du compte). */
  protected readonly typesCompte = ORDRE_TYPES_COMPTE;
  protected readonly libellesTypePluriel: Record<TypeCompte, string> = {
    ADMIN: 'Administrateurs',
    CUISINIER: 'Cuisiniers',
    CHEF: 'Chefs cuisiniers',
    PRODUCTEUR: 'Producteurs',
    LIVREUR: 'Livreurs',
  };
  protected ecran = inject(EcranService);

  // ----- Paramètres de l'adresse -----
  readonly onglet = input<string>();
  readonly recherche = input<string>();
  readonly role = input<string>();
  readonly statut = input<string>();
  readonly page = input<string>();
  readonly taille = input<string>();

  protected readonly roles = ROLES;
  protected readonly statuts = STATUTS;
  protected readonly libellesRole = LIBELLES_TYPE_COMPTE;
  protected readonly iconesRole = ICONES_TYPE_COMPTE;

  protected ongletActif = computed<Onglet>(() =>
    this.onglet() === 'membres' ? 'membres' : 'demandes',
  );
  protected roleActif = computed(() => ROLES.find((role) => role === this.role()));
  protected statutActif = computed(() => STATUTS.find((s) => s.valeur === this.statut())?.valeur);
  protected pageActive = computed(() => Math.max(Number(this.page() ?? 0) || 0, 0));
  protected tailleActive = computed(
    () => Number(this.taille() ?? TAILLE_PAR_DEFAUT) || TAILLE_PAR_DEFAUT,
  );
  protected filtresActifs = computed(
    () => !!this.recherche() || !!this.roleActif() || !!this.statutActif(),
  );

  // ----- Demandes -----
  protected demandes = signal<DemandeStatut[]>([]);
  protected chargementDemandes = signal(true);
  protected erreurDemandes = signal(false);
  protected demandeEnCours = signal<string | null>(null);

  // ----- Membres -----
  private rechargement = signal(0);
  private filtresMembres = computed<FiltresUtilisateurs & { rechargement: number; actif: boolean }>(
    () => ({
      recherche: this.recherche(),
      role: this.roleActif(),
      statut: this.statutActif(),
      page: this.pageActive(),
      taille: this.tailleActive(),
      rechargement: this.rechargement(),
      actif: this.ongletActif() === 'membres',
    }),
  );
  protected membres = signal<EtatMembres>({ chargement: true, erreur: false, page: null });
  protected membreEnCours = signal<string | null>(null);

  protected champRecherche = new FormControl('', { nonNullable: true });
  protected lignesSquelette = [1, 2, 3, 4, 5];

  /** Icône d'un type de compte (méthode typée : la ligne d'un mat-table n'a pas de type). */
  protected iconeRole(role: TypeCompte): string {
    return ICONES_TYPE_COMPTE[role];
  }

  /** Colonnes du tableau des membres : la date d'inscription est masquée sur tablette. */
  protected colonnes = computed(() =>
    this.ecran.tablette()
      ? ['membre', 'role', 'statut', 'actions']
      : ['membre', 'role', 'inscription', 'statut', 'actions'],
  );

  constructor() {
    // La liste des membres n'est chargée que si son onglet est ouvert
    toObservable(this.filtresMembres)
      .pipe(
        tap(
          ({ actif }) =>
            actif && this.membres.update((etat) => ({ ...etat, chargement: true, erreur: false })),
        ),
        switchMap(({ rechargement, actif, ...filtres }) =>
          !actif
            ? of(null)
            : this.utilisateurService.rechercher(filtres).pipe(
                map((page): EtatMembres => ({ chargement: false, erreur: false, page })),
                catchError(() => of<EtatMembres>({ chargement: false, erreur: true, page: null })),
              ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((etat) => etat && this.membres.set(etat));

    this.champRecherche.valueChanges
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((texte) => this.naviguer({ recherche: texte.trim() || null, page: null }));

    effect(() => this.champRecherche.setValue(this.recherche() ?? '', { emitEvent: false }));
  }

  ngOnInit(): void {
    this.chargerDemandes();
  }

  // ----- Navigation et filtres -----

  changerOnglet(onglet: Onglet): void {
    // En changeant d'onglet, on repart de filtres vides
    this.naviguer({
      onglet: onglet === 'demandes' ? null : onglet,
      recherche: null,
      role: null,
      statut: null,
      page: null,
    });
  }

  changerRole(role: TypeCompte | null): void {
    this.naviguer({ role, page: null });
  }

  changerStatut(statut: StatutCompte | null): void {
    this.naviguer({ statut, page: null });
  }

  changerPage(evenement: PageEvent): void {
    this.naviguer({
      page: evenement.pageIndex || null,
      taille: evenement.pageSize === TAILLE_PAR_DEFAUT ? null : evenement.pageSize,
    });
  }

  effacerFiltres(): void {
    this.naviguer({ recherche: null, role: null, statut: null, page: null });
  }

  recharger(): void {
    this.rechargement.update((valeur) => valeur + 1);
  }

  // ----- Création d'un compte -----

  async nouvelUtilisateur(): Promise<void> {
    const resultat = await firstValueFrom(
      this.dialog
        .open<NouvelUtilisateurDialog, void, ResultatNouvelUtilisateur>(NouvelUtilisateurDialog, {
          width: 'min(620px, 96vw)',
          // Material limite les dialogues à 560 px par défaut : sans cela, le contenu débordait
          maxWidth: '96vw',
          maxHeight: '94dvh',
        })
        .afterClosed(),
    );
    if (!resultat) {
      return;
    }
    if (resultat.aVerifier) {
      this.notification.avertissement(resultat.message);
    } else {
      this.notification.succes(resultat.message);
    }
    // Les deux listes peuvent changer (nouveau membre, éventuelle demande en attente)
    this.recharger();
    this.chargerDemandes();
    this.aValider.rafraichir();
  }

  // ----- Demandes de statut -----

  chargerDemandes(): void {
    this.chargementDemandes.set(true);
    this.erreurDemandes.set(false);
    const filtres = { statutRole: 'EN_ATTENTE' as const, taille: TAILLE_DEMANDES };

    forkJoin({
      chefs: this.utilisateurService.getChefs(filtres),
      producteurs: this.utilisateurService.getProducteurs(filtres),
      cuisiniers: this.utilisateurService.getDemandesStatut('EN_ATTENTE'),
    }).subscribe({
      next: ({ chefs, producteurs, cuisiniers }) => {
        const sansDemande = { origine: 'compte' as const, demandeId: null, motivation: null };
        const demandes: DemandeStatut[] = [
          ...chefs.contenu.map((c) => ({ ...c, ...sansDemande, type: 'CHEF' as const, localite: null })),
          ...producteurs.contenu.map((p) => ({ ...p, ...sansDemande, type: 'PRODUCTEUR' as const })),
          // Cuisiniers qui demandent à devenir chef ou producteur
          ...cuisiniers.map((d) => ({
            id: d.demandeurId,
            origine: 'cuisinier' as const,
            demandeId: d.id,
            motivation: d.motivation,
            type: d.type,
            nom: d.demandeurNom,
            prenom: d.demandeurPrenom,
            email: d.demandeurEmail,
            telephone: d.demandeurTelephone,
            photoProfil: d.demandeurPhotoProfil,
            preuveUrl: d.preuveUrl,
            localite: d.localite,
            latitude: d.latitude,
            longitude: d.longitude,
            dateInscription: d.dateDemande,
          })),
        ];
        // Les plus anciennes d'abord : elles attendent depuis le plus longtemps
        demandes.sort(
          (a, b) => new Date(a.dateInscription).getTime() - new Date(b.dateInscription).getTime(),
        );
        this.demandes.set(demandes);
        this.chargementDemandes.set(false);
      },
      error: () => {
        this.erreurDemandes.set(true);
        this.chargementDemandes.set(false);
      },
    });
  }

  async validerDemande(demande: DemandeStatut): Promise<void> {
    const role = LIBELLES_TYPE_COMPTE[demande.type].toLowerCase();
    if (demande.demandeId) {
      // Cuisinier qui devient chef / producteur : on choisit le profil qui lui donne ses droits
      const profilId = await choisirProfil(this.dialog, {
        titre: `${demande.prenom} ${demande.nom} devient ${role} ?`,
        message: `Son compte passe de cuisinier à ${role}. Il garde ses favoris, commentaires et contenus.`,
        texteConfirmer: 'Valider la demande',
        suggestion: demande.type === 'CHEF' ? 'chef' : 'producteur',
      });
      if (!profilId) {
        return;
      }
      this.demandeEnCours.set(demande.id);
      this.utilisateurService.validerDemande(demande.demandeId, profilId).subscribe({
        next: () => this.apresDecision(`${demande.prenom} ${demande.nom} est maintenant ${role}.`),
        error: () => this.demandeEnCours.set(null),
      });
      return;
    }
    const confirme = await this.confirmation.demander({
      titre: `Valider ${demande.prenom} ${demande.nom} ?`,
      message: `Son compte obtiendra le statut ${role}.`,
      texteConfirmer: 'Valider la demande',
    });
    if (!confirme) {
      return;
    }
    this.demandeEnCours.set(demande.id);
    const requete: Observable<unknown> = demande.type === 'CHEF'
        ? this.utilisateurService.validerChef(demande.id)
        : this.utilisateurService.validerProducteur(demande.id);
    requete.subscribe({
      next: () => this.apresDecision(`${demande.prenom} ${demande.nom} est maintenant ${role}.`),
      error: () => this.demandeEnCours.set(null),
    });
  }

  async refuserDemande(demande: DemandeStatut): Promise<void> {
    const motif = await this.confirmation.demanderMotif({
      titre: `Refuser la demande de ${demande.prenom} ${demande.nom} ?`,
      message:
        'Son compte reste actif, mais sans le statut demandé. Il pourra envoyer un nouveau justificatif.',
      libelle: 'Motif du refus',
      aide: 'Ce message sera montré à la personne : indiquez ce qui manque.',
      texteConfirmer: 'Refuser la demande',
    });
    if (!motif) {
      return;
    }
    this.demandeEnCours.set(demande.id);
    const requete: Observable<unknown> = demande.demandeId
      ? this.utilisateurService.refuserDemande(demande.demandeId, motif)
      : demande.type === 'CHEF'
        ? this.utilisateurService.rejeterChef(demande.id, motif)
        : this.utilisateurService.rejeterProducteur(demande.id, motif);
    requete.subscribe({
      next: () =>
        this.apresDecision(`La demande de ${demande.prenom} ${demande.nom} a été refusée.`),
      error: () => this.demandeEnCours.set(null),
    });
  }

  private apresDecision(message: string): void {
    this.demandeEnCours.set(null);
    this.notification.succes(message);
    this.chargerDemandes();
    this.aValider.rafraichir();
  }

  // ----- Statut des comptes -----

  protected estMoi(membre: UtilisateurResume): boolean {
    return membre.id === this.session.utilisateur()?.id;
  }

  async suspendre(membre: UtilisateurResume): Promise<void> {
    const confirme = await this.confirmation.demander({
      titre: `Suspendre le compte de ${membre.prenom} ${membre.nom} ?`,
      message:
        'La personne ne pourra plus se connecter. Ses contenus restent en place. Vous pourrez réactiver le compte à tout moment.',
      texteConfirmer: 'Suspendre le compte',
      danger: true,
    });
    if (confirme) {
      this.changerStatutCompte(
        membre,
        'SUSPENDU',
        `Le compte de ${membre.prenom} ${membre.nom} est suspendu.`,
      );
    }
  }

  async reactiver(membre: UtilisateurResume): Promise<void> {
    const confirme = await this.confirmation.demander({
      titre: `Réactiver le compte de ${membre.prenom} ${membre.nom} ?`,
      message: 'La personne pourra de nouveau se connecter et utiliser Gwaso.',
      texteConfirmer: 'Réactiver le compte',
    });
    if (confirme) {
      this.changerStatutCompte(
        membre,
        'ACTIF',
        `Le compte de ${membre.prenom} ${membre.nom} est réactivé.`,
      );
    }
  }

  private changerStatutCompte(
    membre: UtilisateurResume,
    statut: StatutCompte,
    message: string,
  ): void {
    this.membreEnCours.set(membre.id);
    this.utilisateurService.changerStatutCompte(membre.id, statut).subscribe({
      next: () => {
        this.membreEnCours.set(null);
        this.notification.succes(message);
        this.recharger();
      },
      error: () => this.membreEnCours.set(null),
    });
  }

  /** Met à jour l'adresse ; null retire le paramètre. */
  private naviguer(parametres: Record<string, string | number | null>): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: parametres,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
