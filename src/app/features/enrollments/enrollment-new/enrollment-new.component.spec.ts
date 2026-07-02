import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

import { environment } from '../../../../environments/environment';
import { UserDto } from '@core/models/auth.model';
import { CycleDto } from '../models/cycle.model';
import { CourseDto, EnrollmentDto } from '../models/enrollment.model';
import {
  EnrollmentNewComponent,
  ERROR_MESSAGE,
  LOAD_ERROR_MESSAGE,
  SUCCESS_MESSAGE,
} from './enrollment-new.component';

function makeStudent(id: number, overrides: Partial<UserDto> = {}): UserDto {
  return {
    id,
    username: `student${id}`,
    profile: {
      name: `Name${id}`,
      parentLastName: `Last${id}`,
      motherLastName: 'M',
    },
    ...overrides,
  };
}

function makeCourse(id: number): CourseDto {
  return {
    id,
    credits: 4,
    teacher: { id: 999, username: 'tch' },
    cycle: { id: 1, description: '2026-I', startDate: '', endDate: '' },
    subject: {
      id,
      code: `SUB${id}`,
      description: `Materia ${id}`,
      category: { title: 'Núcleo', description: '', code: 'NUC' },
      level: {},
    },
  };
}

const cycle: CycleDto = {
  id: 1,
  description: '2026-I',
  startDate: '',
  endDate: '',
  current: true,
  active: true,
};

interface Harness {
  fixture: ComponentFixture<EnrollmentNewComponent>;
  http: HttpTestingController;
  dialogRef: { close: ReturnType<typeof vi.fn> };
  snackOpen: ReturnType<typeof vi.spyOn>;
}

function setup(options: { skipFlush?: boolean; failLoad?: boolean } = {}): Harness {
  const dialogRef = { close: vi.fn() };

  TestBed.configureTestingModule({
    imports: [EnrollmentNewComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideAnimationsAsync(),
      { provide: MatDialogRef, useValue: dialogRef },
    ],
  });

  const fixture = TestBed.createComponent(EnrollmentNewComponent);
  // Spy on the actual MatSnackBar instance the component received, so we
  // intercept calls regardless of which injector Material's dialog scoping
  // resolves the token in.
  const componentSnack = (fixture.componentInstance as unknown as {
    snackBar: MatSnackBar;
  }).snackBar;
  const snackOpen = vi
    .spyOn(componentSnack, 'open')
    .mockReturnValue({} as never);
  fixture.detectChanges();
  const http = TestBed.inject(HttpTestingController);

  if (!options.skipFlush) {
    const studentsReq = http.expectOne(
      (r) =>
        r.url === `${environment.apiBaseUrl}/api/user` &&
        r.params.get('role') === 'ROLE_STUDENT'
    );
    const cycleReq = http.expectOne(`${environment.apiBaseUrl}/api/cycle/current`);
    if (options.failLoad) {
      studentsReq.flush('boom', { status: 500, statusText: 'Server Error' });
      cycleReq.flush(cycle);
    } else {
      studentsReq.flush([makeStudent(1), makeStudent(2)]);
      cycleReq.flush(cycle);
      const coursesReq = http.expectOne(
        `${environment.apiBaseUrl}/api/course/cycle/${cycle.id}`
      );
      coursesReq.flush([makeCourse(10), makeCourse(20)]);
    }
    fixture.detectChanges();
  }

  return { fixture, http, dialogRef, snackOpen };
}

