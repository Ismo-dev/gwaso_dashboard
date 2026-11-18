import { DatePipe, LowerCasePipe } from '@angular/common';
import { Component, computed, inject, input, output } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { Avatar } from '../../../../shared/components/avatar/avatar';
import { DepuisPipe } from '../../../../shared/pipes/depuis.pipe';
import {
  DemandeStatut,
  ICONES_TYPE_COMPTE,
  JUSTIFICATIFS_ATTENDUS,
  LIBELLES_TYPE_COMPTE,
  lienCarte,
  OPERATEURS_MOBILE_MONEY,
} from '../../models/utilisateur.model';
import { ouvrirJustificatif } from '../justificatif-dialog/ouvrir-justificatif';

/**
 * Carte d'une demande de statut (chef cuisinier, producteur ou livreur).
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
  protected justificatifAttendu = computed(() => JUSTIFICATIFS_ATTENDUS[this.demande().type]);
  protected icone = computed(() => ICONES_TYPE_COMPTE[this.demande().type]);
  protected livreur = computed(() => this.demande().type === 'LIVREUR');
  protected readonly operateurs = OPERATEURS_MOBILE_MONEY;

  /** [verso] : la seconde photo de la pièce d'identité d'un livreur. */
  voirJustificatif(verso = false): void {
    const d = this.demande();
    const url = verso ? d.preuveVersoUrl! : d.preuveUrl!;
    ouvrirJustificatif(
      this.dialog,
      url,
      `${d.prenom} ${d.nom}${this.livreur() ? (verso ? ' (verso)' : ' (recto)') : ''}`,
    );
  }
}
