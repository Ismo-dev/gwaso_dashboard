import { DatePipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { Avatar } from '../../../../shared/components/avatar/avatar';
import { DepuisPipe } from '../../../../shared/pipes/depuis.pipe';
import { FichierPipe } from '../../../../shared/pipes/fichier.pipe';
import { DemandeStatut, LIBELLES_ROLE } from '../../models/utilisateur.model';

/**
 * Carte d'une demande de statut (chef cuisinier ou producteur).
 * Tout ce qu'il faut pour décider est sur la carte : identité, contact, justificatif, décision.
 */
@Component({
  imports: [RouterLink, DatePipe, MatButton, NgIcon, Avatar, DepuisPipe, FichierPipe],
  selector: 'app-carte-demande',
  styleUrl: './carte-demande.scss',
  templateUrl: './carte-demande.html',
})
export class CarteDemande {
  readonly demande = input.required<DemandeStatut>();
  /** true pendant l'envoi de la décision : les boutons sont désactivés. */
  readonly enCours = input(false);

  readonly valider = output<DemandeStatut>();
  readonly refuser = output<DemandeStatut>();

  protected libelleRole = computed(() => LIBELLES_ROLE[this.demande().type]);
  protected icone = computed(() =>
    this.demande().type === 'CHEF' ? 'lucideChefHat' : 'lucideStore',
  );
}
