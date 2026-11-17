import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatError, MatFormField, MatLabel, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { NgIcon } from '@ng-icons/core';
import { NotificationService } from '../../../../core/services/notification.service';
import { messageErreur } from '../../../../core/utils/erreurs';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { ParametresMarche } from '../../models/marche.model';
import { MarcheService } from '../../services/marche.service';

/** La route est plus longue que la ligne droite : même coefficient que l'API (DistanceService). */
const COEFFICIENT_ROUTE = 1.3;
/** Distances de l'aperçu du prix de livraison. */
const DISTANCES_EXEMPLE = [1, 3, 5, 10];

/** Même calcul que l'API : base + prix au km × distance de route, arrondi aux 50 F au-dessus. */
export function prixLivraison(distanceKm: number, base: number, parKm: number): number {
  const brut = Math.round((base + parKm * distanceKm * COEFFICIENT_ROUTE) * 100) / 100;
  return Math.ceil(brut / 50) * 50;
}

/**
 * Réglages du marché : rayons et délais de recherche des fournisseurs, délai de paiement, tarif et commission
 * de la livraison. Un aperçu montre le prix payé par le client selon la distance.
 */
@Component({
  imports: [
    ReactiveFormsModule,
    DecimalPipe,
    MatButton,
    MatFormField,
    MatLabel,
    MatError,
    MatSuffix,
    MatInput,
    MatProgressSpinner,
    NgIcon,
    PageHeader,
    EmptyState,
  ],
  selector: 'app-reglages-marche',
  styleUrl: './reglages-marche.scss',
  templateUrl: './reglages-marche.html',
})
export class ReglagesMarche implements OnInit {
  private marcheService = inject(MarcheService);
  private notification = inject(NotificationService);

  protected chargement = signal(true);
  protected erreurChargement = signal(false);
  protected enCours = signal(false);
  protected erreur = signal('');

  /** Gardé tel quel : l'API l'exige mais ne s'en sert pas dans le calcul du prix. */
  private prixMinLivraison = 0;

  private nombre = (min: number, max?: number) =>
    new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(min),
      ...(max === undefined ? [] : [Validators.max(max)]),
    ]);

  protected formulaire = new FormGroup({
    rayonInitialKm: this.nombre(0.1),
    pasRayonKm: this.nombre(0.1),
    rayonMaxKm: this.nombre(0.1),
    delaiRechercheMin: this.nombre(1),
    delaiPaiementMin: this.nombre(1),
    prixBaseLivraison: this.nombre(0),
    prixParKm: this.nombre(0),
    tauxCommissionLivraison: this.nombre(0, 100),
  });

  private valeurs = toSignal(this.formulaire.valueChanges, { initialValue: this.formulaire.value });

  /** Aperçu : prix payé par le client à 1, 3, 5 et 10 km ; gain du livreur après commission. */
  protected apercu = computed(() => {
    const v = this.valeurs();
    const base = Number(v.prixBaseLivraison ?? 0);
    const parKm = Number(v.prixParKm ?? 0);
    const taux = Number(v.tauxCommissionLivraison ?? 0);
    return DISTANCES_EXEMPLE.map((km) => {
      const prix = prixLivraison(km, base, parKm);
      return { km, prix, gain: prix - Math.round((prix * taux) / 100) };
    });
  });

  /** Paliers de recherche : 3 km, 5 km, … jusqu'au rayon maximum. */
  protected paliers = computed(() => {
    const v = this.valeurs();
    const debut = Number(v.rayonInitialKm ?? 0);
    const pas = Number(v.pasRayonKm ?? 0);
    const max = Number(v.rayonMaxKm ?? 0);
    if (debut <= 0 || pas <= 0 || max < debut) {
      return [];
    }
    const liste: number[] = [];
    for (let r = debut; r < max && liste.length < 20; r += pas) {
      liste.push(Math.round(r * 10) / 10);
    }
    liste.push(max);
    return liste;
  });

  /** Le rayon maximum doit couvrir le rayon de départ. */
  protected rayonIncoherent = computed(() => {
    const v = this.valeurs();
    return (
      v.rayonInitialKm != null &&
      v.rayonMaxKm != null &&
      Number(v.rayonMaxKm) < Number(v.rayonInitialKm)
    );
  });

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreurChargement.set(false);
    this.marcheService.getParametres().subscribe({
      next: (p) => {
        this.remplir(p);
        this.chargement.set(false);
      },
      error: () => {
        this.erreurChargement.set(true);
        this.chargement.set(false);
      },
    });
  }

  enregistrer(): void {
    if (this.formulaire.invalid || this.rayonIncoherent()) {
      this.formulaire.markAllAsTouched();
      return;
    }
    const v = this.formulaire.getRawValue();
    const requete: ParametresMarche = {
      rayonInitialKm: Number(v.rayonInitialKm),
      pasRayonKm: Number(v.pasRayonKm),
      rayonMaxKm: Number(v.rayonMaxKm),
      delaiRechercheMin: Number(v.delaiRechercheMin),
      delaiPaiementMin: Number(v.delaiPaiementMin),
      prixMinLivraison: this.prixMinLivraison,
      prixBaseLivraison: Number(v.prixBaseLivraison),
      prixParKm: Number(v.prixParKm),
      tauxCommissionLivraison: Number(v.tauxCommissionLivraison),
    };
    this.enCours.set(true);
    this.erreur.set('');
    this.marcheService.modifierParametres(requete).subscribe({
      next: (p) => {
        this.remplir(p);
        this.enCours.set(false);
        this.notification.succes(
          'Les réglages du marché sont enregistrés. Ils comptent pour les prochaines commandes.',
        );
      },
      error: (erreur: unknown) => {
        this.enCours.set(false);
        this.erreur.set(messageErreur(erreur, "Impossible d'enregistrer les réglages."));
      },
    });
  }

  private remplir(p: ParametresMarche): void {
    this.prixMinLivraison = p.prixMinLivraison ?? 0;
    this.formulaire.setValue({
      rayonInitialKm: p.rayonInitialKm,
      pasRayonKm: p.pasRayonKm,
      rayonMaxKm: p.rayonMaxKm,
      delaiRechercheMin: p.delaiRechercheMin,
      delaiPaiementMin: p.delaiPaiementMin,
      prixBaseLivraison: p.prixBaseLivraison,
      prixParKm: p.prixParKm,
      tauxCommissionLivraison: Number(p.tauxCommissionLivraison),
    });
    this.formulaire.markAsPristine();
  }
}
