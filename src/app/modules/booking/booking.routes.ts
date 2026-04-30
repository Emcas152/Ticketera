import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';
import { PublicLayout } from '../../layouts/public-layout/public-layout.component';
import { CartComponent } from './cart.component';
import { ConfirmComponent } from './confirm.component';
import { HistoryComponent } from './history.component';
import { SeatMapComponent } from './seat-map.component';

export const routes: Routes = [
  {
    path: '',
    component: PublicLayout,
    children: [
      { path: ':eventId/seats', component: SeatMapComponent },
      { path: 'cart', component: CartComponent },
      { path: 'confirm', component: ConfirmComponent, canActivate: [authGuard] },
      { path: 'history', component: HistoryComponent, canActivate: [authGuard] },
      { path: '', pathMatch: 'full', redirectTo: 'history' }
    ]
  }
];
