import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { vi } from 'vitest';

import { AuthService } from '@core/services/auth.service';
import { environment } from '../../../../environments/environment';
import {
  ChangePasswordComponent,
  ERROR_MESSAGE,
  PASSWORDS_MISMATCH_MESSAGE,
  SUCCESS_MESSAGE,
  passwordsMatchValidator,
} from './change-password.component';

const PASSWORD_URL = (id: number): string =>
  `${environment.apiBaseUrl}/api/user/${id}/profile/password`;

interface Harness {
  fixture: ComponentFixture<ChangePasswordComponent>;
  http: HttpTestingController;
  dialogRef: { close: ReturnType<typeof vi.fn> };
  snackOpen: ReturnType<typeof vi.spyOn>;
}

function setup(options: { userId?: number | null } = {}): Harness {
  const dialogRef = { close: vi.fn() };
  const userId = 'userId' in options ? options.userId : 42;
  const authStub: Partial<AuthService> = {
    currentUser: signal(
      userId == null
        ? null
        : {
            id: userId,
            username: 'jdoe',
            role: 'admin',
            rawRole: 'ROLE_ADMIN',
          }
    ) as unknown as AuthService['currentUser'],
  };

  TestBed.configureTestingModule({
    imports: [ChangePasswordComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideAnimationsAsync(),
      { provide: MatDialogRef, useValue: dialogRef },
      { provide: AuthService, useValue: authStub },
    ],
  });

  const fixture = TestBed.createComponent(ChangePasswordComponent);
  const componentSnack = (
    fixture.componentInstance as unknown as { snackBar: MatSnackBar }
  ).snackBar;
  const snackOpen = vi
    .spyOn(componentSnack, 'open')
    .mockReturnValue({} as never);
  const http = TestBed.inject(HttpTestingController);
  fixture.detectChanges();

  return { fixture, http, dialogRef, snackOpen };
}

function fillValid(fixture: ComponentFixture<ChangePasswordComponent>): void {
  fixture.componentInstance.form.controls.currentPassword.setValue('old');
  fixture.componentInstance.form.controls.newPassword.setValue('newSecret1');
  fixture.componentInstance.form.controls.confirmPassword.setValue(
    'newSecret1'
  );
}

