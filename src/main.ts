import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

registerLocaleData(localeEs, 'es-GT');

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));

// Register service worker for PWA (basic)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(err => console.warn('SW registration failed', err));
  });
}
