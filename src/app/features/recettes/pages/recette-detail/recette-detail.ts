import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { forkJoin } from 'rxjs';
import { AValiderService } from '../../../../core/services/a-valider.service';
import { ConfirmationService } from '../../../../core/services/confirmation.service';
import { FilArianeService } from '../../../../core/services/fil-ariane.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { TexteRiche } from '../../../../shared/components/texte-riche/texte-riche';
import { FichierPipe } from '../../../../shared/pipes/fichier.pipe';
import { UnitePipe } from '../../../../shared/pipes/unite.pipe';
import {
  EtapeIngredientResponse,
  EtapeResponse,
  EtapeUstensileResponse,
  RecetteIngredientResponse,
  RecetteResponse,
  nomsCategories,
} from '../../models/recette.model';
import { RecetteService } from '../../services/recette.service';

const DIFFICULTES: Record<string, string> = {
  FACILE: 'Facile',
  MOYEN: 'Moyenne',
  DIFFICILE: 'Difficile',
};

/**
 * Fiche d'une recette : tout ce qu'il faut pour décider de la publier ou de la rejeter.
 * Ordre de lecture : identité de la recette → décision → ingrédients → étapes.
 */
@Component({
  imports: [
    RouterLink,
    DatePipe,
    DecimalPipe,
    MatButton,
    NgIcon,
    StatusBadge,
    EmptyState,
    FichierPipe,
    UnitePipe,
    TexteRiche,
  ],
  selector: 'app-recette-detail',
  styleUrl: './recette-detail.scss',
  templateUrl: './recette-detail.html',
})
export class RecetteDetail {
  protected readonly nomsCategories = nomsCategories;
  private recetteService = inject(RecetteService);
  private confirmation = inject(ConfirmationService);
  private notification = inject(NotificationService);
  private aValider = inject(AValiderService);
  private filAriane = inject(FilArianeService);

  /** Identifiant lu dans l'adresse (/recettes/:id) grâce à withComponentInputBinding(). */
  readonly id = input.required<string>();

  protected recette = signal<RecetteResponse | null>(null);
  protected ingredients = signal<RecetteIngredientResponse[]>([]);
  /** Autres noms du plat (ex. Tigadèguèna pour le mafé). */
  protected autresNoms = signal<string[]>([]);
  protected etapes = signal<EtapeResponse[]>([]);
  /** Ingrédients et ustensiles de chaque étape (clé : identifiant de l'étape). */
  protected contenuEtapes = signal<
    Record<string, { ingredients: EtapeIngredientResponse[]; ustensiles: EtapeUstensileResponse[] }>
  >({});
  /** Alternatives de chaque ustensile utilisé (clé : identifiant de l'ustensile). */
  protected chargement = signal(true);
  protected introuvable = signal(false);
  protected erreur = signal(false);
  protected actionEnCours = signal(false);

  protected readonly difficultes = DIFFICULTES;

  protected enAttente = computed(() => this.recette()?.statut === 'EN_ATTENTE_VALIDATION');

  /** Durée totale des étapes renseignées (en minutes). */
  protected dureeEtapes = computed(() =>
    this.etapes().reduce((total, etape) => total + (etape.dureeMinutes ?? 0), 0),
  );

  constructor() {
    // Recharge la fiche quand l'identifiant de l'adresse change
    effect(() => {
      const id = this.id();
      untracked(() => this.charger(id));
    });
  }

  charger(id: string = this.id()): void {
    this.chargement.set(true);
    this.introuvable.set(false);
    this.erreur.set(false);

    forkJoin({
      recette: this.recetteService.getById(id),
      ingredients: this.recetteService.getIngredients(id),
      etapes: this.recetteService.getEtapes(id),
      noms: this.recetteService.getNoms(id),
    }).subscribe({
      next: ({ recette, ingredients, etapes, noms }) => {
        this.recette.set(recette);
        this.autresNoms.set(noms.map((n) => n.nom));
        this.ingredients.set(ingredients);
        this.etapes.set([...etapes].sort((a, b) => a.ordre - b.ordre));
        this.filAriane.definirPageCourante(recette.nom);
        this.chargement.set(false);
        this.chargerContenuEtapes(etapes);
      },
      error: (erreur: HttpErrorResponse) => {
        this.introuvable.set(erreur.status === 404);
        this.erreur.set(erreur.status !== 404);
        this.chargement.set(false);
      },
    });
  }

