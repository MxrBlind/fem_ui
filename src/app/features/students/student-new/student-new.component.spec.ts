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
import {
  ERROR_MESSAGE,
  StudentNewComponent,
  SUCCESS_MESSAGE,
} from './student-new.component';

const USERS_URL = `${environment.apiBaseUrl}/api/user`;

interface Harness {
  fixture: ComponentFixture<StudentNewComponent>;
  http: HttpTestingController;
  dialogRef: { close: ReturnType<typeof vi.fn> };
  snackOpen: ReturnType<typeof vi.spyOn>;
}

function setup(): Harness {
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

  return { fixture, http, dialogRef, snackOpen };
}

function fillValid(fixture: ComponentFixture<StudentNewComponent>): void {
  const c = fixture.componentInstance.form.controls;
  c.username.setValue('jdoe');
  c.password.setValue('secret12');
  c.name.setValue('Juan');
  c.parentLastName.setValue('Doe');
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

    it('renders all 10 field labels', () => {
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

  describe('submit', () => {
    it('POSTs the exact payload with role.id === 3 (number) and ISO birthDate', () => {
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
      });
      expect(typeof req.request.body.role.id).toBe('number');

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
