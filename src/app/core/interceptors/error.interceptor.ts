import { HttpInterceptorFn, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

export const errorInterceptor: HttpInterceptorFn = (req: HttpRequest<any>, next: HttpHandlerFn) => {
  return next(req).pipe(
    catchError((err) => {
      // simple global error handling; extend to show UI notifications
      console.error('API Error', err);
      return throwError(() => err);
    })
  );
};
