import { DecimalPipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { Avatar } from '../../../../shared/components/avatar/avatar';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { DepuisPipe } from '../../../../shared/pipes/depuis.pipe';
import { FichierPipe } from '../../../../shared/pipes/fichier.pipe';
import { formaterDuree, LIBELLES_TYPE_VIDEO, VideoResponse } from '../../models/video.model';

/**
 * Carte d'une vidéo dans la liste de modération : miniature, statut, auteur, chiffres.
 * Pour une vidéo en attente, les deux décisions sont directement sur la carte.
 *
 * Utilisation : <app-carte-video [video]="v" (publier)="..." (refuser)="..." />
 */
@Component({
  imports: [RouterLink, DecimalPipe, MatButton, NgIcon, Avatar, StatusBadge, DepuisPipe, FichierPipe],
  selector: 'app-carte-video',
  styleUrl: './carte-video.scss',
  templateUrl: './carte-video.html',
})
export class CarteVideo {
  readonly video = input.required<VideoResponse>();
  /** Désactive les boutons pendant une action sur cette vidéo. */
  readonly enCours = input(false);

  readonly publier = output<VideoResponse>();
  readonly refuser = output<VideoResponse>();

  protected duree = computed(() => formaterDuree(this.video().dureeSecondes));
  protected type = computed(() => LIBELLES_TYPE_VIDEO[this.video().type]);
}
