import { Component, computed, ElementRef, inject, input, output } from '@angular/core';

/** Ton d'une tuile : la couleur de sa pastille (le libellé est toujours écrit). */
export type TonStatut = 'attente' | 'succes' | 'erreur' | 'neutre' | 'info';

export interface OptionStatut {
  valeur: string;
  libelle: string;
  /** Nombre d'éléments ; null quand il n'est pas connu. */
  compte: number | null;
  /** Courte phrase sous le nombre (« attendent votre décision »). */
  aide?: string;
  ton?: TonStatut;
  /** Mis en avant quand il y a du travail (le nombre passe en couleur d'action). */
  prioritaire?: boolean;
}

/**
 * Filtre par statut, en tuiles : chaque tuile donne le nombre d'éléments du statut
 * et sert de filtre. On voit l'état de la page et on choisit en un clic.
 * Accessibilité : groupe de boutons radio (flèches gauche / droite pour changer).
 */
@Component({
  selector: 'app-filtre-statuts',
  styleUrl: './filtre-statuts.scss',
  templateUrl: './filtre-statuts.html',
})
export class FiltreStatuts {
  private hote = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly options = input.required<OptionStatut[]>();
  readonly valeur = input.required<string>();
  /** Nom du groupe pour les lecteurs d'écran (« Filtrer les vidéos par statut »). */
  readonly libelle = input.required<string>();
  readonly choisir = output<string>();

  protected indexActif = computed(() =>
    Math.max(
      0,
      this.options().findIndex((o) => o.valeur === this.valeur()),
    ),
  );

  protected selectionner(option: OptionStatut): void {
    if (option.valeur !== this.valeur()) {
      this.choisir.emit(option.valeur);
    }
  }

  /** Flèches : tuile précédente / suivante, Début / Fin : première / dernière. */
  protected clavier(evenement: KeyboardEvent, index: number): void {
    const n = this.options().length;
    const cible = {
      ArrowRight: (index + 1) % n,
      ArrowDown: (index + 1) % n,
      ArrowLeft: (index - 1 + n) % n,
      ArrowUp: (index - 1 + n) % n,
      Home: 0,
      End: n - 1,
    }[evenement.key];
    if (cible === undefined) {
      return;
    }
    evenement.preventDefault();
    this.selectionner(this.options()[cible]);
    this.hote.nativeElement.querySelectorAll<HTMLButtonElement>('.tuile')[cible]?.focus();
  }
}
