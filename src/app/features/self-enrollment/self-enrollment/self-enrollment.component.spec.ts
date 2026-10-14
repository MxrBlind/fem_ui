import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { Observable, Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { ROLE_HOME_ROUTES } from '@core/auth/rbac';
import { NOT_ALLOWED_MESSAGE } from '@core/errors/error-messages';
import { AuthService } from '@core/services/auth.service';
import { CourseService } from '@core/services/course.service';
import { CycleService } from '@core/services/cycle.service';
import { EnrollmentService } from '@core/services/enrollment.service';
import { CycleDto } from '@features/enrollments/models/cycle.model';
import {
  CourseDto,
  EnrollmentDto,
  SelfEnrollmentResult,
} from '@features/enrollments/models/enrollment.model';
import {
  ERROR_MESSAGE,
  LOAD_ERROR_MESSAGE,
  NO_OPEN_CYCLE_MESSAGE,
  SelfEnrollmentComponent,
  SUCCESS_MESSAGE,
} from './self-enrollment.component';

const STUDENT_ID = 345;

const openCycle: CycleDto = {
  id: 12,
  description: '2026-B',
  startDate: '2026-07-01T00:00:00Z',
  endDate: '2026-12-15T00:00:00Z',
  openForEnrollment: true,
};

function makeCourse(id: number, description: string): CourseDto {
  return {
    id,
    credits: 4,
    teacher: { id: 9, username: 'tch' },
    cycle: openCycle,
    subject: {
      id: id + 1000,
      code: `C${id}`,
      description,
      category: { title: 'Núcleo', description: '', code: 'NUC' },
      level: {},
    },
  };
}

const courses: CourseDto[] = [makeCourse(101, 'Biblia I'), makeCourse(102, 'Doctrina')];

function makeEnrollment(courseId: number): EnrollmentDto {
  return { id: courseId * 10, course: makeCourse(courseId, 'x') };
}

interface Mocks {
  getOpenForEnrollment: ReturnType<typeof vi.fn>;
  listByCycle: ReturnType<typeof vi.fn>;
  listMyByCycle: ReturnType<typeof vi.fn>;
  selfEnroll: ReturnType<typeof vi.fn>;
  navigate: ReturnType<typeof vi.fn>;
}

interface Harness {
  fixture: ComponentFixture<SelfEnrollmentComponent>;
  el: HTMLElement;
  mocks: Mocks;
  snackOpen: ReturnType<typeof vi.spyOn>;
}

interface SetupOptions {
  cycle$?: Observable<CycleDto | null>;
  courses$?: Observable<CourseDto[]>;
  enrollments$?: Observable<EnrollmentDto[]>;
  selfEnroll$?: Observable<SelfEnrollmentResult>;
  userId?: number | null;
}

function setup(options: SetupOptions = {}): Harness {
  const mocks: Mocks = {
    getOpenForEnrollment: vi.fn(() => options.cycle$ ?? of(openCycle)),
    listByCycle: vi.fn(() => options.courses$ ?? of(courses)),
    listMyByCycle: vi.fn(() => options.enrollments$ ?? of([])),
    selfEnroll: vi.fn(() => options.selfEnroll$ ?? of({ created: [], skippedCourseIds: [] })),
    navigate: vi.fn(() => Promise.resolve(true)),
  };
  const userId = options.userId === undefined ? STUDENT_ID : options.userId;
  const currentUser =
    userId === null
      ? signal(null)
      : signal({ id: userId, username: 'stu', role: 'student', rawRole: 'ROLE_STUDENT' });

  TestBed.configureTestingModule({
    imports: [SelfEnrollmentComponent],
    providers: [
      provideAnimationsAsync(),
      { provide: CycleService, useValue: { getOpenForEnrollment: mocks.getOpenForEnrollment } },
      { provide: CourseService, useValue: { listByCycle: mocks.listByCycle } },
      {
        provide: EnrollmentService,
        useValue: { listMyByCycle: mocks.listMyByCycle, selfEnroll: mocks.selfEnroll },
      },
      { provide: AuthService, useValue: { currentUser } },
      { provide: Router, useValue: { navigate: mocks.navigate } },
    ],
  });

  const fixture = TestBed.createComponent(SelfEnrollmentComponent);
  const componentSnack = (fixture.componentInstance as unknown as { snackBar: MatSnackBar })
    .snackBar;
  const snackOpen = vi.spyOn(componentSnack, 'open').mockReturnValue({} as never);
  fixture.detectChanges();

  return { fixture, el: fixture.nativeElement as HTMLElement, mocks, snackOpen };
}

function byTestId(el: HTMLElement, id: string): HTMLElement | null {
  return el.querySelector(`[data-testid="${id}"]`);
}

function checkboxInput(el: HTMLElement, courseId: number): HTMLInputElement {
  return el.querySelector(`[data-testid="course-checkbox-${courseId}"] input`) as HTMLInputElement;
}

function submitButton(el: HTMLElement): HTMLButtonElement {
  return byTestId(el, 'submit-button') as HTMLButtonElement;
}

async function tick(h: Harness, courseId: number): Promise<void> {
  checkboxInput(h.el, courseId).click();
  h.fixture.detectChanges();
  await h.fixture.whenStable();
}

describe('SelfEnrollmentComponent', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loading', () => {
    it('shows a spinner while data is loading and no form', () => {
      const h = setup({ cycle$: new Subject<CycleDto | null>() });
      expect(byTestId(h.el, 'loading')).not.toBeNull();
      expect(byTestId(h.el, 'self-enrollment-form')).toBeNull();
    });

    it('requests the courses and the enrollments of the open cycle id', () => {
      const h = setup();
      expect(h.mocks.listByCycle).toHaveBeenCalledWith(12);
      expect(h.mocks.listMyByCycle).toHaveBeenCalledWith(12);
    });

    it('shows the empty state and sends no further request when no cycle is open', () => {
      const h = setup({ cycle$: of(null) });
      expect(byTestId(h.el, 'no-open-cycle')?.textContent).toContain(NO_OPEN_CYCLE_MESSAGE);
      expect(NO_OPEN_CYCLE_MESSAGE).toBe('No hay un ciclo abierto para preinscripción.');
      expect(byTestId(h.el, 'self-enrollment-form')).toBeNull();
      expect(h.mocks.listByCycle).not.toHaveBeenCalled();
      expect(h.mocks.listMyByCycle).not.toHaveBeenCalled();
    });

    it.each([
      ['cycle request', { cycle$: throwError(() => new Error('boom')) }],
      ['courses request', { courses$: throwError(() => new Error('boom')) }],
      ['enrollments request', { enrollments$: throwError(() => new Error('boom')) }],
    ])('shows a snackbar and no form when the %s fails', (_name, options) => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const h = setup(options as SetupOptions);
      expect(LOAD_ERROR_MESSAGE).toBe('Error al cargar las materias');
      expect(h.snackOpen).toHaveBeenCalledWith(
        LOAD_ERROR_MESSAGE,
        'Cerrar',
        expect.objectContaining({ panelClass: 'snackbar-error' })
      );
      expect(byTestId(h.el, 'self-enrollment-form')).toBeNull();
      expect(byTestId(h.el, 'loading')).toBeNull();
    });
  });

  describe('content', () => {
    it('renders the cycle label and one checkbox per course labeled with the subject description', () => {
      const h = setup();
      expect(byTestId(h.el, 'courses-label')?.textContent?.trim()).toBe(
        'Materias disponibles para el ciclo 2026-B:'
      );
      expect(byTestId(h.el, 'course-checkbox-101')?.textContent).toContain('Biblia I');
      expect(byTestId(h.el, 'course-checkbox-102')?.textContent).toContain('Doctrina');
      expect(checkboxInput(h.el, 101).checked).toBe(false);
      expect(checkboxInput(h.el, 102).checked).toBe(false);
    });

    it('marks already-enrolled courses as checked and disabled, leaving the rest editable', () => {
      const h = setup({ enrollments$: of([makeEnrollment(101)]) });
      expect(checkboxInput(h.el, 101).checked).toBe(true);
      expect(checkboxInput(h.el, 101).disabled).toBe(true);
      expect(checkboxInput(h.el, 102).checked).toBe(false);
      expect(checkboxInput(h.el, 102).disabled).toBe(false);
    });

    it('labels the checkbox group with the cycle label', () => {
      const h = setup();
      const label = byTestId(h.el, 'courses-label') as HTMLElement;
      const group = byTestId(h.el, 'courses-group') as HTMLElement;
      expect(group.getAttribute('role')).toBe('group');
      expect(label.id).not.toBe('');
      expect(group.getAttribute('aria-labelledby')).toBe(label.id);
    });

    it('defaults the payment mode to SINGLE and offers "Un pago" and "Varios pagos"', async () => {
      const h = setup();
      await h.fixture.whenStable();
      h.fixture.detectChanges();
      const select = byTestId(h.el, 'payment-mode-select') as HTMLElement;
      expect(select.textContent).toContain('Un pago');

      (select.querySelector('.mat-mdc-select-trigger') as HTMLElement).click();
      h.fixture.detectChanges();
      await h.fixture.whenStable();
      const options = Array.from(document.querySelectorAll('mat-option')).map((o) =>
        o.textContent?.trim()
      );
      expect(options).toEqual(['Un pago', 'Varios pagos']);
    });
  });

  describe('submit button state', () => {
    it('is disabled when nothing is ticked and enabled after ticking a course', async () => {
      const h = setup();
      expect(submitButton(h.el).disabled).toBe(true);
      await tick(h, 101);
      expect(submitButton(h.el).disabled).toBe(false);
    });

    it('is disabled again after unticking the only selected course', async () => {
      const h = setup();
      await tick(h, 101);
      await tick(h, 101);
      expect(submitButton(h.el).disabled).toBe(true);
    });

    it('stays disabled when the student is already enrolled in every course', () => {
      const h = setup({ enrollments$: of([makeEnrollment(101), makeEnrollment(102)]) });
      expect(checkboxInput(h.el, 101).disabled).toBe(true);
      expect(checkboxInput(h.el, 102).disabled).toBe(true);
      expect(submitButton(h.el).disabled).toBe(true);
    });
  });

  describe('submission', () => {
    it('sends only the newly ticked course ids with the session user id and default payment mode', async () => {
      const h = setup({ enrollments$: of([makeEnrollment(101)]) });
      await tick(h, 102);
      submitButton(h.el).click();
      expect(h.mocks.selfEnroll).toHaveBeenCalledWith({
        cycleId: 12,
        studentId: STUDENT_ID,
        courseIds: [102],
        paymentMode: 'SINGLE',
      });
    });

    it('sends MULTIPLE when the student selects "Varios pagos"', async () => {
      const h = setup();
      await tick(h, 101);
      await tick(h, 102);
      h.fixture.componentInstance.form.controls.paymentMode.setValue('MULTIPLE');
      h.fixture.detectChanges();
      submitButton(h.el).click();
      expect(h.mocks.selfEnroll).toHaveBeenCalledWith({
        cycleId: 12,
        studentId: STUDENT_ID,
        courseIds: [101, 102],
        paymentMode: 'MULTIPLE',
      });
    });

    it('sends exactly one request when the form is submitted twice while saving', async () => {
      const pending$ = new Subject<SelfEnrollmentResult>();
      const h = setup({ selfEnroll$: pending$ });
      await tick(h, 101);
      h.fixture.componentInstance.onSubmit();
      h.fixture.componentInstance.onSubmit();
      expect(h.mocks.selfEnroll).toHaveBeenCalledTimes(1);
    });

    it('disables the button and shows a spinner while saving', async () => {
      const pending$ = new Subject<SelfEnrollmentResult>();
      const h = setup({ selfEnroll$: pending$ });
      await tick(h, 101);
      submitButton(h.el).click();
      h.fixture.detectChanges();
      expect(submitButton(h.el).disabled).toBe(true);
      expect(submitButton(h.el).querySelector('mat-progress-spinner')).not.toBeNull();
    });

    it('does not send a request when the session user is missing and shows the error message', async () => {
      const h = setup({ userId: null });
      await tick(h, 101);
      h.fixture.componentInstance.onSubmit();
      expect(h.mocks.selfEnroll).not.toHaveBeenCalled();
      expect(h.snackOpen).toHaveBeenCalledWith(
        ERROR_MESSAGE,
        'Cerrar',
        expect.objectContaining({ panelClass: 'snackbar-error' })
      );
    });
  });

  describe('outcome', () => {
    it('shows the success snackbar and navigates to the student home on 200', async () => {
      const h = setup();
      await tick(h, 101);
      submitButton(h.el).click();
      expect(SUCCESS_MESSAGE).toBe('Preinscripción registrada con éxito');
      expect(h.snackOpen).toHaveBeenCalledWith(SUCCESS_MESSAGE, 'Cerrar', { duration: 3000 });
      expect(h.mocks.navigate).toHaveBeenCalledWith([ROLE_HOME_ROUTES.student]);
    });

    it('treats a response with skipped courses and nothing created as success', async () => {
      const h = setup({ selfEnroll$: of({ created: [], skippedCourseIds: [101] }) });
      await tick(h, 101);
      submitButton(h.el).click();
      expect(h.snackOpen).toHaveBeenCalledWith(SUCCESS_MESSAGE, 'Cerrar', { duration: 3000 });
      expect(h.mocks.navigate).toHaveBeenCalledWith([ROLE_HOME_ROUTES.student]);
    });

    it('shows the not-allowed snackbar and still redirects on 403 without ending the session', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const failure = new HttpErrorResponse({ status: 403, error: { code: 'ACCESS_DENIED' } });
      const h = setup({ selfEnroll$: throwError(() => failure) });
      await tick(h, 101);
      submitButton(h.el).click();
      expect(h.snackOpen).toHaveBeenCalledWith(
        NOT_ALLOWED_MESSAGE,
        'Cerrar',
        expect.objectContaining({ panelClass: 'snackbar-error' })
      );
      expect(h.mocks.navigate).toHaveBeenCalledWith([ROLE_HOME_ROUTES.student]);
    });

    it.each([400, 404, 409, 500, 0])(
      'shows the error snackbar, logs and navigates to the student home on status %s',
      async (status) => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const failure = { status };
        const h = setup({ selfEnroll$: throwError(() => failure) });
        await tick(h, 101);
        submitButton(h.el).click();
        expect(ERROR_MESSAGE).toBe('Un error ha ocurrido al preinscribirse. Inténtelo más tarde');
        expect(h.snackOpen).toHaveBeenCalledWith(
          ERROR_MESSAGE,
          'Cerrar',
          expect.objectContaining({ panelClass: 'snackbar-error' })
        );
        expect(errorSpy).toHaveBeenCalledWith('[self-enrollment] failed to submit', failure);
        expect(h.mocks.navigate).toHaveBeenCalledWith([ROLE_HOME_ROUTES.student]);
        expect(h.fixture.componentInstance.saving()).toBe(false);
      }
    );
  });
});
