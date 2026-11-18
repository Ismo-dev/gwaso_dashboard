import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
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
import { NgIcon } from '@ng-icons/core';
import { firstValueFrom } from 'rxjs';
import { PageResponse } from '../../../../core/models/page-response.model';
import { EcranService } from '../../../../core/services/ecran.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import {
  FiltreStatuts,
  OptionStatut,
} from '../../../../shared/components/filtre-statuts/filtre-statuts';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { DecisionLitigeDialog } from '../../components/decision-litige-dialog/decision-litige-dialog';
import {
  DECISIONS_LITIGE,
  LitigeResponse,
  MOTIFS_LITIGE,
  StatutLitige,
} from '../../models/marche.model';
import { MarcheService } from '../../services/marche.service';

type Filtre = StatutLitige | 'TOUS';

const TAILLES = [10, 20, 50];

/**
 * Litiges du marché : les problèmes signalés par les clients, du plus ancien au plus récent, à trancher.
 * Tant qu'un litige est ouvert, la commande n'est ni clôturée ni versée.
 */
@Component({
  imports: [
    DatePipe,
    DecimalPipe,
    MatButton,
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
    PageHeader,
    EmptyState,
    FiltreStatuts,
  ],
  selector: 'app-litiges-liste',
  styleUrl: './litiges-liste.scss',
  templateUrl: './litiges-liste.html',
})
export class LitigesListe implements OnInit {
  private marcheService = inject(MarcheService);
  private dialog = inject(MatDialog);
  private notification = inject(NotificationService);
  protected ecran = inject(EcranService);

  protected readonly tailles = TAILLES;
  protected readonly colonnes = ['commande', 'motif', 'personnes', 'date', 'decision', 'actions'];
  protected readonly lignesSquelette = [1, 2, 3, 4];

  protected filtre = signal<Filtre>('OUVERT');
  protected page = signal(0);
  protected taille = signal(TAILLES[0]);
  protected chargement = signal(true);
  protected erreur = signal(false);
  protected resultat = signal<PageResponse<LitigeResponse> | null>(null);
  /** Nombre de litiges par statut (GET /admin/litiges/compteurs). */
  private compteurs = signal<Record<string, number>>({});

  protected litiges = computed(() => this.resultat()?.contenu ?? []);

  protected options = computed<OptionStatut[]>(() => [
    {
      valeur: 'OUVERT',
      libelle: 'À trancher',
      compte: this.compteurs()['OUVERT'] ?? null,
      aide: 'versement en attente',
      ton: 'attente',
      prioritaire: true,
    },
    {
      valeur: 'RESOLU',
      libelle: 'Tranchés',
      compte: this.compteurs()['RESOLU'] ?? null,
      aide: 'remboursés ou rejetés',
      ton: 'succes',
    },
    {
      valeur: 'TOUS',
      libelle: 'Tous',
      compte: this.compteurs()['TOUS'] ?? null,
      aide: 'tous les litiges',
      ton: 'info',
    },
  ]);

  protected motif(litige: LitigeResponse): string {
    return MOTIFS_LITIGE[litige.motif] ?? litige.motif;
  }

  protected decision(litige: LitigeResponse): string {
    return litige.decision ? DECISIONS_LITIGE[litige.decision] : 'À trancher';
  }

  ngOnInit(): void {
    this.charger();
    this.chargerCompteurs();
  }

  private chargerCompteurs(): void {
    this.marcheService.getCompteursLitiges().subscribe({
      next: (c) => this.compteurs.set(c),
      error: () => this.compteurs.set({}),
    });
  }

  changerFiltre(valeur: string): void {
    this.filtre.set(valeur as Filtre);
    this.page.set(0);
    this.charger();
  }

  changerPage(evenement: PageEvent): void {
    this.taille.set(evenement.pageSize);
    this.page.set(evenement.pageIndex);
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set(false);
    const filtre = this.filtre();
    this.marcheService
      .getLitiges({
        statut: filtre === 'TOUS' ? undefined : filtre,
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

  async trancher(litige: LitigeResponse): Promise<void> {
    const fenetre = this.dialog.open<DecisionLitigeDialog, LitigeResponse, LitigeResponse>(
      DecisionLitigeDialog,
      {
        data: litige,
        width: '600px',
        maxWidth: 'calc(100vw - 2rem)',
      },
    );
    const tranche = await firstValueFrom(fenetre.afterClosed());
    if (!tranche) {
      return;
    }
    const rembourse = tranche.montantRembourse ?? 0;
    this.notification.succes(
      rembourse > 0
        ? `Commande ${tranche.referenceCommande} : ${rembourse} F remboursés au client, versements lancés.`
        : `Commande ${tranche.referenceCommande} : réclamation rejetée, versements lancés.`,
    );
    this.charger();
    this.chargerCompteurs();
  }
}
