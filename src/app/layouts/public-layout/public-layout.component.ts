import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';

@Component({
  selector: 'app-public-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterOutlet, NavbarComponent, FooterComponent],
  template: `
    <app-navbar />
    <aside class="presale-notice" aria-label="Aviso de preventa">
      <div class="presale-notice__content">
        <span class="presale-notice__badge">Preventa</span>
        <p><strong>¡La preventa ya está disponible!</strong> Asegura tus boletos antes de la venta general.</p>
        <a routerLink="/events">Ver eventos <span aria-hidden="true">→</span></a>
      </div>
    </aside>
    <main class="public-shell">
      <router-outlet />
    </main>
    <app-footer />
  `,
  styles: [
    `
      .public-shell {
        min-height: calc(100vh - 144px);
        padding: 0 24px 48px;
      }

      .presale-notice {
        padding: 10px 24px;
        color: #fff;
        background: linear-gradient(90deg, #c90061, #ff007a 55%, #d90042);
        box-shadow: 0 4px 18px rgba(201, 0, 97, 0.22);
      }

      .presale-notice__content {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 14px;
        max-width: 1200px;
        margin: 0 auto;
      }

      .presale-notice__badge {
        padding: 4px 9px;
        border: 1px solid rgba(255, 255, 255, 0.7);
        border-radius: 999px;
        font-size: 0.7rem;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .presale-notice p {
        margin: 0;
        font-size: 0.9rem;
      }

      .presale-notice a {
        color: #fff;
        font-size: 0.85rem;
        font-weight: 800;
        text-underline-offset: 3px;
        white-space: nowrap;
      }

      @media (max-width: 768px) {
        .presale-notice {
          padding: 10px 16px;
        }

        .presale-notice__content {
          flex-wrap: wrap;
          gap: 6px 10px;
          justify-content: flex-start;
        }

        .presale-notice p {
          flex: 1;
          min-width: 220px;
          font-size: 0.82rem;
        }

        .public-shell {
          padding: 0 16px 32px;
        }
      }
    `
  ]
})
export class PublicLayout {}
