import { Routes } from '@angular/router';
import { guestGuard } from '../../core/guards/guest.guard';
import { PublicLayout } from '../../layouts/public-layout/public-layout.component';
import { ForgotPasswordComponent } from './forgot-password.component';
import { LoginComponent } from './login.component';
import { RegisterComponent } from './register.component';

export const routes: Routes = [
  {
    path: '',
    component: PublicLayout,
    children: [
      { path: 'login', component: LoginComponent, canActivate: [guestGuard] },
      { path: 'register', component: RegisterComponent, canActivate: [guestGuard] },
      { path: 'forgot-password', component: ForgotPasswordComponent, canActivate: [guestGuard] },
      { path: '', pathMatch: 'full', redirectTo: 'login' }
    ]
  }
];
