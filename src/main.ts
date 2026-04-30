import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { environment } from './environments/environment';

registerLocaleData(localeEs, 'es-GT');

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));

if (environment.production && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch((err) => console.warn('SW registration failed', err));
  });
}
