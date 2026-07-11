import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

import { environment } from '../../../../environments/environment';
import { UserDto } from '@core/models/auth.model';
import { CycleDto } from '@features/enrollments/models/cycle.model';
import { CourseDto, SubjectDto } from '@features/enrollments/models/enrollment.model';
import {
  CourseEditComponent,
  ERROR_MESSAGE,
  LOAD_ERROR_MESSAGE,
  SUCCESS_MESSAGE,
} from './course-edit.component';

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

function makeCourse(overrides: Partial<CourseDto> = {}): CourseDto {
  return {
    id: 555,
    credits: 4,
    subject: makeSubject(10),
    teacher: makeTeacher(1),
    cycle,
    ...overrides,
  };
}

interface Harness {
  fixture: ComponentFixture<CourseEditComponent>;
  http: HttpTestingController;
  dialogRef: { close: ReturnType<typeof vi.fn> };
  snackOpen: ReturnType<typeof vi.spyOn>;
  data: CourseDto;
}

type FailWhich = 'subjects' | 'teachers' | 'cycle';

function setup(options: {
  skipFlush?: boolean;
  failLoad?: FailWhich;
  data?: CourseDto;
} = {}): Harness {
  const dialogRef = { close: vi.fn() };
  const data = options.data ?? makeCourse();

  TestBed.configureTestingModule({
    imports: [CourseEditComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideAnimationsAsync(),
      { provide: MatDialogRef, useValue: dialogRef },
      { provide: MAT_DIALOG_DATA, useValue: data },
    ],
  });

  const fixture = TestBed.createComponent(CourseEditComponent);
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

  return { fixture, http, dialogRef, snackOpen, data };
}

describe('CourseEditComponent', () => {
  afterEach(() => {
    try {
      TestBed.inject(HttpTestingController).verify();
    } catch {
      /* some tests already verify */
    }
  });

  describe('title and prefill', () => {
    it('renders the dialog title "Editar curso"', () => {
      const { fixture } = setup();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain('Editar curso');
    });

    it('prefills the form from the injected CourseDto', () => {
      const { fixture, data } = setup();
      const c = fixture.componentInstance;
      expect(c.form.controls.subjectId.value).toBe(data.subject.id);
      expect(c.form.controls.teacherId.value).toBe(data.teacher.id);
      expect(c.form.controls.credits.value).toBe(data.credits);
      expect(c.form.valid).toBe(true);
    });
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
      'opens the load-error snackbar and keeps Actualizar disabled when %s load fails',
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
          '[course-edit] failed to load form data',
          expect.anything()
        );
        errSpy.mockRestore();
      }
    );
  });

  describe('credits validation', () => {
    function ctrl(fixture: ComponentFixture<CourseEditComponent>) {
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

    it('accepts boundary values 1 and 100', () => {
      const { fixture } = setup();
      ctrl(fixture).setValue(1);
      expect(ctrl(fixture).valid).toBe(true);
      ctrl(fixture).setValue(100);
      expect(ctrl(fixture).valid).toBe(true);
    });
  });

  describe('autocomplete filter and edit clears id', () => {
    it('filteredSubjects is case-insensitive', () => {
      const { fixture } = setup();
      fixture.componentInstance.onSubjectInput('materia 20');
      expect(fixture.componentInstance.filteredSubjects().map((s) => s.id)).toEqual([20]);
    });

    it('filteredTeachers is case-insensitive', () => {
      const { fixture } = setup();
      fixture.componentInstance.onTeacherInput('name2');
      expect(fixture.componentInstance.filteredTeachers().map((u) => u.id)).toEqual([2]);
    });

    it('clears subjectId when the visible text no longer matches the selected option', () => {
      const { fixture } = setup();
      const c = fixture.componentInstance;
      c.onSubjectInput('random text that does not match');
      expect(c.form.controls.subjectId.value).toBeNull();
    });

    it('clears teacherId when the visible text no longer matches the selected option', () => {
      const { fixture } = setup();
      const c = fixture.componentInstance;
      c.onTeacherInput('random text that does not match');
      expect(c.form.controls.teacherId.value).toBeNull();
    });
  });

  describe('submit', () => {
    it('PUTs the expected payload to /api/course/{id}?includeDependencies=true and closes with the updated DTO on success', () => {
      const { fixture, http, dialogRef, snackOpen, data } = setup();
      fixture.componentInstance.form.controls.credits.setValue(7);
      fixture.componentInstance.onSubmit();

      const req = http.expectOne(
        `${environment.apiBaseUrl}/api/course/${data.id}?includeDependencies=true`
      );
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({
        ...data,
        subject: makeSubject(10),
        teacher: makeTeacher(1),
        cycle,
        credits: 7,
      });

      const updated: CourseDto = { ...data, credits: 7 };
      req.flush(updated);

      expect(snackOpen).toHaveBeenCalledWith(
        SUCCESS_MESSAGE,
        'Cerrar',
        expect.objectContaining({ duration: 3000 })
      );
      expect(dialogRef.close).toHaveBeenCalledWith(updated);
    });

    it('keeps the dialog open and shows the error snackbar on failure', () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { fixture, http, dialogRef, snackOpen, data } = setup();
      fixture.componentInstance.onSubmit();
      http
        .expectOne(`${environment.apiBaseUrl}/api/course/${data.id}?includeDependencies=true`)
        .flush('boom', { status: 500, statusText: 'Server Error' });

      expect(snackOpen).toHaveBeenCalledWith(
        ERROR_MESSAGE,
        'Cerrar',
        expect.objectContaining({ duration: 3000, panelClass: 'snackbar-error' })
      );
      expect(dialogRef.close).not.toHaveBeenCalled();
      expect(fixture.componentInstance.saving()).toBe(false);
      expect(fixture.componentInstance.form.enabled).toBe(true);
      expect(errSpy).toHaveBeenCalledWith(
        '[course-edit] failed to update course',
        expect.anything()
      );
      errSpy.mockRestore();
    });

    it('does nothing when the form is invalid', () => {
      const { fixture, http, data } = setup();
      fixture.componentInstance.form.controls.credits.setValue(0);
      fixture.componentInstance.onSubmit();
      http.expectNone(
        `${environment.apiBaseUrl}/api/course/${data.id}?includeDependencies=true`
      );
    });
  });

  describe('cancel', () => {
    it('closes the dialog with undefined and issues no request', () => {
      const { fixture, dialogRef, http, data } = setup();
      fixture.componentInstance.onCancel();
      expect(dialogRef.close).toHaveBeenCalledWith();
      http.expectNone(
        `${environment.apiBaseUrl}/api/course/${data.id}?includeDependencies=true`
      );
    });
  });
});
