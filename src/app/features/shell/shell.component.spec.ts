import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

import { AuthService } from '../../core/services/auth.service';
import { AuthUser } from '../../core/auth/rbac';
import { ShellComponent } from './shell.component';

const admin: AuthUser = { id: 1, username: 'admin_user', role: 'admin', rawRole: 'admin' };
const teacher: AuthUser = { id: 2, username: 'teacher_user', role: 'teacher', rawRole: 'teacher' };
const student: AuthUser = { id: 3, username: 'student_user', role: 'student', rawRole: 'student' };

function setup(user: AuthUser | null) {
  const currentUser = signal<AuthUser | null>(user);
  const fakeAuth = { currentUser: currentUser.asReadonly() } as unknown as AuthService;

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
    it('1.10a visible for admin', () => {
      const fixture = setup(admin);
      expect(textVisible(fixture, 'Ciclo actual')).toBe(true);
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
    it('1.11a visible for admin', () => {
      const fixture = setup(admin);
      expect(textVisible(fixture, 'Inscripciones')).toBe(true);
    });

    it('1.11b visible for teacher', () => {
      const fixture = setup(teacher);
      expect(textVisible(fixture, 'Inscripciones')).toBe(true);
    });

    it('1.11c absent for student', () => {
      const fixture = setup(student);
      expect(textVisible(fixture, 'Inscripciones')).toBe(false);
    });
  });

  describe('"Calificaciones" link', () => {
    it('1.12a visible for student', () => {
      const fixture = setup(student);
      expect(textVisible(fixture, 'Calificaciones')).toBe(true);
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
});
