import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import localeFr from '@angular/common/locales/fr';
import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { DateAdapter, MAT_DATE_LOCALE, provideNativeDateAdapter } from '@angular/material/core';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { provideRouter, TitleStrategy, withComponentInputBinding } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { routes } from './app.routes';
import { AdaptateurDateFr } from './core/config/adaptateur-date-fr';
import { ICONES } from './core/config/icones';
import { PaginationFr } from './core/config/pagination-fr';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { erreurInterceptor } from './core/interceptors/erreur.interceptor';
import { TitrePageService } from './core/services/titre-page.service';

// Dates, nombres et montants affichés à la française (pipes date, number, currency)
registerLocaleData(localeFr);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // withComponentInputBinding : le paramètre :id d'une route arrive directement dans input() du composant
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor, erreurInterceptor])),
    { provide: TitleStrategy, useClass: TitrePageService },
    { provide: LOCALE_ID, useValue: 'fr' },

    // ----- Angular Material -----
    // Tous les champs de formulaire avec un contour (plus lisible que le style « rempli »)
    { provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: { appearance: 'outline' } },
    // Pagination des tableaux en français
    { provide: MatPaginatorIntl, useClass: PaginationFr },
    // Calendrier (mat-datepicker) en français, semaine commençant le lundi
    provideNativeDateAdapter(),
    { provide: MAT_DATE_LOCALE, useValue: 'fr-FR' },
    // Saisie au clavier en JJ/MM/AAAA
    { provide: DateAdapter, useClass: AdaptateurDateFr },

    // ----- Icônes (voir core/config/icones.ts) -----
    provideIcons(ICONES),
  ],
};
