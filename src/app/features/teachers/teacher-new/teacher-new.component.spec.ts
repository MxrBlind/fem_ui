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
import {
  ERROR_MESSAGE,
  SUCCESS_MESSAGE,
  TeacherNewComponent,
  toBirthDateIso,
} from './teacher-new.component';

const USERS_URL = `${environment.apiBaseUrl}/api/user`;

interface Harness {
  fixture: ComponentFixture<TeacherNewComponent>;
  http: HttpTestingController;
  dialogRef: { close: ReturnType<typeof vi.fn> };
  snackOpen: ReturnType<typeof vi.spyOn>;
}

function setup(): Harness {
  const dialogRef = { close: vi.fn() };

  TestBed.configureTestingModule({
    imports: [TeacherNewComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideAnimationsAsync(),
      { provide: MatDialogRef, useValue: dialogRef },
    ],
  });

  const fixture = TestBed.createComponent(TeacherNewComponent);
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

function fillValid(fixture: ComponentFixture<TeacherNewComponent>): void {
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

describe('TeacherNewComponent', () => {
  afterEach(() => {
    try {
      TestBed.inject(HttpTestingController).verify();
    } catch {
      /* some tests already verify */
    }
  });

  describe('toBirthDateIso', () => {
    it('serializes to YYYY-MM-DDT00:00:00.000+00:00', () => {
      expect(toBirthDateIso(new Date(1969, 4, 31))).toBe(
        '1969-05-31T00:00:00.000+00:00'
      );
    });

    it('does not end with Z', () => {
      const iso = toBirthDateIso(new Date(2000, 0, 1));
      expect(iso.endsWith('Z')).toBe(false);
      expect(iso.endsWith('+00:00')).toBe(true);
    });

    it('pads month and day', () => {
      expect(toBirthDateIso(new Date(2027, 0, 3))).toBe(
        '2027-01-03T00:00:00.000+00:00'
      );
    });
  });

  describe('form validity', () => {
    it('is invalid initially and submit does nothing', () => {
      const { fixture, http } = setup();
      expect(fixture.componentInstance.form.invalid).toBe(true);
      fixture.componentInstance.onSubmit();
      http.expectNone(USERS_URL);
    });

    it('has no "role" form control (role is not user-editable)', () => {
      const { fixture } = setup();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((fixture.componentInstance.form.controls as any).role).toBeUndefined();
    });
  });

  describe('submit', () => {
    it('POSTs the exact payload with role.id === 2 (number) and ISO birthDate', () => {
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
        role: { id: 2 },
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
        '[teacher-new] failed to create teacher',
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
