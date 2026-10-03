import { DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatFormField, MatLabel, MatPrefix, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { SessionService } from '../../../../core/services/session.service';
import { Avatar } from '../../../../shared/components/avatar/avatar';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { FichierPipe } from '../../../../shared/pipes/fichier.pipe';
import { UnitePipe } from '../../../../shared/pipes/unite.pipe';
import { IngredientResponse } from '../../../ingredients/models/ingredient.model';
import { IngredientService } from '../../../ingredients/services/ingredient.service';
import { ProducteurAnnuaire } from '../../models/annuaire.model';
import { AnnuaireService } from '../../services/annuaire.service';

const TAILLE_PAGE = 12;

/**
 * Annuaire des producteurs : les producteurs validés et ce qu'ils vendent.
 * On cherche par nom, localité ou produit, et on filtre par ingrédient ou localité.
 * C'est la même liste que celle de l'application (route publique).
 */
@Component({
  imports: [
    ReactiveFormsModule,
    RouterLink,
    DecimalPipe,
    MatButton,
    MatIconButton,
    MatFormField,
    MatLabel,
    MatPrefix,
    MatSuffix,
    MatInput,
    MatSelect,
    MatOption,
    NgIcon,
    PageHeader,
    EmptyState,
    Avatar,
    FichierPipe,
    UnitePipe,
  ],
  selector: 'app-annuaire',
  styleUrl: './annuaire.scss',
  templateUrl: './annuaire.html',
})
export class Annuaire implements OnInit {
  private annuaireService = inject(AnnuaireService);
  private ingredientService = inject(IngredientService);
  protected session = inject(SessionService);

  protected recherche = new FormControl('', { nonNullable: true });
  protected ingredient = new FormControl<string | null>(null);
  protected localite = new FormControl<string | null>(null);

  protected ingredients = signal<IngredientResponse[]>([]);
  protected localites = signal<string[]>([]);

  protected producteurs = signal<ProducteurAnnuaire[]>([]);
  protected total = signal(0);
  protected chargement = signal(true);
  protected erreur = signal(false);
  protected toutCharge = signal(true);
  private page = 0;

  constructor() {
    this.recherche.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.charger(true));
    this.ingredient.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.charger(true));
    this.localite.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.charger(true));
  }

  ngOnInit(): void {
    this.charger(true);
    this.ingredientService.getAll().subscribe({
      next: (liste) => this.ingredients.set([...liste].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))),
    });
    this.annuaireService.getLocalites().subscribe({ next: (liste) => this.localites.set(liste) });
  }

  charger(depuisLeDebut: boolean): void {
    if (depuisLeDebut) {
      this.page = 0;
    }
    this.chargement.set(true);
    this.erreur.set(false);
    this.annuaireService
      .rechercher({
        recherche: this.recherche.value.trim() || undefined,
        ingredientId: this.ingredient.value ?? undefined,
        localite: this.localite.value ?? undefined,
        page: this.page,
        taille: TAILLE_PAGE,
      })
      .subscribe({
        next: (page) => {
          this.producteurs.update((liste) => (depuisLeDebut ? page.contenu : [...liste, ...page.contenu]));
          this.total.set(page.totalElements);
          this.toutCharge.set(page.page + 1 >= page.totalPages);
          this.page = page.page + 1;
          this.chargement.set(false);
        },
        error: () => {
          this.erreur.set(true);
          this.chargement.set(false);
        },
      });
  }

  effacerFiltres(): void {
    this.recherche.setValue('', { emitEvent: false });
    this.ingredient.setValue(null, { emitEvent: false });
    this.localite.setValue(null, { emitEvent: false });
    this.charger(true);
  }

  protected filtresActifs(): boolean {
    return !!this.recherche.value || !!this.ingredient.value || !!this.localite.value;
  }
}
