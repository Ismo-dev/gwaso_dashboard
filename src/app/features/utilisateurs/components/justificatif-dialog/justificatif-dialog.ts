import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { NgIcon } from '@ng-icons/core';
import { FichierPipe } from '../../../../shared/pipes/fichier.pipe';

export interface DonneesJustificatif {
  /** preuveUrl renvoyée par l'API. */
  url: string;
  /** « Awa Traoré » : pour le titre. */
  nom: string;
}

/**
 * Justificatif d'un chef ou d'un producteur, affiché seulement à la demande.
 * Le fichier est privé (réservé aux administrateurs) : on le télécharge avec le jeton,
 * puis on l'affiche (photo) ou on l'intègre (PDF) dans la fenêtre.
 */
@Component({
  imports: [MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose, MatButton, MatProgressSpinner, NgIcon],
  selector: 'app-justificatif-dialog',
  styleUrl: './justificatif-dialog.scss',
  templateUrl: './justificatif-dialog.html',
})
export class JustificatifDialog implements OnInit {
  protected donnees = inject<DonneesJustificatif>(MAT_DIALOG_DATA);
  private http = inject(HttpClient);
  private sanitizer = inject(DomSanitizer);
  private destroyRef = inject(DestroyRef);

  protected chargement = signal(true);
  protected erreur = signal(false);
  protected type = signal<'image' | 'pdf' | null>(null);
  /** Adresse locale (blob:) du fichier téléchargé. */
  protected adresse = signal<string | null>(null);
  protected adressePdf = signal<SafeResourceUrl | null>(null);

  ngOnInit(): void {
    const url = new FichierPipe().transform(this.donnees.url);
    if (!url) {
      this.erreur.set(true);
      this.chargement.set(false);
      return;
    }
    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: (fichier) => {
        const adresse = URL.createObjectURL(fichier);
        this.destroyRef.onDestroy(() => URL.revokeObjectURL(adresse));
        this.adresse.set(adresse);
        if (fichier.type === 'application/pdf') {
          this.type.set('pdf');
          // Adresse blob: créée par nous à partir du fichier reçu : on peut l'afficher dans le cadre
          this.adressePdf.set(this.sanitizer.bypassSecurityTrustResourceUrl(adresse));
        } else {
          this.type.set('image');
        }
        this.chargement.set(false);
      },
      error: () => {
        this.erreur.set(true);
        this.chargement.set(false);
      },
    });
  }
}
