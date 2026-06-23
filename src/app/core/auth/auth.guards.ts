import { inject } from '@angular/core';
import { CanMatchFn, Router, UrlTree } from '@angular/router';

import { AuthService } from '../services/auth.service';
import { FALLBACK_HOME_ROUTE, ROLE_HOME_ROUTES, Role } from './rbac';

/**
 * Blocks unauthenticated access. Redirects to /login.
 * Uses CanMatchFn so unmatched routes do not attempt to load lazy chunks.
 */
export const authGuard: CanMatchFn = (): boolean | UrlTree => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.currentUser()) return true;
  return router.parseUrl('/login');
};

/**
 * Allows the route only when the current user holds one of the roles listed
 * in `route.data.roles`. On mismatch, redirects to the user's role home
 * route (never a generic 403). If no role qualifies, redirects to /login.
 *
 * Usage:
 *   { path: 'admin', canMatch: [authGuard, roleGuard], data: { roles: ['admin'] } }
 */
export const roleGuard: CanMatchFn = (route): boolean | UrlTree => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const user = auth.currentUser();
  if (!user) return router.parseUrl('/login');

  const allowed = (route.data?.['roles'] as readonly Role[] | undefined) ?? [];
  if (allowed.length === 0 || (user.role && allowed.includes(user.role))) return true;

  // No qualifying role at all → /login. Known role without a home → fallback.
  if (!user.role) return router.parseUrl('/login');
  return router.parseUrl(ROLE_HOME_ROUTES[user.role] ?? FALLBACK_HOME_ROUTE);
};

/**
 * Applied to /login. Redirects already-authenticated users to their role
 * home instead of rendering the login form again.
 */
export const loginRedirectGuard: CanMatchFn = (): boolean | UrlTree => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const user = auth.currentUser();
  if (!user) return true;
  const home = user.role ? ROLE_HOME_ROUTES[user.role] : null;
  return router.parseUrl(home ?? FALLBACK_HOME_ROUTE);
};
