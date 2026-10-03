import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatError, MatFormField, MatLabel, MatPrefix, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { SessionService } from '../../../../core/services/session.service';
import { AuthService } from '../../services/auth.service';

@Component({
  imports: [
    ReactiveFormsModule,
    MatFormField,
    MatLabel,
    MatError,
    MatPrefix,
    MatSuffix,
    MatInput,
    MatButton,
    MatIconButton,
    MatProgressSpinner,
    NgIcon,
  ],
  selector: 'app-login',
  styleUrl: './login.scss',
  templateUrl: './login.html',
})
export class Login {
  private authService = inject(AuthService);
  private session = inject(SessionService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  protected formulaire = inject(FormBuilder).nonNullable.group({
    identifiant: ['', Validators.required],
    motDePasse: ['', Validators.required],
  });

  protected enCours = signal(false);
  protected erreur = signal('');
  protected motDePasseVisible = signal(false);

  basculerMotDePasse(): void {
    this.motDePasseVisible.update((visible) => !visible);
  }

  connecter(): void {
    if (this.formulaire.invalid) {
      this.formulaire.markAllAsTouched();
      return;
    }

    this.enCours.set(true);
    this.erreur.set('');

    this.authService.connecter(this.formulaire.getRawValue()).subscribe({
      next: (reponse) => {
        this.enCours.set(false);
        // Le dashboard s'ouvre avec le droit ACCES_DASHBOARD du profil
        if (!reponse.utilisateur.droits.includes('ACCES_DASHBOARD')) {
          this.erreur.set("Votre profil ne donne pas accès au dashboard d'administration.");
          return;
        }
        this.session.enregistrer(reponse);
        const retour = this.route.snapshot.queryParamMap.get('retour') ?? '/';
        this.router.navigateByUrl(retour);
      },
      error: (erreur: HttpErrorResponse) => {
        this.enCours.set(false);
        // Serveur injoignable : le message général est déjà affiché par erreurInterceptor
        if (erreur.status !== 0) {
          this.erreur.set(erreur.error?.message ?? 'Identifiant ou mot de passe incorrect.');
        }
      },
    });
  }
}
