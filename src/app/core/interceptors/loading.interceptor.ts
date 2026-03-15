import { HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { LoaderService } from '../services/loader.service';

export const loadingInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const loader = inject(LoaderService);
  loader.show();

  return next(req).pipe(finalize(() => loader.hide()));
};
