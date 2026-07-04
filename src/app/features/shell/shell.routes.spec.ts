import { SHELL_ROUTES } from './shell.routes';

describe('SHELL_ROUTES', () => {
  it('exposes the enrollment list under the "inscripciones" path', () => {
    const route = SHELL_ROUTES.find((r) => r.path === 'inscripciones');
    expect(route).toBeDefined();
    expect(route?.data?.['roles']).toEqual(['admin', 'teacher']);
    expect(route?.loadComponent).toBeDefined();
  });

  it('no longer registers the retired "ciclo-actual" path', () => {
    const route = SHELL_ROUTES.find((r) => r.path === 'ciclo-actual');
    expect(route).toBeUndefined();
  });
});
