import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { UserDto } from '../models/auth.model';
import { AuthService } from './auth.service';
import { TokenStorageService } from './token-storage.service';

const TOKEN_URL = `${environment.apiBaseUrl}/public/token`;
const ME_URL = `${environment.apiBaseUrl}/api/user/me`;

function userDto(overrides: Partial<UserDto> = {}, roleName: string | null = 'admin'): UserDto {
  return {
    id: 1,
    username: 'alice',
    role: roleName === null ? null : { id: 10, name: roleName },
    ...overrides
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let router: Router;
  let tokenStorage: TokenStorageService;
  let navigateSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    tokenStorage = TestBed.inject(TokenStorageService);
    navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true) as never;
    localStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('posts to /public/token without Authorization, then fetches /me and populates currentUser', async () => {
    const promise = firstValueFrom(service.login({ username: 'alice', password: 'pass1' }));

    const tokenReq = httpMock.expectOne(TOKEN_URL);
    expect(tokenReq.request.method).toBe('POST');
    expect(tokenReq.request.headers.has('Authorization')).toBe(false);
    tokenReq.flush({ token: 'tok', type: 'Bearer', expirationDate: '2099-12-31T00:00:00Z' });

    const meReq = httpMock.expectOne(ME_URL);
    expect(meReq.request.method).toBe('GET');
    meReq.flush(userDto({}, 'admin'));

    await promise;

    expect(tokenStorage.getToken()).toBe('tok');
    expect(service.currentUser()?.role).toBe('admin');
    expect(navigateSpy).toHaveBeenCalledWith('/dashboard');
  });

  it('navigates a teacher to /courses (single-role landing)', async () => {
    const promise = firstValueFrom(service.login({ username: 't', password: 't' }));
    httpMock.expectOne(TOKEN_URL).flush({ token: 'tok', type: 'Bearer', expirationDate: 'e' });
    httpMock.expectOne(ME_URL).flush(userDto({}, 'teacher'));
    await promise;
    expect(navigateSpy).toHaveBeenCalledWith('/courses');
  });

  it('treats null/unknown role as unauthorized → clears state and redirects to /login', async () => {
    const promise = firstValueFrom(service.login({ username: 'a', password: 'b' }));
    httpMock.expectOne(TOKEN_URL).flush({ token: 'tok', type: 'Bearer', expirationDate: 'e' });
    httpMock.expectOne(ME_URL).flush(userDto({}, 'mystery-role'));
    await promise;

    expect(service.currentUser()).toBeNull();
    expect(tokenStorage.getToken()).toBeNull();
    expect(navigateSpy).toHaveBeenCalledWith('/login', expect.objectContaining({ state: expect.any(Object) }));
  });

  it('normalizes role casing, whitespace, and Spring "ROLE_" prefix', async () => {
    const promise = firstValueFrom(service.login({ username: 'a', password: 'b' }));
    httpMock.expectOne(TOKEN_URL).flush({ token: 'tok', type: 'Bearer', expirationDate: 'e' });
    httpMock.expectOne(ME_URL).flush(userDto({}, '  ROLE_ADMIN  '));
    await promise;
    expect(service.currentUser()?.role).toBe('admin');
    expect(service.currentUser()?.rawRole).toBe('admin');
  });

  it('logout() clears state, removes token, navigates to /login', () => {
    tokenStorage.saveToken('tok', '2099-01-01T00:00:00Z');
    service.logout();
    expect(service.currentUser()).toBeNull();
    expect(tokenStorage.getToken()).toBeNull();
    expect(navigateSpy).toHaveBeenCalledWith('/login');
  });

  it('late /me resolving after logout does NOT repopulate currentUser', async () => {
    const promise = firstValueFrom(service.login({ username: 'a', password: 'b' })).catch(() => null);
    httpMock.expectOne(TOKEN_URL).flush({ token: 'tok', type: 'Bearer', expirationDate: 'e' });
    const meReq = httpMock.expectOne(ME_URL);

    service.logout();
    meReq.flush(userDto({}, 'admin'));
    await promise;

    expect(service.currentUser()).toBeNull();
  });

  it('hasRole supports string and array forms (OR-semantics)', async () => {
    const promise = firstValueFrom(service.login({ username: 'a', password: 'b' }));
    httpMock.expectOne(TOKEN_URL).flush({ token: 'tok', type: 'Bearer', expirationDate: 'e' });
    httpMock.expectOne(ME_URL).flush(userDto({}, 'teacher'));
    await promise;

    expect(service.hasRole('teacher')).toBe(true);
    expect(service.hasRole('admin')).toBe(false);
    expect(service.hasRole(['admin', 'teacher'])).toBe(true);
    expect(service.hasRole(['admin', 'student'])).toBe(false);
  });

  it('propagates 401 from /public/token to caller', async () => {
    const promise = firstValueFrom(service.login({ username: 'a', password: 'b' }));
    httpMock
      .expectOne(TOKEN_URL)
      .flush({ message: 'nope' }, { status: 401, statusText: 'Unauthorized' });
    await expect(promise).rejects.toBeInstanceOf(HttpErrorResponse);
  });

  it('exposes profile.name and profile.parentLastName on currentUser after login', async () => {
    const promise = firstValueFrom(service.login({ username: 'alice', password: 'p' }));
    httpMock.expectOne(TOKEN_URL).flush({ token: 'tok', type: 'Bearer', expirationDate: 'e' });
    httpMock
      .expectOne(ME_URL)
      .flush(userDto({ profile: { name: 'Marcos', parentLastName: 'Reyes' } }, 'admin'));
    await promise;

    expect(service.currentUser()?.name).toBe('Marcos');
    expect(service.currentUser()?.parentLastName).toBe('Reyes');
  });

  it('exposes profile.name and profile.parentLastName on refreshProfile (bootstrap path)', async () => {
    tokenStorage.saveToken('tok', '2099-01-01T00:00:00Z');
    const p = service.refreshProfile();
    httpMock
      .expectOne(ME_URL)
      .flush(userDto({ profile: { name: 'Ana', parentLastName: 'García' } }, 'teacher'));
    await p;

    expect(service.currentUser()?.name).toBe('Ana');
    expect(service.currentUser()?.parentLastName).toBe('García');
  });

  it('leaves name and parentLastName undefined when profile is absent', async () => {
    const promise = firstValueFrom(service.login({ username: 'a', password: 'b' }));
    httpMock.expectOne(TOKEN_URL).flush({ token: 'tok', type: 'Bearer', expirationDate: 'e' });
    httpMock.expectOne(ME_URL).flush(userDto({}, 'admin'));
    await promise;

    expect(service.currentUser()?.name).toBeUndefined();
    expect(service.currentUser()?.parentLastName).toBeUndefined();
  });

  it('refreshProfile() de-duplicates concurrent callers (single /me)', async () => {
    tokenStorage.saveToken('tok', '2099-01-01T00:00:00Z');
    const p1 = service.refreshProfile();
    const p2 = service.refreshProfile();
    expect(p1).toBe(p2);
    httpMock.expectOne(ME_URL).flush(userDto({}, 'admin'));
    await Promise.all([p1, p2]);
    expect(service.currentUser()?.role).toBe('admin');
  });
});
