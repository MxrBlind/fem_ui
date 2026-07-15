import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ProfileDto, UserDto } from '../models/auth.model';
import { ProfileService } from './profile.service';

describe('ProfileService', () => {
  let service: ProfileService;
  let http: HttpTestingController;

  const baseProfile: ProfileDto = {
    name: 'Ana',
    parentLastName: 'Lopez',
    motherLastName: 'Perez',
    birthDate: '1990-01-15',
    email: 'ana@example.com',
    phone: '5551234567',
    address: 'Calle Falsa 123',
    church: 'Central',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ProfileService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getMe() issues GET /api/user/me and returns the UserDto', async () => {
    const user: UserDto = { id: 42, username: 'ana', profile: baseProfile };
    const promise = firstValueFrom(service.getMe());

    const req = http.expectOne(`${environment.apiBaseUrl}/api/user/me`);
    expect(req.request.method).toBe('GET');
    req.flush(user);

    await expect(promise).resolves.toEqual(user);
  });

  it('getMe() propagates HTTP errors', async () => {
    const promise = firstValueFrom(service.getMe());
    http
      .expectOne(`${environment.apiBaseUrl}/api/user/me`)
      .flush('boom', { status: 500, statusText: 'Server Error' });
    await expect(promise).rejects.toBeInstanceOf(HttpErrorResponse);
  });

  it('update() issues PUT /api/user/{id}/profile with the ProfileDto body and returns UserDto', async () => {
    const updatedProfile: ProfileDto = { ...baseProfile, name: 'Ana Maria' };
    const updatedUser: UserDto = { id: 42, username: 'ana', profile: updatedProfile };
    const promise = firstValueFrom(service.update(42, updatedProfile));

    const req = http.expectOne(`${environment.apiBaseUrl}/api/user/42/profile`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(updatedProfile);

    req.flush(updatedUser);
    await expect(promise).resolves.toEqual(updatedUser);
  });

  it('update() propagates HTTP errors via the observable error channel', async () => {
    const promise = firstValueFrom(service.update(42, baseProfile));
    http
      .expectOne(`${environment.apiBaseUrl}/api/user/42/profile`)
      .flush('boom', { status: 500, statusText: 'Server Error' });
    await expect(promise).rejects.toBeInstanceOf(HttpErrorResponse);
  });

  it('changePassword() PUTs /api/user/{id}/profile/password with the payload and no Authorization header set by the service', async () => {
    const promise = firstValueFrom(
      service.changePassword(42, {
        oldPassword: 'old',
        newPassword: 'newSecret1',
      })
    );

    const req = http.expectOne(
      `${environment.apiBaseUrl}/api/user/42/profile/password`
    );
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      oldPassword: 'old',
      newPassword: 'newSecret1',
    });
    expect(req.request.headers.has('Authorization')).toBe(false);

    req.flush(null);
    await expect(promise).resolves.toBeNull();
  });

  it('changePassword() propagates HTTP errors', async () => {
    const promise = firstValueFrom(
      service.changePassword(42, {
        oldPassword: 'old',
        newPassword: 'newSecret1',
      })
    );
    http
      .expectOne(
        `${environment.apiBaseUrl}/api/user/42/profile/password`
      )
      .flush('boom', { status: 400, statusText: 'Bad Request' });
    await expect(promise).rejects.toBeInstanceOf(HttpErrorResponse);
  });
});
