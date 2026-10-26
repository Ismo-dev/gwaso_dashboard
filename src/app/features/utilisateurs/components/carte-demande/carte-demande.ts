import { DatePipe, LowerCasePipe } from '@angular/common';
import { Component, computed, inject, input, output } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { Avatar } from '../../../../shared/components/avatar/avatar';
import { DepuisPipe } from '../../../../shared/pipes/depuis.pipe';
import { DemandeStatut, JUSTIFICATIFS_ATTENDUS, LIBELLES_TYPE_COMPTE, lienCarte } from '../../models/utilisateur.model';
import { ouvrirJustificatif } from '../justificatif-dialog/ouvrir-justificatif';

/**
 * Carte d'une demande de statut (chef cuisinier ou producteur).
 * Tout ce qu'il faut pour décider est sur la carte : identité, contact, justificatif, décision.
 */
@Component({
  imports: [RouterLink, DatePipe, LowerCasePipe, MatButton, NgIcon, Avatar, DepuisPipe],
  selector: 'app-carte-demande',
  styleUrl: './carte-demande.scss',
  templateUrl: './carte-demande.html',
})
export class CarteDemande {
  private dialog = inject(MatDialog);

  readonly demande = input.required<DemandeStatut>();
  /** true pendant l'envoi de la décision : les boutons sont désactivés. */
  readonly enCours = input(false);

  readonly valider = output<DemandeStatut>();
  readonly refuser = output<DemandeStatut>();

  protected readonly lienCarte = lienCarte;
  protected libelleRole = computed(() => LIBELLES_TYPE_COMPTE[this.demande().type]);
  /** Ce que l'administrateur doit s'attendre à voir dans le justificatif. */
  protected justificatifAttendu = computed(() => JUSTIFICATIFS_ATTENDUS[this.demande().type === 'CHEF' ? 'CHEF' : 'PRODUCTEUR']);
  protected icone = computed(() =>
    this.demande().type === 'CHEF' ? 'lucideChefHat' : 'lucideStore',
  );

  voirJustificatif(): void {
    const d = this.demande();
    ouvrirJustificatif(this.dialog, d.preuveUrl!, `${d.prenom} ${d.nom}`);
  }
}
