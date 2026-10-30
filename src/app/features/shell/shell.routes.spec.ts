import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Route, Router, UrlSegment, UrlTree, provideRouter } from '@angular/router';

import { roleGuard } from '@core/auth/auth.guards';
import { AuthUser } from '@core/auth/rbac';
import { AuthService } from '@core/services/auth.service';
import { ReportBuilderComponent } from '../reports/report-builder/report-builder.component';
import { SelfEnrollmentComponent } from '../self-enrollment/self-enrollment/self-enrollment.component';
import { SHELL_ROUTES } from './shell.routes';

describe('SHELL_ROUTES', () => {
  it('exposes the enrollment list under the "inscripciones" path', () => {
    const route = SHELL_ROUTES.find((r) => r.path === 'inscripciones');
    expect(route).toBeDefined();
    expect(route?.data?.['roles']).toEqual(['admin', 'teacher']);
    expect(route?.loadComponent).toBeDefined();
  });

  it('exposes the current-cycle list under the "ciclo-actual" path, admin-only', () => {
    const route = SHELL_ROUTES.find((r) => r.path === 'ciclo-actual');
    expect(route).toBeDefined();
    expect(route?.data?.['roles']).toEqual(['admin']);
    expect(route?.loadComponent).toBeDefined();
  });

  it('exposes the teacher list under the "teachers" path, admin-only', () => {
    const route = SHELL_ROUTES.find((r) => r.path === 'teachers');
    expect(route).toBeDefined();
    expect(route?.data?.['roles']).toEqual(['admin']);
    expect(route?.loadComponent).toBeDefined();
    expect(route?.canMatch?.length).toBeGreaterThan(0);
  });

  it('exposes the student list under the "students" path, admin-only', () => {
    const route = SHELL_ROUTES.find((r) => r.path === 'students');
    expect(route).toBeDefined();
    expect(route?.data?.['roles']).toEqual(['admin']);
    expect(route?.loadComponent).toBeDefined();
    expect(route?.canMatch?.length).toBeGreaterThan(0);
  });

  it('exposes the self-enrollment page under the "preinscripciones" path, student-only', async () => {
    const route = SHELL_ROUTES.find((r) => r.path === 'preinscripciones');
    expect(route).toBeDefined();
    expect(route?.data?.['roles']).toEqual(['student']);
    expect(route?.canMatch).toEqual([roleGuard]);
    const loaded = await (route?.loadComponent as () => Promise<unknown>)();
    expect(loaded).toBe(SelfEnrollmentComponent);
  });

  describe('"reportes" path', () => {
    const admin: AuthUser = { id: 1, username: 'a', role: 'admin', rawRole: 'admin' };
    const teacher: AuthUser = { id: 2, username: 't', role: 'teacher', rawRole: 'teacher' };
    const student: AuthUser = { id: 3, username: 's', role: 'student', rawRole: 'student' };

    function runCanMatch(user: AuthUser | null): boolean | UrlTree {
      const route = SHELL_ROUTES.find((r) => r.path === 'reportes') as Route;
      TestBed.configureTestingModule({
        providers: [
          provideRouter([]),
          { provide: AuthService, useValue: { currentUser: signal(user).asReadonly() } },
        ],
      });
      const guard = route.canMatch?.[0] as (route: Route, segments: UrlSegment[]) => boolean | UrlTree;
      return TestBed.runInInjectionContext(() => guard(route, []));
    }

    it('is admin-only, guarded by roleGuard and lazy loads the report builder', async () => {
      const route = SHELL_ROUTES.find((r) => r.path === 'reportes');
      expect(route).toBeDefined();
      expect(route?.data?.['roles']).toEqual(['admin']);
      expect(route?.canMatch).toEqual([roleGuard]);
      const loaded = await (route?.loadComponent as () => Promise<unknown>)();
      expect(loaded).toBe(ReportBuilderComponent);
    });

    it('matches for an admin', () => {
      expect(runCanMatch(admin)).toBe(true);
    });

    it.each([
      ['teacher', teacher],
      ['student', student],
    ])('does not match for a %s, who is redirected to their home', (_label, user) => {
      const result = runCanMatch(user);

      expect(result).toBeInstanceOf(UrlTree);
      expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).not.toBe('/reportes');
    });

    it('does not match for an unauthenticated user, who is sent to /login', () => {
      const result = runCanMatch(null) as UrlTree;

      expect(TestBed.inject(Router).serializeUrl(result)).toBe('/login');
    });
  });
});
