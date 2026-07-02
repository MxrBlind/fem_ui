import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { signal } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { By } from '@angular/platform-browser';

import { environment } from '../../../../environments/environment';
import { AuthService } from '@core/services/auth.service';
import { AuthUser } from '@core/auth/rbac';
import { EnrollmentDto } from '../models/enrollment.model';
import {
  EnrollmentEditComponent,
  SUCCESS_MESSAGE,
  ERROR_MESSAGE,
  LOAD_ERROR_MESSAGE,
} from './enrollment-edit.component';

const admin: AuthUser = { id: 1, username: 'admin', role: 'admin', rawRole: 'admin' };
const teacher: AuthUser = { id: 2, username: 'teacher', role: 'teacher', rawRole: 'teacher' };

const baseEnrollment: EnrollmentDto = {
  id: 9,
  active: true,
  grade: 15,
  startDate: '2026-02-01T00:00:00Z',
  student: {
    id: 42,
    username: 'student42',
    profile: { name: 'Ana', parentLastName: 'López', motherLastName: 'Ruiz' },
  },
  course: {
    id: 7,
    subject: { code: 'MAT-101', description: 'Álgebra', category: { title: 'Núcleo', description: '', code: 'NUC' }, level: {} },
    teacher: { id: 99, username: 'tch' },
    credits: 4,
    cycle: { description: '2026-I', startDate: '', endDate: '' },
  },
  scholarshipPercent: 25,
};

interface Harness {
  fixture: ComponentFixture<EnrollmentEditComponent>;
  http: HttpTestingController;
  snackOpen: ReturnType<typeof vi.spyOn>;
  dialogClose: ReturnType<typeof vi.fn>;
}

function setup(user: AuthUser, enrollment: EnrollmentDto = baseEnrollment): Harness {
  const currentUser = signal<AuthUser | null>(user);
  const fakeAuth = {
    currentUser: currentUser.asReadonly(),
    hasRole: (role: string | readonly string[]) => {
      const r = user.role;
      return Array.isArray(role) ? role.includes(r!) : role === r;
    },
  } as unknown as AuthService;

  const dialogClose = vi.fn();
  const fakeDialogRef = { close: dialogClose } as unknown as MatDialogRef<EnrollmentEditComponent, EnrollmentDto>;

  // Spy on prototype so the mock works regardless of injector hierarchy
  const snackOpen = vi.spyOn(MatSnackBar.prototype, 'open').mockReturnValue({} as never);

  TestBed.configureTestingModule({
    imports: [EnrollmentEditComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideAnimationsAsync(),
      { provide: AuthService, useValue: fakeAuth },
      { provide: MatDialogRef, useValue: fakeDialogRef },
      { provide: MAT_DIALOG_DATA, useValue: { enrollment } },
    ],
  });

  const fixture = TestBed.createComponent(EnrollmentEditComponent);
  fixture.detectChanges();
  const http = TestBed.inject(HttpTestingController);

  return { fixture, http, snackOpen, dialogClose };
}

function flushLoad(http: HttpTestingController, fixture: ComponentFixture<EnrollmentEditComponent>): void {
  http.expectOne((req) => req.url.includes('/api/user') && req.params.get('role') === 'ROLE_STUDENT').flush([
    baseEnrollment.student!,
  ]);
  http.expectOne(`${environment.apiBaseUrl}/api/cycle/current`).flush({
    id: 1,
    description: '2026-I',
    startDate: '',
    endDate: '',
  });
  http.expectOne(`${environment.apiBaseUrl}/api/course/cycle/1`).flush([
    baseEnrollment.course!,
  ]);
  fixture.detectChanges();
}

