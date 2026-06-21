import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { JwtResponse } from '../models/auth.model';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('issues POST to /public/token with body and no Authorization header', async () => {
    const credentials = { username: 'alice', password: 'secret' };
    const expected: JwtResponse = { token: 't', type: 'Bearer', expirationDate: 'e' };
    const promise = firstValueFrom(service.login(credentials));

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/public/token`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(credentials);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush(expected);
    await promise;
  });

  it('returns typed JwtResponse on 200', async () => {
    const expected: JwtResponse = { token: 'abc', type: 'Bearer', expirationDate: '2026-12-31T00:00:00Z' };
    const promise = firstValueFrom(service.login({ username: 'a', password: 'b' }));
    httpMock.expectOne(`${environment.apiBaseUrl}/public/token`).flush(expected);
    await expect(promise).resolves.toEqual(expected);
  });

  it('propagates 401 as error', async () => {
    const promise = firstValueFrom(service.login({ username: 'a', password: 'b' }));
    httpMock
      .expectOne(`${environment.apiBaseUrl}/public/token`)
      .flush({ message: 'unauthorized' }, { status: 401, statusText: 'Unauthorized' });
    await expect(promise).rejects.toMatchObject({ status: 401 });
  });
});
