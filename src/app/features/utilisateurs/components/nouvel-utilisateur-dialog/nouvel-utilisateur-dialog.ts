import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import {
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatError, MatFormField, MatHint, MatLabel, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatTooltip } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { map, Observable, of, switchMap } from 'rxjs';
import { TypeCompte } from '../../../../core/models/enums.model';
import { messageErreur } from '../../../../core/utils/erreurs';
import {
  ProfilDroitsResponse,
  ProfilResponse,
} from '../../../profils/models/profil.model';
import { ProfilService } from '../../../profils/services/profil.service';
import {
  AIDES_TYPE_COMPTE,
  ICONES_TYPE_COMPTE,
  LIBELLES_NIVEAU,
  LIBELLES_TYPE_COMPTE,
  NiveauCuisine,
  TYPES_COMPTE_CREABLES, JUSTIFICATIFS_ATTENDUS } from '../../models/utilisateur.model';
import { UtilisateurService } from '../../services/utilisateur.service';

/** Il faut un email ou un téléphone pour se connecter ; l'email est obligatoire pour un administrateur. */
function contactValide(groupe: AbstractControl): ValidationErrors | null {
  const email = (groupe.get('email')?.value ?? '').trim();
  const telephone = (groupe.get('telephone')?.value ?? '').trim();
  if (groupe.get('typeCompte')?.value === 'ADMIN') {
    return email ? null : { emailAdmin: true };
  }
  return email || telephone ? null : { contact: true };
}

/** Ce que la fenêtre renvoie : le message à afficher, et s'il reste quelque chose à faire. */
export interface ResultatNouvelUtilisateur {
  message: string;
  aVerifier: boolean;
}

/**
 * Création d'un compte par l'administrateur. On choisit UN profil (Administrateur, Cuisinier, Chef cuisinier,
 * Producteur...) : le compte reçoit ses droits, et les champs demandés suivent l'accès donné par ce profil.
 * Un chef ou un producteur créé ici peut être validé tout de suite (case cochée par défaut).
 * Renvoie un ResultatNouvelUtilisateur, ou undefined si l'admin annule.
 */
@Component({
  imports: [
    ReactiveFormsModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatButton,
    MatIconButton,
    MatCheckbox,
    MatFormField,
    MatLabel,
    MatHint,
    MatError,
    MatSuffix,
    MatInput,
    MatSelect,
    MatOption,
    MatProgressSpinner,
    MatTooltip,
    NgIcon,
    RouterLink,
  ],
  selector: 'app-nouvel-utilisateur-dialog',
  styleUrl: './nouvel-utilisateur-dialog.scss',
  templateUrl: './nouvel-utilisateur-dialog.html',
})
export class NouvelUtilisateurDialog implements OnInit {
  private utilisateurService = inject(UtilisateurService);
  private profilService = inject(ProfilService);
  private fenetre = inject(MatDialogRef<NouvelUtilisateurDialog, ResultatNouvelUtilisateur>);

  protected readonly typesCompte = TYPES_COMPTE_CREABLES;
  protected readonly libellesType = LIBELLES_TYPE_COMPTE;
  protected readonly iconesType = ICONES_TYPE_COMPTE;
  protected readonly aidesType = AIDES_TYPE_COMPTE;
  protected readonly niveaux = Object.entries(LIBELLES_NIVEAU) as [NiveauCuisine, string][];

  protected formulaire = inject(FormBuilder).nonNullable.group(
    {
      /** Classe du compte : décide des informations demandées (niveau, localité, justificatif). */
      typeCompte: ['CUISINIER' as TypeCompte, Validators.required],
      /** Profil : décide des droits. */
      profilId: ['', Validators.required],
      prenom: ['', [Validators.required, Validators.maxLength(60)]],
      nom: ['', [Validators.required, Validators.maxLength(60)]],
      email: ['', [Validators.email, Validators.maxLength(120)]],
      telephone: ['', [Validators.pattern(/^\+?[0-9 ]{8,20}$/)]],
      motDePasse: ['', [Validators.required, Validators.minLength(8)]],
      niveau: ['DEBUTANT' as NiveauCuisine],
      localite: [''],
      validerDirectement: [true],
    },
    { validators: contactValide },
  );

