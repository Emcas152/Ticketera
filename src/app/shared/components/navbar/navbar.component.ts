import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <nav class="navbar">
      <a routerLink="/" class="brand">Sistema Tickets</a>
      <div class="links">
        <a routerLink="/">Eventos</a>
        <a routerLink="/dashboard" *ngIf="isLogged">Mi Cuenta</a>
        <a routerLink="/auth/login" *ngIf="!isLogged">Ingresar</a>
        <button *ngIf="isLogged" (click)="logout()">Cerrar sesión</button>
      </div>
    </nav>
  `,
  styles: [`.navbar{display:flex;justify-content:space-between;padding:12px 18px;background:#fff;border-bottom:1px solid #eee}.brand{font-weight:700}.links a,.links button{margin-left:12px}`]
})
export class NavbarComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  get isLogged() { return this.auth.isLoggedIn(); }
  logout() { this.auth.logout(); this.router.navigate(['/']); }
}
