import {
  afterNextRender,
  Component,
  ElementRef,
  inject,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { Observable, of, switchMap } from 'rxjs';
import { messageErreur } from '../../../../core/utils/erreurs';
import { ImageUpload } from '../../../../shared/components/image-upload/image-upload';
import { UstensileResponse } from '../../models/ustensile.model';
import { UstensileService } from '../../services/ustensile.service';

/**
 * Formulaire d'un ustensile (nom, description, photo), sans fenêtre autour.
 * Utilisé dans la fenêtre « Nouvel ustensile » et directement dans l'éditeur d'étape.
 */
@Component({
  imports: [
    ReactiveFormsModule,
    MatButton,
    MatFormField,
    MatLabel,
    MatInput,
    MatHint,
    MatError,
    MatProgressSpinner,
    ImageUpload,
  ],
  selector: 'app-ustensile-formulaire',
  styleUrl: './ustensile-formulaire.scss',
  templateUrl: './ustensile-formulaire.html',
})
export class UstensileFormulaire implements OnInit {
  private ustensileService = inject(UstensileService);
  private hote = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Ustensile à modifier ; absent pour une création. */
  readonly ustensile = input<UstensileResponse>();
  /** Nom pré-rempli lors d'une création rapide. */
  readonly nomInitial = input('');
  /** Texte du bouton principal (ex. « Créer et utiliser »). */
  readonly texteValider = input<string>();

  /** Ustensile enregistré (photo comprise). */
  readonly enregistre = output<UstensileResponse>();
  /** Abandon : renvoie l'ustensile s'il a déjà été créé (la photo a échoué), sinon null. */
  readonly annule = output<UstensileResponse | null>();

  protected formulaire = inject(FormBuilder).nonNullable.group({
    nom: ['', [Validators.required, Validators.maxLength(80)]],
    description: ['', Validators.maxLength(255)],
  });

  protected sauve = signal<UstensileResponse | null>(null);
  protected photo: File | null = null;
  protected enCours = signal(false);
  protected erreur = signal('');

  constructor() {
    // Le curseur va directement dans le premier champ
    afterNextRender(() =>
      this.hote.nativeElement.querySelector<HTMLInputElement>('input')?.focus(),
    );
  }

  ngOnInit(): void {
    const existant = this.ustensile();
    this.sauve.set(existant ?? null);
    this.formulaire.patchValue({
      nom: existant?.nom ?? this.nomInitial(),
      description: existant?.description ?? '',
    });
  }

  annuler(): void {
    this.annule.emit(this.sauve());
  }

  enregistrer(): void {
    if (this.formulaire.invalid) {
      this.formulaire.markAllAsTouched();
      return;
    }
    this.enCours.set(true);
    this.erreur.set('');

    const valeurs = this.formulaire.getRawValue();
    const requete = {
      nom: valeurs.nom.trim(),
      description: valeurs.description.trim() || undefined,
    };
    const existant = this.sauve();
    const sauvegarde = existant
      ? this.ustensileService.modifier(existant.id, requete)
      : this.ustensileService.creer(requete);

    let sauvegardeFaite = false;
    sauvegarde
      .pipe(
        switchMap((ustensile) => {
          sauvegardeFaite = true;
          this.sauve.set(ustensile);
          return this.envoyerPhoto(ustensile);
        }),
      )
      .subscribe({
        next: (ustensile) => {
          this.enCours.set(false);
          this.enregistre.emit(ustensile);
        },
        error: (erreur: unknown) => {
          this.enCours.set(false);
          this.erreur.set(
            sauvegardeFaite
              ? "L'ustensile est enregistré, mais la photo n'a pas pu être envoyée. Cliquez à nouveau sur Enregistrer pour réessayer."
              : messageErreur(erreur, "Impossible d'enregistrer l'ustensile."),
          );
        },
      });
  }

  private envoyerPhoto(ustensile: UstensileResponse): Observable<UstensileResponse> {
    if (!this.photo) {
      return of(ustensile);
    }
    return this.ustensileService
      .envoyerImage(ustensile.id, this.photo)
      .pipe(switchMap(() => this.ustensileService.getById(ustensile.id)));
  }
}
