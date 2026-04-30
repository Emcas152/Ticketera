import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import { MATERIAL_IMPORTS } from '../../shared/material/material-imports';

@Component({
  selector: 'app-dashboard-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, AsyncPipe, NavbarComponent, ...MATERIAL_IMPORTS],
  template: `
    <app-navbar />
    <div class="dashboard-shell">
      <aside class="dashboard-nav">

        <div class="brand-block">
          <img src="/assets/icons/icon-white-ui.png" alt="ALCON" />
          <div>
            <strong class="brand-name">ALCON</strong>
            <p class="brand-sub">Admin Workspace</p>
          </div>
        </div>

        <div class="user-card">
          <div class="avatar">{{ initials((user$ | async)?.fullName) }}</div>
          <div class="user-info">
            <strong>{{ (user$ | async)?.fullName }}</strong>
            <p>Administrador</p>
          </div>
        </div>

        <div class="nav-group">
          <p class="nav-label">Principal</p>
          <nav class="dashboard-links">
            <a routerLink="/dashboard" routerLinkActive="is-active" [routerLinkActiveOptions]="{ exact: true }">
              <mat-icon>dashboard</mat-icon>
              <span>Resumen</span>
            </a>
            <a routerLink="/dashboard/tickets" routerLinkActive="is-active">
              <mat-icon>confirmation_number</mat-icon>
              <span>Tickets</span>
            </a>
            <a routerLink="/dashboard/profile" routerLinkActive="is-active">
              <mat-icon>person</mat-icon>
              <span>Perfil</span>
            </a>
          </nav>
        </div>

        <div class="nav-group">
          <p class="nav-label">Herramientas</p>
          <nav class="dashboard-links">
            <a routerLink="/dashboard/seat-map-builder" routerLinkActive="is-active">
              <mat-icon>table_restaurant</mat-icon>
              <span>Mapa de Asientos</span>
            </a>
          </nav>
        </div>

        <div class="sidebar-footer">
          <span class="footer-badge">Portal interno</span>
          <!-- <p>Acceso fuera del flujo público de compras.</p> -->
        </div>

      </aside>

      <section class="dashboard-content">
        <router-outlet />
      </section>
    </div>

    <footer class="dash-footer">
      <p class="dash-footer-copy">&copy; {{ currentYear }} ALCON Productions. Todos los derechos reservados.</p>
      <p class="dash-footer-credit">
        Desarrollado por
        <a href="https://xpert-dev.com" target="_blank" rel="noopener noreferrer" class="dash-footer-link">
          Xpert-Dev
        </a>
      </p>
    </footer>
  `,
  styles: [
    `
      .dashboard-shell {
        display: grid;
        grid-template-columns: 260px minmax(0, 1fr);
        min-height: calc(100vh - 64px);
        background: linear-gradient(to right, #0f1c2e 260px, #f4f7fb 260px);
      }

      /* ── Sidebar ── */
      .dashboard-nav {
        position: sticky;
        top: 64px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        height: calc(100vh - 64px);
        padding: 20px 14px;
        background: #0f1c2e;
        border-right: 1px solid rgba(255, 255, 255, 0.05);
        overflow-y: auto;
        color: #fff;
      }

      /* Brand */
      .brand-block {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 6px 16px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.07);
        margin-bottom: 8px;
      }

      .brand-block img {
        width: 34px;
        height: 34px;
        object-fit: contain;
        flex-shrink: 0;
      }

      .brand-name {
        display: block;
        font-size: 0.95rem;
        letter-spacing: 0.06em;
        color: #fff;
      }

      .brand-sub {
        margin: 0;
        font-size: 0.68rem;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: rgba(255, 255, 255, 0.4);
      }

      /* User card */
      .user-card {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 10px;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.05);
        margin-bottom: 6px;
      }

      .avatar {
        display: grid;
        place-items: center;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: linear-gradient(135deg, #004489, #ba1c1c);
        font-size: 0.78rem;
        font-weight: 800;
        flex-shrink: 0;
      }

      .user-info strong {
        display: block;
        font-size: 0.85rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 160px;
      }

      .user-info p {
        margin: 2px 0 0;
        font-size: 0.68rem;
        color: rgba(255, 255, 255, 0.45);
        text-transform: uppercase;
        letter-spacing: 0.07em;
      }

      /* Nav groups */
      .nav-group {
        margin-top: 8px;
      }

      .nav-label {
        margin: 0 0 4px 10px;
        font-size: 0.62rem;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: rgba(255, 255, 255, 0.3);
      }

      .dashboard-links {
        display: grid;
        gap: 2px;
      }

      .dashboard-links a {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 10px;
        border-radius: 8px;
        color: rgba(255, 255, 255, 0.65);
        text-decoration: none;
        font-size: 0.875rem;
        font-weight: 500;
        transition: background 0.15s ease, color 0.15s ease;
      }

      .dashboard-links a mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        flex-shrink: 0;
        opacity: 0.75;
      }

      .dashboard-links a:hover {
        background: rgba(255, 255, 255, 0.07);
        color: rgba(255, 255, 255, 0.9);
      }

      .dashboard-links a.is-active {
        background: rgba(0, 68, 137, 0.35);
        color: #fff;
        border-left: 3px solid #4a9eff;
        padding-left: 7px;
      }

      .dashboard-links a.is-active mat-icon {
        opacity: 1;
      }

      /* Footer note */
      .sidebar-footer {
        margin-top: auto;
        padding: 12px 10px;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.06);
      }

      .footer-badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.08);
        font-size: 0.65rem;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: rgba(255, 255, 255, 0.5);
        margin-bottom: 6px;
      }

      .sidebar-footer p {
        margin: 0;
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.35);
        line-height: 1.5;
      }

      /* ── Content ── */
      .dashboard-content {
        padding: 28px 32px;
        background: #f4f7fb;
        min-height: 100%;
        overflow: auto;
      }

      /* ── Footer ── */
      .dash-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
        position: sticky;
        bottom: 0;
        padding: 12px 32px 12px calc(260px + 32px);
        background: #f4f7fb;
        border-top: 1px solid rgba(0,0,0,0.08);
        box-shadow: 0 -4px 12px rgba(0,0,0,0.05);
        z-index: 10;
      }

      .dash-footer-copy,
      .dash-footer-credit {
        margin: 0;
        font-size: 0.75rem;
        color: #8a94a2;
      }

      .dash-footer-credit { display: flex; align-items: center; gap: 4px; }

      .dash-footer-link {
        color: var(--brand-primary);
        font-weight: 700;
        text-decoration: none;
      }

      .dash-footer-link:hover { text-decoration: underline; }

      @media (max-width: 960px) {
        .dashboard-shell {
          grid-template-columns: 1fr;
        }

        .dashboard-nav {
          position: static;
          height: auto;
          flex-direction: row;
          flex-wrap: wrap;
          padding: 12px;
        }
      }
    `
  ]
})
export class DashboardLayout {
  private readonly auth = inject(AuthService);
  readonly user$       = this.auth.user$;
  readonly currentYear = new Date().getFullYear();

  initials(name?: string): string {
    if (!name) {
      return 'AP';
    }

    return name
      .split(' ')
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }
}
