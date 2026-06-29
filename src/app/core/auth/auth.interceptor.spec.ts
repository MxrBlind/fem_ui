import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';
import { TokenStorageService } from '../services/token-storage.service';
import { UserDto } from '../models/auth.model';
import { authInterceptor } from './auth.interceptor';

const ME_URL = `${environment.apiBaseUrl}/api/user/me`;
const PROTECTED_URL = `${environment.apiBaseUrl}/api/courses`;
const PUBLIC_URL = `${environment.apiBaseUrl}/public/token`;

function admin(): UserDto {
  return { id: 1, username: 'a', role: { id: 1, name: 'admin' } };
}

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let auth: AuthService;
  let tokenStorage: TokenStorageService;
  let router: Router;
  let navigateSpy: ReturnType<typeof vi.fn>;
  let logoutSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    tokenStorage = TestBed.inject(TokenStorageService);
    router = TestBed.inject(Router);
    localStorage.clear();
    navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true) as never;
    logoutSpy = vi.spyOn(auth, 'logout');
    tokenStorage.saveToken('tok', '2099-01-01T00:00:00Z');
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('attaches Bearer to protected URLs', async () => {
    const p = firstValueFrom(http.get(PROTECTED_URL));
    const req = httpMock.expectOne(PROTECTED_URL);
    expect(req.request.headers.get('Authorization')).toBe('Bearer tok');
    req.flush({});
    await p;
  });

  it('does NOT attach Bearer to /public/ URLs', async () => {
    const p = firstValueFrom(http.post(PUBLIC_URL, {}));
    const req = httpMock.expectOne(PUBLIC_URL);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
    await p;
  });

  it('401 → invokes logout()', async () => {
    const p = firstValueFrom(http.get(PROTECTED_URL)).catch(() => null);
    httpMock.expectOne(PROTECTED_URL).flush({}, { status: 401, statusText: 'Unauthorized' });
    await p;
    expect(logoutSpy).toHaveBeenCalled();
  });

  // Microtask flusher — `from(promise)` and Promise.then chains in the
  // interceptor mean we need a tick between flushing a response and seeing
  // the next request appear in HttpTestingController.
  const tick = () => new Promise<void>((r) => setTimeout(r, 0));

  it('403 → issues a single /me re-sync then retries the original request once', async () => {
    const p = firstValueFrom(http.get(PROTECTED_URL));
    httpMock.expectOne(PROTECTED_URL).flush({}, { status: 403, statusText: 'Forbidden' });
    await tick();

    httpMock.expectOne(ME_URL).flush(admin());
    await tick();

    const retried = httpMock.expectOne(PROTECTED_URL);
    expect(retried.request.headers.get('X-Auth-Retry')).toBe('1');
    retried.flush({ ok: true });

    await expect(p).resolves.toEqual({ ok: true });
  });

  it('N concurrent 403s issue exactly one /me and replay all originals', async () => {
    const p1 = firstValueFrom(http.get(PROTECTED_URL));
    const p2 = firstValueFrom(http.get(PROTECTED_URL));
    const p3 = firstValueFrom(http.get(PROTECTED_URL));

    const initial = httpMock.match(PROTECTED_URL);
    expect(initial).toHaveLength(3);
    initial.forEach((r) => r.flush({}, { status: 403, statusText: 'Forbidden' }));
    await tick();

    const meReqs = httpMock.match(ME_URL);
    expect(meReqs).toHaveLength(1);
    meReqs[0].flush(admin());
    await tick();

    const retried = httpMock.match(PROTECTED_URL);
    expect(retried).toHaveLength(3);
    retried.forEach((r) => r.flush({ ok: true }));

    await Promise.all([p1, p2, p3]);
  });

  it('retry returning 403 → redirects (no second retry, no loop)', async () => {
    const p = firstValueFrom(http.get(PROTECTED_URL)).catch(() => null);
    httpMock.expectOne(PROTECTED_URL).flush({}, { status: 403, statusText: 'Forbidden' });
    await tick();
    httpMock.expectOne(ME_URL).flush(admin());
    await tick();
    httpMock.expectOne(PROTECTED_URL).flush({}, { status: 403, statusText: 'Forbidden' });
    await p;

    expect(navigateSpy).toHaveBeenCalled();
    httpMock.expectNone(PROTECTED_URL);
    httpMock.expectNone(ME_URL);
  });
});
