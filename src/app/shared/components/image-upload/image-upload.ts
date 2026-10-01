import { Component, computed, input, OnDestroy, output, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { NgIcon } from '@ng-icons/core';
import { FichierPipe } from '../../pipes/fichier.pipe';

/** Formats acceptés par l'API (le type réel est revérifié côté serveur). */
const TYPES_ACCEPTES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const TAILLE_MAX_MO = 5;

let compteur = 0;

/**
 * Choix d'une image avec aperçu. Le fichier n'est pas envoyé ici : le composant parent
 * reçoit le fichier choisi (fichierChoisi) et l'envoie au bon moment.
 *
 * Utilisation :
 *   <app-image-upload libelle="Photo de la recette" [imageActuelle]="recette.photoUrl"
 *                     (fichierChoisi)="photo = $event" />
 */
@Component({
  imports: [MatButton, NgIcon, FichierPipe],
  selector: 'app-image-upload',
  styleUrl: './image-upload.scss',
  templateUrl: './image-upload.html',
})
export class ImageUpload implements OnDestroy {
  readonly libelle = input('Image');
  /** Image déjà enregistrée (adresse renvoyée par l'API), ou null. */
  readonly imageActuelle = input<string | null>(null);
  /** Forme de l'aperçu : carré (ingrédient) ou paysage (recette, catégorie). */
  readonly format = input<'carre' | 'paysage'>('paysage');
  /** verticale : aperçu pleine largeur et boutons dessous (colonnes étroites, ex. éditeur d'étape). */
  readonly disposition = input<'horizontale' | 'verticale'>('horizontale');

  /** Fichier choisi par l'utilisateur, ou null s'il annule son choix. */
  readonly fichierChoisi = output<File | null>();

  protected readonly idAide = `image-upload-aide-${++compteur}`;
  protected readonly typesAcceptes = TYPES_ACCEPTES.join(',');
  protected readonly tailleMax = TAILLE_MAX_MO;

  protected apercuLocal = signal<string | null>(null);
  protected nomFichier = signal('');
  protected erreur = signal('');

  /** true s'il y a une image à montrer (nouvelle ou déjà enregistrée). */
  protected aUneImage = computed(() => !!this.apercuLocal() || !!this.imageActuelle());

  choisir(evenement: Event): void {
    const champ = evenement.target as HTMLInputElement;
    const fichier = champ.files?.[0];
    champ.value = ''; // permet de rechoisir le même fichier
    if (!fichier) {
      return;
    }

    if (!TYPES_ACCEPTES.includes(fichier.type)) {
      this.erreur.set('Format non accepté. Choisissez une image JPG, PNG, WebP ou GIF.');
      return;
    }
    if (fichier.size > TAILLE_MAX_MO * 1024 * 1024) {
      this.erreur.set(
        `Image trop lourde (${(fichier.size / 1024 / 1024).toFixed(1)} Mo). Maximum : ${TAILLE_MAX_MO} Mo.`,
      );
      return;
    }

    this.erreur.set('');
    this.libererApercu();
    this.apercuLocal.set(URL.createObjectURL(fichier));
    this.nomFichier.set(fichier.name);
    this.fichierChoisi.emit(fichier);
  }

  annulerChoix(): void {
    this.libererApercu();
    this.apercuLocal.set(null);
    this.nomFichier.set('');
    this.fichierChoisi.emit(null);
  }

  ngOnDestroy(): void {
    this.libererApercu();
  }

  /** Libère la mémoire utilisée par l'aperçu local. */
  private libererApercu(): void {
    const apercu = this.apercuLocal();
    if (apercu) {
      URL.revokeObjectURL(apercu);
    }
  }
}
