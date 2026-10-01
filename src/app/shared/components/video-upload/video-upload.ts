import { Component, computed, input, OnDestroy, output, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { NgIcon } from '@ng-icons/core';
import { FichierPipe } from '../../pipes/fichier.pipe';

/** Formats vidéo acceptés par l'API (le type réel est revérifié côté serveur). */
const TYPES_ACCEPTES = ['video/mp4', 'video/webm', 'video/quicktime'];
const TAILLE_MAX_MO = 200;

let compteur = 0;

/**
 * Choix d'une vidéo avec aperçu lisible. Comme image-upload, le fichier n'est pas envoyé ici :
 * le parent reçoit le fichier (fichierChoisi) et l'envoie.
 */
@Component({
  imports: [MatButton, NgIcon, FichierPipe],
  selector: 'app-video-upload',
  styleUrl: './video-upload.scss',
  templateUrl: './video-upload.html',
})
export class VideoUpload implements OnDestroy {
  readonly libelle = input('Vidéo');
  /** Vidéo déjà enregistrée (adresse renvoyée par l'API), ou null. */
  readonly videoActuelle = input<string | null>(null);

  readonly fichierChoisi = output<File | null>();

  protected readonly idAide = `video-upload-aide-${++compteur}`;
  protected readonly typesAcceptes = TYPES_ACCEPTES.join(',');
  protected readonly tailleMax = TAILLE_MAX_MO;

  protected apercuLocal = signal<string | null>(null);
  protected nomFichier = signal('');
  protected erreur = signal('');

  protected aUneVideo = computed(() => !!this.apercuLocal() || !!this.videoActuelle());

  choisir(evenement: Event): void {
    const champ = evenement.target as HTMLInputElement;
    const fichier = champ.files?.[0];
    champ.value = '';
    if (!fichier) {
      return;
    }
    if (!TYPES_ACCEPTES.includes(fichier.type)) {
      this.erreur.set('Format non accepté. Choisissez une vidéo MP4, WebM ou MOV.');
      return;
    }
    if (fichier.size > TAILLE_MAX_MO * 1024 * 1024) {
      this.erreur.set(
        `Vidéo trop lourde (${Math.round(fichier.size / 1024 / 1024)} Mo). Maximum : ${TAILLE_MAX_MO} Mo.`,
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

  private libererApercu(): void {
    const apercu = this.apercuLocal();
    if (apercu) {
      URL.revokeObjectURL(apercu);
    }
  }
}
