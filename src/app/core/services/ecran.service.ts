import { BreakpointObserver } from '@angular/cdk/layout';
import { computed, inject, Service } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';


const MOBILE = '(max-width: 767.98px)';
const TABLETTE = '(min-width: 768px) and (max-width: 1199.98px)';


@Service()
export class EcranService {
  private observateur = inject(BreakpointObserver);

  private resultat = toSignal(this.observateur.observe([MOBILE, TABLETTE]), {
    initialValue: { matches: false, breakpoints: {} as Record<string, boolean> },
  });

  /** Téléphone (moins de 768 px). */
  readonly mobile = computed(() => this.resultat().breakpoints[MOBILE] === true);
  /** Tablette et petit portable (768 à 1199 px). */
  readonly tablette = computed(() => this.resultat().breakpoints[TABLETTE] === true);
  /** Ordinateur (1200 px et plus). */
  readonly bureau = computed(() => !this.mobile() && !this.tablette());
}
