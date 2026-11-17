import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { firstValueFrom } from 'rxjs';
import { ConfirmationService } from '../../../../core/services/confirmation.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { messageErreur } from '../../../../core/utils/erreurs';
import { CartePoint } from '../../../../shared/components/carte-point/carte-point';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { FichierPipe } from '../../../../shared/pipes/fichier.pipe';
import { UnitePipe } from '../../../../shared/pipes/unite.pipe';
import {
  AffecterLivreurDialog,
  AffectationLivreur,
} from '../../components/affecter-livreur-dialog/affecter-livreur-dialog';
import {
  AUTEURS_ANNULATION,
  CommandeAdminDetail,
  DECISIONS_LITIGE,
  MOTIFS_LITIGE,
  OPERATEURS,
  STATUTS_COMMANDE,
  STATUTS_LIVRAISON,
  STATUTS_PAIEMENT,
  STATUTS_VERSEMENT,
} from '../../models/marche.model';
import { MarcheService } from '../../services/marche.service';

/** Une étape du suivi : faite (avec sa date) ou pas encore. */
interface Etape {
  libelle: string;
  date: string | null;
  detail?: string | null;
}

/**
 * Tout sur une commande du marché, pour l'équipe Gwaso : produits et montants, suivi daté, livraison,
 * paiement, versements, réclamation, avis, client, fournisseur et lieu de livraison. Jamais le code de livraison.
 */
@Component({
  imports: [
    DatePipe,
    DecimalPipe,
    MatButton,
    NgIcon,
    RouterLink,
    CartePoint,
    EmptyState,
    FichierPipe,
    UnitePipe,
  ],
  selector: 'app-commande-detail',
  styleUrl: './commande-detail.scss',
  templateUrl: './commande-detail.html',
})
export class CommandeDetail implements OnInit {
  private marcheService = inject(MarcheService);
  private dialog = inject(MatDialog);
  private confirmation = inject(ConfirmationService);
  private notification = inject(NotificationService);

  /** Identifiant de la commande (paramètre de la route). */
  readonly id = input.required<string>();

  protected fiche = signal<CommandeAdminDetail | null>(null);
  protected chargement = signal(true);
  protected erreur = signal(false);
  protected introuvable = signal(false);
  protected enAction = signal(false);

  protected readonly libellesLivraison = STATUTS_LIVRAISON;
  protected readonly libellesPaiement = STATUTS_PAIEMENT;
  protected readonly libellesVersement = STATUTS_VERSEMENT;
  protected readonly motifs = MOTIFS_LITIGE;
  protected readonly decisions = DECISIONS_LITIGE;
  protected readonly operateurs = OPERATEURS;

  protected statut = computed(() => {
    const f = this.fiche();
    return f
      ? (STATUTS_COMMANDE[f.resume.statut] ?? { libelle: f.resume.statut, ton: 'neutre' })
      : null;
  });

  protected annulation = computed(() => {
    const auteur = this.fiche()?.annuleePar;
    return auteur ? (AUTEURS_ANNULATION[auteur] ?? auteur) : null;
  });

  /** Étapes datées, de la commande à la clôture ; les étapes à venir restent grisées. */
  protected etapes = computed<Etape[]>(() => {
    const f = this.fiche();
    if (!f) {
      return [];
    }
    const l = f.livraison;
    const p = f.paiement;
    return [
      { libelle: 'Commande passée', date: f.resume.dateCreation },
      {
        libelle: 'Acceptée par le fournisseur',
        date: f.dateAcceptation,
        detail: f.fournisseur?.nom,
      },
      {
        libelle: 'Payée',
        date: p?.dateConfirmation ?? null,
        detail: p ? OPERATEURS[p.operateur ?? ''] : null,
      },
      { libelle: 'Livreur trouvé', date: l?.dateAssignation ?? null, detail: l?.livreurNom },
      { libelle: 'Partie chez le client', date: l?.dateDepart ?? null },
      { libelle: 'Remise au client', date: l?.dateLivraison ?? null },
      { libelle: 'Clôturée', date: f.dateCloture },
    ];
  });

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set(false);
    this.introuvable.set(false);
    this.marcheService.getCommande(this.id()).subscribe({
      next: (fiche) => {
        this.fiche.set(fiche);
        this.chargement.set(false);
      },
      error: (e) => {
        if (e?.status === 404 || e?.status === 400) {
          this.introuvable.set(true);
        } else {
          this.erreur.set(true);
        }
        this.chargement.set(false);
      },
    });
  }

  protected lienCarte(lat: number, lng: number): string {
    return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
  }

  async affecter(): Promise<void> {
    const f = this.fiche();
    if (!f?.resume.livraisonId) {
      return;
    }
    const fenetre = this.dialog.open<AffecterLivreurDialog, AffectationLivreur, string>(
      AffecterLivreurDialog,
      {
        data: { livraisonId: f.resume.livraisonId, reference: f.resume.reference },
        width: '520px',
        maxWidth: 'calc(100vw - 2rem)',
      },
    );
    const livreur = await firstValueFrom(fenetre.afterClosed());
    if (livreur === undefined) {
      return;
    }
    this.notification.succes(`Commande ${f.resume.reference} confiée à ${livreur}.`);
    this.charger();
  }

  async annuler(): Promise<void> {
    const f = this.fiche();
    if (!f) {
      return;
    }
    const ok = await this.confirmation.demander({
      titre: `Annuler la commande ${f.resume.reference} ?`,
      message: `Le client est remboursé de ${(f.resume.montant ?? 0).toLocaleString('fr-FR')} F et le stock rendu au fournisseur. Le client et le fournisseur sont prévenus.`,
      texteConfirmer: 'Annuler et rembourser',
      texteAnnuler: 'Garder',
      danger: true,
    });
    if (!ok) {
      return;
    }
    this.enAction.set(true);
    this.marcheService.annulerCommande(f.resume.id).subscribe({
      next: () => {
        this.enAction.set(false);
        this.notification.succes(`Commande ${f.resume.reference} annulée, client remboursé.`);
        this.charger();
      },
      error: (e) => {
        this.enAction.set(false);
        this.notification.erreur(messageErreur(e, "Impossible d'annuler cette commande."));
      },
    });
  }
}
