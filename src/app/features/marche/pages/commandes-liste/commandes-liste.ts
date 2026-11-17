import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormField, MatLabel, MatPrefix, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { firstValueFrom } from 'rxjs';
import { PageResponse } from '../../../../core/models/page-response.model';
import { ConfirmationService } from '../../../../core/services/confirmation.service';
import { EcranService } from '../../../../core/services/ecran.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { messageErreur } from '../../../../core/utils/erreurs';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import {
  FiltreStatuts,
  OptionStatut,
} from '../../../../shared/components/filtre-statuts/filtre-statuts';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import {
  AffecterLivreurDialog,
  AffectationLivreur,
} from '../../components/affecter-livreur-dialog/affecter-livreur-dialog';
import {
  CommandeAdmin,
  FiltreCommandes,
  STATUTS_COMMANDE,
  STATUTS_LIVRAISON,
  STATUTS_PAIEMENT,
} from '../../models/marche.model';
import { MarcheService } from '../../services/marche.service';

const TAILLES = [10, 20, 50];

const ONGLETS: {
  valeur: FiltreCommandes;
  libelle: string;
  aide: string;
  ton: OptionStatut['ton'];
}[] = [
  { valeur: 'SANS_LIVREUR', libelle: 'Sans livreur', aide: 'à confier ou annuler', ton: 'attente' },
  { valeur: 'EN_ATTENTE', libelle: 'En attente', aide: 'fournisseur ou paiement', ton: 'info' },
  { valeur: 'EN_COURS', libelle: 'En cours', aide: 'de la préparation à la remise', ton: 'info' },
  { valeur: 'A_SURVEILLER', libelle: 'À surveiller', aide: 'litige ou échec', ton: 'erreur' },
  { valeur: 'TERMINEES', libelle: 'Terminées', aide: 'livrées ou clôturées', ton: 'succes' },
  {
    valeur: 'ANNULEES',
    libelle: 'Annulées',
    aide: 'annulées, expirées, remboursées',
    ton: 'neutre',
  },
  { valeur: 'TOUTES', libelle: 'Toutes', aide: 'toutes les commandes', ton: 'info' },
];

/**
 * Commandes du marché : toutes, par onglet, avec recherche. Les commandes payées que personne ne livre
 * se confient à un livreur ou s'annulent (client remboursé) d'ici ; le détail montre tout le reste.
 */
