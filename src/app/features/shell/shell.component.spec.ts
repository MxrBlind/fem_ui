import { vi } from 'vitest';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

import { AuthService } from '../../core/services/auth.service';
import { AuthUser } from '../../core/auth/rbac';
import { ShellComponent } from './shell.component';

const admin: AuthUser = { id: 1, username: 'admin_user', role: 'admin', rawRole: 'admin' };
const teacher: AuthUser = { id: 2, username: 'teacher_user', role: 'teacher', rawRole: 'teacher' };
const student: AuthUser = { id: 3, username: 'student_user', role: 'student', rawRole: 'student' };

function setup(user: AuthUser | null) {
  const currentUser = signal<AuthUser | null>(user);
  const logoutSpy = vi.fn();
  const fakeAuth = {
    currentUser: currentUser.asReadonly(),
    logout: logoutSpy,
  } as unknown as AuthService;

  TestBed.configureTestingModule({
    imports: [ShellComponent],
    providers: [
      { provide: AuthService, useValue: fakeAuth },
      provideRouter([]),
      provideAnimationsAsync(),
    ],
  });

  const fixture: ComponentFixture<ShellComponent> = TestBed.createComponent(ShellComponent);
  fixture.detectChanges();
  (fixture as ComponentFixture<ShellComponent> & {
    logoutSpy: ReturnType<typeof vi.fn>;
  }).logoutSpy = logoutSpy;
  return fixture;
}

function q(fixture: ComponentFixture<ShellComponent>, selector: string): HTMLElement | null {
  return fixture.nativeElement.querySelector(selector);
}

function qAll(fixture: ComponentFixture<ShellComponent>, selector: string): NodeListOf<HTMLElement> {
  return fixture.nativeElement.querySelectorAll(selector);
}

function textVisible(fixture: ComponentFixture<ShellComponent>, text: string): boolean {
  return (fixture.nativeElement as HTMLElement).textContent?.includes(text) ?? false;
}

