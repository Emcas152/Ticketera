import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const adminRoleGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.canAccessAdmin() ? true : router.createUrlTree(['/dashboard/validar']);
};

export const authorizerRoleGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.canAuthorizeEntry() ? true : router.createUrlTree(['/dashboard']);
};
