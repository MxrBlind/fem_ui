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
import { By } from '@angular/platform-browser';

import { environment } from '../../../../environments/environment';
import { UserDto } from '@core/models/auth.model';
import { LevelDto } from '@features/enrollments/models/enrollment.model';
import {
  ERROR_MESSAGE,
  LOAD_ERROR_MESSAGE,
  StudentNewComponent,
  SUCCESS_MESSAGE,
} from './student-new.component';

const USERS_URL = `${environment.apiBaseUrl}/api/user`;
const LEVELS_URL = `${environment.apiBaseUrl}/api/level`;

function makeLevel(id: number, title = `Nivel ${id}`): LevelDto {
  return { id, title, code: `LVL${id}` };
}

interface Harness {
  fixture: ComponentFixture<StudentNewComponent>;
  http: HttpTestingController;
  dialogRef: { close: ReturnType<typeof vi.fn> };
  snackOpen: ReturnType<typeof vi.spyOn>;
}

function setup(
  options: { skipFlush?: boolean; failLoad?: boolean } = {}
): Harness {
  const dialogRef = { close: vi.fn() };

  TestBed.configureTestingModule({
    imports: [StudentNewComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideAnimationsAsync(),
      { provide: MatDialogRef, useValue: dialogRef },
    ],
  });

  const fixture = TestBed.createComponent(StudentNewComponent);
  const componentSnack = (
    fixture.componentInstance as unknown as { snackBar: MatSnackBar }
  ).snackBar;
  const snackOpen = vi
    .spyOn(componentSnack, 'open')
    .mockReturnValue({} as never);
  fixture.detectChanges();
  const http = TestBed.inject(HttpTestingController);

  if (!options.skipFlush) {
    const levelsReq = http.expectOne(LEVELS_URL);
    if (options.failLoad) {
      levelsReq.flush('boom', { status: 500, statusText: 'Server Error' });
    } else {
      levelsReq.flush([
        makeLevel(1, 'Maestría'),
        makeLevel(2, 'Licenciatura'),
        makeLevel(3, 'Diplomado'),
      ]);
    }
    fixture.detectChanges();
  }

  return { fixture, http, dialogRef, snackOpen };
}

function fillValid(fixture: ComponentFixture<StudentNewComponent>): void {
  const c = fixture.componentInstance.form.controls;
  c.username.setValue('jdoe');
  c.password.setValue('secret12');
  c.name.setValue('Juan');
  c.parentLastName.setValue('Doe');
  c.levelId.setValue(2);
  c.motherLastName.setValue('Smith');
  c.birthDate.setValue(new Date(1969, 4, 31));
  c.address.setValue('Calle 1');
  c.church.setValue('Central');
  c.email.setValue('jdoe@example.com');
  c.phone.setValue('5551234567');
}