describe('ShellComponent', () => {
  it('1.2 creates successfully', () => {
    const fixture = setup(admin);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('1.3 toolbar displays site title "FEM - Control escolar"', () => {
    const fixture = setup(admin);
    expect(textVisible(fixture, 'FEM - Control escolar')).toBe(true);
  });

  it('1.4 toolbar displays authenticated user username', () => {
    const fixture = setup(admin);
    expect(textVisible(fixture, 'admin_user')).toBe(true);
  });

  it('1.5 hamburger toggle flips sidenavOpen from true to false', () => {
    const fixture = setup(admin);
    expect(fixture.componentInstance.sidenavOpen()).toBe(true);
    fixture.componentInstance.toggleSidenav();
    expect(fixture.componentInstance.sidenavOpen()).toBe(false);
  });

  it('1.6 hamburger toggle flips sidenavOpen from false to true', () => {
    const fixture = setup(admin);
    fixture.componentInstance.toggleSidenav();
    fixture.componentInstance.toggleSidenav();
    expect(fixture.componentInstance.sidenavOpen()).toBe(true);
  });

  describe('"Ciclo escolar" section visibility', () => {
    it('1.7 visible for admin', () => {
      const fixture = setup(admin);
      expect(textVisible(fixture, 'Ciclo escolar')).toBe(true);
    });

    it('1.8 visible for teacher', () => {
      const fixture = setup(teacher);
      expect(textVisible(fixture, 'Ciclo escolar')).toBe(true);
    });

    it('1.9 visible for student', () => {
      const fixture = setup(student);
      expect(textVisible(fixture, 'Ciclo escolar')).toBe(true);
    });
  });

  describe('"Ciclo actual" link', () => {
    it('1.10a visible for admin and routes to /ciclo-actual', () => {
      const fixture = setup(admin);
      expect(textVisible(fixture, 'Ciclo actual')).toBe(true);
      const link = Array.from(qAll(fixture, 'a[mat-list-item]')).find((el) =>
        (el.textContent ?? '').includes('Ciclo actual')
      );
      expect(link?.getAttribute('href')).toBe('/ciclo-actual');
    });

    it('1.10b absent for teacher', () => {
      const fixture = setup(teacher);
      expect(textVisible(fixture, 'Ciclo actual')).toBe(false);
    });

    it('1.10c absent for student', () => {
      const fixture = setup(student);
      expect(textVisible(fixture, 'Ciclo actual')).toBe(false);
    });
  });

  describe('"Inscripciones" link', () => {
    it('1.11a visible for admin and routes to /inscripciones', () => {
      const fixture = setup(admin);
      expect(textVisible(fixture, 'Inscripciones')).toBe(true);
      const link = Array.from(qAll(fixture, 'a[mat-list-item]')).find((el) =>
        (el.textContent ?? '').includes('Inscripciones')
      );
      expect(link?.getAttribute('href')).toBe('/inscripciones');
    });

    it('1.11b visible for teacher and routes to /inscripciones', () => {
      const fixture = setup(teacher);
      expect(textVisible(fixture, 'Inscripciones')).toBe(true);
      const link = Array.from(qAll(fixture, 'a[mat-list-item]')).find((el) =>
        (el.textContent ?? '').includes('Inscripciones')
      );
      expect(link?.getAttribute('href')).toBe('/inscripciones');
    });

    it('1.11c absent for student', () => {
      const fixture = setup(student);
      expect(textVisible(fixture, 'Inscripciones')).toBe(false);
    });
  });

  describe('"Calificaciones" link', () => {
    it('1.12a visible for student and routes to /grades', () => {
      const fixture = setup(student);
      expect(textVisible(fixture, 'Calificaciones')).toBe(true);
      const link = Array.from(qAll(fixture, 'a[mat-list-item]')).find((el) =>
        (el.textContent ?? '').includes('Calificaciones')
      );
      expect(link?.getAttribute('href')).toBe('/grades');
    });

    it('1.12b absent for admin', () => {
      const fixture = setup(admin);
      expect(textVisible(fixture, 'Calificaciones')).toBe(false);
    });

    it('1.12c absent for teacher', () => {
      const fixture = setup(teacher);
      expect(textVisible(fixture, 'Calificaciones')).toBe(false);
    });
  });

  describe('"Catálogos" section', () => {
    it('1.13a visible for admin with all links', () => {
      const fixture = setup(admin);
      expect(textVisible(fixture, 'Catálogos')).toBe(true);
      expect(textVisible(fixture, 'Maestros')).toBe(true);
      expect(textVisible(fixture, 'Estudiantes')).toBe(true);
      expect(textVisible(fixture, 'Materias')).toBe(true);
    });

    it('1.13d "Maestros" links to /teachers with routerLinkActive', () => {
      const fixture = setup(admin);
      const links = Array.from(qAll(fixture, 'a[mat-list-item]')) as HTMLAnchorElement[];
      const maestros = links.find((el) => (el.textContent ?? '').trim().includes('Maestros'));
      expect(maestros).toBeTruthy();
      expect(maestros!.getAttribute('href')).toBe('/teachers');
    });

    it('1.13e "Estudiantes" links to /students with routerLinkActive', () => {
      const fixture = setup(admin);
      const links = Array.from(qAll(fixture, 'a[mat-list-item]')) as HTMLAnchorElement[];
      const estudiantes = links.find((el) =>
        (el.textContent ?? '').trim().includes('Estudiantes')
      );
      expect(estudiantes).toBeTruthy();
      expect(estudiantes!.getAttribute('href')).toBe('/students');
    });

    it('1.13f "Materias" links to /subjects with routerLinkActive', () => {
      const fixture = setup(admin);
      const links = Array.from(qAll(fixture, 'a[mat-list-item]')) as HTMLAnchorElement[];
      const materias = links.find((el) =>
        (el.textContent ?? '').trim().includes('Materias')
      );
      expect(materias).toBeTruthy();
      expect(materias!.getAttribute('href')).toBe('/subjects');
    });

    it('1.13b absent for teacher', () => {
      const fixture = setup(teacher);
      expect(textVisible(fixture, 'Catálogos')).toBe(false);
    });

    it('1.13c absent for student', () => {
      const fixture = setup(student);
      expect(textVisible(fixture, 'Catálogos')).toBe(false);
    });
  });

  it('1.14 router-outlet is present inside mat-sidenav-content', () => {
    const fixture = setup(admin);
    const content = q(fixture, 'mat-sidenav-content');
    expect(content).toBeTruthy();
    expect(content!.querySelector('router-outlet')).toBeTruthy();
  });

  describe('Logout flow (FEM-15)', () => {
    function openProfileMenu(fixture: ComponentFixture<ShellComponent>): void {
      const trigger = Array.from(qAll(fixture, 'button')).find(
        (el) => el.getAttribute('aria-label') === 'User profile menu',
      );
      trigger!.click();
      fixture.detectChanges();
    }

    function findMenuItem(text: string): HTMLElement | undefined {
      return Array.from(
        document.querySelectorAll<HTMLElement>('button.mat-mdc-menu-item'),
      ).find((el) => (el.textContent ?? '').includes(text));
    }

    afterEach(() => {
      document
        .querySelectorAll('.cdk-overlay-container')
        .forEach((el) => el.remove());
    });

    it('3.2 clicking Salir calls AuthService.logout exactly once', () => {
      const fixture = setup(admin);
      const spy = (fixture as ComponentFixture<ShellComponent> & {
        logoutSpy: ReturnType<typeof vi.fn>;
      }).logoutSpy;
      vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

      openProfileMenu(fixture);
      findMenuItem('Salir')!.click();

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('3.3 after clicking Salir, Router.navigate is called with ["/login"]', () => {
      const fixture = setup(admin);
      const router = TestBed.inject(Router);
      const navSpy = vi
        .spyOn(router, 'navigate')
        .mockResolvedValue(true);

      openProfileMenu(fixture);
      findMenuItem('Salir')!.click();

      expect(navSpy).toHaveBeenCalledWith(['/login']);
    });

    it('3.4 activating Salir via keyboard triggers the same handler', () => {
      const fixture = setup(admin);
      const spy = (fixture as ComponentFixture<ShellComponent> & {
        logoutSpy: ReturnType<typeof vi.fn>;
      }).logoutSpy;
      const router = TestBed.inject(Router);
      vi.spyOn(router, 'navigate').mockResolvedValue(true);

      fixture.componentInstance.logout();

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('3.5 Salir button exposes aria-label="Cerrar sesión" in the DOM', () => {
      const fixture = setup(admin);

      openProfileMenu(fixture);
      const salir = findMenuItem('Salir');

      expect(salir).toBeTruthy();
      expect(salir!.getAttribute('aria-label')).toBe('Cerrar sesión');
    });

    it('3.6 Mi perfil click routes through onProfileAction("perfil") and navigates to /mi-perfil', () => {
      const fixture = setup(admin);
      const router = TestBed.inject(Router);
      const navSpy = vi
        .spyOn(router, 'navigate')
        .mockResolvedValue(true);
      const onProfileActionSpy = vi.spyOn(
        fixture.componentInstance,
        'onProfileAction',
      );

      openProfileMenu(fixture);
      findMenuItem('Mi perfil')!.click();

      expect(onProfileActionSpy).toHaveBeenCalledWith('perfil');
      expect(navSpy).toHaveBeenCalledWith(['/mi-perfil']);
    });
  });
});
