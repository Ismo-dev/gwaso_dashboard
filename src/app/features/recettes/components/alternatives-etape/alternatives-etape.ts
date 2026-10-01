import { Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatAutocomplete, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { MatButton } from '@angular/material/button';
import { MatOption } from '@angular/material/core';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { NgIcon } from '@ng-icons/core';
import { Observable, of, startWith, switchMap } from 'rxjs';
import { NotificationService } from '../../../../core/services/notification.service';
import { messageErreur } from '../../../../core/utils/erreurs';
import { AlternativeUstensileResponse } from '../../../ustensiles/models/ustensile.model';
import { UstensileService } from '../../../ustensiles/services/ustensile.service';
import {
  EtapeUstensileAlternativeResponse,
  EtapeUstensileResponse,
} from '../../models/recette.model';
import { RecetteService } from '../../services/recette.service';

/** Choix dans la liste : une alternative existante, ou la création d'une nouvelle à partir du texte saisi. */
type Choix = AlternativeUstensileResponse | { creer: string };

/**
 * Alternatives de l'ustensile d'UNE étape : « Si vous n'avez pas de mortier, utilisez… ».
 * Elles ne valent que pour cette étape de cette recette : une autre recette peut proposer autre chose.
 *
 * Utilisation : <app-alternatives-etape [ustensile]="u" (alternativesChange)="..." />
 */
@Component({
  imports: [
    ReactiveFormsModule,
    MatAutocomplete,
    MatAutocompleteTrigger,
    MatOption,
    MatButton,
    MatFormField,
    MatLabel,
    MatInput,
    NgIcon,
  ],
  selector: 'app-alternatives-etape',
  styleUrl: './alternatives-etape.scss',
  templateUrl: './alternatives-etape.html',
})
export class AlternativesEtape {
  private recetteService = inject(RecetteService);
  private ustensileService = inject(UstensileService);
  private notification = inject(NotificationService);

  /** L'ustensile de l'étape, avec ses alternatives déjà enregistrées. */
  readonly ustensile = input.required<EtapeUstensileResponse>();
  /** Nouvelle liste d'alternatives, pour que le parent garde son état à jour. */
  readonly alternativesChange = output<EtapeUstensileAlternativeResponse[]>();

  /** Copie locale, réinitialisée quand le parent change d'ustensile. */
  protected alternatives = linkedSignal(() => this.ustensile().alternatives ?? []);
  private catalogue = signal<AlternativeUstensileResponse[]>([]);
  protected ajoutOuvert = signal(false);
  protected enCours = signal(false);

  protected champ = new FormControl<string | Choix>('', { nonNullable: true });
  private saisie = toSignal(this.champ.valueChanges.pipe(startWith('')), {
    initialValue: '' as string | Choix,
  });

  /** Texte tapé (vide si un choix de la liste est sélectionné). */
  protected texte = computed(() => {
    const valeur = this.saisie();
    return typeof valeur === 'string' ? valeur.trim() : '';
  });

  /** Alternatives du catalogue pas encore proposées pour cet ustensile, filtrées par la saisie. */
  protected suggestions = computed(() => {
    const terme = this.texte().toLowerCase();
    const deja = new Set(this.alternatives().map((a) => a.alternativeId));
    return this.catalogue()
      .filter((a) => !deja.has(a.id) && (!terme || a.nom.toLowerCase().includes(terme)))
      .slice(0, 8);
  });

  /** On propose de créer l'alternative si aucune ne porte exactement ce nom. */
  protected peutCreer = computed(() => {
    const terme = this.texte().toLowerCase();
    return !!terme && !this.catalogue().some((a) => a.nom.toLowerCase() === terme);
  });

  protected affichage = (valeur: string | Choix | null): string =>
    !valeur
      ? ''
      : typeof valeur === 'string'
        ? valeur
        : 'creer' in valeur
          ? valeur.creer
          : valeur.nom;

  ouvrirAjout(): void {
    this.ajoutOuvert.set(true);
    if (this.catalogue().length === 0) {
      this.ustensileService.getCatalogueAlternatives().subscribe({
        next: (catalogue) =>
          this.catalogue.set([...catalogue].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))),
      });
    }
  }

  fermerAjout(): void {
    this.ajoutOuvert.set(false);
    this.champ.setValue('');
  }

  /** L'admin a choisi une alternative existante ou « Créer … » dans la liste. */
  ajouter(choix: Choix): void {
    this.enCours.set(true);
    const alternative$: Observable<AlternativeUstensileResponse> =
      'creer' in choix ? this.ustensileService.creerAlternative({ nom: choix.creer }) : of(choix);

    alternative$
      .pipe(
        switchMap((alternative) => {
          if ('creer' in choix) {
            this.catalogue.update((liste) => [...liste, alternative]);
          }
          return this.recetteService.ajouterAlternativeUstensileEtape(
            this.ustensile().id,
            alternative.id,
          );
        }),
      )
      .subscribe({
        next: (ajoutee) => {
          this.alternatives.update((liste) => [...liste, ajoutee]);
          this.alternativesChange.emit(this.alternatives());
          this.enCours.set(false);
          this.fermerAjout();
        },
        error: (erreur: unknown) => {
          this.enCours.set(false);
          this.notification.erreur(messageErreur(erreur, "L'alternative n'a pas pu être ajoutée."));
        },
      });
  }

  /** Pas de confirmation : on peut la remettre en deux clics, et elle ne touche que cette étape. */
  retirer(alternative: EtapeUstensileAlternativeResponse): void {
    this.recetteService.retirerAlternativeUstensileEtape(alternative.id).subscribe({
      next: () => {
        this.alternatives.update((liste) => liste.filter((a) => a.id !== alternative.id));
        this.alternativesChange.emit(this.alternatives());
      },
      error: (erreur: unknown) =>
        this.notification.erreur(messageErreur(erreur, "L'alternative n'a pas pu être retirée.")),
    });
  }
}