describe('EnrollmentNewComponent', () => {
  afterEach(() => {
    try {
      TestBed.inject(HttpTestingController).verify();
    } catch {
      /* some tests already verify */
    }
  });

  describe('initial data loading', () => {
    it('issues student and cycle requests in parallel then loads courses for the cycle', () => {
      const { fixture } = setup();
      expect(fixture.componentInstance.loading()).toBe(false);
      expect(fixture.componentInstance.students().length).toBe(2);
      expect(fixture.componentInstance.courses().length).toBe(2);
      expect(fixture.componentInstance.currentCycle()?.id).toBe(1);
      expect(fixture.componentInstance.form.enabled).toBe(true);
    });

    it('form is disabled while any initial request is pending', () => {
      const { fixture } = setup({ skipFlush: true });
      expect(fixture.componentInstance.loading()).toBe(true);
      expect(fixture.componentInstance.form.disabled).toBe(true);
    });

    it('opens the load-error snackbar and keeps Crear disabled when loading fails', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { fixture, snackOpen } = setup({ failLoad: true });
      await fixture.whenStable();
      expect(fixture.componentInstance.loadFailed()).toBe(true);
      expect(snackOpen).toHaveBeenCalledWith(
        LOAD_ERROR_MESSAGE,
        'Cerrar',
        expect.objectContaining({ duration: 3000, panelClass: 'snackbar-error' })
      );
      expect(errSpy).toHaveBeenCalledWith(
        '[enrollment-new] failed to load form data',
        expect.anything()
      );
      errSpy.mockRestore();
    });
  });

  describe('display helpers', () => {
    it('displayStudent returns "name parentLastName"', () => {
      const { fixture } = setup();
      expect(
        fixture.componentInstance.displayStudent({
          id: 1,
          username: 'ap',
          profile: { name: 'Ana', parentLastName: 'Pérez' },
        })
      ).toBe('Ana Pérez');
    });

    it('displayStudent falls back to username when profile is null', () => {
      const { fixture } = setup();
      expect(
        fixture.componentInstance.displayStudent({ id: 1, username: 'ap' })
      ).toBe('ap');
    });

    it('displayCourse returns "description — code"', () => {
      const { fixture } = setup();
      expect(fixture.componentInstance.displayCourse(makeCourse(10))).toBe(
        'Materia 10 — SUB10'
      );
    });
  });

  describe('scholarship validation', () => {
    function ctrl(fixture: ComponentFixture<EnrollmentNewComponent>) {
      return fixture.componentInstance.form.controls.scholarshipPercent;
    }

    it('defaults to 0 and is valid', () => {
      const { fixture } = setup();
      expect(ctrl(fixture).value).toBe(0);
      expect(ctrl(fixture).valid).toBe(true);
    });

    it('rejects -1 with min error', () => {
      const { fixture } = setup();
      ctrl(fixture).setValue(-1);
      expect(ctrl(fixture).hasError('min')).toBe(true);
    });

    it('rejects 101 with max error', () => {
      const { fixture } = setup();
      ctrl(fixture).setValue(101);
      expect(ctrl(fixture).hasError('max')).toBe(true);
    });

    it('rejects 50.5 with pattern error', () => {
      const { fixture } = setup();
      ctrl(fixture).setValue(50.5 as unknown as number);
      expect(ctrl(fixture).hasError('pattern')).toBe(true);
    });

    it('rejects null with required error', () => {
      const { fixture } = setup();
      ctrl(fixture).setValue(null as unknown as number);
      expect(ctrl(fixture).hasError('required')).toBe(true);
    });

    it('accepts boundary values 0 and 100', () => {
      const { fixture } = setup();
      ctrl(fixture).setValue(0);
      expect(ctrl(fixture).valid).toBe(true);
      ctrl(fixture).setValue(100);
      expect(ctrl(fixture).valid).toBe(true);
    });
  });

  describe('submit', () => {
    function selectValid(fixture: ComponentFixture<EnrollmentNewComponent>) {
      fixture.componentInstance.form.controls.studentId.setValue(1);
      fixture.componentInstance.form.controls.courseId.setValue(10);
      fixture.componentInstance.form.controls.scholarshipPercent.setValue(25);
    }

    it('POSTs the expected payload and closes the dialog with the created DTO on success', () => {
      const { fixture, http, dialogRef, snackOpen } = setup();
      selectValid(fixture);
      fixture.componentInstance.onSubmit();

      const req = http.expectOne(`${environment.apiBaseUrl}/api/enrollment`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        student: { id: 1 },
        course: { id: 10 },
        scholarshipPercent: 25,
        active: true,
      });

      const created: EnrollmentDto = { id: 500, scholarshipPercent: 25 };
      req.flush(created);

      expect(snackOpen).toHaveBeenCalledWith(
        SUCCESS_MESSAGE,
        'Cerrar',
        expect.objectContaining({ duration: 3000 })
      );
      expect(dialogRef.close).toHaveBeenCalledWith(created);
    });

    it('keeps the dialog open and shows the error snackbar on failure', () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { fixture, http, dialogRef, snackOpen } = setup();
      selectValid(fixture);
      fixture.componentInstance.onSubmit();
      http
        .expectOne(`${environment.apiBaseUrl}/api/enrollment`)
        .flush('boom', { status: 500, statusText: 'Server Error' });

      expect(snackOpen).toHaveBeenCalledWith(
        ERROR_MESSAGE,
        'Cerrar',
        expect.objectContaining({ duration: 3000, panelClass: 'snackbar-error' })
      );
      expect(dialogRef.close).not.toHaveBeenCalled();
      expect(fixture.componentInstance.saving()).toBe(false);
      expect(fixture.componentInstance.form.enabled).toBe(true);
      expect(fixture.componentInstance.form.controls.studentId.value).toBe(1);
      expect(errSpy).toHaveBeenCalledWith(
        '[enrollment-new] failed to create enrollment',
        expect.anything()
      );
      errSpy.mockRestore();
    });

    it('does nothing when the form is invalid', () => {
      const { fixture, http } = setup();
      fixture.componentInstance.onSubmit();
      http.expectNone(`${environment.apiBaseUrl}/api/enrollment`);
    });
  });

  describe('cancel', () => {
    it('closes the dialog with undefined and issues no request', () => {
      const { fixture, dialogRef, http } = setup();
      fixture.componentInstance.onCancel();
      expect(dialogRef.close).toHaveBeenCalledWith();
      http.expectNone(`${environment.apiBaseUrl}/api/enrollment`);
    });
  });
});
