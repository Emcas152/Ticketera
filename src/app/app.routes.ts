import { Routes } from '@angular/router';

export const routes: Routes = [
	{ path: '', loadChildren: () => import('./modules/events/events.routes').then(m => m.routes) },
	{ path: 'auth', loadChildren: () => import('./modules/auth/auth.routes').then(m => m.routes) },
	{ path: 'booking', loadChildren: () => import('./modules/booking/booking.routes').then(m => m.routes) },
	{ path: 'dashboard', loadChildren: () => import('./modules/dashboard/dashboard.routes').then(m => m.routes) },
	{ path: '**', redirectTo: '' }
];
