import { Component, computed, inject, input, OnDestroy, output, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { NgIcon } from '@ng-icons/core';
import { ConfirmationService } from '../../../../core/services/confirmation.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { messageErreur } from '../../../../core/utils/erreurs';
import { FichierPipe } from '../../../../shared/pipes/fichier.pipe';
import { LangueAudio } from '../../models/recette.model';
import { RecetteService } from '../../services/recette.service';

/** Au-delà, l'enregistrement s'arrête seul (l'API accepte 15 Mo, soit bien plus). */
const DUREE_MAX_SECONDES = 10 * 60;

/**
 * Audio d'explication d'une étape, dans une langue : enregistré au micro ou choisi sur l'ordinateur.
 * La préparation guidée de l'application le fait écouter (en attendant la synthèse vocale et la traduction).
 *
 * Utilisation : <app-audio-etape [etapeId]="id" langue="BAMBARA" [audioActuel]="url" (audioModifie)="relire()" />
 */
@Component({
  imports: [MatButton, MatProgressSpinner, NgIcon, FichierPipe],
  selector: 'app-audio-etape',
  styleUrl: './audio-etape.scss',
  templateUrl: './audio-etape.html',
})
export class AudioEtape implements OnDestroy {
  private recetteService = inject(RecetteService);
  private notification = inject(NotificationService);
  private confirmation = inject(ConfirmationService);

  readonly etapeId = input.required<string>();
  readonly langue = input.required<LangueAudio>();
  /** Audio déjà enregistré pour cette langue (adresse renvoyée par l'API). */
  readonly audioActuel = input<string | null>(null);
  /** L'audio a été enregistré ou retiré : le parent relit l'étape. */
  readonly audioModifie = output<void>();

  protected libelleLangue = computed(() => (this.langue() === 'BAMBARA' ? 'Bambara' : 'Français'));

  /** Nouvel audio pas encore envoyé : enregistré au micro ou choisi. */
  protected brouillon = signal<{ fichier: Blob; nom: string; apercu: string } | null>(null);
  protected enregistrement = signal(false);
  protected secondes = signal(0);
  protected envoi = signal(false);
  protected erreurMicro = signal<string | null>(null);

  protected duree = computed(() => {
    const s = this.secondes();
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  });

  private enregistreur: MediaRecorder | null = null;
  private flux: MediaStream | null = null;
  private minuterie: ReturnType<typeof setInterval> | null = null;

  async demarrer(): Promise<void> {
    this.erreurMicro.set(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      this.erreurMicro.set("Ce navigateur ne permet pas d'enregistrer : choisissez plutôt un fichier audio.");
      return;
    }
    try {
      this.flux = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      this.erreurMicro.set(
        "Micro inaccessible : autorisez-le dans le navigateur (icône du cadenas), ou choisissez un fichier audio.",
      );
      return;
    }
    const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((t) => MediaRecorder.isTypeSupported(t));
    const morceaux: Blob[] = [];
    this.enregistreur = new MediaRecorder(this.flux, type ? { mimeType: type } : undefined);
    this.enregistreur.ondataavailable = (e) => {
      if (e.data.size > 0) morceaux.push(e.data);
    };
    this.enregistreur.onstop = () => {
      const typeReel = this.enregistreur?.mimeType || type || 'audio/webm';
      const fichier = new Blob(morceaux, { type: typeReel });
      this.remplacerBrouillon({
        fichier,
        nom: typeReel.includes('mp4') ? 'audio.m4a' : 'audio.webm',
        apercu: URL.createObjectURL(fichier),
      });
      this.libererMicro();
    };
    this.secondes.set(0);
    this.enregistrement.set(true);
    this.enregistreur.start();
    this.minuterie = setInterval(() => {
      this.secondes.update((s) => s + 1);
      if (this.secondes() >= DUREE_MAX_SECONDES) this.arreter();
    }, 1000);
  }

  arreter(): void {
    if (this.minuterie) clearInterval(this.minuterie);
    this.minuterie = null;
    this.enregistrement.set(false);
    if (this.enregistreur?.state === 'recording') this.enregistreur.stop();
  }

  choisirFichier(evenement: Event): void {
    const champ = evenement.target as HTMLInputElement;
    const fichier = champ.files?.[0];
    champ.value = '';
    if (!fichier) return;
    if (!fichier.type.startsWith('audio/') && !/\.(m4a|mp3|ogg|wav|aac|webm)$/i.test(fichier.name)) {
      this.notification.erreur('Choisissez un fichier audio (M4A, MP3, OGG, WAV, AAC ou WEBM).');
      return;
    }
    this.remplacerBrouillon({ fichier, nom: fichier.name, apercu: URL.createObjectURL(fichier) });
  }

  annuler(): void {
    this.remplacerBrouillon(null);
  }

  envoyer(): void {
    const brouillon = this.brouillon();
    if (!brouillon) return;
    this.envoi.set(true);
    this.recetteService.envoyerAudioEtape(this.etapeId(), this.langue(), brouillon.fichier, brouillon.nom).subscribe({
      next: () => {
        this.envoi.set(false);
        this.remplacerBrouillon(null);
        this.notification.succes(`L'audio en ${this.libelleLangue().toLowerCase()} est enregistré.`);
        this.audioModifie.emit();
      },
      error: (erreur: unknown) => {
        this.envoi.set(false);
        this.notification.erreur(messageErreur(erreur, "L'audio n'a pas pu être envoyé."));
      },
    });
  }

  async retirer(): Promise<void> {
    const confirme = await this.confirmation.demander({
      titre: `Retirer l'audio en ${this.libelleLangue().toLowerCase()} ?`,
      message: "Les cuisiniers ne l'entendront plus pendant la préparation guidée.",
      texteConfirmer: "Retirer l'audio",
      danger: true,
    });
    if (!confirme) return;
    this.envoi.set(true);
    this.recetteService.supprimerAudioEtape(this.etapeId(), this.langue()).subscribe({
      next: () => {
        this.envoi.set(false);
        this.notification.succes("L'audio est retiré.");
        this.audioModifie.emit();
      },
      error: (erreur: unknown) => {
        this.envoi.set(false);
        this.notification.erreur(messageErreur(erreur, "L'audio n'a pas pu être retiré."));
      },
    });
  }

  ngOnDestroy(): void {
    this.arreter();
    this.libererMicro();
    this.remplacerBrouillon(null);
  }

  private remplacerBrouillon(nouveau: { fichier: Blob; nom: string; apercu: string } | null): void {
    const ancien = this.brouillon();
    if (ancien) URL.revokeObjectURL(ancien.apercu);
    this.brouillon.set(nouveau);
  }

  private libererMicro(): void {
    this.flux?.getTracks().forEach((piste) => piste.stop());
    this.flux = null;
  }
}
