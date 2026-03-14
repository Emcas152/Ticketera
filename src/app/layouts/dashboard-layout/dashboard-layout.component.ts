import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';

@Component({
  selector: 'dashboard-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NavbarComponent],
  template: `
    <app-navbar></app-navbar>
    <div class="dashboard">
      <aside class="sidenav">Menu</aside>
      <section class="content"><router-outlet></router-outlet></section>
    </div>
  `,
  styles: [`.dashboard{display:flex;gap:18px}.sidenav{width:220px;background:#f8f8f8;padding:12px}.content{flex:1;padding:12px}`]
})
export class DashboardLayout {}
