import { ApplicationConfig, importProvidersFrom, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';

import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { loadingInterceptor } from './core/interceptors/loading.interceptor';
import { MatSnackBarModule } from '@angular/material/snack-bar';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withInMemoryScrolling({
        scrollPositionRestoration: 'enabled'
      })
    ),
    provideClientHydration(withEventReplay()),
    provideAnimations(),
    provideHttpClient(withFetch(), withInterceptors([loadingInterceptor, authInterceptor, errorInterceptor])),
    importProvidersFrom(MatSnackBarModule),
    { provide: LOCALE_ID, useValue: 'es-GT' }
  ]
};
