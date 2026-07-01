import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { UserDto } from '../models/auth.model';
import { UserService } from './user.service';

describe('UserService', () => {
  let service: UserService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(UserService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listByRole() issues GET /api/user with the role query param', async () => {
    const users: UserDto[] = [{ id: 1, username: 'student1' }];
    const promise = firstValueFrom(service.listByRole('ROLE_STUDENT'));
    const req = http.expectOne(
      (r) => r.url === `${environment.apiBaseUrl}/api/user` && r.params.get('role') === 'ROLE_STUDENT'
    );
    expect(req.request.method).toBe('GET');
    req.flush(users);
    await expect(promise).resolves.toEqual(users);
  });

  it('surfaces errors via the observable error channel', async () => {
    const promise = firstValueFrom(service.listByRole('ROLE_STUDENT'));
    http
      .expectOne(
        (r) => r.url === `${environment.apiBaseUrl}/api/user` && r.params.get('role') === 'ROLE_STUDENT'
      )
      .flush('boom', { status: 500, statusText: 'Server Error' });
    await expect(promise).rejects.toBeInstanceOf(HttpErrorResponse);
  });
});
