import { Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatTooltip } from '@angular/material/tooltip';
import { NgIcon } from '@ng-icons/core';
import { ConfirmationService } from '../../../../core/services/confirmation.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { messageErreur } from '../../../../core/utils/erreurs';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import {
  CategorieIngredientRequest,
  CategorieIngredientResponse,
} from '../../models/categorie-ingredient.model';
import { IngredientResponse } from '../../models/ingredient.model';
import { CategorieIngredientService } from '../../services/categorie-ingredient.service';

export interface DonneesCategoriesIngredientsDialog {
  categories: CategorieIngredientResponse[];
  ingredients: IngredientResponse[];
}

/**
 * Boîte de dialogue permettant d'administrer les rayons / catégories d'ingrédients
 * (Légumes, Épices & Aromates, Céréales, Viandes, etc.).
 */
@Component({
  imports: [
    ReactiveFormsModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatButton,
    MatIconButton,
    MatFormField,
    MatLabel,
    MatInput,
    MatError,
    MatProgressSpinner,
    MatTooltip,
    NgIcon,
    EmptyState,
  ],
  providers: [CategorieIngredientService],
  selector: 'app-categories-ingredients-dialog',
  styleUrl: './categories-ingredients-dialog.scss',
  templateUrl: './categories-ingredients-dialog.html',
})
export class CategoriesIngredientsDialog implements OnInit {
  private categorieService = inject(CategorieIngredientService);
  private confirmation = inject(ConfirmationService);
  private notification = inject(NotificationService);
  private fenetre = inject(
    MatDialogRef<CategoriesIngredientsDialog, CategorieIngredientResponse[]>,
  );
  protected donnees = inject<DonneesCategoriesIngredientsDialog>(MAT_DIALOG_DATA);

  protected categories = signal<CategorieIngredientResponse[]>(this.donnees.categories ?? []);
  protected enEditionId = signal<string | null>(null);
  protected chargement = signal(false);
  protected erreur = signal('');

  // Formulaire d'ajout d'un nouveau rayon
  protected nomNouveau = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(80)],
  });
  protected descriptionNouvelle = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(255)],
  });

  // Formulaire d'édition inline
  protected nomEdition = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(80)],
  });
  protected descriptionEdition = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(255)],
  });

  ngOnInit(): void {
    if (this.categories().length === 0) {
      this.charger();
    }
  }

  charger(): void {
    this.chargement.set(true);
    this.categorieService.getAll().subscribe({
      next: (liste) => {
        this.categories.set(this.trier(liste));
        this.chargement.set(false);
      },
      error: (err: unknown) => {
        this.erreur.set(messageErreur(err, 'Impossible de charger les rayons.'));
        this.chargement.set(false);
      },
    });
  }

  /** Nombre d'ingrédients rattachés à ce rayon */
  compteIngredients(catId: string): number {
    return (this.donnees.ingredients ?? []).filter((i) => i.categorieId === catId).length;
  }

  ajouter(): void {
    if (this.nomNouveau.invalid) {
      this.nomNouveau.markAsTouched();
      return;
    }
    const nom = this.nomNouveau.value.trim();
    if (!nom) {
      return;
    }

    this.chargement.set(true);
    this.erreur.set('');

    const requete: CategorieIngredientRequest = {
      nom,
      description: this.descriptionNouvelle.value.trim() || undefined,
    };

    this.categorieService.creer(requete).subscribe({
      next: (creee) => {
        this.categories.update((liste) => this.trier([...liste, creee]));
        this.nomNouveau.reset();
        this.descriptionNouvelle.reset();
        this.chargement.set(false);
        this.notification.succes(`Le rayon « ${creee.nom} » est créé.`);
      },
      error: (err: unknown) => {
        this.chargement.set(false);
        this.erreur.set(messageErreur(err, 'Impossible de créer ce rayon.'));
      },
    });
  }

  commencerEdition(cat: CategorieIngredientResponse): void {
    this.enEditionId.set(cat.id);
    this.nomEdition.setValue(cat.nom);
    this.descriptionEdition.setValue(cat.description ?? '');
    this.erreur.set('');
  }

  annulerEdition(): void {
    this.enEditionId.set(null);
    this.nomEdition.reset();
    this.descriptionEdition.reset();
  }

  enregistrerEdition(cat: CategorieIngredientResponse): void {
    if (this.nomEdition.invalid) {
      this.nomEdition.markAsTouched();
      return;
    }
    const nom = this.nomEdition.value.trim();
    if (!nom) {
      return;
    }

    this.chargement.set(true);
    this.erreur.set('');

    const requete: CategorieIngredientRequest = {
      nom,
      description: this.descriptionEdition.value.trim() || undefined,
    };

    this.categorieService.modifier(cat.id, requete).subscribe({
      next: (modifiee) => {
        this.categories.update((liste) =>
          this.trier(liste.map((c) => (c.id === modifiee.id ? modifiee : c))),
        );
        this.annulerEdition();
        this.chargement.set(false);
        this.notification.succes(`Le rayon « ${modifiee.nom} » a été mis à jour.`);
      },
      error: (err: unknown) => {
        this.chargement.set(false);
        this.erreur.set(messageErreur(err, 'Impossible de modifier ce rayon.'));
      },
    });
  }

  async supprimer(cat: CategorieIngredientResponse): Promise<void> {
    const compte = this.compteIngredients(cat.id);
    const message =
      compte > 0
        ? `Ce rayon contient actuellement ${compte} ingrédient${compte > 1 ? 's' : ''}. Les ingrédients ne seront pas supprimés mais n'auront plus de rayon rattaché.`
        : `Le rayon « ${cat.nom} » sera définitivement supprimé.`;

    const confirme = await this.confirmation.demander({
      titre: `Supprimer le rayon « ${cat.nom} » ?`,
      message,
      texteConfirmer: 'Supprimer le rayon',
      danger: true,
    });

    if (!confirme) {
      return;
    }

    this.chargement.set(true);
    this.categorieService.supprimer(cat.id).subscribe({
      next: () => {
        this.categories.update((liste) => liste.filter((c) => c.id !== cat.id));
        this.chargement.set(false);
        this.notification.succes(`Le rayon « ${cat.nom} » est supprimé.`);
      },
      error: (err: unknown) => {
        this.chargement.set(false);
        this.erreur.set(messageErreur(err, 'Impossible de supprimer ce rayon.'));
      },
    });
  }

  fermer(): void {
    this.fenetre.close(this.categories());
  }

  private trier(liste: CategorieIngredientResponse[]): CategorieIngredientResponse[] {
    return [...liste].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  }
}
