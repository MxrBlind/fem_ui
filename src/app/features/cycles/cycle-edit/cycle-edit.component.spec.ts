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
import {
  CycleEditComponent,
  CURRENT_CONFLICT_MESSAGE,
  ERROR_MESSAGE,
  LOAD_ERROR_MESSAGE,
  OPEN_FOR_ENROLLMENT_CONFLICT_MESSAGE,
  SUCCESS_MESSAGE,
} from './cycle-edit.component';

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

function baseCycle(): CycleDto {
  return {
    id: 7,
    description: 'Ciclo 2026-1',
    startDate: '2026-02-01',
    endDate: '2026-06-30',
    current: true,
    active: true,
    principal: makeTeacher(1),
  };
}

interface Harness {
  fixture: ComponentFixture<CycleEditComponent>;
  http: HttpTestingController;
  dialogRef: { close: ReturnType<typeof vi.fn> };
  snackOpen: ReturnType<typeof vi.spyOn>;
}

function setup(
  options: {
    skipFlush?: boolean;
    failLoad?: boolean;
    cycle?: CycleDto;
  } = {}
): Harness {
  const dialogRef = { close: vi.fn() };
  const cycle = options.cycle ?? baseCycle();

  TestBed.configureTestingModule({
    imports: [CycleEditComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideAnimationsAsync(),
      { provide: MatDialogRef, useValue: dialogRef },
      { provide: MAT_DIALOG_DATA, useValue: { cycle } },
    ],
  });

  const fixture = TestBed.createComponent(CycleEditComponent);
  const componentSnack = (
    fixture.componentInstance as unknown as { snackBar: MatSnackBar }
  ).snackBar;
  const snackOpen = vi
    .spyOn(componentSnack, 'open')
    .mockReturnValue({} as never);
  fixture.detectChanges();
  const http = TestBed.inject(HttpTestingController);

  if (!options.skipFlush) {
    const req = http.expectOne(
      (r) =>
        r.url === `${environment.apiBaseUrl}/api/user` &&
        r.params.get('role') === 'ROLE_TEACHER'
    );
    if (options.failLoad) {
      req.flush('boom', { status: 500, statusText: 'Server Error' });
    } else {
      req.flush([makeTeacher(1), makeTeacher(2)]);
    }
    fixture.detectChanges();
  }

  return { fixture, http, dialogRef, snackOpen };
}

