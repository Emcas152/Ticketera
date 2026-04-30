import { Component } from '@angular/core';

@Component({
  selector: 'app-footer',
  standalone: true,
  template: `
    <footer class="footer panel-surface">
      <div class="footer-brand">
        <img src="/assets/icons/alcon-bluered-ui.png" alt="ALCON Productions" />
        <strong>ALCON Productions</strong>
        <p>Plataforma escalable para exploracion, compra y gestion de tickets.</p>
      </div>
      <div class="footer-links">
        <span>API-ready</span>
        <span>JWT auth</span>
        <span>Responsive UI</span>
      </div>
      <small>© {{ year }} ALCON Productions. Frontend listo para integrarse con API REST.</small>
    </footer>
  `,
  styles: [
    `
      .footer {
        display: grid;
        gap: 16px;
        margin: 0 24px 24px;
        border-left: 5px solid var(--brand-primary);
      }

      .footer p,
      .footer small {
        margin: 0;
        color: var(--text-muted);
      }

      .footer-brand {
        display: grid;
        gap: 8px;
      }

      .footer-brand img {
        width: 220px;
        max-width: 100%;
        height: auto;
        object-fit: contain;
      }

      .footer-links {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        color: var(--text-muted);
      }

      @media (max-width: 768px) {
        .footer {
          margin: 0 16px 16px;
        }
      }
    `
  ]
})
export class FooterComponent {
  year = new Date().getFullYear();
}
