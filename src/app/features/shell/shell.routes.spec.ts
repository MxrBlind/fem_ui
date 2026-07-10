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
});
