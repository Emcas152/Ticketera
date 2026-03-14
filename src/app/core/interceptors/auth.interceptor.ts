import { HttpInterceptorFn, HttpRequest, HttpHandler } from '@angular/common/http';
import { Observable } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<any>, next: HttpHandler): Observable<any> => {
  const token = localStorage.getItem('token');
  if (token) {
    const cloned = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
    return next.handle(cloned);
  }
  return next.handle(req);
};
