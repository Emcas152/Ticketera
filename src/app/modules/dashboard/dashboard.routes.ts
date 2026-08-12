import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';
import { adminRoleGuard, authorizerRoleGuard } from '../../core/guards/role.guard';
import { DashboardLayout } from '../../layouts/dashboard-layout/dashboard-layout.component';
import { OverviewComponent } from './overview.component';
import { ProfileComponent } from './profile.component';
import { SeatMapBuilderComponent } from './seat-map-builder.component';
import { TicketsComponent } from './tickets.component';
import { AccessValidatorComponent } from './access-validator.component';
import { AdminEventsComponent } from './admin-events.component';
import { CashSalesComponent } from './cash-sales.component';
import { VenuesComponent } from './venues.component';
import { ReservationsComponent } from './reservations.component';
import { CourtesySeatsComponent } from './courtesy-seats.component';

export const routes: Routes = [
  {
    path: '',
    component: DashboardLayout,
    canActivate: [authGuard],
    children: [
      { path: '', component: OverviewComponent, canActivate: [adminRoleGuard] },
      { path: 'eventos', component: AdminEventsComponent, canActivate: [adminRoleGuard] },
      { path: 'venues', component: VenuesComponent, canActivate: [adminRoleGuard] },
      { path: 'ventas-efectivo', component: CashSalesComponent, canActivate: [adminRoleGuard] },
      { path: 'cortesias', component: CourtesySeatsComponent, canActivate: [adminRoleGuard] },
      { path: 'reservas', component: ReservationsComponent, canActivate: [adminRoleGuard] },
      { path: 'validar', component: AccessValidatorComponent, canActivate: [authorizerRoleGuard] },
      { path: 'tickets', component: TicketsComponent, canActivate: [adminRoleGuard] },
      { path: 'profile', component: ProfileComponent, canActivate: [adminRoleGuard] },
      { path: 'seat-map-builder', component: SeatMapBuilderComponent, canActivate: [adminRoleGuard] }
    ]
  }
];
