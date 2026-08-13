import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { mapHttpError } from './error-mapper';

/** doc 40 §10: 401 signs the user out (the shell's guard sends them to /login), everything else surfaces as an AppError for the caller/UI to render. */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) return throwError(() => error);
      const mapped = mapHttpError(error);
      if (mapped.category === 'AUTH') auth.signOut();
      return throwError(() => mapped);
    })
  );
};
