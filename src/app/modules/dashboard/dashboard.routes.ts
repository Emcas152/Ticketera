import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';
import { DashboardLayout } from '../../layouts/dashboard-layout/dashboard-layout.component';
import { OverviewComponent } from './overview.component';
import { ProfileComponent } from './profile.component';
import { SeatMapBuilderComponent } from './seat-map-builder.component';
import { TicketsComponent } from './tickets.component';
import { AccessValidatorComponent } from './access-validator.component';
import { AdminEventsComponent } from './admin-events.component';
import { CashSalesComponent } from './cash-sales.component';
import { VenuesComponent } from './venues.component';

export const routes: Routes = [
  {
    path: '',
    component: DashboardLayout,
    canActivate: [authGuard],
    children: [
      { path: '', component: OverviewComponent },
      { path: 'eventos', component: AdminEventsComponent },
      { path: 'venues', component: VenuesComponent },
      { path: 'ventas-efectivo', component: CashSalesComponent },
      { path: 'validar', component: AccessValidatorComponent },
      { path: 'tickets', component: TicketsComponent },
      { path: 'profile', component: ProfileComponent },
      { path: 'seat-map-builder', component: SeatMapBuilderComponent }
    ]
  }
];