describe('CycleEditComponent', () => {
  afterEach(() => {
    try {
      TestBed.inject(HttpTestingController).verify();
    } catch {
      /* some tests already verify */
    }
  });

  describe('initial pre-population', () => {
    it('populates the form from the injected cycle after teachers load', () => {
      const { fixture } = setup();
      const c = fixture.componentInstance.form.controls;
      expect(c.description.value).toBe('Ciclo 2026-1');
      expect(c.startDate.value?.getFullYear()).toBe(2026);
      expect(c.endDate.value?.getFullYear()).toBe(2026);
      expect(c.current.value).toBe(true);
      expect(c.principalId.value).toBe(1);
      expect(fixture.componentInstance.principalSearch()).toBe('Name1 Last1');
      expect(fixture.componentInstance.form.enabled).toBe(true);
    });

    it('defaults current to false when the cycle has no current flag', () => {
      const { fixture } = setup({
        cycle: { ...baseCycle(), current: undefined },
      });
      expect(fixture.componentInstance.form.controls.current.value).toBe(false);
    });

    it('initializes openForEnrollment from the injected cycle when true', () => {
      const { fixture } = setup({
        cycle: { ...baseCycle(), openForEnrollment: true },
      });
      expect(
        fixture.componentInstance.form.controls.openForEnrollment.value
      ).toBe(true);
    });

    it('defaults openForEnrollment to false when the cycle has no openForEnrollment flag', () => {
      const { fixture } = setup({
        cycle: { ...baseCycle(), openForEnrollment: undefined },
      });
      expect(
        fixture.componentInstance.form.controls.openForEnrollment.value
      ).toBe(false);
    });

    it('reflects openForEnrollment=false from the injected cycle', () => {
      const { fixture } = setup({
        cycle: { ...baseCycle(), openForEnrollment: false },
      });
      expect(
        fixture.componentInstance.form.controls.openForEnrollment.value
      ).toBe(false);
    });

    it('disables the form while the teacher request is pending', () => {
      const { fixture } = setup({ skipFlush: true });
      expect(fixture.componentInstance.loading()).toBe(true);
      expect(fixture.componentInstance.form.disabled).toBe(true);
    });

    it('shows the load-error snackbar and keeps Actualizar disabled when loading fails', async () => {
      const errSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      const { fixture, snackOpen } = setup({ failLoad: true });
      await fixture.whenStable();
      expect(fixture.componentInstance.loadFailed()).toBe(true);
      expect(snackOpen).toHaveBeenCalledWith(
        LOAD_ERROR_MESSAGE,
        'Cerrar',
        expect.objectContaining({
          duration: 3000,
          panelClass: 'snackbar-error',
        })
      );
      expect(errSpy).toHaveBeenCalledWith(
        '[cycle-edit] failed to load form data',
        expect.anything()
      );
      errSpy.mockRestore();
    });
  });

  describe('description validation', () => {
    it('rejects empty', () => {
      const { fixture } = setup();
      const ctrl = fixture.componentInstance.form.controls.description;
      ctrl.setValue('');
      expect(ctrl.hasError('required')).toBe(true);
    });

    it('rejects whitespace-only', () => {
      const { fixture } = setup();
      const ctrl = fixture.componentInstance.form.controls.description;
      ctrl.setValue('   ');
      expect(ctrl.hasError('required')).toBe(true);
    });

    it('rejects strings longer than 50 characters', () => {
      const { fixture } = setup();
      const ctrl = fixture.componentInstance.form.controls.description;
      ctrl.setValue('x'.repeat(51));
      expect(ctrl.hasError('maxlength')).toBe(true);
    });
  });

  describe('date validation', () => {
    it('flags endBeforeStart when end is not after start', () => {
      const { fixture } = setup();
      fixture.componentInstance.form.controls.startDate.setValue(
        new Date(2027, 5, 15)
      );
      fixture.componentInstance.form.controls.endDate.setValue(
        new Date(2027, 0, 15)
      );
      expect(fixture.componentInstance.form.hasError('endBeforeStart')).toBe(
        true
      );
    });
  });

  describe('director autocomplete', () => {
    it('filters teachers by search term', () => {
      const { fixture } = setup();
      fixture.componentInstance.onPrincipalInput('name2');
      expect(fixture.componentInstance.filteredTeachers().length).toBe(1);
      expect(fixture.componentInstance.filteredTeachers()[0].id).toBe(2);
    });

    it('stores selected teacher id on selection', () => {
      const { fixture } = setup();
      fixture.componentInstance.onPrincipalSelected(makeTeacher(2));
      expect(fixture.componentInstance.form.controls.principalId.value).toBe(2);
    });

    it('clears principalId when the user edits the input after selection', () => {
      const { fixture } = setup();
      fixture.componentInstance.onPrincipalInput('unrelated text');
      expect(
        fixture.componentInstance.form.controls.principalId.value
      ).toBeNull();
    });
  });

  describe('submit', () => {
    it('PUTs the ISO-serialized payload and closes with the updated DTO on success', () => {
      const { fixture, http, dialogRef, snackOpen } = setup({
        cycle: { ...baseCycle(), openForEnrollment: true },
      });
      fixture.componentInstance.form.controls.description.setValue(
        'Ciclo actualizado'
      );
      fixture.componentInstance.form.controls.current.setValue(false);
      fixture.componentInstance.onSubmit();

      const req = http.expectOne(`${environment.apiBaseUrl}/api/cycle/7`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({
        description: 'Ciclo actualizado',
        startDate: '2026-02-01',
        endDate: '2026-06-30',
        principal: { id: 1 },
        current: false,
        openForEnrollment: true,
      });

      const updated: CycleDto = {
        id: 7,
        description: 'Ciclo actualizado',
        startDate: '2026-02-01',
        endDate: '2026-06-30',
        current: false,
        active: true,
      };
      req.flush(updated);

      expect(snackOpen).toHaveBeenCalledWith(
        SUCCESS_MESSAGE,
        'Cerrar',
        expect.objectContaining({ duration: 3000 })
      );
      expect(dialogRef.close).toHaveBeenCalledWith(updated);
    });

    it('keeps the dialog open and shows the error snackbar on failure', () => {
      const errSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      const { fixture, http, dialogRef, snackOpen } = setup();
      fixture.componentInstance.onSubmit();
      http
        .expectOne(`${environment.apiBaseUrl}/api/cycle/7`)
        .flush('boom', { status: 500, statusText: 'Server Error' });

      expect(snackOpen).toHaveBeenCalledWith(
        ERROR_MESSAGE,
        'Cerrar',
        expect.objectContaining({
          duration: 3000,
          panelClass: 'snackbar-error',
        })
      );
      expect(dialogRef.close).not.toHaveBeenCalled();
      expect(fixture.componentInstance.saving()).toBe(false);
      expect(fixture.componentInstance.form.enabled).toBe(true);
      expect(errSpy).toHaveBeenCalledWith(
        '[cycle-edit] failed to update cycle',
        expect.anything()
      );
      errSpy.mockRestore();
    });

    describe('409 conflict handling', () => {
      const conflictBody = (code?: string) => ({
        status: 409,
        error: 'Conflict',
        message: 'Another cycle is already marked as current (cycleId=3)',
        ...(code === undefined ? {} : { code }),
      });

      function submitAndFlush(
        body: string | object | null,
        status = 409,
        statusText = 'Conflict'
      ) {
        const errSpy = vi
          .spyOn(console, 'error')
          .mockImplementation(() => undefined);
        const harness = setup();
        harness.fixture.componentInstance.onSubmit();
        harness.http
          .expectOne(`${environment.apiBaseUrl}/api/cycle/7`)
          .flush(body, { status, statusText });
        return { ...harness, errSpy };
      }

      const errorOptions = expect.objectContaining({
        duration: 3000,
        panelClass: 'snackbar-error',
      });

      it('shows the current-conflict message for CYCLE_CURRENT_CONFLICT', () => {
        const { snackOpen, errSpy } = submitAndFlush(
          conflictBody('CYCLE_CURRENT_CONFLICT')
        );

        expect(snackOpen).toHaveBeenCalledTimes(1);
        expect(snackOpen).toHaveBeenCalledWith(
          CURRENT_CONFLICT_MESSAGE,
          'Cerrar',
          errorOptions
        );
        errSpy.mockRestore();
      });

      it('shows the enrollment-conflict message for CYCLE_OPEN_FOR_ENROLLMENT_CONFLICT', () => {
        const { snackOpen, errSpy } = submitAndFlush(
          conflictBody('CYCLE_OPEN_FOR_ENROLLMENT_CONFLICT')
        );

        expect(snackOpen).toHaveBeenCalledTimes(1);
        expect(snackOpen).toHaveBeenCalledWith(
          OPEN_FOR_ENROLLMENT_CONFLICT_MESSAGE,
          'Cerrar',
          errorOptions
        );
        errSpy.mockRestore();
      });

      it('uses the exact Spanish texts from the spec', () => {
        expect(CURRENT_CONFLICT_MESSAGE).toBe(
          'Ya existe un ciclo activo, no es posible activar más'
        );
        expect(OPEN_FOR_ENROLLMENT_CONFLICT_MESSAGE).toBe(
          'Ya existe un ciclo abierto a inscripciones'
        );
      });

      it('falls back to the generic message for an unknown 409 code', () => {
        const { snackOpen, errSpy } = submitAndFlush(
          conflictBody('SOMETHING_ELSE')
        );

        expect(snackOpen).toHaveBeenCalledWith(
          ERROR_MESSAGE,
          'Cerrar',
          errorOptions
        );
        errSpy.mockRestore();
      });

      it('falls back to the generic message when a 409 has no code', () => {
        const { snackOpen, errSpy } = submitAndFlush(conflictBody());

        expect(snackOpen).toHaveBeenCalledWith(
          ERROR_MESSAGE,
          'Cerrar',
          errorOptions
        );
        errSpy.mockRestore();
      });

      it.each([
        ['an empty body', null],
        ['a text body', 'conflict'],
        ['a non-string code', { code: 42 }],
      ])(
        'falls back to the generic message for a 409 with %s',
        (_label, body) => {
          const { snackOpen, errSpy } = submitAndFlush(body);

          expect(snackOpen).toHaveBeenCalledWith(
            ERROR_MESSAGE,
            'Cerrar',
            errorOptions
          );
          errSpy.mockRestore();
        }
      );

      it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty'])(
        'does not resolve the inherited property name "%s" as a message',
        (code) => {
          const { snackOpen, errSpy } = submitAndFlush(conflictBody(code));

          expect(snackOpen).toHaveBeenCalledWith(
            ERROR_MESSAGE,
            'Cerrar',
            errorOptions
          );
          errSpy.mockRestore();
        }
      );

      it('ignores a known code on a non-409 status', () => {
        const { snackOpen, errSpy } = submitAndFlush(
          conflictBody('CYCLE_CURRENT_CONFLICT'),
          500,
          'Server Error'
        );

        expect(snackOpen).toHaveBeenCalledWith(
          ERROR_MESSAGE,
          'Cerrar',
          errorOptions
        );
        errSpy.mockRestore();
      });

      it('never shows the server-provided message', () => {
        const { snackOpen, errSpy } = submitAndFlush(
          conflictBody('CYCLE_CURRENT_CONFLICT')
        );

        const shown = snackOpen.mock.calls.map((call: unknown[]) => call[0]);
        expect(shown.join(' ')).not.toContain('Another cycle');
        errSpy.mockRestore();
      });

      it('keeps the dialog open, re-enables the form and logs the error', () => {
        const { fixture, dialogRef, errSpy } = submitAndFlush(
          conflictBody('CYCLE_CURRENT_CONFLICT')
        );

        expect(dialogRef.close).not.toHaveBeenCalled();
        expect(fixture.componentInstance.saving()).toBe(false);
        expect(fixture.componentInstance.form.enabled).toBe(true);
        expect(errSpy).toHaveBeenCalledWith(
          '[cycle-edit] failed to update cycle',
          expect.anything()
        );
        errSpy.mockRestore();
      });

      it('allows resubmitting after a conflict', () => {
        const { fixture, http, dialogRef, errSpy } = submitAndFlush(
          conflictBody('CYCLE_CURRENT_CONFLICT')
        );

        fixture.componentInstance.form.controls.current.setValue(false);
        fixture.componentInstance.onSubmit();
        const retry = http.expectOne(`${environment.apiBaseUrl}/api/cycle/7`);
        expect(retry.request.method).toBe('PUT');
        expect(retry.request.body.current).toBe(false);
        retry.flush({ ...baseCycle(), current: false });

        expect(dialogRef.close).toHaveBeenCalled();
        errSpy.mockRestore();
      });
    });

    it('does nothing when the form is invalid', () => {
      const { fixture, http } = setup();
      fixture.componentInstance.form.controls.description.setValue('');
      fixture.componentInstance.onSubmit();
      http.expectNone(`${environment.apiBaseUrl}/api/cycle/7`);
    });

    it('does nothing when the initial load failed', () => {
      const { fixture, http } = setup({ failLoad: true });
      fixture.componentInstance.onSubmit();
      http.expectNone(`${environment.apiBaseUrl}/api/cycle/7`);
    });

    it('sends openForEnrollment=true in the payload when toggled on', () => {
      const { fixture, http } = setup({
        cycle: { ...baseCycle(), openForEnrollment: false },
      });
      fixture.componentInstance.form.controls.openForEnrollment.setValue(true);
      fixture.componentInstance.onSubmit();

      const req = http.expectOne(`${environment.apiBaseUrl}/api/cycle/7`);
      expect(req.request.body).toEqual(
        expect.objectContaining({ openForEnrollment: true })
      );
      req.flush({ ...baseCycle(), openForEnrollment: true });
    });

    it('submits current and openForEnrollment independently in any combination', () => {
      const { fixture, http } = setup({
        cycle: { ...baseCycle(), current: true, openForEnrollment: false },
      });
      fixture.componentInstance.form.controls.current.setValue(true);
      fixture.componentInstance.form.controls.openForEnrollment.setValue(false);
      fixture.componentInstance.onSubmit();

      const req = http.expectOne(`${environment.apiBaseUrl}/api/cycle/7`);
      expect(req.request.body).toEqual(
        expect.objectContaining({ current: true, openForEnrollment: false })
      );
      req.flush({ ...baseCycle(), current: true, openForEnrollment: false });
    });
  });

  describe('cancel', () => {
    it('closes the dialog with undefined and issues no request', () => {
      const { fixture, dialogRef, http } = setup();
      fixture.componentInstance.onCancel();
      expect(dialogRef.close).toHaveBeenCalledWith();
      http.expectNone(`${environment.apiBaseUrl}/api/cycle/7`);
    });
  });
});
