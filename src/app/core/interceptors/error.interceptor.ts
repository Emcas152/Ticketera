import { HttpErrorResponse, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ErrorService } from '../services/error.service';

export const errorInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const errors = inject(ErrorService);
  const auth = inject(AuthService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        auth.handleUnauthorized();
      }

      const courtesyLimitNotConfigured = req.method === 'GET'
        && req.url.includes('/courtesy-limits/') && error.status === 404;
      const body = req.body as { payment_method?: unknown } | null;
      const isCourtesyRequest = req.url.includes('/tickets/courtesy')
        || (req.url.includes('/bookings') && body?.payment_method === 'cortesia');
      if (!courtesyLimitNotConfigured) {
        errors.handleHttpError(error, isCourtesyRequest ? 'courtesy' : 'general');
      }
      return throwError(() => error);
    })
  );
};
