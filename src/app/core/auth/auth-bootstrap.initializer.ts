import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';

import { AuthService } from '../services/auth.service';
import { TokenStorageService } from '../services/token-storage.service';
import { AUTH_BOOTSTRAP_TIMEOUT_MS } from './rbac';

/**
 * Bootstrap factory wired through `provideAppInitializer`. If a token is
 * present, fetches /api/user/me with a hard timeout before the router
 * activates so guards never see a transient "no user with valid token" state.
 *
 * Outcomes:
 *  - 200 → currentUser is populated, app proceeds.
 *  - 401 → silent: token cleared, navigate to /login (expected expiry).
 *  - 5xx / network / timeout → token cleared, navigate to /login + error toast.
 */
export function authBootstrapInitializer(): Promise<void> {
  const tokenStorage = inject(TokenStorageService);
  const auth = inject(AuthService);
  const router = inject(Router);
  const snackBar = inject(MatSnackBar);

  if (!tokenStorage.getToken()) return Promise.resolve();

  const profile = auth.loadProfileForBootstrap();
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new BootstrapTimeoutError()), AUTH_BOOTSTRAP_TIMEOUT_MS)
  );

  return Promise.race([profile, timeout])
    .then(() => undefined)
    .catch((err: unknown) => {
      tokenStorage.clear();
      const status = err instanceof HttpErrorResponse ? err.status : null;
      if (status === 401) {
        // Silent: expected expiry.
        void router.navigateByUrl('/login');
        return;
      }
      snackBar.open('No fue posible restaurar tu sesión.', undefined, {
        duration: 5000,
        panelClass: 'snackbar-error'
      });
      void router.navigateByUrl('/login');
    });
}

class BootstrapTimeoutError extends Error {
  constructor() {
    super('Auth bootstrap timed out');
    this.name = 'BootstrapTimeoutError';
  }
}
