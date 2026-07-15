import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { vi } from 'vitest';

import { UserDto } from '@core/models/auth.model';
import { AuthService } from '@core/services/auth.service';
import { environment } from '../../../../environments/environment';
import {
  ERROR_MESSAGE,
  LOAD_ERROR_MESSAGE,
  ProfileEditComponent,
  SUCCESS_MESSAGE,
} from './profile-edit.component';

const ME_URL = `${environment.apiBaseUrl}/api/user/me`;
const PROFILE_URL = (id: number): string =>
  `${environment.apiBaseUrl}/api/user/${id}/profile`;

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
  fixture: ComponentFixture<ProfileEditComponent>;
  http: HttpTestingController;
  snackOpen: ReturnType<typeof vi.spyOn>;
  user: UserDto;
}

function setup(): Harness {
  const user = makeUser();
  const authStub: Partial<AuthService> = {
    currentUser: signal({
      id: user.id,
      username: user.username,
      role: 'admin',
      rawRole: 'ROLE_ADMIN',
    }) as unknown as AuthService['currentUser'],
  };

  TestBed.configureTestingModule({
    imports: [ProfileEditComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideAnimationsAsync(),
      { provide: AuthService, useValue: authStub },
    ],
  });

  const fixture = TestBed.createComponent(ProfileEditComponent);
  const componentSnack = (
    fixture.componentInstance as unknown as { snackBar: MatSnackBar }
  ).snackBar;
  const snackOpen = vi
    .spyOn(componentSnack, 'open')
    .mockReturnValue({} as never);
  const http = TestBed.inject(HttpTestingController);
  fixture.detectChanges();

  return { fixture, http, snackOpen, user };
}

function resolveGetMe(http: HttpTestingController, user: UserDto): void {
  http.expectOne(ME_URL).flush(user);
}

