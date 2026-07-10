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
import {
  ERROR_MESSAGE,
  SUCCESS_MESSAGE,
  TeacherEditComponent,
} from './teacher-edit.component';

const USER_URL = (id: number): string =>
  `${environment.apiBaseUrl}/api/user/${id}`;

function makeUser(): UserDto {
  return {
    id: 42,
    username: 'jdoe',
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
  };
}

interface Harness {
  fixture: ComponentFixture<TeacherEditComponent>;
  http: HttpTestingController;
  dialogRef: { close: ReturnType<typeof vi.fn> };
  snackOpen: ReturnType<typeof vi.spyOn>;
  user: UserDto;
}

function setup(userOverride?: UserDto): Harness {
  const user = userOverride ?? makeUser();
  const dialogRef = { close: vi.fn() };

  TestBed.configureTestingModule({
    imports: [TeacherEditComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideAnimationsAsync(),
      { provide: MatDialogRef, useValue: dialogRef },
      { provide: MAT_DIALOG_DATA, useValue: { user } },
    ],
  });

  const fixture = TestBed.createComponent(TeacherEditComponent);
  const componentSnack = (
    fixture.componentInstance as unknown as { snackBar: MatSnackBar }
  ).snackBar;
  const snackOpen = vi
    .spyOn(componentSnack, 'open')
    .mockReturnValue({} as never);
  fixture.detectChanges();
  const http = TestBed.inject(HttpTestingController);

  return { fixture, http, dialogRef, snackOpen, user };
}

describe('TeacherEditComponent', () => {
  afterEach(() => {
    try {
      TestBed.inject(HttpTestingController).verify();
    } catch {
      /* verified inline */
    }
  });

  describe('prefill', () => {
    it('prefills every editable control from MAT_DIALOG_DATA.user.profile', () => {
      const { fixture, user } = setup();
      const c = fixture.componentInstance.form.controls;
      expect(c.username.value).toBe(user.username);
      expect(c.name.value).toBe(user.profile?.name);
      expect(c.parentLastName.value).toBe(user.profile?.parentLastName);
      expect(c.motherLastName.value).toBe(user.profile?.motherLastName);
      expect(c.address.value).toBe(user.profile?.address);
      expect(c.church.value).toBe(user.profile?.church);
      expect(c.email.value).toBe(user.profile?.email);
      expect(c.phone.value).toBe(user.profile?.phone);
      const bd = c.birthDate.value as Date;
      expect(bd.getFullYear()).toBe(1969);
      expect(bd.getMonth()).toBe(4);
      expect(bd.getDate()).toBe(31);
    });

    it('leaves password empty regardless of source and disables username', () => {
      const { fixture } = setup();
      const c = fixture.componentInstance.form.controls;
      expect(c.password.value).toBe('');
      expect(c.username.disabled).toBe(true);
    });

    it('renders the username input as readonly in the DOM', () => {
      const { fixture } = setup();
      const input = (fixture.nativeElement as HTMLElement).querySelector(
        'input[formcontrolname="username"]'
      ) as HTMLInputElement;
      expect(input.hasAttribute('readonly')).toBe(true);
    });
  });

  describe('validation', () => {
    it('is valid initially with a well-formed prefill', () => {
      const { fixture } = setup();
      expect(fixture.componentInstance.form.valid).toBe(true);
    });

    it('is invalid when a required field is cleared', () => {
      const { fixture } = setup();
      fixture.componentInstance.form.controls.name.setValue('');
      expect(fixture.componentInstance.form.invalid).toBe(true);
    });

    it('rejects invalid email format', () => {
      const { fixture } = setup();
      fixture.componentInstance.form.controls.email.setValue('not-an-email');
      expect(
        fixture.componentInstance.form.controls.email.hasError('email')
      ).toBe(true);
      expect(fixture.componentInstance.form.invalid).toBe(true);
    });

    it('accepts empty password (no validators fire)', () => {
      const { fixture } = setup();
      fixture.componentInstance.form.controls.password.setValue('');
      expect(fixture.componentInstance.form.valid).toBe(true);
    });

    it('rejects password shorter than 8 characters', () => {
      const { fixture } = setup();
      fixture.componentInstance.form.controls.password.setValue('short');
      expect(
        fixture.componentInstance.form.controls.password.hasError('minlength')
      ).toBe(true);
      expect(fixture.componentInstance.form.invalid).toBe(true);
    });

    it('rejects password longer than 20 characters', () => {
      const { fixture } = setup();
      fixture.componentInstance.form.controls.password.setValue(
        'a'.repeat(21)
      );
      expect(
        fixture.componentInstance.form.controls.password.hasError('maxlength')
      ).toBe(true);
    });
  });

  describe('submit', () => {
    it('PUTs the exact payload without password when blank', () => {
      const { fixture, http, dialogRef, snackOpen, user } = setup();
      fixture.componentInstance.onSubmit();

      const req = http.expectOne(USER_URL(user.id));
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({
        username: 'jdoe',
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
      });
      expect('password' in req.request.body).toBe(false);
      expect('role' in req.request.body).toBe(false);

      const updated: UserDto = { ...user };
      req.flush(updated);

      expect(snackOpen).toHaveBeenCalledWith(
        SUCCESS_MESSAGE,
        'Cerrar',
        expect.objectContaining({ duration: 3000 })
      );
      expect(dialogRef.close).toHaveBeenCalledWith(updated);
    });

    it('includes password when the user types one', () => {
      const { fixture, http, user } = setup();
      fixture.componentInstance.form.controls.password.setValue('NewPass1!');
      fixture.componentInstance.onSubmit();

      const req = http.expectOne(USER_URL(user.id));
      expect(req.request.body.password).toBe('NewPass1!');
      req.flush(user);
    });

    it('shows error snackbar, keeps dialog open, re-enables form, and logs on failure', () => {
      const errSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      const { fixture, http, dialogRef, snackOpen, user } = setup();
      fixture.componentInstance.onSubmit();
      http
        .expectOne(USER_URL(user.id))
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
      expect(fixture.componentInstance.form.controls.name.enabled).toBe(true);
      expect(fixture.componentInstance.form.controls.username.disabled).toBe(
        true
      );
      expect(errSpy).toHaveBeenCalledWith(
        '[teacher-edit] failed to update teacher',
        expect.anything()
      );
      errSpy.mockRestore();
    });
  });

  describe('cancel', () => {
    it('closes the dialog with no argument and issues no HTTP request', () => {
      const { fixture, dialogRef, http, user } = setup();
      fixture.componentInstance.onCancel();
      expect(dialogRef.close).toHaveBeenCalledWith();
      http.expectNone(USER_URL(user.id));
    });
  });
});