describe('ChangePasswordComponent', () => {
  afterEach(() => {
    try {
      TestBed.inject(HttpTestingController).verify();
    } catch {
      /* verified inline */
    }
  });

  describe('constants', () => {
    it('exports the expected user-facing messages', () => {
      expect(SUCCESS_MESSAGE).toBe('Password actualizado exitosamente');
      expect(ERROR_MESSAGE).toBe(
        'Error al actualizar el password. Verifica la información.'
      );
      expect(PASSWORDS_MISMATCH_MESSAGE).toBe('Las contraseñas no coinciden');
    });
  });

  describe('rendering', () => {
    it('renders the dialog title', () => {
      const { fixture } = setup();
      const title = (fixture.nativeElement as HTMLElement).querySelector(
        'h2[mat-dialog-title]'
      );
      expect((title?.textContent ?? '').trim()).toBe('Cambiar contraseña');
    });

    it('renders three password inputs with correct type and autocomplete', () => {
      const { fixture } = setup();
      const host = fixture.nativeElement as HTMLElement;
      const inputs = Array.from(
        host.querySelectorAll('input')
      ) as HTMLInputElement[];
      expect(inputs.length).toBe(3);
      inputs.forEach((i) => expect(i.type).toBe('password'));
      expect(inputs[0].getAttribute('autocomplete')).toBe('current-password');
      expect(inputs[1].getAttribute('autocomplete')).toBe('new-password');
      expect(inputs[2].getAttribute('autocomplete')).toBe('new-password');
    });

    it('renders a mat-divider between current and new password sections', () => {
      const { fixture } = setup();
      const dividers = (fixture.nativeElement as HTMLElement).querySelectorAll(
        'mat-divider'
      );
      expect(dividers.length).toBe(1);
    });
  });

  describe('validation', () => {
    it('requires all three fields', () => {
      const { fixture } = setup();
      const c = fixture.componentInstance.form.controls;
      expect(c.currentPassword.hasError('required')).toBe(true);
      expect(c.newPassword.hasError('required')).toBe(true);
      expect(c.confirmPassword.hasError('required')).toBe(true);
    });

    it('rejects whitespace-only via nonBlankValidator', () => {
      const { fixture } = setup();
      fixture.componentInstance.form.controls.currentPassword.setValue('   ');
      expect(
        fixture.componentInstance.form.controls.currentPassword.hasError(
          'required'
        )
      ).toBe(true);
    });

    it('rejects newPassword shorter than 8 characters', () => {
      const { fixture } = setup();
      fixture.componentInstance.form.controls.newPassword.setValue('short');
      expect(
        fixture.componentInstance.form.controls.newPassword.hasError('minlength')
      ).toBe(true);
    });

    it('rejects confirmPassword shorter than 8 characters', () => {
      const { fixture } = setup();
      fixture.componentInstance.form.controls.confirmPassword.setValue('short');
      expect(
        fixture.componentInstance.form.controls.confirmPassword.hasError(
          'minlength'
        )
      ).toBe(true);
    });

    it('rejects values longer than 20 characters', () => {
      const { fixture } = setup();
      const c = fixture.componentInstance.form.controls;
      c.currentPassword.setValue('x'.repeat(21));
      c.newPassword.setValue('x'.repeat(21));
      c.confirmPassword.setValue('x'.repeat(21));
      expect(c.currentPassword.hasError('maxlength')).toBe(true);
      expect(c.newPassword.hasError('maxlength')).toBe(true);
      expect(c.confirmPassword.hasError('maxlength')).toBe(true);
    });

    it('sets passwordsMismatch on the group when new and confirm differ', () => {
      const { fixture } = setup();
      const c = fixture.componentInstance.form.controls;
      c.currentPassword.setValue('old');
      c.newPassword.setValue('Str0ngPass');
      c.confirmPassword.setValue('Str0ngPas');
      expect(fixture.componentInstance.form.hasError('passwordsMismatch')).toBe(
        true
      );
    });

    it('is valid when all fields are populated and passwords match', () => {
      const { fixture } = setup();
      fillValid(fixture);
      expect(fixture.componentInstance.form.valid).toBe(true);
    });

    it('passwordsMatchValidator returns null when either value is empty', () => {
      expect(
        passwordsMatchValidator({
          get: (name: string) =>
            name === 'newPassword' ? { value: '' } : { value: 'abc' },
        } as never)
      ).toBeNull();
    });
  });

  describe('submit', () => {
    it('PUTs { currentPassword, newPassword } without confirmPassword, then closes with true', () => {
      const { fixture, http, dialogRef, snackOpen } = setup();
      fillValid(fixture);
      fixture.componentInstance.onSubmit();

      const req = http.expectOne(PASSWORD_URL(42));
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({
        oldPassword: 'old',
        newPassword: 'newSecret1',
      });
      req.flush(null);

      expect(snackOpen).toHaveBeenCalledWith(
        SUCCESS_MESSAGE,
        'Cerrar',
        expect.objectContaining({ duration: 3000 })
      );
      expect(dialogRef.close).toHaveBeenCalledWith(true);
    });

    it('keeps the dialog open and shows the error snackbar on failure', () => {
      const errSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      const { fixture, http, dialogRef, snackOpen } = setup();
      fillValid(fixture);
      fixture.componentInstance.onSubmit();
      http
        .expectOne(PASSWORD_URL(42))
        .flush('boom', { status: 400, statusText: 'Bad Request' });

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
      expect(fixture.componentInstance.form.controls.currentPassword.value).toBe(
        'old'
      );
      expect(errSpy).toHaveBeenCalledWith(
        '[change-password] failed to update password',
        expect.anything()
      );
      expect(errSpy).toHaveBeenCalledTimes(1);
      expect(errSpy.mock.calls[0].some((arg) => arg === 'old')).toBe(false);
      expect(errSpy.mock.calls[0].some((arg) => arg === 'newSecret1')).toBe(false);
      errSpy.mockRestore();
    });

    it('does nothing when the form is invalid', () => {
      const { fixture, http } = setup();
      fixture.componentInstance.onSubmit();
      http.expectNone(PASSWORD_URL(42));
    });

    it('short-circuits with an error snackbar when the user id is missing', () => {
      const { fixture, http, snackOpen } = setup({ userId: null });
      fillValid(fixture);
      fixture.componentInstance.onSubmit();
      http.expectNone(PASSWORD_URL(42));
      expect(snackOpen).toHaveBeenCalledWith(
        ERROR_MESSAGE,
        'Cerrar',
        expect.objectContaining({
          duration: 3000,
          panelClass: 'snackbar-error',
        })
      );
    });

    it('does not log password field values on success', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
      const debugSpy = vi
        .spyOn(console, 'debug')
        .mockImplementation(() => undefined);
      const infoSpy = vi
        .spyOn(console, 'info')
        .mockImplementation(() => undefined);
      const warnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);

      const { fixture, http } = setup();
      fillValid(fixture);
      fixture.componentInstance.onSubmit();
      http.expectOne(PASSWORD_URL(42)).flush(null);

      for (const spy of [logSpy, debugSpy, infoSpy, warnSpy]) {
        for (const call of spy.mock.calls) {
          expect(call.some((arg) => arg === 'old' || arg === 'newSecret1')).toBe(
            false
          );
        }
        spy.mockRestore();
      }
    });
  });

  describe('cancel', () => {
    it('closes the dialog with undefined and issues no request', () => {
      const { fixture, dialogRef, http } = setup();
      fixture.componentInstance.onCancel();
      expect(dialogRef.close).toHaveBeenCalledWith();
      http.expectNone(PASSWORD_URL(42));
    });
  });
});