describe('ProfileEditComponent', () => {
  afterEach(() => {
    try {
      TestBed.inject(HttpTestingController).verify();
    } catch {
      /* verified inline */
    }
  });

  describe('constants', () => {
    it('exports the expected user-facing messages', () => {
      expect(LOAD_ERROR_MESSAGE).toBe('Error al cargar el perfil');
      expect(SUCCESS_MESSAGE).toBe('Perfil actualizado exitosamente');
      expect(ERROR_MESSAGE).toBe('Error al actualizar el perfil');
    });
  });

  describe('load / prefill', () => {
    it('shows a spinner and hides the form until GET /api/user/me resolves', () => {
      const { fixture, http, user } = setup();
      const host = fixture.nativeElement as HTMLElement;
      expect(host.querySelector('mat-progress-spinner')).toBeTruthy();
      expect(host.querySelector('form')).toBeNull();

      resolveGetMe(http, user);
      fixture.detectChanges();

      expect(host.querySelector('form')).toBeTruthy();
    });

    it('prefills the form from the /me response', () => {
      const { fixture, http, user } = setup();
      resolveGetMe(http, user);

      const c = fixture.componentInstance.form.controls;
      expect(c.name.value).toBe(user.profile?.name);
      expect(c.parentLastName.value).toBe(user.profile?.parentLastName);
      expect(c.motherLastName.value).toBe(user.profile?.motherLastName);
      expect(c.email.value).toBe(user.profile?.email);
      expect(c.phone.value).toBe(user.profile?.phone);
      expect(c.address.value).toBe(user.profile?.address);
      expect(c.church.value).toBe(user.profile?.church);
      const bd = c.birthDate.value as Date;
      expect(bd.getFullYear()).toBe(1969);
      expect(bd.getMonth()).toBe(4);
      expect(bd.getDate()).toBe(31);
    });

    it('renders the title "Mi perfil: <username>"', () => {
      const { fixture, http, user } = setup();
      resolveGetMe(http, user);
      fixture.detectChanges();
      const title = (fixture.nativeElement as HTMLElement).querySelector(
        'mat-card-title'
      );
      expect((title?.textContent ?? '').trim()).toBe('Mi perfil: jdoe');
    });

    it('hides the form and shows an error snackbar when /me fails', () => {
      const errSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      const { fixture, http, snackOpen } = setup();
      http
        .expectOne(ME_URL)
        .flush('boom', { status: 500, statusText: 'Server Error' });
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).querySelector('form')).toBeNull();
      expect(snackOpen).toHaveBeenCalledWith(
        LOAD_ERROR_MESSAGE,
        'Cerrar',
        expect.objectContaining({
          duration: 3000,
          panelClass: 'snackbar-error',
        })
      );
      expect(fixture.componentInstance.loadFailed()).toBe(true);
      errSpy.mockRestore();
    });
  });

  describe('validation', () => {
    it('is valid with a well-formed prefill', () => {
      const { fixture, http, user } = setup();
      resolveGetMe(http, user);
      expect(fixture.componentInstance.form.valid).toBe(true);
    });

    it('is invalid when any required field is cleared', () => {
      const { fixture, http, user } = setup();
      resolveGetMe(http, user);
      fixture.componentInstance.form.controls.name.setValue('');
      expect(fixture.componentInstance.form.invalid).toBe(true);
    });

    it('rejects blank whitespace via nonBlankValidator', () => {
      const { fixture, http, user } = setup();
      resolveGetMe(http, user);
      fixture.componentInstance.form.controls.phone.setValue('   ');
      expect(
        fixture.componentInstance.form.controls.phone.hasError('required')
      ).toBe(true);
    });

    it('rejects invalid email format', () => {
      const { fixture, http, user } = setup();
      resolveGetMe(http, user);
      fixture.componentInstance.form.controls.email.setValue('not-an-email');
      expect(
        fixture.componentInstance.form.controls.email.hasError('email')
      ).toBe(true);
    });

    it('enforces max lengths per field', () => {
      const { fixture, http, user } = setup();
      resolveGetMe(http, user);
      const c = fixture.componentInstance.form.controls;
      c.name.setValue('a'.repeat(101));
      expect(c.name.hasError('maxlength')).toBe(true);
      c.email.setValue('a'.repeat(51) + '@x.com');
      expect(c.email.hasError('maxlength')).toBe(true);
      c.address.setValue('a'.repeat(201));
      expect(c.address.hasError('maxlength')).toBe(true);
    });
  });

  describe('save / actions', () => {
    it('renders the Guardar and Cambiar password buttons; Cambiar password is disabled', () => {
      const { fixture, http, user } = setup();
      resolveGetMe(http, user);
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      const buttons = Array.from(host.querySelectorAll('button')) as HTMLButtonElement[];
      const guardar = buttons.find((b) => b.textContent?.trim() === 'Guardar');
      const changePwd = buttons.find(
        (b) => b.textContent?.trim() === 'Cambiar password'
      );
      expect(guardar).toBeTruthy();
      expect(changePwd).toBeTruthy();
      expect(changePwd!.disabled).toBe(true);
    });

    it('clicking Cambiar password fires the no-op handler and issues no HTTP request', () => {
      const { fixture, http, user } = setup();
      resolveGetMe(http, user);
      fixture.detectChanges();
      const spy = vi.spyOn(fixture.componentInstance, 'onChangePassword');
      fixture.componentInstance.onChangePassword();
      expect(spy).toHaveBeenCalled();
      http.expectNone(PROFILE_URL(user.id));
    });

    it('PUTs the trimmed ProfileDto payload with ISO birthDate and re-prefills from response', () => {
      const { fixture, http, snackOpen, user } = setup();
      resolveGetMe(http, user);

      fixture.componentInstance.form.controls.name.setValue(' Ana Maria ');
      fixture.componentInstance.onSubmit();

      const req = http.expectOne(PROFILE_URL(user.id));
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({
        name: 'Ana Maria',
        parentLastName: 'Doe',
        motherLastName: 'Smith',
        birthDate: '1969-05-31T00:00:00.000+00:00',
        email: 'jdoe@example.com',
        phone: '5551234567',
        address: 'Calle 1',
        church: 'Central',
      });

      const updated: UserDto = {
        ...user,
        profile: { ...user.profile!, name: 'Ana Maria' },
      };
      req.flush(updated);

      expect(fixture.componentInstance.form.controls.name.value).toBe(
        'Ana Maria'
      );
      expect(fixture.componentInstance.user()).toEqual(updated);
      expect(fixture.componentInstance.saving()).toBe(false);
      expect(fixture.componentInstance.form.enabled).toBe(true);
      expect(snackOpen).toHaveBeenCalledWith(
        SUCCESS_MESSAGE,
        'Cerrar',
        expect.objectContaining({ duration: 3000 })
      );
    });

    it('shows error snackbar, logs, and re-enables the form on failure', () => {
      const errSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      const { fixture, http, snackOpen, user } = setup();
      resolveGetMe(http, user);

      fixture.componentInstance.onSubmit();
      http
        .expectOne(PROFILE_URL(user.id))
        .flush('boom', { status: 500, statusText: 'Server Error' });

      expect(snackOpen).toHaveBeenCalledWith(
        ERROR_MESSAGE,
        'Cerrar',
        expect.objectContaining({
          duration: 3000,
          panelClass: 'snackbar-error',
        })
      );
      expect(fixture.componentInstance.saving()).toBe(false);
      expect(fixture.componentInstance.form.enabled).toBe(true);
      expect(errSpy).toHaveBeenCalledWith(
        '[profile-edit] failed to update profile',
        expect.anything()
      );
      errSpy.mockRestore();
    });

    it('short-circuits with an error snackbar and no HTTP request when user id is missing', () => {
      const { fixture, http, snackOpen, user } = setup();
      resolveGetMe(http, user);

      fixture.componentInstance.user.set({ ...user, id: undefined as unknown as number });
      fixture.componentInstance.onSubmit();

      http.expectNone(PROFILE_URL(user.id));
      expect(snackOpen).toHaveBeenCalledWith(
        ERROR_MESSAGE,
        'Cerrar',
        expect.objectContaining({
          duration: 3000,
          panelClass: 'snackbar-error',
        })
      );
    });
  });
});
