import {
  HttpContextToken,
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest
} from '@angular/common/http';
import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, from, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

import { AuthService } from '../services/auth.service';
import { TokenStorageService } from '../services/token-storage.service';
import { NOT_ALLOWED_MESSAGE } from '../errors/error-messages';

/**
 * Auth interceptor:
 *  - Attaches `Authorization: Bearer <token>` to every request EXCEPT URLs
 *    whose path starts with `/public/` (login endpoint must never receive
 *    an Authorization header).
 *  - 401 → logout + redirect, except for `/public/` requests (a bad login has
 *    no session to end); those propagate to the caller untouched.
 *  - 403 → de-duplicated profile re-sync, then retry the originating request
 *    exactly once. If the retry also returns 403, show a "not allowed" snackbar
 *    and propagate the error. A 403 never ends the session. Never loops.
 *  - Responses arriving after a logout are dropped (epoch check via
 *    AuthService.refreshProfile()).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokenStorage = inject(TokenStorageService);
  const auth = inject(AuthService);
  const snackBar = inject(MatSnackBar);

  const authedReq = attachToken(req, tokenStorage.getToken());

  return next(authedReq).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse)) return throwError(() => err);

      if (err.status === 401 && !isPublicUrl(req.url)) {
        auth.logout();
        return throwError(() => err);
      }

      if (err.status === 403 && !isRetried(req) && !isProfileEndpoint(req.url)) {
        return from(auth.refreshProfile()).pipe(
          switchMap(() => {
            const retried = attachToken(markRetried(req), tokenStorage.getToken());
            return next(retried).pipe(
              catchError((retryErr: unknown) => {
                if (retryErr instanceof HttpErrorResponse && retryErr.status === 403) {
                  notifyNotAllowed(snackBar);
                }
                return throwError(() => retryErr);
              })
            );
          }),
          catchError((refreshErr: unknown) => {
            // Profile re-sync itself failed (likely 401 → logout already
            // happened inside AuthService). Surface original 403.
            return throwError(() => refreshErr ?? err);
          })
        );
      }

      return throwError(() => err);
    })
  );
};

// Retry marker kept in the request context, NOT as a header: the backend CORS
// config rejects unknown request headers, which made the retry fail with status 0.
const IS_RETRY = new HttpContextToken<boolean>(() => false);

function attachToken<T>(req: HttpRequest<T>, token: string | null): HttpRequest<T> {
  if (!token) return req;
  if (isPublicUrl(req.url)) return req;
  if (req.headers.has('Authorization')) return req;
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

function isPublicUrl(url: string): boolean {
  // Match `/public/...` anywhere in the URL — covers both absolute and
  // relative URLs. Keeps the contract documented in AuthService.login().
  return /\/public\//.test(url);
}

function isProfileEndpoint(url: string): boolean {
  return /\/api\/user\/me(\?|$)/.test(url);
}

function isRetried<T>(req: HttpRequest<T>): boolean {
  return req.context.get(IS_RETRY);
}

function markRetried<T>(req: HttpRequest<T>): HttpRequest<T> {
  req.context.set(IS_RETRY, true);
  return req.clone();
}

function notifyNotAllowed(snackBar: MatSnackBar): void {
  snackBar.open(NOT_ALLOWED_MESSAGE, 'Cerrar', { duration: 5000, panelClass: 'snackbar-error' });
}

// Re-export to keep the appConfig import surface small and the signature
// available to tests without circular imports.
export type _AuthInterceptor = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => Observable<HttpEvent<unknown>>;