  /** Profils actifs (n'importe lequel peut être donné, quel que soit le type de compte). */
  protected profils = signal<ProfilResponse[]>([]);
  protected chargementProfils = signal(true);
  protected profilChoisi = toSignal(
    this.formulaire.controls.profilId.valueChanges.pipe(
      map((id) => this.profils().find((p) => p.id === id) ?? null),
    ),
    { initialValue: null },
  );
  /** Droits du profil choisi, affichés pour que l'admin sache ce qu'il donne. */
  protected droitsProfil = signal<ProfilDroitsResponse[]>([]);
  protected motDePasseVisible = signal(false);
  /** Chef ou producteur : pièce qui prouve le statut (photo ou PDF, obligatoire). */
  protected justificatif = signal<File | null>(null);
  protected erreurJustificatif = signal('');
  protected enCours = signal(false);
  protected erreur = signal('');

  protected role = toSignal(this.formulaire.controls.typeCompte.valueChanges, {
    initialValue: this.formulaire.controls.typeCompte.value,
  });
  /** Chef et producteur : statut à valider (on propose de le faire tout de suite). */
  protected aValider = computed(() => this.role() === 'CHEF' || this.role() === 'PRODUCTEUR');
  protected aideJustificatif = computed(
    () => `Photo ou PDF : ${JUSTIFICATIFS_ATTENDUS[this.role() === 'CHEF' ? 'CHEF' : 'PRODUCTEUR']}`,
  );

  constructor() {
    this.formulaire.controls.typeCompte.valueChanges.subscribe((type) => {
      // La localité n'est obligatoire que pour un producteur
      const localite = this.formulaire.controls.localite;
      localite.setValidators(type === 'PRODUCTEUR' ? [Validators.required] : []);
      localite.updateValueAndValidity();
      this.formulaire.updateValueAndValidity();
      this.proposerProfil(type);
    });
    this.formulaire.controls.profilId.valueChanges.subscribe((profilId) => {
      if (!profilId) {
        this.droitsProfil.set([]);
        return;
      }
      this.profilService.getDroitsDuProfil(profilId).subscribe({
        next: (droits) => this.droitsProfil.set(droits),
        error: () => this.droitsProfil.set([]),
      });
    });
  }

  ngOnInit(): void {
    this.profilService.getAll().subscribe({
      next: (profils) => {
        this.profils.set(profils.filter((p) => p.actif).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')));
        this.chargementProfils.set(false);
        this.proposerProfil(this.formulaire.controls.typeCompte.value);
      },
      error: () => this.chargementProfils.set(false),
    });
  }

  /**
   * Profil proposé pour un type de compte (l'admin peut en choisir un autre) :
   * administrateur → profil système ; cuisinier → profil des inscriptions ; chef / producteur → profil dont le nom l'évoque.
   */
  private proposerProfil(type: TypeCompte): void {
    const profils = this.profils();
    const normaliser = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    const propose =
      type === 'ADMIN'
        ? profils.find((p) => p.systeme)
        : type === 'CUISINIER'
          ? profils.find((p) => p.inscription)
          : profils.find((p) => normaliser(p.nom).includes(type === 'CHEF' ? 'chef' : 'producteur'));
    if (propose) {
      this.formulaire.controls.profilId.setValue(propose.id);
    }
  }

  /** Propose un mot de passe solide, affiché pour que l'admin puisse le transmettre. */
  genererMotDePasse(): void {
    const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    const valeurs = crypto.getRandomValues(new Uint32Array(12));
    const motDePasse = Array.from(valeurs, (v) => caracteres[v % caracteres.length]).join('');
    this.formulaire.controls.motDePasse.setValue(motDePasse);
    this.formulaire.controls.motDePasse.markAsDirty();
    this.motDePasseVisible.set(true);
  }

  choisirJustificatif(champ: HTMLInputElement): void {
    const fichier = champ.files?.[0] ?? null;
    champ.value = '';
    if (!fichier) {
      return;
    }
    const types = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!types.includes(fichier.type) || fichier.size > 5 * 1024 * 1024) {
      this.erreurJustificatif.set('Photo (JPG, PNG, WebP) ou PDF de 5 Mo maximum.');
      return;
    }
    this.erreurJustificatif.set('');
    this.justificatif.set(fichier);
  }

