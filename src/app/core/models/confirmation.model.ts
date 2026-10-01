/** Contenu de la boîte de confirmation (voir ConfirmationService.demander). */
export interface DemandeConfirmation {
  titre: string;
  message: string;
  texteConfirmer?: string;
  texteAnnuler?: string;
  /** true pour une action destructrice (suppression, rejet...) : le bouton est affiché en rouge. */
  danger?: boolean;
}

/** Contenu de la boîte qui demande un motif (voir ConfirmationService.demanderMotif). */
export interface DemandeMotif {
  titre: string;
  message: string;
  /** Libellé du champ, ex. « Motif du rejet ». */
  libelle: string;
  /** Aide sous le champ, ex. « Ce message sera envoyé à l'auteur. » */
  aide?: string;
  texteConfirmer?: string;
}