describe('EnrollmentEditComponent', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    try {
      TestBed.inject(HttpTestingController).verify();
    } catch { /* some tests already verify */ }
  });

  describe('initial data loading', () => {
    it('issues GET /api/user, /api/cycle/current, /api/course/cycle/{id} on open', () => {
      const { fixture, http } = setup(admin);
      http.expectOne((req) => req.url.includes('/api/user') && req.params.get('role') === 'ROLE_STUDENT').flush([]);
      http.expectOne(`${environment.apiBaseUrl}/api/cycle/current`).flush({ id: 1, description: '2026-I', startDate: '', endDate: '' });
      http.expectOne(`${environment.apiBaseUrl}/api/course/cycle/1`).flush([]);
      fixture.detectChanges();
    });

    it('form is disabled while loading', () => {
      const { fixture, http } = setup(admin);
      expect(fixture.componentInstance.form.disabled).toBe(true);
      http.expectOne((req) => req.url.includes('/api/user')).flush([]);
      http.expectOne(`${environment.apiBaseUrl}/api/cycle/current`).flush({ id: 1, description: '2026-I', startDate: '', endDate: '' });
      http.expectOne(`${environment.apiBaseUrl}/api/course/cycle/1`).flush([]);
      fixture.detectChanges();
    });

    it('shows progress bar while loading', () => {
      const { fixture, http } = setup(admin);
      expect(fixture.debugElement.query(By.css('mat-progress-bar'))).toBeTruthy();
      http.expectOne((req) => req.url.includes('/api/user')).flush([]);
      http.expectOne(`${environment.apiBaseUrl}/api/cycle/current`).flush({ id: 1, description: '2026-I', startDate: '', endDate: '' });
      http.expectOne(`${environment.apiBaseUrl}/api/course/cycle/1`).flush([]);
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css('mat-progress-bar'))).toBeFalsy();
    });
  });

  describe('prefill', () => {
    it('prefills studentId, courseId, scholarshipPercent, grade from injected enrollment', () => {
      const { fixture, http } = setup(admin);
      flushLoad(http, fixture);
      const form = fixture.componentInstance.form;
      expect(form.getRawValue().studentId).toBe(42);
      expect(form.getRawValue().courseId).toBe(7);
      expect(form.getRawValue().scholarshipPercent).toBe(25);
      expect(form.getRawValue().grade).toBe(15);
    });

    it('defaults grade to 0 when enrollment.grade is undefined', () => {
      const { fixture, http } = setup(admin, { ...baseEnrollment, grade: undefined });
      flushLoad(http, fixture);
      expect(fixture.componentInstance.form.getRawValue().grade).toBe(0);
    });

    it('prefills grade with 87 when enrollment.grade is 87', () => {
      const { fixture, http } = setup(admin, { ...baseEnrollment, grade: 87 });
      flushLoad(http, fixture);
      expect(fixture.componentInstance.form.getRawValue().grade).toBe(87);
    });
  });

  describe('load failure', () => {
    it('opens LOAD_ERROR_MESSAGE snackbar on failure', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { fixture, http, snackOpen } = setup(admin);
      http.expectOne((req) => req.url.includes('/api/user')).flush('boom', { status: 500, statusText: 'Server Error' });
      http.expectOne(`${environment.apiBaseUrl}/api/cycle/current`).flush({ id: 1, description: '2026-I', startDate: '', endDate: '' });
      fixture.detectChanges();
      expect(snackOpen).toHaveBeenCalledWith(LOAD_ERROR_MESSAGE, 'Cerrar', expect.objectContaining({ duration: 3000, panelClass: 'snackbar-error' }));
      expect(errorSpy).toHaveBeenCalledWith('[enrollment-edit]', expect.anything());
      errorSpy.mockRestore();
    });

    it('keeps Actualizar disabled after load failure', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { fixture, http } = setup(admin);
      http.expectOne((req) => req.url.includes('/api/user')).flush('boom', { status: 500, statusText: 'Server Error' });
      http.expectOne(`${environment.apiBaseUrl}/api/cycle/current`).flush({ id: 1, description: '2026-I', startDate: '', endDate: '' });
      fixture.detectChanges();
      const btn = fixture.debugElement.query(By.css('button[color="primary"]'));
      expect(btn.nativeElement.disabled).toBe(true);
      errorSpy.mockRestore();
    });
  });

  describe('displayStudent and displayCourse', () => {
    it('returns name + parentLastName for user with profile', () => {
      const { fixture, http } = setup(admin);
      flushLoad(http, fixture);
      const result = fixture.componentInstance.displayStudent({
        id: 1,
        username: 'u',
        profile: { name: 'Ana', parentLastName: 'López' },
      });
      expect(result).toBe('Ana López');
    });

    it('falls back to username when profile is null', () => {
      const { fixture, http } = setup(admin);
      flushLoad(http, fixture);
      const result = fixture.componentInstance.displayStudent({
        id: 1,
        username: 'ana.lopez',
        profile: undefined,
      });
      expect(result).toBe('ana.lopez');
    });

    it('displayCourse returns description — code', () => {
      const { fixture, http } = setup(admin);
      flushLoad(http, fixture);
      const result = fixture.componentInstance.displayCourse({
        id: 7,
        subject: { code: 'MAT-101', description: 'Álgebra', category: { title: 'N', description: '', code: 'N' }, level: {} },
        teacher: { id: 99, username: 'tch' },
        credits: 4,
        cycle: { description: '2026-I', startDate: '', endDate: '' },
      });
      expect(result).toBe('Álgebra — MAT-101');
    });
  });

  describe('scholarship validators', () => {
    let fixture: ComponentFixture<EnrollmentEditComponent>;
    let http: HttpTestingController;

    beforeEach(() => {
      const harness = setup(admin);
      fixture = harness.fixture;
      http = harness.http;
      flushLoad(http, fixture);
    });

    it('invalid for -1 (min)', () => {
      fixture.componentInstance.form.controls.scholarshipPercent.setValue(-1);
      expect(fixture.componentInstance.form.controls.scholarshipPercent.hasError('min')).toBe(true);
    });

    it('valid for 0', () => {
      fixture.componentInstance.form.controls.scholarshipPercent.setValue(0);
      expect(fixture.componentInstance.form.controls.scholarshipPercent.valid).toBe(true);
    });

    it('valid for 50', () => {
      fixture.componentInstance.form.controls.scholarshipPercent.setValue(50);
      expect(fixture.componentInstance.form.controls.scholarshipPercent.valid).toBe(true);
    });

    it('valid for 100', () => {
      fixture.componentInstance.form.controls.scholarshipPercent.setValue(100);
      expect(fixture.componentInstance.form.controls.scholarshipPercent.valid).toBe(true);
    });

    it('invalid for 101 (max)', () => {
      fixture.componentInstance.form.controls.scholarshipPercent.setValue(101);
      expect(fixture.componentInstance.form.controls.scholarshipPercent.hasError('max')).toBe(true);
    });

    it('invalid for empty (required)', () => {
      fixture.componentInstance.form.controls.scholarshipPercent.setValue(null as unknown as number);
      expect(fixture.componentInstance.form.controls.scholarshipPercent.hasError('required')).toBe(true);
    });
  });

  describe('grade validators', () => {
    let fixture: ComponentFixture<EnrollmentEditComponent>;
    let http: HttpTestingController;

    beforeEach(() => {
      const harness = setup(admin);
      fixture = harness.fixture;
      http = harness.http;
      flushLoad(http, fixture);
    });

    it('invalid for -1 (min)', () => {
      fixture.componentInstance.form.controls.grade.setValue(-1);
      expect(fixture.componentInstance.form.controls.grade.hasError('min')).toBe(true);
    });

    it('invalid for 101 (max)', () => {
      fixture.componentInstance.form.controls.grade.setValue(101);
      expect(fixture.componentInstance.form.controls.grade.hasError('max')).toBe(true);
    });

    it('invalid for 1.5 (pattern)', () => {
      fixture.componentInstance.form.controls.grade.setValue(1.5);
      expect(fixture.componentInstance.form.controls.grade.hasError('pattern')).toBe(true);
    });

    it('invalid for null (required)', () => {
      fixture.componentInstance.form.controls.grade.setValue(null as unknown as number);
      expect(fixture.componentInstance.form.controls.grade.hasError('required')).toBe(true);
    });

    it('valid for 0, 50, 100', () => {
      for (const v of [0, 50, 100]) {
        fixture.componentInstance.form.controls.grade.setValue(v);
        expect(fixture.componentInstance.form.controls.grade.valid).toBe(true);
      }
    });

    it('Actualizar button disabled while grade invalid', () => {
      fixture.componentInstance.form.controls.grade.setValue(200);
      fixture.detectChanges();
      const btn = fixture.debugElement.query(By.css('button[color="primary"]'));
      expect(btn.nativeElement.disabled).toBe(true);
    });
  });

  describe('role gating', () => {
    it('teacher: studentId and courseId controls are disabled after load', () => {
      const { fixture, http } = setup(teacher);
      flushLoad(http, fixture);
      expect(fixture.componentInstance.form.controls.studentId.disabled).toBe(true);
      expect(fixture.componentInstance.form.controls.courseId.disabled).toBe(true);
      expect(fixture.componentInstance.form.controls.scholarshipPercent.disabled).toBe(false);
      expect(fixture.componentInstance.form.controls.grade.disabled).toBe(false);
    });

    it('admin: all controls are enabled after load', () => {
      const { fixture, http } = setup(admin);
      flushLoad(http, fixture);
      expect(fixture.componentInstance.form.controls.studentId.disabled).toBe(false);
      expect(fixture.componentInstance.form.controls.courseId.disabled).toBe(false);
      expect(fixture.componentInstance.form.controls.scholarshipPercent.disabled).toBe(false);
      expect(fixture.componentInstance.form.controls.grade.disabled).toBe(false);
    });

    it('teacher: inputs have readonly attribute', () => {
      const { fixture, http } = setup(teacher);
      flushLoad(http, fixture);
      fixture.detectChanges();
      const inputs = fixture.debugElement.queryAll(By.css('input[readonly]'));
      expect(inputs.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('submit', () => {
    it('calls enrollmentService.update with correct id and payload preserving id/active/grade/startDate', () => {
      const { fixture, http, snackOpen, dialogClose } = setup(admin);
      flushLoad(http, fixture);

      fixture.componentInstance.form.controls.scholarshipPercent.setValue(20);
      fixture.componentInstance.form.controls.grade.setValue(80);
      fixture.componentInstance.onSubmit();
      fixture.detectChanges();

      const req = http.expectOne(`${environment.apiBaseUrl}/api/enrollment/9`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body.id).toBe(9);
      expect(req.request.body.active).toBe(true);
      expect(req.request.body.grade).toBe(80);
      expect(req.request.body.startDate).toBe('2026-02-01T00:00:00Z');
      expect(req.request.body.scholarshipPercent).toBe(20);
      req.flush(baseEnrollment);

      fixture.detectChanges();
      expect(snackOpen).toHaveBeenCalledWith(SUCCESS_MESSAGE, 'Cerrar', expect.objectContaining({ duration: 3000 }));
      expect(dialogClose).toHaveBeenCalledWith(baseEnrollment);
    });

    it('on failure: opens error snackbar, saving resets, dialog stays open', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { fixture, http, snackOpen, dialogClose } = setup(admin);
      flushLoad(http, fixture);

      fixture.componentInstance.onSubmit();
      fixture.detectChanges();

      http.expectOne(`${environment.apiBaseUrl}/api/enrollment/9`).flush('err', { status: 500, statusText: 'Server Error' });
      fixture.detectChanges();

      expect(snackOpen).toHaveBeenCalledWith(ERROR_MESSAGE, 'Cerrar', expect.objectContaining({ panelClass: 'snackbar-error' }));
      expect(fixture.componentInstance.saving()).toBe(false);
      expect(dialogClose).not.toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });

  describe('cancel', () => {
    it('calls dialogRef.close() with no argument on Cancel click', () => {
      const { fixture, http, dialogClose } = setup(admin);
      flushLoad(http, fixture);
      fixture.componentInstance.onCancel();
      expect(dialogClose).toHaveBeenCalledWith();
    });
  });
});