describe('StudentNewComponent', () => {
  afterEach(() => {
    try {
      TestBed.inject(HttpTestingController).verify();
    } catch {
      /* some tests already verify */
    }
  });

  describe('rendering', () => {
    it('renders the dialog title "Crear estudiante"', () => {
      const { fixture } = setup();
      const title = fixture.debugElement.query(By.css('[mat-dialog-title]'));
      expect((title.nativeElement as HTMLElement).textContent).toContain(
        'Crear estudiante'
      );
    });

    it('renders all 11 field labels with Nivel after Apellido materno', () => {
      const { fixture } = setup();
      const labels = fixture.debugElement
        .queryAll(By.css('mat-label'))
        .map((l) => (l.nativeElement.textContent ?? '').trim());
      expect(labels).toEqual([
        'Username',
        'Password',
        'Nombre(s)',
        'Apellido paterno',
        'Apellido materno',
        'Nivel',
        'Fecha de nacimiento',
        'Dirección',
        'Iglesia',
        'Email',
        'Teléfono',
      ]);
    });

    it('does not expose a "role" form control', () => {
      const { fixture } = setup();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((fixture.componentInstance.form.controls as any).role).toBeUndefined();
    });
  });

  describe('form validity', () => {
    it('is invalid initially and submit issues no HTTP request', () => {
      const { fixture, http } = setup();
      expect(fixture.componentInstance.form.invalid).toBe(true);
      fixture.componentInstance.onSubmit();
      http.expectNone(USERS_URL);
    });

    it('password enforces min length 8', () => {
      const { fixture } = setup();
      fixture.componentInstance.form.controls.password.setValue('short');
      expect(
        fixture.componentInstance.form.controls.password.hasError('minlength')
      ).toBe(true);
    });

    it('password enforces max length 20', () => {
      const { fixture } = setup();
      fixture.componentInstance.form.controls.password.setValue(
        'a'.repeat(21)
      );
      expect(
        fixture.componentInstance.form.controls.password.hasError('maxlength')
      ).toBe(true);
    });

    it('username enforces max length 20', () => {
      const { fixture } = setup();
      fixture.componentInstance.form.controls.username.setValue('a'.repeat(21));
      expect(
        fixture.componentInstance.form.controls.username.hasError('maxlength')
      ).toBe(true);
    });

    it('email validator flags malformed addresses', () => {
      const { fixture } = setup();
      fixture.componentInstance.form.controls.email.setValue('not-an-email');
      expect(
        fixture.componentInstance.form.controls.email.hasError('email')
      ).toBe(true);
    });

    it('submit button is disabled while invalid', () => {
      const { fixture } = setup();
      const btn = fixture.debugElement.query(
        By.css('[data-testid="student-new-submit"]')
      ).nativeElement as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    it('submit button is disabled while saving', () => {
      const { fixture } = setup();
      fillValid(fixture);
      fixture.componentInstance.onSubmit();
      fixture.detectChanges();
      const btn = fixture.debugElement.query(
        By.css('[data-testid="student-new-submit"]')
      ).nativeElement as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
      expect(fixture.componentInstance.saving()).toBe(true);
      expect(fixture.componentInstance.form.disabled).toBe(true);
    });
  });

  describe('level catalog loading', () => {
    it('requests the level catalog once on open and enables the form', () => {
      const { fixture } = setup();
      expect(fixture.componentInstance.loading()).toBe(false);
      expect(fixture.componentInstance.loadFailed()).toBe(false);
      expect(fixture.componentInstance.levels().length).toBe(3);
      expect(fixture.componentInstance.form.enabled).toBe(true);
      expect(
        fixture.nativeElement.querySelector('mat-progress-bar')
      ).toBeNull();
    });

    it('shows the progress bar and keeps the form and Crear disabled while loading', () => {
      const { fixture, http } = setup({ skipFlush: true });
      fixture.detectChanges();
      expect(fixture.componentInstance.loading()).toBe(true);
      expect(fixture.componentInstance.form.disabled).toBe(true);
      expect(
        fixture.nativeElement.querySelector('mat-progress-bar')
      ).not.toBeNull();
      const btn = fixture.debugElement.query(
        By.css('[data-testid="student-new-submit"]')
      ).nativeElement as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
      http.expectOne(LEVELS_URL).flush([]);
    });

    it('opens the load-error snackbar, logs, and keeps the form and Crear disabled when loading fails', () => {
      const errSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      const { fixture, snackOpen } = setup({ failLoad: true });
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
        '[student-new] failed to load form data',
        expect.anything()
      );
      expect(fixture.componentInstance.form.disabled).toBe(true);
      const btn = fixture.debugElement.query(
        By.css('[data-testid="student-new-submit"]')
      ).nativeElement as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
      errSpy.mockRestore();
    });

    it('does not submit when the level catalog failed to load', () => {
      const errSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      const { fixture, http } = setup({ failLoad: true });
      fixture.componentInstance.form.enable();
      fillValid(fixture);
      fixture.componentInstance.onSubmit();
      http.expectNone(USERS_URL);
      errSpy.mockRestore();
    });
  });

  describe('level field', () => {
    it('has eleven controls including levelId, in the rendered order', () => {
      const { fixture } = setup();
      expect(Object.keys(fixture.componentInstance.form.controls)).toEqual([
        'username',
        'password',
        'name',
        'parentLastName',
        'motherLastName',
        'levelId',
        'birthDate',
        'address',
        'church',
        'email',
        'phone',
      ]);
    });

    it('is required: the form is invalid when only levelId is missing', () => {
      const { fixture } = setup();
      fillValid(fixture);
      expect(fixture.componentInstance.form.valid).toBe(true);
      fixture.componentInstance.form.controls.levelId.setValue(null);
      expect(
        fixture.componentInstance.form.controls.levelId.hasError('required')
      ).toBe(true);
      expect(fixture.componentInstance.form.invalid).toBe(true);
    });

    it('does not submit without a level', () => {
      const { fixture, http } = setup();
      fillValid(fixture);
      fixture.componentInstance.form.controls.levelId.setValue(null);
      fixture.componentInstance.onSubmit();
      http.expectNone(USERS_URL);
    });

    it('filters levels by title case-insensitively', () => {
      const { fixture } = setup();
      fixture.componentInstance.onLevelInput('LICEN');
      expect(
        fixture.componentInstance.filteredLevels().map((l) => l.id)
      ).toEqual([2]);
      fixture.componentInstance.onLevelInput('');
      expect(fixture.componentInstance.filteredLevels().length).toBe(3);
    });

    it('selecting a level sets levelId and the displayed title', () => {
      const { fixture } = setup();
      fixture.componentInstance.onLevelSelected(makeLevel(3, 'Diplomado'));
      expect(fixture.componentInstance.form.controls.levelId.value).toBe(3);
      expect(fixture.componentInstance.levelSearch()).toBe('Diplomado');
      expect(fixture.componentInstance.levelText.value).toBe('Diplomado');
    });

    it('editing the text after a selection resets levelId to null', () => {
      const { fixture } = setup();
      fixture.componentInstance.onLevelSelected(makeLevel(3, 'Diplomado'));
      fixture.componentInstance.onLevelInput('Diplo');
      expect(fixture.componentInstance.form.controls.levelId.value).toBeNull();
    });

    it('keeps levelId when the text still equals the selected title', () => {
      const { fixture } = setup();
      fixture.componentInstance.onLevelSelected(makeLevel(3, 'Diplomado'));
      fixture.componentInstance.onLevelInput('Diplomado');
      expect(fixture.componentInstance.form.controls.levelId.value).toBe(3);
    });

    it('shows "Selecciona un nivel." when touched and empty', () => {
      const { fixture } = setup();
      fixture.componentInstance.levelText.markAsTouched();
      fixture.componentInstance.levelText.updateValueAndValidity();
      fixture.detectChanges();
      const errors = fixture.debugElement
        .queryAll(By.css('mat-error'))
        .map((e) => (e.nativeElement.textContent ?? '').trim());
      expect(errors).toContain('Selecciona un nivel.');
    });

    it('renders the Nivel field between Apellido materno and Fecha de nacimiento', () => {
      const { fixture } = setup();
      const labels = fixture.debugElement
        .queryAll(By.css('mat-label'))
        .map((l) => (l.nativeElement.textContent ?? '').trim());
      const idx = labels.indexOf('Nivel');
      expect(labels[idx - 1]).toBe('Apellido materno');
      expect(labels[idx + 1]).toBe('Fecha de nacimiento');
    });
  });

  describe('submit', () => {
    it('POSTs the exact payload with role.id === 3, the selected level and ISO birthDate', () => {
      const { fixture, http, dialogRef, snackOpen } = setup();
      fillValid(fixture);
      fixture.componentInstance.onSubmit();

      const req = http.expectOne(USERS_URL);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        username: 'jdoe',
        password: 'secret12',
        profile: {
          name: 'Juan',
          parentLastName: 'Doe',
          motherLastName: 'Smith',
          birthDate: '1969-05-31T00:00:00.000+00:00',
          address: 'Calle 1',
          church: 'Central',
          email: 'jdoe@example.com',
          phone: '5551234567',
        },
        role: { id: 3 },
        level: { id: 2 },
      });
      expect(typeof req.request.body.role.id).toBe('number');
      expect(typeof req.request.body.level.id).toBe('number');

      const created: UserDto = { id: 99, username: 'jdoe' };
      req.flush(created);

      expect(snackOpen).toHaveBeenCalledWith(
        SUCCESS_MESSAGE,
        'Cerrar',
        expect.objectContaining({ duration: 3000 })
      );
      expect(dialogRef.close).toHaveBeenCalledWith(created);
    });

    it('shows error snackbar, keeps dialog open, re-enables form, and logs on failure', () => {
      const errSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      const { fixture, http, dialogRef, snackOpen } = setup();
      fillValid(fixture);
      fixture.componentInstance.onSubmit();
      http
        .expectOne(USERS_URL)
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
        '[student-new] failed to create student',
        expect.anything()
      );
      for (const call of errSpy.mock.calls) {
        for (const arg of call) {
          expect(JSON.stringify(arg)).not.toContain('secret12');
        }
      }
      errSpy.mockRestore();
    });
  });

  describe('cancel', () => {
    it('closes the dialog with undefined and issues no HTTP request', () => {
      const { fixture, dialogRef, http } = setup();
      fixture.componentInstance.onCancel();
      expect(dialogRef.close).toHaveBeenCalledWith();
      http.expectNone(USERS_URL);
    });
  });
});
