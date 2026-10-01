import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatAutocomplete, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { MatButton } from '@angular/material/button';
import { MatOption } from '@angular/material/core';
import { MatError, MatFormField, MatHint, MatLabel, MatPrefix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { Router, RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { catchError, debounceTime, distinctUntilChanged, map, of, startWith, switchMap } from 'rxjs';
import { FilArianeService } from '../../../../core/services/fil-ariane.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { messageErreur } from '../../../../core/utils/erreurs';
import { EditeurRiche } from '../../../../shared/components/editeur-riche/editeur-riche';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { RecetteService } from '../../../recettes/services/recette.service';
import { DefiRequest, DefiResponse } from '../../models/defi.model';
import { DefiService } from '../../services/defi.service';

/** Recette choisie pour le défi (seules les recettes publiées sont proposées). */
interface RecetteChoisie {
  id: string;
  nom: string;
}

/** La date de fin ne peut pas précéder la date de début. */
function periodeValide(groupe: AbstractControl): ValidationErrors | null {
  const debut = groupe.get('dateDebut')?.value;
  const fin = groupe.get('dateFin')?.value;
  return debut && fin && fin < debut ? { periode: true } : null;
}

/** Date du jour au format AAAA-MM-JJ (valeur d'un champ de type date). */
function aujourdhui(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Création ou modification d'un défi par l'administrateur.
 * Un défi créé par l'administration est validé directement (visible par les cuisiniers).
 * Description, règles, conditions et critères peuvent être mis en forme (gras, listes, couleurs).
 */
@Component({
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButton,
    MatFormField,
    MatLabel,
    MatHint,
    MatError,
    MatPrefix,
    MatInput,
    MatAutocomplete,
    MatAutocompleteTrigger,
    MatOption,
    MatProgressSpinner,
    NgIcon,
    PageHeader,
    EmptyState,
    EditeurRiche,
  ],
  selector: 'app-defi-formulaire',
  styleUrl: './defi-formulaire.scss',
  templateUrl: './defi-formulaire.html',
})
export class DefiFormulaire {
  private defiService = inject(DefiService);
  private recetteService = inject(RecetteService);
  private notification = inject(NotificationService);
  private filAriane = inject(FilArianeService);
  private router = inject(Router);

  /** Présent sur /defis/:id/modifier. */
  readonly id = input<string>();

  protected estNouveau = computed(() => !this.id());
  protected defi = signal<DefiResponse | null>(null);
  protected chargement = signal(false);
  protected introuvable = signal(false);
  protected enregistrement = signal(false);
  protected erreur = signal('');
  protected readonly minDate = aujourdhui();

  protected formulaire = inject(FormBuilder).nonNullable.group(
    {
      nom: ['', [Validators.required, Validators.maxLength(120)]],
      dateDebut: ['', Validators.required],
      dateFin: ['', Validators.required],
      description: ['', [Validators.required, Validators.maxLength(3000)]],
      regles: ['', Validators.maxLength(3000)],
      conditionsParticipation: ['', Validators.maxLength(3000)],
      criteresClassement: ['', Validators.maxLength(3000)],
    },
    { validators: periodeValide },
  );

  // ----- Recette associée (recherche parmi les recettes publiées) -----
  protected champRecette = new FormControl<string | RecetteChoisie>('', {
    nonNullable: true,
    validators: (c) => (typeof c.value === 'object' && c.value ? null : { recette: true }),
  });
  protected suggestionsRecettes = toSignal(
    this.champRecette.valueChanges.pipe(
      startWith(''),
      map((valeur) => (typeof valeur === 'string' ? valeur.trim() : null)),
      debounceTime(250),
      distinctUntilChanged(),
      switchMap((terme) =>
        terme === null
          ? of([] as RecetteChoisie[])
          : this.recetteService
              .rechercher({ statut: 'PUBLIEE', recherche: terme || undefined, taille: 8 })
              .pipe(
                map((page) => page.contenu.map((r) => ({ id: r.id, nom: r.nom }))),
                catchError(() => of([] as RecetteChoisie[])),
              ),
      ),
      takeUntilDestroyed(),
    ),
    { initialValue: [] as RecetteChoisie[] },
  );
  protected nomRecette = (valeur: string | RecetteChoisie | null): string =>
    typeof valeur === 'string' ? valeur : (valeur?.nom ?? '');

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => (id ? this.charger(id) : this.formulaire.controls.dateDebut.setValue(aujourdhui())));
    });
  }

  private charger(id: string): void {
    this.chargement.set(true);
    this.defiService.getById(id).subscribe({
      next: (defi) => {
        this.defi.set(defi);
        this.formulaire.reset({
          nom: defi.nom,
          dateDebut: defi.dateDebut,
          dateFin: defi.dateFin,
          description: defi.description ?? '',
          regles: defi.regles ?? '',
          conditionsParticipation: defi.conditionsParticipation ?? '',
          criteresClassement: defi.criteresClassement ?? '',
        });
        if (defi.recetteId) {
          this.champRecette.setValue({ id: defi.recetteId, nom: defi.recetteNom ?? '' });
        }
        this.filAriane.definirPageCourante(`Modifier « ${defi.nom} »`);
        this.chargement.set(false);
      },
      error: (erreur: HttpErrorResponse) => {
        this.introuvable.set(erreur.status === 404);
        this.chargement.set(false);
      },
    });
  }

  enregistrer(): void {
    if (this.formulaire.invalid || this.champRecette.invalid) {
      this.formulaire.markAllAsTouched();
      this.champRecette.markAsTouched();
      this.erreur.set(
        this.formulaire.hasError('periode')
          ? 'La date de fin doit être le même jour ou après la date de début.'
          : this.champRecette.invalid
            ? 'Choisissez la recette du défi dans la liste proposée.'
            : 'Certains champs sont à compléter. Ils sont signalés en rouge.',
      );
      return;
    }
    this.enregistrement.set(true);
    this.erreur.set('');

    const v = this.formulaire.getRawValue();
    const recette = this.champRecette.value as RecetteChoisie;
    const requete: DefiRequest = {
      nom: v.nom.trim(),
      dateDebut: v.dateDebut,
      dateFin: v.dateFin,
      description: v.description,
      regles: v.regles || null,
      conditionsParticipation: v.conditionsParticipation || null,
      criteresClassement: v.criteresClassement || null,
      recetteId: recette.id,
    };
    const existant = this.defi();
    const appel = existant
      ? this.defiService.modifier(existant.id, requete)
      : this.defiService.creer(requete);

    appel.subscribe({
      next: (defi) => {
        this.enregistrement.set(false);
        this.formulaire.markAsPristine();
        this.notification.succes(
          existant ? 'Le défi est enregistré.' : `« ${defi.nom} » est créé et validé.`,
        );
        this.router.navigate(['/defis', defi.id]);
      },
      error: (erreur: unknown) => {
        this.enregistrement.set(false);
        this.erreur.set(messageErreur(erreur, "Le défi n'a pas pu être enregistré."));
      },
    });
  }
}
