import { Routes } from '@angular/router';
import { ProfileComponent } from './profile.component';
import { TicketsComponent } from './tickets.component';
import { DashboardLayout } from '../../layouts/dashboard-layout/dashboard-layout.component';
import { authGuard } from '../../core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    component: DashboardLayout,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'profile', pathMatch: 'full' },
      { path: 'profile', component: ProfileComponent },
      { path: 'tickets', component: TicketsComponent }
    ]
  }
];
