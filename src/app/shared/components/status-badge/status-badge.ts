import { Component, computed, input } from '@angular/core';

type Ton = 'succes' | 'attention' | 'danger' | 'neutre';

/** Libellé français et couleur de chaque statut renvoyé par l'API. */
const STATUTS: Record<string, { libelle: string; ton: Ton }> = {
  // Recettes et vidéos
  BROUILLON: { libelle: 'Brouillon', ton: 'neutre' },
  EN_ATTENTE_VALIDATION: { libelle: 'En attente', ton: 'attention' },
  PUBLIEE: { libelle: 'Publiée', ton: 'succes' },
  REJETEE: { libelle: 'Rejetée', ton: 'danger' },
  ARCHIVEE: { libelle: 'Archivée', ton: 'neutre' },
  DESACTIVEE: { libelle: 'Désactivée', ton: 'danger' },
  // Défis
  PROPOSE: { libelle: 'Proposé', ton: 'attention' },
  EN_COURS: { libelle: 'En cours', ton: 'succes' },
  TERMINE: { libelle: 'Terminé', ton: 'neutre' },
  ANNULE: { libelle: 'Annulé', ton: 'neutre' },
  // Rôles à valider (chefs, producteurs)
  EN_ATTENTE: { libelle: 'En attente', ton: 'attention' },
  VALIDE: { libelle: 'Validé', ton: 'succes' },
  REJETE: { libelle: 'Rejeté', ton: 'danger' },
  // Comptes
  ACTIF: { libelle: 'Actif', ton: 'succes' },
  INACTIF: { libelle: 'Inactif', ton: 'neutre' },
  SUSPENDU: { libelle: 'Suspendu', ton: 'danger' },
  SUPPRIME: { libelle: 'Supprimé', ton: 'neutre' },
};

/** Pastille de statut. Utilisation : <app-status-badge [statut]="recette.statut" /> */
@Component({
  imports: [],
  selector: 'app-status-badge',
  styleUrl: './status-badge.scss',
  templateUrl: './status-badge.html',
})
export class StatusBadge {
  readonly statut = input.required<string>();

  protected readonly info = computed(
    () => STATUTS[this.statut()] ?? { libelle: this.statut(), ton: 'neutre' as Ton },
  );
}