  enregistrer(): void {
    if (this.aValider() && !this.justificatif()) {
      this.formulaire.markAllAsTouched();
      this.erreurJustificatif.set('Le justificatif est obligatoire.');
      this.erreur.set('Ajoutez le justificatif du statut (diplôme, attestation, carte professionnelle...).');
      return;
    }
    if (this.formulaire.invalid) {
      this.formulaire.markAllAsTouched();
      this.erreur.set(
        this.formulaire.controls.profilId.invalid
          ? 'Choisissez le profil du compte.'
          : this.formulaire.hasError('emailAdmin')
          ? "L'email est obligatoire pour ce profil (il sert à se connecter au dashboard)."
          : this.formulaire.hasError('contact')
            ? 'Indiquez un email ou un numéro de téléphone : il sert à se connecter.'
            : 'Certains champs sont à compléter. Ils sont signalés en rouge.',
      );
      return;
    }
    this.enCours.set(true);
    this.erreur.set('');

    const v = this.formulaire.getRawValue();
    const commun = {
      prenom: v.prenom.trim(),
      nom: v.nom.trim(),
      email: v.email.trim() || undefined,
      telephone: v.telephone.replace(/\s/g, '') || undefined,
      motDePasse: v.motDePasse,
    };

    const personne = `${commun.prenom} ${commun.nom}`;
    // Pour un chef ou un producteur, la création et la validation sont deux appels distincts
    let compteCree = false;
    const valider = <T>(appel: Observable<T>): Observable<T> => {
      compteCree = true;
      return appel;
    };

    // Chef et producteur : le justificatif part d'abord, son adresse accompagne la création du compte
    const justificatif = this.justificatif();
    const preuve$: Observable<string> = justificatif
      ? this.utilisateurService.envoyerJustificatif(justificatif)
      : of('');

    let creation: Observable<unknown>;
    switch (v.typeCompte) {
      case 'ADMIN':
        creation = this.utilisateurService.creerAdmin(commun);
        break;
      case 'CHEF':
        creation = preuve$.pipe(
          switchMap((preuveUrl) => this.utilisateurService.creerChef({ ...commun, preuveUrl })),
        )
          .pipe(
            switchMap((chef) =>
              v.validerDirectement ? valider(this.utilisateurService.validerChef(chef.id)) : of(chef),
            ),
          );
        break;
      case 'PRODUCTEUR':
        creation = preuve$
          .pipe(
            switchMap((preuveUrl) =>
              this.utilisateurService.creerProducteur({ ...commun, localite: v.localite.trim(), preuveUrl }),
            ),
          )
          .pipe(
            switchMap((producteur) =>
              v.validerDirectement
                ? valider(this.utilisateurService.validerProducteur(producteur.id))
                : of(producteur),
            ),
          );
        break;
      default:
        creation = this.utilisateurService.creerCuisinier({ ...commun, niveau: v.niveau });
    }

    // Le compte est créé avec le profil par défaut de son type : on lui donne ensuite celui choisi
    const profilId = v.profilId;
    const avecProfil = creation.pipe(
      switchMap((compte) => {
        compteCree = true;
        const c = compte as { id: string; profilId: string | null };
        return c.profilId === profilId ? of(compte) : this.utilisateurService.changerProfil(c.id, profilId);
      }),
    );

    avecProfil.subscribe({
      next: () =>
        this.fenetre.close({
          message:
            this.aValider() && !v.validerDirectement
              ? `Le compte de ${personne} est créé. Son statut attend votre validation.`
              : `Le compte de ${personne} est créé.`,
          aVerifier: false,
        }),
      error: (erreur: unknown) => {
        if (compteCree) {
          // Le compte existe déjà : on ferme, la demande reste dans « Demandes à valider »
          this.fenetre.close({
            message: `Le compte de ${personne} est créé, mais la dernière étape (validation du statut ou profil choisi) n'a pas pu être faite. Vérifiez sa fiche.`,
            aVerifier: true,
          });
          return;
        }
        this.enCours.set(false);
        this.erreur.set(messageErreur(erreur, "Le compte n'a pas pu être créé."));
      },
    });
  }
}
