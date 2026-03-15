import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';
import { DashboardLayout } from '../../layouts/dashboard-layout/dashboard-layout.component';
import { OverviewComponent } from './overview.component';
import { ProfileComponent } from './profile.component';
import { PurchasesComponent } from './purchases.component';
import { TicketsComponent } from './tickets.component';

export const routes: Routes = [
  {
    path: '',
    component: DashboardLayout,
    canActivate: [authGuard],
    children: [
      { path: '', component: OverviewComponent },
      { path: 'tickets', component: TicketsComponent },
      { path: 'purchases', component: PurchasesComponent },
      { path: 'profile', component: ProfileComponent }
    ]
  }
];
