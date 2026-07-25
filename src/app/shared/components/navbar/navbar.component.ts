import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { MATERIAL_IMPORTS } from '../../material/material-imports';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, ...MATERIAL_IMPORTS],
  template: `
    <header class="navbar-wrap">
      <mat-toolbar class="navbar panel-surface">
        <a routerLink="/dashboard" class="brand">
          <img class="brand-logo" src="/assets/icons/C5952526-EC42-4BC4-8968-7F2270317160.PNG" alt="ALCON Ticket" />
          <span>
            <strong>ALCON Ticket</strong>
            <small>Experiencias que conectan</small>
          </span>
        </a>

        <nav class="desktop-links" *ngIf="auth.isLoggedIn()">
          <a routerLink="/dashboard" routerLinkActive="is-active" [routerLinkActiveOptions]="{ exact: true }">Resumen</a>
          <a routerLink="/dashboard/tickets" routerLinkActive="is-active">Tickets</a>
          <a routerLink="/dashboard/profile" routerLinkActive="is-active">Perfil</a>
        </nav>

        <div class="actions">
          <ng-container *ngIf="auth.isLoggedIn(); else guestActions">
            <a mat-flat-button routerLink="/dashboard" class="desktop-action">Panel</a>
            <button mat-button type="button" (click)="logout()" class="desktop-action">Salir</button>
          </ng-container>

          <ng-template #guestActions>
            <a mat-flat-button routerLink="/auth/login" class="desktop-action">Acceso admin</a>
          </ng-template>

          <button mat-stroked-button [matMenuTriggerFor]="mobileMenu" class="mobile-trigger">Menu</button>
        </div>
      </mat-toolbar>
    </header>

    <mat-menu #mobileMenu="matMenu">
      <ng-container *ngIf="auth.isLoggedIn(); else guestMenu">
        <a mat-menu-item routerLink="/dashboard">Resumen</a>
        <a mat-menu-item routerLink="/dashboard/tickets">Tickets</a>
        <a mat-menu-item routerLink="/dashboard/profile">Perfil</a>
        <button mat-menu-item type="button" (click)="logout()">Salir</button>
      </ng-container>

      <ng-template #guestMenu>
        <a mat-menu-item routerLink="/auth/login">Acceso admin</a>
      </ng-template>
    </mat-menu>
  `,
  styles: [
    `
      .navbar-wrap {
        position: sticky;
        top: 0;
        z-index: 100;
        padding: 0;
      }

      .navbar {
        display: flex;
        gap: 16px;
        border-radius: 0 !important;
        padding: 0 28px;
        height: 64px;
        background: #0d0d0d;
        color: #fff;
        border-bottom: 2px solid #ff007a;
        box-shadow: 0 2px 16px rgba(0,0,0,0.28) !important;
      }

      .brand {
        display: inline-flex;
        align-items: center;
        gap: 12px;
        color: inherit;
        text-decoration: none;
      }

      .brand strong,
      .brand small {
        display: block;
      }

      .brand small {
        color: rgba(255, 255, 255, 0.75);
      }

      .brand-logo {
        width: 76px;
        height: 50px;
        object-fit: contain;
        flex-shrink: 0;
      }

      .desktop-links,
      .actions {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .actions {
        margin-left: auto;
      }

      .desktop-links a {
        color: rgba(255, 255, 255, 0.78);
        text-decoration: none;
        font-weight: 600;
      }

      .desktop-links a.is-active {
        color: #fff;
        text-decoration: underline #ff007a 2px;
        text-underline-offset: 8px;
      }

      .actions .mat-mdc-button,
      .actions .mat-mdc-outlined-button,
      .actions .mat-mdc-unelevated-button {
        color: #fff;
      }

      .mobile-trigger {
        display: none;
      }

      @media (max-width: 1024px) {
        .navbar { padding: 0 16px; }

        .desktop-links,
        .actions .desktop-action {
          display: none;
        }

        .mobile-trigger {
          display: inline-flex;
        }

        .brand-logo {
          width: 38px;
          height: 38px;
        }
      }
    `
  ]
})
export class NavbarComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/auth/login']);
  }
}
