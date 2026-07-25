import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isLoggedIn() && auth.canAccessAdmin()) {
    return true;
  }

  if (auth.isLoggedIn()) {
    auth.logout(false);
    return router.createUrlTree(['/auth/login'], {
      queryParams: { accessDenied: 'admin' }
    });
  }

  return router.createUrlTree(['/auth/login'], {
    queryParams: { returnUrl: state.url }
  });
};
