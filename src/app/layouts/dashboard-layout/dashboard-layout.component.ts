import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
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

    <div class="dashboard-shell" [class.sidebar-collapsed]="collapsed()">

      <!-- ══ SIDEBAR ══════════════════════════════════ -->
      <aside class="dashboard-nav">

        <!-- Toggle button -->
        <button class="collapse-btn" (click)="toggle()" [title]="collapsed() ? 'Expandir menú' : 'Colapsar menú'">
          <mat-icon>{{ collapsed() ? 'menu' : 'menu_open' }}</mat-icon>
        </button>

        <!-- Brand -->
        <div class="brand-block">
          <img src="/assets/icons/C5952526-EC42-4BC4-8968-7F2270317160.PNG" alt="ALCON Ticket" class="brand-logo" />
          <div class="brand-text">
            <strong class="brand-name">ALCON Ticket</strong>
            <p class="brand-sub">Admin Workspace</p>
          </div>
        </div>

        <!-- User -->
        <div class="user-card">
          <div class="avatar">{{ initials((user$ | async)?.fullName) }}</div>
          <div class="user-info">
            <strong>{{ (user$ | async)?.fullName }}</strong>
            <p>{{ roleLabel((user$ | async)?.roleId) }}</p>
          </div>
        </div>

        <!-- Nav principal -->
        <div class="nav-group">
          <p class="nav-label">Principal</p>
          <nav class="dashboard-links">
            @if (auth.canAccessAdmin()) {
            <a routerLink="/dashboard" routerLinkActive="is-active" [routerLinkActiveOptions]="{ exact: true }" [title]="collapsed() ? 'Resumen' : ''">
              <mat-icon>star_outline</mat-icon>
              <span class="nav-text">Resumen</span>
            </a>
            <a routerLink="/dashboard/tickets" routerLinkActive="is-active" [title]="collapsed() ? 'Tickets' : ''">
              <mat-icon>confirmation_number</mat-icon>
              <span class="nav-text">Tickets</span>
            </a>
            <a routerLink="/dashboard/ventas-efectivo" routerLinkActive="is-active" [title]="collapsed() ? 'Ventas en efectivo' : ''">
              <mat-icon>point_of_sale</mat-icon>
              <span class="nav-text">Ventas en efectivo</span>
            </a>
            <a routerLink="/dashboard/cortesias" routerLinkActive="is-active" [title]="collapsed() ? 'Cortesías' : ''">
              <mat-icon>card_giftcard</mat-icon>
              <span class="nav-text">Cortesías</span>
            </a>
            <a routerLink="/dashboard/reservas" routerLinkActive="is-active" [title]="collapsed() ? 'Estado de reservas' : ''">
              <mat-icon>pending_actions</mat-icon>
              <span class="nav-text">Estado de reservas</span>
            </a>
            }
            @if (auth.canAuthorizeEntry()) {
            <a routerLink="/dashboard/validar" routerLinkActive="is-active" [title]="collapsed() ? 'Autorizar entrada' : ''">
              <mat-icon>verified_user</mat-icon>
              <span class="nav-text">Autorizar entrada</span>
            </a>
            }
            @if (auth.canAccessAdmin()) {
            <a routerLink="/dashboard/profile" routerLinkActive="is-active" [title]="collapsed() ? 'Perfil' : ''">
              <mat-icon>person</mat-icon>
              <span class="nav-text">Perfil</span>
            </a>
            }
          </nav>
        </div>

        <!-- Herramientas -->
        @if (auth.canAccessAdmin()) {
        <div class="nav-group">
          <p class="nav-label">Herramientas</p>
          <nav class="dashboard-links">
            <a routerLink="/dashboard/eventos" routerLinkActive="is-active" [title]="collapsed() ? 'Eventos' : ''">
              <mat-icon>calendar_month</mat-icon>
              <span class="nav-text">Eventos</span>
            </a>
            <a routerLink="/dashboard/venues" routerLinkActive="is-active" [title]="collapsed() ? 'Ubicaciones' : ''">
              <mat-icon>location_on</mat-icon>
              <span class="nav-text">Ubicaciones</span>
            </a>
            <a routerLink="/dashboard/seat-map-builder" routerLinkActive="is-active" [title]="collapsed() ? 'Mapa de Asientos' : ''">
              <mat-icon>table_restaurant</mat-icon>
              <span class="nav-text">Mapa de Asientos</span>
            </a>
          </nav>
        </div>
        }

        <div class="sidebar-footer">
          <span class="footer-badge">Portal interno</span>
        </div>

      </aside>

      <!-- ══ MAIN CONTENT ══════════════════════════════ -->
      <section class="dashboard-content">
        <div class="content-inner">
          <router-outlet />
        </div>
        <footer class="dash-footer">
          <p class="dash-footer-copy">&copy; {{ currentYear }} ALCON Ticket. Todos los derechos reservados.</p>
          <p class="dash-footer-credit">
            Desarrollado por
            <a href="https://xpert-dev.com" target="_blank" rel="noopener noreferrer" class="dash-footer-link">Xpert-Dev</a>
          </p>
        </footer>
      </section>

    </div>
  `,
  styles: [`
    /* ══ CSS Variables ══════════════════════════════════ */
    :host {
      --sidebar-w: 252px;
      --sidebar-collapsed-w: 58px;
      --nav-h: 64px;
      --transition: 0.25s cubic-bezier(.4,0,.2,1);
    }

    /* ══ Shell ══════════════════════════════════════════ */
    .dashboard-shell {
      display: flex;
      height: calc(100vh - var(--nav-h));
      overflow: hidden;
      background: #0d0d0d;
    }

    /* ══ Sidebar ════════════════════════════════════════ */
    .dashboard-nav {
      position: relative;
      width: var(--sidebar-w);
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
      height: 100%;
      padding: 12px 10px;
      background: #0d0d0d;
      border-right: 1px solid rgba(255,255,255,0.06);
      overflow: hidden;
      overflow-y: auto;
      color: #fff;
      transition: width var(--transition);
      /* Hide scrollbar visually */
      scrollbar-width: thin;
      scrollbar-color: rgba(255,255,255,0.1) transparent;
    }
    .dashboard-nav::-webkit-scrollbar { width: 4px; }
    .dashboard-nav::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

    /* Collapsed state */
    .sidebar-collapsed .dashboard-nav {
      width: var(--sidebar-collapsed-w);
    }

    /* ── Toggle button ────────────────────────── */
    .collapse-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border: none;
      border-radius: 8px;
      background: rgba(255,255,255,0.07);
      color: rgba(255,255,255,0.7);
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
      flex-shrink: 0;
      align-self: flex-end;
      margin-bottom: 4px;
    }
    .collapse-btn:hover {
      background: rgba(106,0,255,0.35);
      color: #fff;
    }
    .collapse-btn mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    /* ── Brand ────────────────────────────────── */
    .brand-block {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 4px 12px;
      border-bottom: 1px solid rgba(255,255,255,0.07);
      margin-bottom: 6px;
      overflow: hidden;
    }
    .brand-logo {
      width: 60px;
      height: 40px;
      object-fit: contain;
      flex-shrink: 0;
    }
    .brand-text {
      overflow: hidden;
      white-space: nowrap;
      opacity: 1;
      transition: opacity var(--transition), width var(--transition);
    }
    .sidebar-collapsed .brand-text {
      opacity: 0;
      width: 0;
      pointer-events: none;
    }
    .brand-name {
      display: block;
      font-size: 0.9rem;
      letter-spacing: 0.06em;
      color: #fff;
    }
    .brand-sub {
      margin: 0;
      font-size: 0.65rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: rgba(255,255,255,0.4);
    }

    /* ── User card ────────────────────────────── */
    .user-card {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px;
      border-radius: 10px;
      background: rgba(255,255,255,0.05);
      margin-bottom: 4px;
      overflow: hidden;
    }
    .avatar {
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: var(--brand-gradient);
      font-size: 0.75rem;
      font-weight: 800;
      flex-shrink: 0;
    }
    .user-info {
      overflow: hidden;
      white-space: nowrap;
      opacity: 1;
      transition: opacity var(--transition);
    }
    .sidebar-collapsed .user-info {
      opacity: 0;
      pointer-events: none;
      width: 0;
    }
    .user-info strong {
      display: block;
      font-size: 0.82rem;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .user-info p {
      margin: 1px 0 0;
      font-size: 0.65rem;
      color: rgba(255,255,255,0.4);
      text-transform: uppercase;
      letter-spacing: 0.07em;
    }

    /* ── Nav groups ───────────────────────────── */
    .nav-group { margin-top: 6px; }

    .nav-label {
      margin: 0 0 3px 8px;
      font-size: 0.6rem;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: rgba(255,255,255,0.28);
      white-space: nowrap;
      overflow: hidden;
      opacity: 1;
      transition: opacity var(--transition);
    }
    .sidebar-collapsed .nav-label { opacity: 0; }

    .dashboard-links { display: grid; gap: 2px; }

    .dashboard-links a {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 10px;
      border-radius: 8px;
      color: rgba(255,255,255,0.62);
      text-decoration: none;
      font-size: 0.85rem;
      font-weight: 500;
      transition: background 0.15s, color 0.15s;
      white-space: nowrap;
      overflow: hidden;
    }
    .dashboard-links a mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      flex-shrink: 0;
      opacity: 0.78;
      color: #d900dc;
      transition: color 0.15s;
    }
    .nav-text {
      opacity: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      transition: opacity var(--transition), width var(--transition);
    }
    .sidebar-collapsed .nav-text {
      opacity: 0;
      width: 0;
      pointer-events: none;
    }

    .dashboard-links a:hover {
      background: rgba(255,255,255,0.07);
      color: rgba(255,255,255,0.9);
    }
    .dashboard-links a.is-active {
      background: linear-gradient(90deg, rgba(106,0,255,.38), rgba(255,0,122,.18));
      color: #fff;
      border-left: 3px solid #ff007a;
      padding-left: 7px;
    }
    .dashboard-links a.is-active mat-icon { opacity: 1; }

    /* ── Sidebar footer ───────────────────────── */
    .sidebar-footer {
      margin-top: auto;
      padding: 10px 8px;
      border-radius: 8px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.06);
      overflow: hidden;
    }
    .footer-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      background: rgba(255,255,255,0.08);
      font-size: 0.62rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: rgba(255,255,255,0.45);
      white-space: nowrap;
      opacity: 1;
      transition: opacity var(--transition);
    }
    .sidebar-collapsed .footer-badge { opacity: 0; }

    /* ══ Content area ═══════════════════════════════════ */
    .dashboard-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: #f7f3f9;
      transition: none;
    }

    .content-inner {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 14px 16px 12px;
      /* Custom scrollbar */
      scrollbar-width: thin;
      scrollbar-color: rgba(106,0,255,.2) transparent;
    }
    .content-inner::-webkit-scrollbar { width: 6px; }
    .content-inner::-webkit-scrollbar-thumb {
      background: rgba(106,0,255,.2);
      border-radius: 3px;
    }

    /* ── Footer (inside content column) ──────── */
    .dash-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      padding: 6px 16px;
      background: #f7f3f9;
      border-top: 1px solid rgba(0,0,0,0.07);
      flex-shrink: 0;
    }
    .dash-footer-copy,
    .dash-footer-credit {
      margin: 0;
      font-size: 0.72rem;
      color: #a0a9b5;
    }
    .dash-footer-credit { display: flex; align-items: center; gap: 4px; }
    .dash-footer-link {
      color: var(--brand-primary);
      font-weight: 700;
      text-decoration: none;
    }
    .dash-footer-link:hover { text-decoration: underline; }

    /* ══ Responsive ════════════════════════════════════ */
    @media (max-width: 960px) {
      .dashboard-shell {
        flex-direction: column;
        height: auto;
        overflow: visible;
      }
      .dashboard-nav {
        width: 100% !important;
        height: auto;
        flex-direction: row;
        flex-wrap: wrap;
        padding: 8px 12px;
        overflow: visible;
      }
      .dashboard-content {
        height: auto;
        overflow: visible;
      }
      .content-inner {
        overflow: visible;
        height: auto;
      }
    }
  `]
})
export class DashboardLayout {
  readonly auth         = inject(AuthService);
  readonly user$        = this.auth.user$;
  readonly currentYear  = new Date().getFullYear();
  readonly collapsed    = signal(false);

  toggle(): void {
    this.collapsed.update(v => !v);
  }

  initials(name?: string): string {
    if (!name) return 'AP';
    return name
      .split(' ')
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase() ?? '')
      .join('');
  }

  roleLabel(roleId?: number): string {
    return roleId === 1 ? 'Super administrador'
         : roleId === 2 ? 'Administrador'
         : 'Autorizador';
  }
}
