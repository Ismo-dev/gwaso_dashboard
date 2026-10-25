import { DatePipe } from '@angular/common';
import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { catchError, forkJoin, of } from 'rxjs';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { FichierPipe } from '../../../../shared/pipes/fichier.pipe';
import { DefiResponse } from '../../../defis/models/defi.model';
import { DefiService } from '../../../defis/services/defi.service';
import { RecetteResponse, nomsCategories } from '../../../recettes/models/recette.model';
import { RecetteService } from '../../../recettes/services/recette.service';

const TAILLE = 50;

/** Ce qu'un chef a proposé : ses recettes et ses défis, avec leur statut. */
@Component({
  imports: [RouterLink, DatePipe, NgIcon, StatusBadge, FichierPipe],
  selector: 'app-activite-chef',
  styleUrl: './activite-chef.scss',
  templateUrl: './activite-chef.html',
})
export class ActiviteChef {
  protected readonly nomsCategories = nomsCategories;
  private recetteService = inject(RecetteService);
  private defiService = inject(DefiService);

  readonly chefId = input.required<string>();

  protected recettes = signal<RecetteResponse[]>([]);
  protected nbRecettes = signal(0);
  protected defis = signal<DefiResponse[]>([]);
  protected nbDefis = signal(0);
  protected chargement = signal(true);
  protected onglet = signal<'recettes' | 'defis'>('recettes');

  constructor() {
    effect(() => {
      const id = this.chefId();
      untracked(() => this.charger(id));
    });
  }

  private charger(id: string): void {
    this.chargement.set(true);
    const vide = { contenu: [], totalElements: 0 };
    forkJoin({
      recettes: this.recetteService
        .rechercher({ auteurId: id, taille: TAILLE })
        .pipe(catchError(() => of(vide))),
      defis: this.defiService
        .rechercher({ chefId: id, taille: TAILLE })
        .pipe(catchError(() => of(vide))),
    }).subscribe(({ recettes, defis }) => {
      this.recettes.set(recettes.contenu as RecetteResponse[]);
      this.nbRecettes.set(recettes.totalElements);
      this.defis.set(defis.contenu as DefiResponse[]);
      this.nbDefis.set(defis.totalElements);
      this.chargement.set(false);
    });
  }
}
