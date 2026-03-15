import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { BookingService } from '../../../core/services/booking.service';
import { MATERIAL_IMPORTS } from '../../material/material-imports';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, AsyncPipe, ...MATERIAL_IMPORTS],
  template: `
    <header class="navbar-wrap">
      <mat-toolbar class="navbar panel-surface">
        <a routerLink="/" class="brand">
          <span class="brand-mark"></span>
          <span>
            <strong>Pulse Events</strong>
            <small>Ticketing Platform</small>
          </span>
        </a>

        <nav class="desktop-links">
          <a routerLink="/" routerLinkActive="is-active" [routerLinkActiveOptions]="{ exact: true }">Inicio</a>
          <a routerLink="/events" routerLinkActive="is-active">Eventos</a>
          <a routerLink="/booking/history" routerLinkActive="is-active" *ngIf="auth.isLoggedIn()">Reservas</a>
          <a routerLink="/dashboard" routerLinkActive="is-active" *ngIf="auth.isLoggedIn()">Dashboard</a>
        </nav>

        <div class="actions">
          <a
            mat-stroked-button
            routerLink="/booking/cart"
            class="cart-button"
            [matBadge]="seatCount$ | async"
            matBadgeColor="accent"
            [matBadgeHidden]="(seatCount$ | async) === 0"
          >
            Carrito
          </a>

          <ng-container *ngIf="auth.isLoggedIn(); else guestActions">
            <a mat-flat-button routerLink="/dashboard">Mi cuenta</a>
            <button mat-button type="button" (click)="logout()">Salir</button>
          </ng-container>

          <ng-template #guestActions>
            <a mat-button routerLink="/auth/login">Ingresar</a>
            <a mat-flat-button routerLink="/auth/register">Crear cuenta</a>
          </ng-template>

          <button mat-stroked-button [matMenuTriggerFor]="mobileMenu" class="mobile-trigger">Menu</button>
        </div>
      </mat-toolbar>
    </header>

    <mat-menu #mobileMenu="matMenu">
      <a mat-menu-item routerLink="/">Inicio</a>
      <a mat-menu-item routerLink="/events">Eventos</a>
      <a mat-menu-item routerLink="/booking/cart">Carrito</a>
      <a mat-menu-item routerLink="/dashboard" *ngIf="auth.isLoggedIn()">Dashboard</a>
      <a mat-menu-item routerLink="/auth/login" *ngIf="!auth.isLoggedIn()">Ingresar</a>
      <button mat-menu-item type="button" (click)="logout()" *ngIf="auth.isLoggedIn()">Salir</button>
    </mat-menu>
  `,
  styles: [
    `
      .navbar-wrap {
        padding: 16px 24px 0;
      }

      .navbar {
        display: flex;
        gap: 16px;
        border-radius: 24px;
        padding: 14px 18px;
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
        color: var(--text-muted);
      }

      .brand-mark {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: linear-gradient(135deg, var(--brand-primary), var(--brand-accent));
        box-shadow: 0 0 0 8px rgba(15, 98, 254, 0.08);
      }

      .desktop-links,
      .actions {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .desktop-links {
        margin-left: auto;
      }

      .desktop-links a {
        color: var(--text-muted);
        text-decoration: none;
        font-weight: 600;
      }

      .desktop-links a.is-active {
        color: var(--text-primary);
      }

      .mobile-trigger {
        display: none;
      }

      @media (max-width: 1024px) {
        .navbar-wrap {
          padding: 16px 16px 0;
        }

        .desktop-links,
        .actions a:not(.cart-button),
        .actions button:not(.mobile-trigger) {
          display: none;
        }

        .mobile-trigger {
          display: inline-flex;
        }

        .actions {
          margin-left: auto;
        }
      }
    `
  ]
})
export class NavbarComponent {
  readonly auth = inject(AuthService);
  private readonly booking = inject(BookingService);
  private readonly router = inject(Router);
  readonly seatCount$ = this.booking.cart$.pipe(map((cart) => cart.seats.length));

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/']);
  }
}
