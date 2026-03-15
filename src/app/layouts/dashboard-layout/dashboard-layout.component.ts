import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { MATERIAL_IMPORTS } from '../../shared/material/material-imports';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';

@Component({
  selector: 'app-dashboard-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, AsyncPipe, NavbarComponent, ...MATERIAL_IMPORTS],
  template: `
    <app-navbar />
    <div class="dashboard-shell">
      <aside class="dashboard-nav panel-surface">
        <p class="eyebrow">Workspace</p>
        <h3>{{ (user$ | async)?.fullName }}</h3>
        <p class="membership">{{ (user$ | async)?.membershipTier }} member</p>

        <nav class="dashboard-links">
          <a mat-stroked-button routerLink="/dashboard" routerLinkActive="is-active" [routerLinkActiveOptions]="{ exact: true }">Resumen</a>
          <a mat-stroked-button routerLink="/dashboard/tickets" routerLinkActive="is-active">Mis tickets</a>
          <a mat-stroked-button routerLink="/dashboard/purchases" routerLinkActive="is-active">Compras</a>
          <a mat-stroked-button routerLink="/dashboard/profile" routerLinkActive="is-active">Perfil</a>
        </nav>
      </aside>

      <section class="dashboard-content">
        <router-outlet />
      </section>
    </div>
  `,
  styles: [
    `
      .dashboard-shell {
        display: grid;
        grid-template-columns: 280px minmax(0, 1fr);
        gap: 24px;
        padding: 24px;
      }

      .dashboard-nav {
        position: sticky;
        top: 96px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        height: fit-content;
      }

      .dashboard-links {
        display: grid;
        gap: 12px;
      }

      .dashboard-links a {
        justify-content: flex-start;
      }

      .dashboard-links .is-active {
        border-color: var(--brand-primary);
        background: rgba(15, 98, 254, 0.08);
      }

      .membership,
      .eyebrow {
        margin: 0;
      }

      .eyebrow {
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 0.75rem;
      }

      .membership {
        color: var(--text-muted);
      }

      @media (max-width: 960px) {
        .dashboard-shell {
          grid-template-columns: 1fr;
          padding: 16px;
        }

        .dashboard-nav {
          position: static;
        }
      }
    `
  ]
})
export class DashboardLayout {
  private readonly auth = inject(AuthService);
  readonly user$ = this.auth.user$;
}
