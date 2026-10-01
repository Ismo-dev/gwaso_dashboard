import { Component } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';

/** Page affichée pour une adresse qui n'existe pas (erreur 404). */
@Component({
  imports: [RouterLink, MatButton, NgIcon],
  selector: 'app-page-introuvable',
  styleUrl: './page-introuvable.scss',
  templateUrl: './page-introuvable.html',
})
export class PageIntrouvable {}
