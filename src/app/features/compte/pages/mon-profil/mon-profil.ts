import { Component, inject, OnInit, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroupDirective,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatError, MatFormField, MatHint, MatLabel, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { NgIcon } from '@ng-icons/core';
import { switchMap } from 'rxjs';
import { NotificationService } from '../../../../core/services/notification.service';
import { SessionService } from '../../../../core/services/session.service';
import { messageErreur } from '../../../../core/utils/erreurs';
import { Avatar } from '../../../../shared/components/avatar/avatar';
import { ImageUpload } from '../../../../shared/components/image-upload/image-upload';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { AuthService } from '../../../auth/services/auth.service';
import { DroitsLecture } from '../../../profils/components/droits-lecture/droits-lecture';
import { DroitAffiche } from '../../../profils/models/profil.model';
import { ProfilService } from '../../../profils/services/profil.service';
import { UtilisateurService } from '../../../utilisateurs/services/utilisateur.service';

/** Les deux saisies du nouveau mot de passe doivent être identiques. */
function motsDePasseIdentiques(groupe: AbstractControl): ValidationErrors | null {
  const nouveau = groupe.get('nouveau')?.value;
  const confirmation = groupe.get('confirmation')?.value;
  return nouveau && confirmation && nouveau !== confirmation ? { differents: true } : null;
}

/**
 * « Mon profil » : l'administrateur connecté consulte et modifie ses informations,
 * sa photo et son mot de passe. Trois blocs indépendants, chacun avec son bouton.
 */
@Component({
  imports: [
    ReactiveFormsModule,
    MatButton,
    MatIconButton,
    MatFormField,
    MatLabel,
    MatHint,
    MatError,
    MatSuffix,
    MatInput,
    MatProgressSpinner,
    NgIcon,
    PageHeader,
    Avatar,
    ImageUpload,
    DroitsLecture,
  ],
  selector: 'app-mon-profil',
  styleUrl: './mon-profil.scss',
  templateUrl: './mon-profil.html',
})
export class MonProfil implements OnInit {
  protected session = inject(SessionService);
  private authService = inject(AuthService);
  private utilisateurService = inject(UtilisateurService);
  private profilService = inject(ProfilService);

  /** Droits de mon profil, écrits en clair (chargés depuis le profil). */
  protected droits = signal<DroitAffiche[]>([]);
  private notification = inject(NotificationService);
  private fb = inject(FormBuilder).nonNullable;

  // ----- Informations -----
  protected infos = this.fb.group({
    prenom: ['', [Validators.required, Validators.maxLength(60)]],
    nom: ['', [Validators.required, Validators.maxLength(60)]],
    email: ['', [Validators.required, Validators.email]],
    telephone: ['', Validators.pattern(/^\+?[0-9 ]{8,20}$/)],
  });
  protected enregistrementInfos = signal(false);
  protected erreurInfos = signal('');

  // ----- Photo -----
  protected photo = signal<File | null>(null);
  protected envoiPhoto = signal(false);

  // ----- Mot de passe -----
  protected motDePasse = this.fb.group(
    {
      ancien: ['', Validators.required],
      nouveau: ['', [Validators.required, Validators.minLength(8)]],
      confirmation: ['', Validators.required],
    },
    { validators: motsDePasseIdentiques },
  );
  protected visible = signal(false);
  protected enregistrementMotDePasse = signal(false);
  protected erreurMotDePasse = signal('');

  ngOnInit(): void {
    this.remplir();
    // On relit le profil pour avoir les droits et la photo à jour
    this.authService.moi().subscribe({
      next: (utilisateur) => {
        this.session.mettreAJourUtilisateur(utilisateur);
        this.remplir();
        if (utilisateur.profilId) {
          this.profilService.getDroitsDuProfil(utilisateur.profilId).subscribe({
            next: (attributions) =>
              this.droits.set(
                attributions.map((a) => ({ id: a.droitId, action: a.droitAction, description: a.droitDescription, actif: a.droitActif })),
              ),
          });
        }
      },
    });
  }

  private remplir(): void {
    const u = this.session.utilisateur();
    if (u) {
      this.infos.reset({
        prenom: u.prenom,
        nom: u.nom,
        email: u.email ?? '',
        telephone: u.telephone ?? '',
      });
    }
  }

  enregistrerInfos(): void {
    const u = this.session.utilisateur();
    if (!u) {
      return;
    }
    if (this.infos.invalid) {
      this.infos.markAllAsTouched();
      this.erreurInfos.set('Certains champs sont à corriger. Ils sont signalés en rouge.');
      return;
    }
    this.enregistrementInfos.set(true);
    this.erreurInfos.set('');
    const v = this.infos.getRawValue();
    this.utilisateurService
      .modifierAdmin(u.id, {
        prenom: v.prenom.trim(),
        nom: v.nom.trim(),
        email: v.email.trim(),
        telephone: v.telephone.replace(/\s/g, '') || undefined,
      })
      .pipe(switchMap(() => this.authService.moi()))
      .subscribe({
        next: (utilisateur) => {
          this.session.mettreAJourUtilisateur(utilisateur);
          this.infos.markAsPristine();
          this.enregistrementInfos.set(false);
          this.notification.succes('Vos informations sont enregistrées.');
        },
        error: (erreur: unknown) => {
          this.enregistrementInfos.set(false);
          this.erreurInfos.set(messageErreur(erreur, "Vos informations n'ont pas pu être enregistrées."));
        },
      });
  }

  envoyerPhoto(): void {
    const u = this.session.utilisateur();
    const fichier = this.photo();
    if (!u || !fichier) {
      return;
    }
    this.envoiPhoto.set(true);
    this.utilisateurService
      .envoyerPhoto(u.id, fichier)
      .pipe(switchMap(() => this.authService.moi()))
      .subscribe({
        next: (utilisateur) => {
          this.session.mettreAJourUtilisateur(utilisateur);
          this.photo.set(null);
          this.envoiPhoto.set(false);
          this.notification.succes('Votre photo est enregistrée.');
        },
        error: (erreur: unknown) => {
          this.envoiPhoto.set(false);
          this.notification.erreur(messageErreur(erreur, "La photo n'a pas pu être envoyée."));
        },
      });
  }

  /** formulaire : pour effacer aussi l'état « envoyé » (sinon les champs vidés s'affichent en rouge). */
  changerMotDePasse(formulaire: FormGroupDirective): void {
    if (this.motDePasse.invalid) {
      this.motDePasse.markAllAsTouched();
      this.erreurMotDePasse.set(
        this.motDePasse.hasError('differents')
          ? 'Les deux saisies du nouveau mot de passe sont différentes.'
          : 'Remplissez les trois champs (8 caractères minimum pour le nouveau).',
      );
      return;
    }
    this.enregistrementMotDePasse.set(true);
    this.erreurMotDePasse.set('');
    const v = this.motDePasse.getRawValue();
    this.authService
      .changerMotDePasse({ ancienMotDePasse: v.ancien, nouveauMotDePasse: v.nouveau })
      .pipe(
        // Le serveur ferme toutes les sessions : on en rouvre une tout de suite avec le nouveau mot de passe
        switchMap(() =>
          this.authService.connecter({
            identifiant: this.session.utilisateur()?.email ?? this.session.utilisateur()?.telephone ?? '',
            motDePasse: v.nouveau,
          }),
        ),
      )
      .subscribe({
        next: (reponse) => {
          this.session.enregistrer(reponse);
          this.enregistrementMotDePasse.set(false);
          formulaire.resetForm();
          this.visible.set(false);
          this.notification.succes(
            'Votre mot de passe est modifié. Vos autres appareils devront se reconnecter.',
          );
        },
        error: (erreur: unknown) => {
          this.enregistrementMotDePasse.set(false);
          this.erreurMotDePasse.set(
            messageErreur(erreur, "Le mot de passe n'a pas pu être modifié."),
          );
        },
      });
  }
}
