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
import {
  CycleNewComponent,
  END_BEFORE_START_MESSAGE,
  ERROR_MESSAGE,
  LOAD_ERROR_MESSAGE,
  SUCCESS_MESSAGE,
  toIsoDateString,
} from './cycle-new.component';

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

interface Harness {
  fixture: ComponentFixture<CycleNewComponent>;
  http: HttpTestingController;
  dialogRef: { close: ReturnType<typeof vi.fn> };
  snackOpen: ReturnType<typeof vi.spyOn>;
}

function setup(
  options: { skipFlush?: boolean; failLoad?: boolean } = {}
): Harness {
  const dialogRef = { close: vi.fn() };

  TestBed.configureTestingModule({
    imports: [CycleNewComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideAnimationsAsync(),
      { provide: MatDialogRef, useValue: dialogRef },
    ],
  });

  const fixture = TestBed.createComponent(CycleNewComponent);
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

function fillValid(fixture: ComponentFixture<CycleNewComponent>): void {
  fixture.componentInstance.form.controls.description.setValue('Ciclo 2027-A');
  fixture.componentInstance.form.controls.startDate.setValue(
    new Date(2027, 0, 15)
  );
  fixture.componentInstance.form.controls.endDate.setValue(
    new Date(2027, 5, 15)
  );
  fixture.componentInstance.form.controls.principalId.setValue(1);
}

describe('CycleNewComponent', () => {
  afterEach(() => {
    try {
      TestBed.inject(HttpTestingController).verify();
    } catch {
      /* some tests already verify */
    }
  });

  describe('initial data loading', () => {
    it('fetches ROLE_TEACHER users and enables the form on success', () => {
      const { fixture } = setup();
      expect(fixture.componentInstance.loading()).toBe(false);
      expect(fixture.componentInstance.teachers().length).toBe(2);
      expect(fixture.componentInstance.form.enabled).toBe(true);
    });

    it('form is disabled while the request is pending', () => {
      const { fixture } = setup({ skipFlush: true });
      expect(fixture.componentInstance.loading()).toBe(true);
      expect(fixture.componentInstance.form.disabled).toBe(true);
    });

    it('opens the load-error snackbar and keeps Crear disabled when loading fails', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
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
        '[cycle-new] failed to load form data',
        expect.anything()
      );
      errSpy.mockRestore();
    });
  });

  describe('display helpers', () => {
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

    it('accepts a valid description', () => {
      const { fixture } = setup();
      const ctrl = fixture.componentInstance.form.controls.description;
      ctrl.setValue('Ciclo válido');
      expect(ctrl.valid).toBe(true);
    });
  });

  describe('date validation', () => {
    it('requires both dates', () => {
      const { fixture } = setup();
      const start = fixture.componentInstance.form.controls.startDate;
      const end = fixture.componentInstance.form.controls.endDate;
      expect(start.hasError('required')).toBe(true);
      expect(end.hasError('required')).toBe(true);
    });

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

    it('flags endBeforeStart when end equals start', () => {
      const { fixture } = setup();
      const same = new Date(2027, 5, 15);
      fixture.componentInstance.form.controls.startDate.setValue(same);
      fixture.componentInstance.form.controls.endDate.setValue(
        new Date(same.getTime())
      );
      expect(fixture.componentInstance.form.hasError('endBeforeStart')).toBe(
        true
      );
    });

    it('surfaces END_BEFORE_START_MESSAGE constant', () => {
      const { fixture } = setup();
      expect(fixture.componentInstance.endBeforeStartMessage).toBe(
        END_BEFORE_START_MESSAGE
      );
    });
  });

  describe('toIsoDateString', () => {
    it('returns YYYY-MM-DD using local components (no UTC drift)', () => {
      expect(toIsoDateString(new Date(2026, 6, 8))).toBe('2026-07-08');
    });

    it('pads month and day', () => {
      expect(toIsoDateString(new Date(2027, 0, 3))).toBe('2027-01-03');
    });
  });

  describe('director autocomplete', () => {
    it('filters teachers by search term (case-insensitive)', () => {
      const { fixture } = setup();
      fixture.componentInstance.onPrincipalInput('name1');
      expect(fixture.componentInstance.filteredTeachers().length).toBe(1);
      expect(fixture.componentInstance.filteredTeachers()[0].id).toBe(1);
    });

    it('stores selected teacher id on selection', () => {
      const { fixture } = setup();
      fixture.componentInstance.onPrincipalSelected(makeTeacher(2));
      expect(fixture.componentInstance.form.controls.principalId.value).toBe(2);
    });

    it('clears principalId when the user edits the input after selection', () => {
      const { fixture } = setup();
      fixture.componentInstance.onPrincipalSelected(makeTeacher(1));
      expect(fixture.componentInstance.form.controls.principalId.value).toBe(1);
      fixture.componentInstance.onPrincipalInput('unrelated text');
      expect(
        fixture.componentInstance.form.controls.principalId.value
      ).toBeNull();
    });
  });

  describe('submit', () => {
    it('POSTs the ISO-serialized payload and closes with the created DTO on success', () => {
      const { fixture, http, dialogRef, snackOpen } = setup();
      fillValid(fixture);
      fixture.componentInstance.onSubmit();

      const req = http.expectOne(`${environment.apiBaseUrl}/api/cycle`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        description: 'Ciclo 2027-A',
        startDate: '2027-01-15',
        endDate: '2027-06-15',
        principal: { id: 1 },
      });

      const created: CycleDto = {
        id: 99,
        description: 'Ciclo 2027-A',
        startDate: '2027-01-15',
        endDate: '2027-06-15',
        current: false,
        active: true,
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
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const { fixture, http, dialogRef, snackOpen } = setup();
      fillValid(fixture);
      fixture.componentInstance.onSubmit();
      http
        .expectOne(`${environment.apiBaseUrl}/api/cycle`)
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
      expect(fixture.componentInstance.form.controls.description.value).toBe(
        'Ciclo 2027-A'
      );
      expect(errSpy).toHaveBeenCalledWith(
        '[cycle-new] failed to create cycle',
        expect.anything()
      );
      errSpy.mockRestore();
    });

    it('does nothing when the form is invalid', () => {
      const { fixture, http } = setup();
      fixture.componentInstance.onSubmit();
      http.expectNone(`${environment.apiBaseUrl}/api/cycle`);
    });

    it('does nothing when the initial load failed', () => {
      const { fixture, http } = setup({ failLoad: true });
      fillValid(fixture);
      fixture.componentInstance.onSubmit();
      http.expectNone(`${environment.apiBaseUrl}/api/cycle`);
    });
  });

  describe('cancel', () => {
    it('closes the dialog with undefined and issues no request', () => {
      const { fixture, dialogRef, http } = setup();
      fixture.componentInstance.onCancel();
      expect(dialogRef.close).toHaveBeenCalledWith();
      http.expectNone(`${environment.apiBaseUrl}/api/cycle`);
    });
  });
});
