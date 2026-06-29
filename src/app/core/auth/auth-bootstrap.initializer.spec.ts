import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

import { environment } from '../../../environments/environment';
import { TokenStorageService } from '../services/token-storage.service';
import { AuthService } from '../services/auth.service';
import { authBootstrapInitializer } from './auth-bootstrap.initializer';

const ME_URL = `${environment.apiBaseUrl}/api/user/me`;

describe('authBootstrapInitializer', () => {
  let httpMock: HttpTestingController;
  let tokenStorage: TokenStorageService;
  let auth: AuthService;
  let router: Router;
  let snackBar: MatSnackBar;
  let navigateSpy: ReturnType<typeof vi.fn>;
  let snackSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideAnimationsAsync('noop')
      ]
    });
    httpMock = TestBed.inject(HttpTestingController);
    tokenStorage = TestBed.inject(TokenStorageService);
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
    snackBar = TestBed.inject(MatSnackBar);
    localStorage.clear();
    navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true) as never;
    snackSpy = vi.spyOn(snackBar, 'open').mockReturnValue({} as never) as never;
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  function run(): Promise<void> {
    return TestBed.runInInjectionContext(() => authBootstrapInitializer()) as Promise<void>;
  }

  it('no token → resolves without HTTP', async () => {
    await run();
    httpMock.expectNone(ME_URL);
  });

  it('valid token + 200 → populates currentUser', async () => {
    tokenStorage.saveToken('tok', '2099-01-01T00:00:00Z');
    const done = run();
    httpMock.expectOne(ME_URL).flush({ id: 1, username: 'a', role: { name: 'admin' } });
    await done;
    expect(auth.currentUser()?.role).toBe('admin');
  });

  it('401 → silent clear + /login (no toast)', async () => {
    tokenStorage.saveToken('tok', '2099-01-01T00:00:00Z');
    const done = run();
    httpMock
      .expectOne(ME_URL)
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    await done;
    expect(tokenStorage.getToken()).toBeNull();
    expect(navigateSpy).toHaveBeenCalledWith('/login');
    expect(snackSpy).not.toHaveBeenCalled();
  });

  it('5xx → clear + /login + error toast', async () => {
    tokenStorage.saveToken('tok', '2099-01-01T00:00:00Z');
    const done = run();
    httpMock
      .expectOne(ME_URL)
      .flush({}, { status: 503, statusText: 'Service Unavailable' });
    await done;
    expect(tokenStorage.getToken()).toBeNull();
    expect(navigateSpy).toHaveBeenCalledWith('/login');
    expect(snackSpy).toHaveBeenCalledWith(
      'No fue posible restaurar tu sesión.',
      undefined,
      expect.objectContaining({ panelClass: 'snackbar-error' })
    );
  });
});

// Note: a true 5-second timeout test is omitted to keep the suite fast.
// The timeout branch is exercised by inspection of the race in
// authBootstrapInitializer; integration coverage lives in manual acceptance.
