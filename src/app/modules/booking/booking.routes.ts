import { Routes } from '@angular/router';
import { SeatMapComponent } from './seat-map.component';
import { CartComponent } from './cart.component';
import { ConfirmComponent } from './confirm.component';
import { PublicLayout } from '../../layouts/public-layout/public-layout.component';

export const routes: Routes = [
  {
    path: '',
    component: PublicLayout,
    children: [
      { path: '', component: SeatMapComponent },
      { path: 'cart', component: CartComponent },
      { path: 'confirm', component: ConfirmComponent }
    ]
  }
];
