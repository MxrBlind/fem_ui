import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, from, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

import { AuthService } from '../services/auth.service';
import { TokenStorageService } from '../services/token-storage.service';
import { FALLBACK_HOME_ROUTE, ROLE_HOME_ROUTES } from './rbac';

/**
 * Auth interceptor:
 *  - Attaches `Authorization: Bearer <token>` to every request EXCEPT URLs
 *    whose path starts with `/public/` (login endpoint must never receive
 *    an Authorization header).
 *  - 401 → logout + redirect, swallow for caller.
 *  - 403 → de-duplicated profile re-sync, then retry the originating request
 *    exactly once. If the retry also returns 403, redirect to role home (or
 *    /login). Never loops.
 *  - Responses arriving after a logout are dropped (epoch check via
 *    AuthService.refreshProfile()).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokenStorage = inject(TokenStorageService);
  const auth = inject(AuthService);
  const router = inject(Router);

  const authedReq = attachToken(req, tokenStorage.getToken());

  return next(authedReq).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse)) return throwError(() => err);

      if (err.status === 401) {
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
                  redirectToRoleHome(auth, router);
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

const RETRY_HEADER = 'X-Auth-Retry';

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
  return req.headers.has(RETRY_HEADER);
}

function markRetried<T>(req: HttpRequest<T>): HttpRequest<T> {
  return req.clone({ setHeaders: { [RETRY_HEADER]: '1' } });
}

function redirectToRoleHome(auth: AuthService, router: Router): void {
  const user = auth.currentUser();
  const target = user?.role ? ROLE_HOME_ROUTES[user.role] : null;
  void router.navigateByUrl(target ?? (user ? FALLBACK_HOME_ROUTE : '/login'));
}

// Re-export to keep the appConfig import surface small and the signature
// available to tests without circular imports.
export type _AuthInterceptor = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => Observable<HttpEvent<unknown>>;
