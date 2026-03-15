import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';

@Component({
  selector: 'app-public-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NavbarComponent, FooterComponent],
  template: `
    <app-navbar />
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

      @media (max-width: 768px) {
        .public-shell {
          padding: 0 16px 32px;
        }
      }
    `
  ]
})
export class PublicLayout {}
