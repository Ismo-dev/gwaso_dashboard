import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { MatTooltip } from '@angular/material/tooltip';
import { NgIcon } from '@ng-icons/core';
import { forkJoin } from 'rxjs';
import { EcranService } from '../../../../core/services/ecran.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { pageDe, pageValide, TAILLES_PAGE } from '../../../../core/utils/pagination';
import {
  DroitResponse,
  DROITS_INDISPENSABLES,
  grouperDroits,
  libelleDroit,
  ProfilResponse,
} from '../../models/profil.model';
import { ProfilService } from '../../services/profil.service';

/**
 * Qui peut faire quoi : les droits en lignes (regroupés par domaine, écrits en clair),
 * les profils en colonnes. Une case cochée = le profil a ce droit. Un clic l'accorde
 * ou le retire tout de suite ; si le serveur refuse, la case revient comme avant.
 * Sur téléphone, chaque droit devient une carte avec un bouton par profil.
 */
@Component({
  imports: [NgIcon, MatIconButton, MatMenu, MatMenuItem, MatMenuTrigger, MatPaginator, MatSlideToggle, MatTooltip],
  selector: 'app-matrice-droits',
  styleUrl: './matrice-droits.scss',
  templateUrl: './matrice-droits.html',
})
export class MatriceDroits {
  private profilService = inject(ProfilService);
  private notification = inject(NotificationService);
  protected ecran = inject(EcranService);

  readonly profils = input.required<ProfilResponse[]>();
  readonly droits = input.required<DroitResponse[]>();

  /** Les droits d'un profil ont changé (nouveau nombre de droits). */
  readonly profilModifie = output<{ profilId: string; nbDroits: number }>();
  readonly modifierDroit = output<DroitResponse>();
  readonly supprimerDroit = output<DroitResponse>();
  readonly basculerActivation = output<DroitResponse>();

  protected readonly libelleDroit = libelleDroit;

  /** Droits de chaque profil : id du profil → ids des droits. */
  protected attributions = signal<Map<string, Set<string>>>(new Map());
  protected chargement = signal(true);
  /** Cases en cours d'enregistrement (« profil|droit »). */
  protected enCours = signal<Set<string>>(new Set());
  protected recherche = signal('');

  /** Profils actifs d'abord, le profil système en premier. */
  protected colonnes = computed(() =>
    [...this.profils()].sort(
      (a, b) => Number(b.systeme) - Number(a.systeme) || Number(b.actif) - Number(a.actif) || a.nom.localeCompare(b.nom, 'fr'),
    ),
  );

  protected readonly taillesPage = TAILLES_PAGE;
  protected page = signal(0);
  protected taillePage = signal(TAILLES_PAGE[0]);

  /** Droits correspondant à la recherche, dans l'ordre d'affichage (par domaine, puis par libellé). */
  private droitsFiltres = computed(() => {
    const terme = this.recherche().trim().toLowerCase();
    const droits = terme
      ? this.droits().filter((d) => d.action.toLowerCase().includes(terme) || libelleDroit(d).toLowerCase().includes(terme))
      : this.droits();
    return grouperDroits(droits).flatMap((g) => g.droits.map((d) => this.droits().find((x) => x.id === d.id)!));
  });

  protected total = computed(() => this.droitsFiltres().length);
  /** La page reste valable si des droits disparaissent (suppression, recherche). */
  protected pageCourante = computed(() => pageValide(this.page(), this.taillePage(), this.total()));

  /** Droits de la page, regroupés par domaine (un domaine coupé reprend son titre à la page suivante). */
  protected groupes = computed(() => {
    const droits = pageDe(this.droitsFiltres(), this.pageCourante(), this.taillePage());
    return grouperDroits(droits).map((g) => ({
      ...g,
      // Les groupes gardent les DroitResponse complets (pour les actions)
      droits: g.droits.map((d) => droits.find((x) => x.id === d.id)!),
    }));
  });

  rechercher(terme: string): void {
    this.recherche.set(terme);
    this.page.set(0);
  }

  changerPage(evenement: PageEvent): void {
    this.page.set(evenement.pageIndex);
    this.taillePage.set(evenement.pageSize);
  }

  constructor() {
    // Les profils changent (création, suppression) : on relit leurs droits
    effect(() => {
      const profils = this.profils();
      untracked(() => this.charger(profils));
    });
  }

  private charger(profils: ProfilResponse[]): void {
    if (profils.length === 0) {
      this.chargement.set(false);
      return;
    }
    this.chargement.set(true);
    forkJoin(profils.map((p) => this.profilService.getDroitsDuProfil(p.id))).subscribe({
      next: (listes) => {
        const carte = new Map<string, Set<string>>();
        profils.forEach((p, i) => carte.set(p.id, new Set(listes[i].map((a) => a.droitId))));
        this.attributions.set(carte);
        this.chargement.set(false);
      },
      error: () => this.chargement.set(false),
    });
  }

  protected possede(profil: ProfilResponse, droit: DroitResponse): boolean {
    return this.attributions().get(profil.id)?.has(droit.id) ?? false;
  }

  /** Droit indispensable du profil administrateur : il ne peut pas lui être retiré. */
  protected verrouille(profil: ProfilResponse, droit: DroitResponse): boolean {
    return profil.systeme && DROITS_INDISPENSABLES.includes(droit.action);
  }

  protected indispensable(droit: DroitResponse): boolean {
    return DROITS_INDISPENSABLES.includes(droit.action);
  }

  protected occupe(profil: ProfilResponse, droit: DroitResponse): boolean {
    return this.enCours().has(`${profil.id}|${droit.id}`);
  }

  /** Nombre de profils qui ont ce droit. */
  protected nbProfils(droit: DroitResponse): number {
    return this.colonnes().filter((p) => this.possede(p, droit)).length;
  }

  protected libelleCase(profil: ProfilResponse, droit: DroitResponse): string {
    const etat = this.possede(profil, droit) ? 'accordé' : 'non accordé';
    return `${libelleDroit(droit)} — profil ${profil.nom} : ${etat}`;
  }

  basculer(profil: ProfilResponse, droit: DroitResponse): void {
    if (this.verrouille(profil, droit) || this.occupe(profil, droit)) {
      return;
    }
    const avant = new Set(this.attributions().get(profil.id) ?? []);
    const apres = new Set(avant);
    const accorder = !avant.has(droit.id);
    accorder ? apres.add(droit.id) : apres.delete(droit.id);

    // Affichage immédiat ; on revient en arrière si l'enregistrement échoue
    this.majProfil(profil.id, apres);
    const cle = `${profil.id}|${droit.id}`;
    this.enCours.update((s) => new Set(s).add(cle));
    this.profilService.modifierDroitsDuProfil(profil.id, [...apres]).subscribe({
      next: (attributions) => {
        this.majProfil(profil.id, new Set(attributions.map((a) => a.droitId)));
        this.finir(cle);
        this.profilModifie.emit({ profilId: profil.id, nbDroits: attributions.length });
        this.notification.succes(
          accorder
            ? `« ${libelleDroit(droit)} » est accordé au profil ${profil.nom}.`
            : `« ${libelleDroit(droit)} » est retiré du profil ${profil.nom}.`,
        );
      },
      error: () => {
        this.majProfil(profil.id, avant);
        this.finir(cle);
      },
    });
  }

  private majProfil(profilId: string, droits: Set<string>): void {
    this.attributions.update((carte) => new Map(carte).set(profilId, droits));
  }

  private finir(cle: string): void {
    this.enCours.update((s) => {
      const copie = new Set(s);
      copie.delete(cle);
      return copie;
    });
  }
}
