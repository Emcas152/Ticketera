import { Component } from '@angular/core';

@Component({
  selector: 'app-footer',
  standalone: true,
  template: `
    <footer class="footer panel-surface">
      <div>
        <strong>Pulse Events</strong>
        <p>Plataforma escalable para exploracion, compra y gestion de tickets.</p>
      </div>
      <div class="footer-links">
        <span>API-ready</span>
        <span>JWT auth</span>
        <span>Responsive UI</span>
      </div>
      <small>© {{ year }} Pulse Events. Frontend listo para integrarse con API REST.</small>
    </footer>
  `,
  styles: [
    `
      .footer {
        display: grid;
        gap: 16px;
        margin: 0 24px 24px;
      }

      .footer p,
      .footer small {
        margin: 0;
        color: var(--text-muted);
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