  /** Charge le contenu des étapes (les ustensiles arrivent avec leurs alternatives). */
  private chargerContenuEtapes(etapes: EtapeResponse[]): void {
    if (etapes.length === 0) {
      return;
    }
    const requetes = Object.fromEntries(
      etapes.map((etape) => [
        etape.id,
        forkJoin({
          ingredients: this.recetteService.getIngredientsEtape(etape.id),
          ustensiles: this.recetteService.getUstensilesEtape(etape.id),
        }),
      ]),
    );
    forkJoin(requetes).subscribe({ next: (contenu) => this.contenuEtapes.set(contenu) });
  }

  async valider(): Promise<void> {
    const recette = this.recette();
    if (!recette) {
      return;
    }
    const confirme = await this.confirmation.demander({
      titre: `Publier « ${recette.nom} » ?`,
      message:
        'La recette sera visible par tous les utilisateurs de Gwaso, sur l’application et le site.',
      texteConfirmer: 'Publier la recette',
    });
    if (!confirme) {
      return;
    }
    this.actionEnCours.set(true);
    this.recetteService.valider(recette.id).subscribe({
      next: (miseAJour) =>
        this.apresAction(miseAJour, `« ${recette.nom} » est maintenant publiée.`),
      error: () => this.actionEnCours.set(false),
    });
  }

  async rejeter(): Promise<void> {
    const recette = this.recette();
    if (!recette) {
      return;
    }
    const motif = await this.confirmation.demanderMotif({
      titre: `Rejeter « ${recette.nom} » ?`,
      message:
        "La recette ne sera pas publiée. L'auteur pourra la corriger et la soumettre à nouveau.",
      libelle: 'Motif du rejet',
      aide: "Ce message sera montré à l'auteur : soyez précis et bienveillant.",
      texteConfirmer: 'Rejeter la recette',
    });
    if (!motif) {
      return;
    }
    this.actionEnCours.set(true);
    this.recetteService.rejeter(recette.id, motif).subscribe({
      next: (miseAJour) =>
        this.apresAction(
          miseAJour,
          `« ${recette.nom} » a été rejetée. L'auteur verra votre motif.`,
        ),
      error: () => this.actionEnCours.set(false),
    });
  }

  /** Retire la recette de l'application : elle n'est plus visible, mais reste modifiable. */
  async retirer(): Promise<void> {
    const recette = this.recette();
    if (!recette) {
      return;
    }
    const motif = await this.confirmation.demanderMotif({
      titre: `Retirer « ${recette.nom} » de l'application ?`,
      message:
        'Les utilisateurs ne la verront plus, sur l’application comme sur le site. Rien n’est supprimé : vous pourrez la remettre en ligne à tout moment.',
      libelle: 'Motif du retrait',
      aide: "Ce message sera montré à l'auteur : dites-lui ce qu'il faut corriger.",
      texteConfirmer: 'Retirer de l’application',
    });
    if (!motif) {
      return;
    }
    this.actionEnCours.set(true);
    this.recetteService.archiver(recette.id, motif).subscribe({
      next: (miseAJour) =>
        this.apresAction(miseAJour, `« ${recette.nom} » n'est plus visible dans l'application.`),
      error: () => this.actionEnCours.set(false),
    });
  }

  async remettreEnLigne(): Promise<void> {
    const recette = this.recette();
    if (!recette) {
      return;
    }
    const confirme = await this.confirmation.demander({
      titre: `Remettre « ${recette.nom} » en ligne ?`,
      message: 'La recette sera de nouveau visible par tous les utilisateurs de Gwaso.',
      texteConfirmer: 'Remettre en ligne',
    });
    if (!confirme) {
      return;
    }
    this.actionEnCours.set(true);
    this.recetteService.soumettre(recette.id).subscribe({
      next: (miseAJour) =>
        this.apresAction(miseAJour, `« ${recette.nom} » est de nouveau en ligne.`),
      error: () => this.actionEnCours.set(false),
    });
  }

  private apresAction(recette: RecetteResponse, message: string): void {
    this.recette.set(recette);
    this.actionEnCours.set(false);
    this.notification.succes(message);
    this.aValider.rafraichir();
  }
}