@Component({
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    MatButton,
    MatIconButton,
    MatFormField,
    MatLabel,
    MatPrefix,
    MatSuffix,
    MatInput,
    MatPaginator,
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
    NgIcon,
    RouterLink,
    PageHeader,
    EmptyState,
    FiltreStatuts,
  ],
  selector: 'app-commandes-liste',
  styleUrl: './commandes-liste.scss',
  templateUrl: './commandes-liste.html',
})
export class CommandesListe implements OnInit, OnDestroy {
  private marcheService = inject(MarcheService);
  private dialog = inject(MatDialog);
  private confirmation = inject(ConfirmationService);
  private notification = inject(NotificationService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  protected ecran = inject(EcranService);

  protected readonly tailles = TAILLES;
  protected readonly colonnes = [
    'commande',
    'client',
    'fournisseur',
    'montant',
    'statut',
    'actions',
  ];
  protected readonly lignesSquelette = [1, 2, 3, 4];

  protected filtre = signal<FiltreCommandes>('SANS_LIVREUR');
  protected recherche = signal('');
  protected page = signal(0);
  protected taille = signal(TAILLES[1]);
  protected chargement = signal(true);
  protected erreur = signal(false);
  protected resultat = signal<PageResponse<CommandeAdmin> | null>(null);
  protected compteurs = signal<Partial<Record<FiltreCommandes, number>>>({});
  /** Commande dont une action (affecter, annuler) est en cours. */
  protected enAction = signal<string | null>(null);

  protected commandes = computed(() => this.resultat()?.contenu ?? []);

  protected options = computed<OptionStatut[]>(() =>
    ONGLETS.map((o) => ({
      ...o,
      compte: this.compteurs()[o.valeur] ?? null,
      prioritaire: o.valeur === 'SANS_LIVREUR' || o.valeur === 'A_SURVEILLER',
    })),
  );

  private minuterie: ReturnType<typeof setTimeout> | undefined;

  ngOnInit(): void {
    const onglet = this.route.snapshot.queryParamMap.get('onglet') as FiltreCommandes | null;
    if (onglet && ONGLETS.some((o) => o.valeur === onglet)) {
      this.filtre.set(onglet);
    }
    this.charger();
    this.chargerCompteurs();
  }

  ngOnDestroy(): void {
    clearTimeout(this.minuterie);
  }

  protected statut(c: CommandeAdmin) {
    return STATUTS_COMMANDE[c.statut] ?? { libelle: c.statut, ton: 'neutre' };
  }

  protected livraison(c: CommandeAdmin): string | null {
    return c.statutLivraison ? STATUTS_LIVRAISON[c.statutLivraison] : null;
  }

  protected paiement(c: CommandeAdmin): string | null {
    return c.statutPaiement ? STATUTS_PAIEMENT[c.statutPaiement] : null;
  }

  /** « 2 produits » ou le nom du seul produit. */
  protected produits(c: CommandeAdmin): string {
    return c.lignes.length === 1 ? c.lignes[0].ingredientNom : `${c.lignes.length} produits`;
  }

  changerFiltre(valeur: string): void {
    this.filtre.set(valeur as FiltreCommandes);
    this.page.set(0);
    // L'onglet reste dans l'adresse : on y revient depuis le détail
    this.router.navigate([], { queryParams: { onglet: valeur }, replaceUrl: true });
    this.charger();
  }

  rechercher(texte: string): void {
    this.recherche.set(texte);
    clearTimeout(this.minuterie);
    this.minuterie = setTimeout(() => {
      this.page.set(0);
      this.charger();
    }, 300);
  }

  changerPage(evenement: PageEvent): void {
    this.taille.set(evenement.pageSize);
    this.page.set(evenement.pageIndex);
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set(false);
    this.marcheService
      .getCommandes({
        filtre: this.filtre(),
        recherche: this.recherche().trim() || undefined,
        page: this.page(),
        taille: this.taille(),
      })
      .subscribe({
        next: (resultat) => {
          this.resultat.set(resultat);
          this.chargement.set(false);
        },
        error: () => {
          this.erreur.set(true);
          this.chargement.set(false);
        },
      });
  }

  private chargerCompteurs(): void {
    this.marcheService.getCompteursCommandes().subscribe({
      next: (compteurs) => this.compteurs.set(compteurs),
      error: () => this.compteurs.set({}),
    });
  }

  async affecter(c: CommandeAdmin): Promise<void> {
    if (!c.livraisonId) {
      return;
    }
    const fenetre = this.dialog.open<AffecterLivreurDialog, AffectationLivreur, string>(
      AffecterLivreurDialog,
      {
        data: { livraisonId: c.livraisonId, reference: c.reference },
        width: '520px',
        maxWidth: 'calc(100vw - 2rem)',
      },
    );
    const livreur = await firstValueFrom(fenetre.afterClosed());
    if (livreur === undefined) {
      return;
    }
    this.notification.succes(`Commande ${c.reference} confiée à ${livreur}.`);
    this.charger();
    this.chargerCompteurs();
  }

  async annuler(c: CommandeAdmin): Promise<void> {
    const ok = await this.confirmation.demander({
      titre: `Annuler la commande ${c.reference} ?`,
      message: `Le client est remboursé de ${(c.montant ?? 0).toLocaleString('fr-FR')} F et le stock rendu au fournisseur. Le client et le fournisseur sont prévenus.`,
      texteConfirmer: 'Annuler et rembourser',
      texteAnnuler: 'Garder',
      danger: true,
    });
    if (!ok) {
      return;
    }
    this.enAction.set(c.id);
    this.marcheService.annulerCommande(c.id).subscribe({
      next: () => {
        this.enAction.set(null);
        this.notification.succes(`Commande ${c.reference} annulée, client remboursé.`);
        this.charger();
        this.chargerCompteurs();
      },
      error: (e) => {
        this.enAction.set(null);
        this.notification.erreur(messageErreur(e, "Impossible d'annuler cette commande."));
      },
    });
  }
}
