import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';

import { AuthService } from '../../../core/services/auth.service';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let authSpy: { login: ReturnType<typeof vi.fn> };
  let router: Router;
  let snackBarOpen: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    authSpy = { login: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideAnimationsAsync('noop'),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authSpy }
      ]
    }).compileComponents();

    localStorage.clear();
    fixture = TestBed.createComponent(LoginComponent);
    router = TestBed.inject(Router);
    const componentSnackBar = (fixture.componentInstance as unknown as { snackBar: MatSnackBar }).snackBar;
    snackBarOpen = vi.spyOn(componentSnackBar, 'open').mockReturnValue({} as never) as unknown as ReturnType<typeof vi.fn>;
    fixture.detectChanges();
  });

  afterEach(() => localStorage.clear());

  function getInput(name: string): HTMLInputElement {
    return fixture.nativeElement.querySelector(`input[formControlName="${name}"]`) as HTMLInputElement;
  }

  function setValue(name: string, value: string) {
    const input = getInput(name);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
  }

  it('renders the FEM logo and Spanish labels', () => {
    const html: string = fixture.nativeElement.textContent;
    expect(fixture.nativeElement.querySelector('img[alt="FEM"]')).toBeTruthy();
    expect(html).toContain('Usuario');
    expect(html).toContain('Contraseña');
    expect(html).toContain('Entrar');
    expect(html).toContain('Regístrate');
  });

  it('disables Entrar until the form is valid', () => {
    const submitBtn = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);
    setValue('username', 'alice');
    setValue('password', 'pass1');
    expect(submitBtn.disabled).toBe(false);
  });

  it('shows required Spanish errors after blur', () => {
    setValue('username', '');
    setValue('password', '');
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('El usuario es obligatorio.');
    expect(text).toContain('La contraseña es obligatoria.');
  });

  it('shows minlength Spanish error after blur', () => {
    setValue('password', 'abc');
    expect(fixture.nativeElement.textContent).toContain('La contraseña debe tener al menos 4 caracteres.');
  });

  it('password toggle flips type and exposes aria-label', () => {
    const passwordInput = getInput('password');
    const toggle = fixture.nativeElement.querySelector('button[aria-label="Mostrar/Ocultar contraseña"]') as HTMLButtonElement;
    expect(toggle).toBeTruthy();
    expect(passwordInput.type).toBe('password');
    toggle.click();
    fixture.detectChanges();
    expect(getInput('password').type).toBe('text');
    toggle.click();
    fixture.detectChanges();
    expect(getInput('password').type).toBe('password');
  });

  it('on success delegates to AuthService.login() and shows success snackbar', async () => {
    // AuthService.login() now owns token storage AND role-home navigation;
    // the component just reacts to success/error for UX.
    authSpy.login.mockReturnValue(of({ id: 1, username: 'alice', role: 'admin', rawRole: 'admin' }));

    setValue('username', 'alice');
    setValue('password', 'pass1');
    (fixture.componentInstance as unknown as { onSubmit(): void }).onSubmit();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(authSpy.login).toHaveBeenCalledWith({ username: 'alice', password: 'pass1' });
    expect(snackBarOpen).toHaveBeenCalledWith('Sesión iniciada', undefined, { duration: 2000 });
  });

  it('on 401 shows error snackbar, clears password, preserves username', async () => {
    authSpy.login.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' })));

    setValue('username', 'alice');
    setValue('password', 'pass1');
    (fixture.componentInstance as unknown as { onSubmit(): void }).onSubmit();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(snackBarOpen).toHaveBeenCalledWith(
      'Usuario o contraseña incorrectos.',
      undefined,
      expect.objectContaining({ panelClass: 'snackbar-error', duration: 5000 })
    );
    expect(getInput('username').value).toBe('alice');
    expect(getInput('password').value).toBe('');
  });

  it('on 403 treats as wrong credentials (Spring Security default)', async () => {
    authSpy.login.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403, statusText: 'Forbidden' })));
    setValue('username', 'alice');
    setValue('password', 'pass1');
    (fixture.componentInstance as unknown as { onSubmit(): void }).onSubmit();
    await fixture.whenStable();
    expect(snackBarOpen).toHaveBeenCalledWith(
      'Usuario o contraseña incorrectos.',
      undefined,
      expect.objectContaining({ panelClass: 'snackbar-error' })
    );
    expect(getInput('username').value).toBe('alice');
    expect(getInput('password').value).toBe('');
  });

  it('on non-credential error shows generic Spanish snackbar', async () => {
    authSpy.login.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500, statusText: 'Server' })));
    setValue('username', 'alice');
    setValue('password', 'pass1');
    (fixture.componentInstance as unknown as { onSubmit(): void }).onSubmit();
    await fixture.whenStable();
    expect(snackBarOpen).toHaveBeenCalledWith(
      'No fue posible iniciar sesión. Inténtalo de nuevo.',
      undefined,
      expect.objectContaining({ panelClass: 'snackbar-error' })
    );
  });

  it('Regístrate opens Pronto… snackbar without HTTP or navigation', () => {
    const navigateSpy = vi.spyOn(router, 'navigateByUrl');
    (fixture.componentInstance as unknown as { onRegister(): void }).onRegister();
    expect(snackBarOpen).toHaveBeenCalledWith('Pronto…', undefined, { duration: 3000 });
    expect(authSpy.login).not.toHaveBeenCalled();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('keyboard Enter submits the form', async () => {
    authSpy.login.mockReturnValue(of({ token: 't', type: 'Bearer', expirationDate: 'e' }));
    setValue('username', 'alice');
    setValue('password', 'pass1');
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(authSpy.login).toHaveBeenCalled();
  });
});
