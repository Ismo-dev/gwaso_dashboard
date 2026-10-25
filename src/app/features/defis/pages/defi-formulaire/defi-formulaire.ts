import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, input, OnDestroy, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatAutocomplete, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatOption } from '@angular/material/core';
import {
  MatDateRangeInput,
  MatDateRangePicker,
  MatDatepickerToggle,
  MatDatepickerToggleIcon,
  MatEndDate,
  MatStartDate,
} from '@angular/material/datepicker';
import { MatError, MatFormField, MatLabel, MatPrefix, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { Router, RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import {
  catchError,
  concatMap,
  debounceTime,
  distinctUntilChanged,
  from,
  last,
  map,
  of,
  startWith,
  switchMap,
} from 'rxjs';
import { FilArianeService } from '../../../../core/services/fil-ariane.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { messageErreur } from '../../../../core/utils/erreurs';
import { EditeurRiche } from '../../../../shared/components/editeur-riche/editeur-riche';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { FichierPipe } from '../../../../shared/pipes/fichier.pipe';
import { IngredientService } from '../../../ingredients/services/ingredient.service';
import { RecetteService } from '../../../recettes/services/recette.service';
import { UstensileService } from '../../../ustensiles/services/ustensile.service';
import { ChoixElements, ElementCatalogue } from '../../components/choix-elements/choix-elements';
import { EditeurQuestions, nouvelleQuestion, QuestionEdition } from '../../components/editeur-questions/editeur-questions';
import { ListeReponses, normaliserReponse } from '../../components/liste-reponses/liste-reponses';
import {
  DefiRequest,
  DefiResponse,
  iconeType,
  PhotoDefiResponse,
  POINTS_PAR_DEFAUT,
  TypeDefiResponse,
} from '../../models/defi.model';
import { DefiService } from '../../services/defi.service';

/** Recette choisie pour le défi (seules les recettes publiées sont proposées). */
interface RecetteChoisie {
  id: string;
  nom: string;
}

/** Photo choisie mais pas encore envoyée (elle part à l'enregistrement du défi). */
interface PhotoEnAttente {
  fichier: File;
  apercu: string;
}

const PHOTOS_MAX = 8;
const TAILLE_PHOTO_MAX = 5 * 1024 * 1024;
const TYPES_PHOTO = ['image/jpeg', 'image/png', 'image/webp'];

/** Date au format AAAA-MM-JJ attendu par l'API (sans décalage de fuseau). */
function versIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** AAAA-MM-JJ → Date à minuit, heure locale. */
function depuisIso(texte: string): Date {
  const [annee, mois, jour] = texte.split('-').map(Number);
  return new Date(annee, mois - 1, jour);
}

function aujourdhui(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Création ou modification d'un défi par l'administrateur.
 * - Le type de défi décide du reste : recette imposée, plat libre, devinette (avec sa bonne réponse).
 * - La période commence au plus tôt aujourd'hui ; ensuite le statut suit les dates tout seul.
 * - Jusqu'à 8 photos, envoyées juste après l'enregistrement du défi.
 */
@Component({
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButton,
    MatIconButton,
    MatFormField,
    MatLabel,
    MatError,
    MatPrefix,
    MatSuffix,
    MatInput,
    MatAutocomplete,
    MatAutocompleteTrigger,
    MatOption,
    MatDateRangeInput,
    MatStartDate,
    MatEndDate,
    MatDatepickerToggle,
    MatDatepickerToggleIcon,
    MatDateRangePicker,
    MatProgressSpinner,
    NgIcon,
    PageHeader,
    EmptyState,
    EditeurRiche,
    FichierPipe,
    ChoixElements,
    ListeReponses,
    EditeurQuestions,
  ],
  selector: 'app-defi-formulaire',
  styleUrl: './defi-formulaire.scss',
  templateUrl: './defi-formulaire.html',
})
export class DefiFormulaire implements OnDestroy {
  private defiService = inject(DefiService);
  private recetteService = inject(RecetteService);
  private ingredientService = inject(IngredientService);
  private ustensileService = inject(UstensileService);
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
  protected readonly iconeType = iconeType;

  protected formulaire = inject(FormBuilder).group({
    nom: ['', [Validators.required, Validators.maxLength(150)]],
    typeDefiId: ['', Validators.required],
    dateDebut: [null as Date | null, Validators.required],
    dateFin: [null as Date | null, Validators.required],
    reponseAttendue: ['', Validators.maxLength(1000)],
    points: [POINTS_PAR_DEFAUT as number | null, [Validators.min(1), Validators.max(1000)]],
    description: ['', [Validators.required, Validators.maxLength(3000)]],
    regles: ['', Validators.maxLength(3000)],
    conditionsParticipation: ['', Validators.maxLength(3000)],
    criteresClassement: ['', Validators.maxLength(3000)],
  });

  // ----- Type de défi -----
  protected types = toSignal(this.defiService.getTypes().pipe(catchError(() => of([] as TypeDefiResponse[]))));
  private typeChoisiId = toSignal(this.formulaire.controls.typeDefiId.valueChanges, { initialValue: '' });
  protected typeChoisi = computed(() => this.types()?.find((t) => t.id === this.typeChoisiId()) ?? null);
  protected recetteObligatoire = computed(() => this.typeChoisi()?.recetteObligatoire ?? false);
  protected devinette = computed(() => this.typeChoisi()?.modeParticipation === 'REPONSE');
  protected quiz = computed(() => this.typeChoisi()?.modeParticipation === 'QUIZ');

  // ----- Devinette : autres bonnes réponses ; quiz : questions -----
  protected autresReponses = signal<string[]>([]);
  protected questions = signal<QuestionEdition[]>([]);
  /** Quiz déjà joué : le serveur refuse de changer les questions. */
  protected questionsVerrouillees = computed(() => this.quiz() && (this.defi()?.nbParticipants ?? 0) > 0);
  /** Ce que les participants voient : ingrédients ou ustensile choisis dans le catalogue. */
  protected elements = computed(() => this.typeChoisi()?.elements ?? 'AUCUN');

  // ----- Ingrédients / ustensiles montrés (devinettes) -----
  protected catalogueIngredients = signal<ElementCatalogue[] | null>(null);
  protected catalogueUstensiles = signal<ElementCatalogue[] | null>(null);
  protected ingredientsChoisis = signal<string[]>([]);
  protected ustensilesChoisis = signal<string[]>([]);

  // ----- Période -----
  /**
   * Une date de début déjà passée est refusée. En modification, si le défi a déjà commencé,
   * sa date de début reste possible (on ne la change simplement pas).
   */
  protected dateMin = computed(() => {
    const debut = this.defi()?.dateDebut;
    const jour = aujourdhui();
    return debut && depuisIso(debut) < jour ? depuisIso(debut) : jour;
  });

  // ----- Recette associée (recherche parmi les recettes publiées) -----
  protected champRecette = new FormControl<string | RecetteChoisie>('', { nonNullable: true });
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

  // ----- Photos -----
  protected photosEnregistrees = signal<PhotoDefiResponse[]>([]);
  protected photosEnAttente = signal<PhotoEnAttente[]>([]);
  protected nbPhotos = computed(() => this.photosEnregistrees().length + this.photosEnAttente().length);
  protected readonly photosMax = PHOTOS_MAX;
  protected survol = signal(false);

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => (id ? this.charger(id) : this.formulaire.controls.dateDebut.setValue(aujourdhui())));
    });

    // Le catalogue n'est chargé que si le type de défi en a besoin
    effect(() => {
      const elements = this.elements();
      untracked(() => {
        if (elements === 'INGREDIENTS' && !this.catalogueIngredients()) {
          this.ingredientService.getAll().subscribe({ next: (liste) => this.catalogueIngredients.set(liste) });
        }
        if (elements === 'USTENSILES' && !this.catalogueUstensiles()) {
          this.ustensileService.getAll().subscribe({ next: (liste) => this.catalogueUstensiles.set(liste) });
        }
      });
    });

    // La bonne réponse n'est obligatoire que pour une devinette. Gérée ici et pas par un attribut `required` :
    // quand le champ disparaît (passage à « Plat libre »), Angular retire le validateur sans recalculer l'état,
    // et le formulaire restait invalide pour toujours.
    effect(() => {
      const devinette = this.devinette();
      untracked(() => {
        const reponse = this.formulaire.controls.reponseAttendue;
        reponse.setValidators(devinette ? [Validators.required, Validators.maxLength(1000)] : [Validators.maxLength(1000)]);
        reponse.updateValueAndValidity();
      });
    });

    // Un quiz commence avec une question vide à remplir
    effect(() => {
      const quiz = this.quiz();
      untracked(() => {
        if (quiz && this.questions().length === 0) {
          this.questions.set([nouvelleQuestion()]);
        }
      });
    });

    // Premier type proposé par défaut pour un nouveau défi
    effect(() => {
      const types = this.types();
      untracked(() => {
        if (types?.length && this.estNouveau() && !this.formulaire.controls.typeDefiId.value) {
          this.formulaire.controls.typeDefiId.setValue(types[0].id);
        }
      });
    });
  }

  ngOnDestroy(): void {
    this.photosEnAttente().forEach((p) => URL.revokeObjectURL(p.apercu));
  }

  private charger(id: string): void {
    this.chargement.set(true);
    this.defiService.getById(id).subscribe({
      next: (defi) => {
        this.defi.set(defi);
        this.formulaire.reset({
          nom: defi.nom,
          typeDefiId: defi.typeDefiId ?? '',
          dateDebut: depuisIso(defi.dateDebut),
          dateFin: depuisIso(defi.dateFin),
          reponseAttendue: defi.reponseAttendue ?? '',
          points: defi.modeParticipation === 'REPONSE' ? (defi.points ?? POINTS_PAR_DEFAUT) : POINTS_PAR_DEFAUT,
          description: defi.description ?? '',
          regles: defi.regles ?? '',
          conditionsParticipation: defi.conditionsParticipation ?? '',
          criteresClassement: defi.criteresClassement ?? '',
        });
        if (defi.recetteId) {
          this.champRecette.setValue({ id: defi.recetteId, nom: defi.recetteNom ?? '' });
        }
        this.autresReponses.set(defi.autresReponses ?? []);
        this.questions.set(
          (defi.questions ?? []).map((q) =>
            nouvelleQuestion({
              enonce: q.enonce,
              dureeSecondes: q.dureeSecondes,
              points: q.points,
              reponsesAcceptees: q.reponsesAcceptees,
              propositions: q.propositions,
              choixMultiple: q.propositions.length > 0,
            }),
          ),
        );
        this.ingredientsChoisis.set(defi.ingredients.map((e) => e.id).filter((id): id is string => !!id));
        this.ustensilesChoisis.set(defi.ustensiles.map((e) => e.id).filter((id): id is string => !!id));
        this.filAriane.definirPageCourante(`Modifier « ${defi.nom} »`);
        this.chargement.set(false);
      },
      error: (erreur: HttpErrorResponse) => {
        this.introuvable.set(erreur.status === 404);
        this.chargement.set(false);
      },
    });
    this.defiService.getPhotos(id).subscribe({ next: (photos) => this.photosEnregistrees.set(photos) });
  }

  choisirType(type: TypeDefiResponse): void {
    this.formulaire.controls.typeDefiId.setValue(type.id);
  }

  // ===================== Photos =====================

  ajouterPhotos(fichiers: FileList | null): void {
    if (!fichiers) {
      return;
    }
    const refusees: string[] = [];
    const ajout: PhotoEnAttente[] = [];
    for (const fichier of Array.from(fichiers)) {
      if (this.nbPhotos() + ajout.length >= PHOTOS_MAX) {
        refusees.push(`${PHOTOS_MAX} photos au maximum`);
        break;
      }
      if (!TYPES_PHOTO.includes(fichier.type)) {
        refusees.push(`« ${fichier.name} » n'est pas une photo JPG, PNG ou WebP`);
      } else if (fichier.size > TAILLE_PHOTO_MAX) {
        refusees.push(`« ${fichier.name} » dépasse 5 Mo`);
      } else {
        ajout.push({ fichier, apercu: URL.createObjectURL(fichier) });
      }
    }
    this.photosEnAttente.update((liste) => [...liste, ...ajout]);
    if (refusees.length > 0) {
      this.notification.erreur(refusees.join('. ') + '.');
    }
  }

  deposer(evenement: DragEvent): void {
    evenement.preventDefault();
    this.survol.set(false);
    this.ajouterPhotos(evenement.dataTransfer?.files ?? null);
  }

  retirerEnAttente(photo: PhotoEnAttente): void {
    URL.revokeObjectURL(photo.apercu);
    this.photosEnAttente.update((liste) => liste.filter((p) => p !== photo));
  }

  retirerEnregistree(photo: PhotoDefiResponse): void {
    this.defiService.supprimerPhoto(photo.id).subscribe({
      next: () => this.photosEnregistrees.update((liste) => liste.filter((p) => p.id !== photo.id)),
      error: (erreur: unknown) => this.notification.erreur(messageErreur(erreur, "La photo n'a pas pu être retirée.")),
    });
  }

  // ===================== Enregistrement =====================

  enregistrer(): void {
    const recette = typeof this.champRecette.value === 'object' ? this.champRecette.value : null;
    const v = this.formulaire.getRawValue();
    const message = this.verifier(recette);
    if (message) {
      this.formulaire.markAllAsTouched();
      this.champRecette.markAsTouched();
      this.erreur.set(message);
      return;
    }
    this.enregistrement.set(true);
    this.erreur.set('');

    const requete: DefiRequest = {
      nom: v.nom!.trim(),
      typeDefiId: v.typeDefiId!,
      dateDebut: versIso(v.dateDebut!),
      dateFin: versIso(v.dateFin!),
      description: v.description!,
      regles: v.regles || null,
      conditionsParticipation: v.conditionsParticipation || null,
      criteresClassement: v.criteresClassement || null,
      recetteId: recette?.id ?? null,
      reponseAttendue: this.devinette() ? v.reponseAttendue?.trim() || null : null,
      ingredientIds: this.elements() === 'INGREDIENTS' ? this.ingredientsChoisis() : [],
      ustensileIds: this.elements() === 'USTENSILES' ? this.ustensilesChoisis() : [],
      autresReponses: this.devinette() ? this.autresReponses() : [],
      points: this.devinette() ? v.points : null,
      questions: this.quiz()
        ? this.questions().map((q) => ({
            enonce: q.enonce.trim(),
            dureeSecondes: q.dureeSecondes,
            points: q.points,
            reponsesAcceptees: q.reponsesAcceptees,
            propositions: q.choixMultiple ? q.propositions : [],
          }))
        : [],
    };
    const existant = this.defi();
    const appel = existant ? this.defiService.modifier(existant.id, requete) : this.defiService.creer(requete);

    appel.subscribe({
      next: (defi) => this.envoyerPhotos(defi, !existant),
      error: (erreur: unknown) => {
        this.enregistrement.set(false);
        this.erreur.set(messageErreur(erreur, "Le défi n'a pas pu être enregistré."));
      },
    });
  }

  /** Message d'erreur à afficher, ou '' si tout est bon. */
  private verifier(recette: RecetteChoisie | null): string {
    const c = this.formulaire.controls;
    if (c.typeDefiId.invalid) {
      return 'Choisissez le type de défi.';
    }
    if (c.dateDebut.hasError('matDatepickerParse') || c.dateFin.hasError('matDatepickerParse')) {
      return 'Date non reconnue : écrivez-la au format JJ/MM/AAAA, ou choisissez-la dans le calendrier.';
    }
    if (!c.dateDebut.value || !c.dateFin.value) {
      return 'Choisissez la période du défi : date de début et date de fin.';
    }
    if (c.dateDebut.hasError('matDatepickerMin')) {
      return 'La date de début ne peut pas être déjà passée.';
    }
    if (c.dateFin.hasError('matEndDateInvalid')) {
      return 'La date de fin doit être le même jour ou après la date de début.';
    }
    if (this.recetteObligatoire() && !recette) {
      return 'Ce type de défi impose une recette : choisissez-la dans la liste proposée.';
    }
    if (this.elements() === 'INGREDIENTS' && this.ingredientsChoisis().length === 0) {
      return 'Choisissez les ingrédients à montrer aux participants.';
    }
    if (this.elements() === 'USTENSILES' && this.ustensilesChoisis().length === 0) {
      return "Choisissez l'ustensile à faire deviner.";
    }
    if (this.devinette() && !this.formulaire.value.reponseAttendue?.trim()) {
      return 'Indiquez la bonne réponse de la devinette.';
    }
    if (this.devinette() && c.points.invalid) {
      return 'Les points d’une bonne réponse vont de 1 à 1000.';
    }
    if (this.quiz()) {
      const message = this.verifierQuestions();
      if (message) {
        return message;
      }
    }
    if (this.formulaire.invalid) {
      return 'Certains champs sont à compléter. Ils sont signalés en rouge.';
    }
    return '';
  }

  private verifierQuestions(): string {
    const questions = this.questions();
    if (questions.length === 0) {
      return 'Ajoutez au moins une question au quiz.';
    }
    for (const [i, q] of questions.entries()) {
      const numero = `Question ${i + 1}`;
      if (!q.enonce.trim()) {
        return `${numero} : écrivez l'énoncé.`;
      }
      if (!q.points || q.points < 1 || q.points > 1000) {
        return `${numero} : les points vont de 1 à 1000.`;
      }
      if (q.reponsesAcceptees.length === 0) {
        return `${numero} : indiquez au moins une bonne réponse.`;
      }
      if (q.choixMultiple) {
        if (q.propositions.length < 2) {
          return `${numero} : proposez au moins deux choix.`;
        }
        const bonnes = q.reponsesAcceptees.map(normaliserReponse);
        if (!q.propositions.some((p) => bonnes.includes(normaliserReponse(p)))) {
          return `${numero} : la bonne réponse doit faire partie des propositions.`;
        }
      }
    }
    return '';
  }

  /** Les photos en attente partent une par une, après l'enregistrement du défi. */
  private envoyerPhotos(defi: DefiResponse, cree: boolean): void {
    const aEnvoyer = this.photosEnAttente();
    const terminer = (photosRatees: number) => {
      this.enregistrement.set(false);
      this.formulaire.markAsPristine();
      this.notification.succes(cree ? `« ${defi.nom} » est créé et validé.` : 'Le défi est enregistré.');
      if (photosRatees > 0) {
        this.notification.erreur(`${photosRatees} photo(s) n'ont pas pu être envoyées. Réessayez depuis la modification.`);
      }
      this.router.navigate(['/defis', defi.id]);
    };
    if (aEnvoyer.length === 0) {
      terminer(0);
      return;
    }
    let ratees = 0;
    from(aEnvoyer)
      .pipe(
        concatMap((photo) =>
          this.defiService.ajouterPhoto(defi.id, photo.fichier).pipe(
            catchError(() => {
              ratees++;
              return of(null);
            }),
          ),
        ),
        last(),
      )
      .subscribe(() => terminer(ratees));
  }
}
