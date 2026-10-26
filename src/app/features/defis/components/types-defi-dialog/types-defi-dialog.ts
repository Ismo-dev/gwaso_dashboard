import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle } from '@angular/material/dialog';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { NgIcon } from '@ng-icons/core';
import { ConfirmationService } from '../../../../core/services/confirmation.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { messageErreur } from '../../../../core/utils/erreurs';
import {
  ElementsDefi,
  iconeType,
  LIBELLES_ELEMENTS,
  LIBELLES_MODE,
  ModeParticipation,
  TypeDefiRequest,
  TypeDefiResponse,
} from '../../models/defi.model';
import { DefiService } from '../../services/defi.service';

/**
 * Types de défi : la liste, puis un formulaire pour ajouter ou modifier un type.
 * Un type retiré n'est plus proposé ; les défis qui l'utilisent le gardent.
 */
@Component({
  imports: [
    ReactiveFormsModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatButton,
    MatFormField,
    MatLabel,
    MatError,
    MatInput,
    MatCheckbox,
    MatProgressSpinner,
    NgIcon,
  ],
  selector: 'app-types-defi-dialog',
  styleUrl: './types-defi-dialog.scss',
  templateUrl: './types-defi-dialog.html',
})
export class TypesDefiDialog implements OnInit {
  private defiService = inject(DefiService);
  private notification = inject(NotificationService);
  private confirmation = inject(ConfirmationService);

  protected readonly iconeType = iconeType;
  protected readonly libellesMode = LIBELLES_MODE;
  protected readonly modes: ModeParticipation[] = ['REALISATION', 'REPONSE', 'QUIZ'];
  protected readonly libellesElements = LIBELLES_ELEMENTS;
  protected readonly choixElements: ElementsDefi[] = ['AUCUN', 'INGREDIENTS', 'USTENSILES'];

  protected types = signal<TypeDefiResponse[] | null>(null);
  /** null : liste ; 'nouveau' ou le type modifié : formulaire. */
  protected edition = signal<TypeDefiResponse | 'nouveau' | null>(null);
  protected enCours = signal(false);
  protected erreur = signal('');

  protected formulaire = inject(FormBuilder).nonNullable.group({
    nom: ['', [Validators.required, Validators.maxLength(80)]],
    description: ['', Validators.maxLength(500)],
    modeParticipation: ['REALISATION' as ModeParticipation, Validators.required],
    recetteObligatoire: [false],
    elements: ['AUCUN' as ElementsDefi],
  });

  ngOnInit(): void {
    this.charger();
  }

  private charger(): void {
    this.defiService.getTypes().subscribe({
      next: (types) => this.types.set(types),
      error: () => this.types.set([]),
    });
  }

  ouvrir(type: TypeDefiResponse | 'nouveau'): void {
    this.erreur.set('');
    this.formulaire.reset(
      type === 'nouveau'
        ? { nom: '', description: '', modeParticipation: 'REALISATION', recetteObligatoire: false, elements: 'AUCUN' }
        : {
            nom: type.nom,
            description: type.description ?? '',
            modeParticipation: type.modeParticipation,
            recetteObligatoire: type.recetteObligatoire,
            elements: type.elements ?? 'AUCUN',
          },
    );
    this.edition.set(type);
  }

  enregistrer(): void {
    if (this.formulaire.invalid) {
      this.formulaire.markAllAsTouched();
      return;
    }
    const v = this.formulaire.getRawValue();
    const requete: TypeDefiRequest = {
      nom: v.nom.trim(),
      description: v.description.trim() || null,
      modeParticipation: v.modeParticipation,
      // Une devinette ne porte pas sur une recette à réaliser
      recetteObligatoire: v.modeParticipation === 'REALISATION' && v.recetteObligatoire,
      // Ingrédients / ustensile à montrer : seulement pour une devinette
      elements: v.modeParticipation === 'REPONSE' ? v.elements : 'AUCUN',
    };
    const edition = this.edition();
    const appel =
      edition && edition !== 'nouveau'
        ? this.defiService.modifierType(edition.id, requete)
        : this.defiService.creerType(requete);
    this.enCours.set(true);
    this.erreur.set('');
    appel.subscribe({
      next: (type) => {
        this.enCours.set(false);
        this.notification.succes(`Le type « ${type.nom} » est enregistré.`);
        this.edition.set(null);
        this.charger();
      },
      error: (erreur: unknown) => {
        this.enCours.set(false);
        this.erreur.set(messageErreur(erreur, "Le type n'a pas pu être enregistré."));
      },
    });
  }

  async retirer(type: TypeDefiResponse): Promise<void> {
    const confirme = await this.confirmation.demander({
      titre: `Retirer « ${type.nom} » ?`,
      message: 'Il ne sera plus proposé pour les nouveaux défis. Les défis existants le gardent.',
      texteConfirmer: 'Retirer',
      danger: true,
    });
    if (!confirme) {
      return;
    }
    this.defiService.supprimerType(type.id).subscribe({
      next: () => {
        this.notification.succes(`« ${type.nom} » est retiré.`);
        this.charger();
      },
      error: (erreur: unknown) => this.notification.erreur(messageErreur(erreur, "Le type n'a pas pu être retiré.")),
    });
  }
}
