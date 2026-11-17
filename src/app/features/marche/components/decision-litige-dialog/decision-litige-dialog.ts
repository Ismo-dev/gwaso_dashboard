import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatError, MatFormField, MatHint, MatLabel, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatRadioButton, MatRadioGroup } from '@angular/material/radio';
import { messageErreur } from '../../../../core/utils/erreurs';
import { FichierPipe } from '../../../../shared/pipes/fichier.pipe';
import {
  ChargeLitige,
  DecisionLitige,
  DECISIONS_LITIGE,
  LitigeResponse,
  MOTIFS_LITIGE,
} from '../../models/marche.model';
import { MarcheService } from '../../services/marche.service';

/**
 * Trancher un litige : rembourser tout, une partie ou rien. Le remboursement est retiré d'abord de la part du
 * fournisseur ; pour une commande non livrée, on peut le faire supporter d'abord par le livreur.
 * Renvoie le litige tranché, ou rien si on annule.
 */
@Component({
  imports: [
    ReactiveFormsModule,
    DatePipe,
    DecimalPipe,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatButton,
    MatFormField,
    MatLabel,
    MatHint,
    MatError,
    MatSuffix,
    MatInput,
    MatRadioGroup,
    MatRadioButton,
    MatProgressSpinner,
    FichierPipe,
  ],
  selector: 'app-decision-litige-dialog',
  styleUrl: './decision-litige-dialog.scss',
  templateUrl: './decision-litige-dialog.html',
})
export class DecisionLitigeDialog {
  protected litige = inject<LitigeResponse>(MAT_DIALOG_DATA);
  private fenetre = inject(MatDialogRef<DecisionLitigeDialog, LitigeResponse>);
  private marcheService = inject(MarcheService);

  protected readonly motifs = MOTIFS_LITIGE;
  protected readonly decisions = Object.entries(DECISIONS_LITIGE) as [DecisionLitige, string][];
  protected readonly paye = this.litige.montantPaye ?? 0;
  protected readonly nonLivre = this.litige.motif === 'NON_LIVRE';

  protected decision = new FormControl<DecisionLitige | null>(null, Validators.required);
  protected montant = new FormControl<number | null>(null, [
    Validators.required,
    Validators.min(1),
    Validators.max(this.paye),
  ]);
  protected aChargeDe = new FormControl<ChargeLitige>('FOURNISSEUR', { nonNullable: true });

  private decisionChoisie = toSignal(this.decision.valueChanges, { initialValue: null });
  protected partiel = computed(() => this.decisionChoisie() === 'REMBOURSEMENT_PARTIEL');

  protected enCours = signal(false);
  protected erreur = signal('');

  /** Ce que la décision fera, en une phrase. */
  protected consequence = computed(() => {
    switch (this.decisionChoisie()) {
      case 'REMBOURSEMENT_TOTAL':
        return `Le client récupère les ${this.paye.toLocaleString('fr-FR')} F payés. La commande est clôturée sans versement.`;
      case 'REMBOURSEMENT_PARTIEL':
        return 'Le client récupère ce montant ; le fournisseur et le livreur reçoivent le reste, moins la commission.';
      case 'REJETE':
        return 'Rien n’est remboursé : la commande est clôturée et les versements partent en entier.';
      default:
        return '';
    }
  });

  confirmer(): void {
    const decision = this.decision.value;
    if (!decision) {
      this.decision.markAsTouched();
      return;
    }
    if (decision === 'REMBOURSEMENT_PARTIEL' && this.montant.invalid) {
      this.montant.markAsTouched();
      return;
    }
    this.enCours.set(true);
    this.erreur.set('');
    this.marcheService
      .decider(this.litige.id, {
        decision,
        montantRembourse:
          decision === 'REMBOURSEMENT_PARTIEL' ? Number(this.montant.value) : undefined,
        aChargeDe: this.nonLivre ? this.aChargeDe.value : undefined,
      })
      .subscribe({
        next: (litige) => this.fenetre.close(litige),
        error: (erreur: unknown) => {
          this.enCours.set(false);
          this.erreur.set(messageErreur(erreur, 'Impossible de trancher ce litige.'));
        },
      });
  }
}
