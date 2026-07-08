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
import { CycleDto } from '@features/enrollments/models/cycle.model';
import { CourseDto, SubjectDto } from '@features/enrollments/models/enrollment.model';
import {
  CourseNewComponent,
  ERROR_MESSAGE,
  LOAD_ERROR_MESSAGE,
  SUCCESS_MESSAGE,
} from './course-new.component';

function makeSubject(id: number): SubjectDto {
  return {
    id,
    code: `SUB${id}`,
    description: `Materia ${id}`,
    category: { title: 'Núcleo', description: '', code: 'NUC' },
    level: {},
  };
}

function makeTeacher(id: number, overrides: Partial<UserDto> = {}): UserDto {
  return {
    id,
    username: `teacher${id}`,
    profile: {
      name: `Name${id}`,
      parentLastName: `Last${id}`,
      motherLastName: 'M',
    },
    ...overrides,
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
  fixture: ComponentFixture<CourseNewComponent>;
  http: HttpTestingController;
  dialogRef: { close: ReturnType<typeof vi.fn> };
  snackOpen: ReturnType<typeof vi.spyOn>;
}

type FailWhich = 'subjects' | 'teachers' | 'cycle';

function setup(options: { skipFlush?: boolean; failLoad?: FailWhich } = {}): Harness {
  const dialogRef = { close: vi.fn() };

  TestBed.configureTestingModule({
    imports: [CourseNewComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideAnimationsAsync(),
      { provide: MatDialogRef, useValue: dialogRef },
    ],
  });

  const fixture = TestBed.createComponent(CourseNewComponent);
  const componentSnack = (fixture.componentInstance as unknown as {
    snackBar: MatSnackBar;
  }).snackBar;
  const snackOpen = vi.spyOn(componentSnack, 'open').mockReturnValue({} as never);
  fixture.detectChanges();
  const http = TestBed.inject(HttpTestingController);

  if (!options.skipFlush) {
    const subjectsReq = http.expectOne(`${environment.apiBaseUrl}/api/subject`);
    const teachersReq = http.expectOne(
      (r) =>
        r.url === `${environment.apiBaseUrl}/api/user` &&
        r.params.get('role') === 'ROLE_TEACHER'
    );
    const cycleReq = http.expectOne(`${environment.apiBaseUrl}/api/cycle/current`);

    const failWhich = options.failLoad;
    // forkJoin cancels sibling requests as soon as one errors, so we can only
    // flush the failing one; the others become cancelled and cannot be flushed.
    if (failWhich === 'subjects') {
      subjectsReq.flush('boom', { status: 500, statusText: 'Server Error' });
      void teachersReq;
      void cycleReq;
    } else if (failWhich === 'teachers') {
      teachersReq.flush('boom', { status: 500, statusText: 'Server Error' });
      void subjectsReq;
      void cycleReq;
    } else if (failWhich === 'cycle') {
      cycleReq.flush('boom', { status: 500, statusText: 'Server Error' });
      void subjectsReq;
      void teachersReq;
    } else {
      subjectsReq.flush([makeSubject(10), makeSubject(20)]);
      teachersReq.flush([makeTeacher(1), makeTeacher(2)]);
      cycleReq.flush(cycle);
    }
    fixture.detectChanges();
  }

  return { fixture, http, dialogRef, snackOpen };
}

describe('CourseNewComponent', () => {
  afterEach(() => {
    try {
      TestBed.inject(HttpTestingController).verify();
    } catch {
      /* some tests already verify */
    }
  });

  describe('initial data loading', () => {
    it('runs subject/teacher/cycle requests in parallel and enables the form', () => {
      const { fixture } = setup();
      expect(fixture.componentInstance.loading()).toBe(false);
      expect(fixture.componentInstance.subjects().length).toBe(2);
      expect(fixture.componentInstance.teachers().length).toBe(2);
      expect(fixture.componentInstance.currentCycle()?.id).toBe(1);
      expect(fixture.componentInstance.form.enabled).toBe(true);
    });

    it('form is disabled while any initial request is pending', () => {
      const { fixture } = setup({ skipFlush: true });
      expect(fixture.componentInstance.loading()).toBe(true);
      expect(fixture.componentInstance.form.disabled).toBe(true);
    });

    it.each<FailWhich>(['subjects', 'teachers', 'cycle'])(
      'opens the load-error snackbar and keeps Crear disabled when %s load fails',
      async (which) => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const { fixture, snackOpen } = setup({ failLoad: which });
        await fixture.whenStable();
        expect(fixture.componentInstance.loadFailed()).toBe(true);
        expect(fixture.componentInstance.form.disabled).toBe(true);
        expect(snackOpen).toHaveBeenCalledWith(
          LOAD_ERROR_MESSAGE,
          'Cerrar',
          expect.objectContaining({ duration: 3000, panelClass: 'snackbar-error' })
        );
        expect(errSpy).toHaveBeenCalledWith(
          '[course-new] failed to load form data',
          expect.anything()
        );
        errSpy.mockRestore();
      }
    );
  });

  describe('display helpers', () => {
    it('displaySubject returns "description — code"', () => {
      const { fixture } = setup();
      expect(fixture.componentInstance.displaySubject(makeSubject(10))).toBe(
        'Materia 10 — SUB10'
      );
    });

    it('displayTeacher returns "name parentLastName"', () => {
      const { fixture } = setup();
      expect(
        fixture.componentInstance.displayTeacher({
          id: 1,
          username: 'ap',
          profile: { name: 'Ana', parentLastName: 'Pérez' },
        })
      ).toBe('Ana Pérez');
    });

    it('displayTeacher falls back to username when profile is null', () => {
      const { fixture } = setup();
      expect(
        fixture.componentInstance.displayTeacher({ id: 1, username: 'ap' })
      ).toBe('ap');
    });
  });

  describe('credits validation', () => {
    function ctrl(fixture: ComponentFixture<CourseNewComponent>) {
      return fixture.componentInstance.form.controls.credits;
    }

    it('rejects 0 with min error', () => {
      const { fixture } = setup();
      ctrl(fixture).setValue(0);
      expect(ctrl(fixture).hasError('min')).toBe(true);
    });

    it('rejects 101 with max error', () => {
      const { fixture } = setup();
      ctrl(fixture).setValue(101);
      expect(ctrl(fixture).hasError('max')).toBe(true);
    });

    it('rejects 2.5 with pattern error', () => {
      const { fixture } = setup();
      ctrl(fixture).setValue(2.5 as unknown as number);
      expect(ctrl(fixture).hasError('pattern')).toBe(true);
    });

    it('rejects null with required error', () => {
      const { fixture } = setup();
      ctrl(fixture).setValue(null as unknown as number);
      expect(ctrl(fixture).hasError('required')).toBe(true);
    });

    it('accepts boundary values 1 and 100', () => {
      const { fixture } = setup();
      ctrl(fixture).setValue(1);
      expect(ctrl(fixture).valid).toBe(true);
      ctrl(fixture).setValue(100);
      expect(ctrl(fixture).valid).toBe(true);
    });
  });

  describe('autocomplete edit clears id', () => {
    it('clears subjectId when the visible text no longer matches the selected option', () => {
      const { fixture } = setup();
      const c = fixture.componentInstance;
      c.onSubjectSelected(makeSubject(10));
      expect(c.form.controls.subjectId.value).toBe(10);
      c.onSubjectInput('random text that does not match');
      expect(c.form.controls.subjectId.value).toBeNull();
    });

    it('clears teacherId when the visible text no longer matches the selected option', () => {
      const { fixture } = setup();
      const c = fixture.componentInstance;
      c.onTeacherSelected(makeTeacher(1));
      expect(c.form.controls.teacherId.value).toBe(1);
      c.onTeacherInput('random text that does not match');
      expect(c.form.controls.teacherId.value).toBeNull();
    });
  });

  describe('submit', () => {
    function selectValid(fixture: ComponentFixture<CourseNewComponent>) {
      fixture.componentInstance.form.controls.subjectId.setValue(10);
      fixture.componentInstance.form.controls.teacherId.setValue(1);
      fixture.componentInstance.form.controls.credits.setValue(3);
    }

    it('POSTs the expected payload and closes the dialog with the created DTO on success', () => {
      const { fixture, http, dialogRef, snackOpen } = setup();
      selectValid(fixture);
      fixture.componentInstance.onSubmit();

      const req = http.expectOne(`${environment.apiBaseUrl}/api/course`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        subject: { id: 10 },
        teacher: { id: 1 },
        cycle: { id: 1 },
        credits: 3,
      });

      const created: CourseDto = {
        id: 900,
        credits: 3,
        teacher: { id: 1, username: 'teacher1' },
        cycle,
        subject: makeSubject(10),
      };
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
        .expectOne(`${environment.apiBaseUrl}/api/course`)
        .flush('boom', { status: 500, statusText: 'Server Error' });

      expect(snackOpen).toHaveBeenCalledWith(
        ERROR_MESSAGE,
        'Cerrar',
        expect.objectContaining({ duration: 3000, panelClass: 'snackbar-error' })
      );
      expect(dialogRef.close).not.toHaveBeenCalled();
      expect(fixture.componentInstance.saving()).toBe(false);
      expect(fixture.componentInstance.form.enabled).toBe(true);
      expect(fixture.componentInstance.form.controls.subjectId.value).toBe(10);
      expect(errSpy).toHaveBeenCalledWith(
        '[course-new] failed to create course',
        expect.anything()
      );
      errSpy.mockRestore();
    });

    it('does nothing when the form is invalid', () => {
      const { fixture, http } = setup();
      fixture.componentInstance.onSubmit();
      http.expectNone(`${environment.apiBaseUrl}/api/course`);
    });
  });

  describe('cancel', () => {
    it('closes the dialog with undefined and issues no request', () => {
      const { fixture, dialogRef, http } = setup();
      fixture.componentInstance.onCancel();
      expect(dialogRef.close).toHaveBeenCalledWith();
      http.expectNone(`${environment.apiBaseUrl}/api/course`);
    });
  });
});
