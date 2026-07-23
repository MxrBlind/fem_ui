import { TestBed } from '@angular/core/testing';
import { Router, Route, UrlSegment, UrlTree, provideRouter } from '@angular/router';
import { signal } from '@angular/core';

import { AuthService } from '../services/auth.service';
import { AuthUser } from './rbac';
import { authGuard, loginRedirectGuard, roleGuard } from './auth.guards';

function makeAuth(user: AuthUser | null) {
  const sig = signal(user);
  return { currentUser: sig.asReadonly() } as unknown as AuthService;
}

function runGuard(
  guard: typeof authGuard,
  user: AuthUser | null,
  route: Partial<Route> = {}
): boolean | UrlTree {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: AuthService, useFactory: () => makeAuth(user) }]
  });
  return TestBed.runInInjectionContext(() =>
    guard(route as Route, [] as UrlSegment[])
  ) as boolean | UrlTree;
}

const admin: AuthUser = { id: 1, username: 'a', role: 'admin', rawRole: 'admin' };
const student: AuthUser = { id: 2, username: 's', role: 'student', rawRole: 'student' };
const ghost: AuthUser = { id: 3, username: 'g', role: null, rawRole: null };

describe('authGuard', () => {
  it('passes when authenticated', () => {
    expect(runGuard(authGuard, admin)).toBe(true);
  });

  it('redirects to /login when unauthenticated', () => {
    const tree = runGuard(authGuard, null) as UrlTree;
    expect(tree).toBeInstanceOf(UrlTree);
    const router = TestBed.inject(Router);
    expect(router.serializeUrl(tree)).toBe('/login');
  });
});

describe('roleGuard', () => {
  it('passes when user role matches data.roles', () => {
    expect(runGuard(roleGuard, admin, { data: { roles: ['admin'] } })).toBe(true);
  });

  it('redirects to the user role home on mismatch (never generic 403)', () => {
    const tree = runGuard(roleGuard, student, { data: { roles: ['admin'] } }) as UrlTree;
    const router = TestBed.inject(Router);
    expect(router.serializeUrl(tree)).toBe('/grades');
  });

  it('redirects to /login when user has no qualifying role', () => {
    const tree = runGuard(roleGuard, ghost, { data: { roles: ['admin'] } }) as UrlTree;
    const router = TestBed.inject(Router);
    expect(router.serializeUrl(tree)).toBe('/login');
  });

  it('redirects to /login when unauthenticated', () => {
    const tree = runGuard(roleGuard, null, { data: { roles: ['admin'] } }) as UrlTree;
    const router = TestBed.inject(Router);
    expect(router.serializeUrl(tree)).toBe('/login');
  });
});

describe('loginRedirectGuard', () => {
  it('allows /login when unauthenticated', () => {
    expect(runGuard(loginRedirectGuard, null)).toBe(true);
  });

  it('sends authenticated users to their role home', () => {
    const tree = runGuard(loginRedirectGuard, admin) as UrlTree;
    const router = TestBed.inject(Router);
    expect(router.serializeUrl(tree)).toBe('/inscripciones');
  });
});
