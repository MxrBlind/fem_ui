import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { environment } from '../../../environments/environment';
import { UserDto } from '../models/auth.model';
import { TeacherService } from './teacher.service';

describe('TeacherService', () => {
  let service: TeacherService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TeacherService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('issues GET /api/user?role=ROLE_TEACHER and forwards the response', () => {
    const teachers: UserDto[] = [
      { id: 1, username: 'a', profile: { name: 'A' } },
      { id: 2, username: 'b', profile: { name: 'B' } },
    ];

    let received: UserDto[] | undefined;
    service.getAll().subscribe((value) => (received = value));

    const req = http.expectOne(
      (r) =>
        r.method === 'GET' &&
        r.url === `${environment.apiBaseUrl}/api/user` &&
        r.params.get('role') === 'ROLE_TEACHER'
    );
    req.flush(teachers);

    expect(received).toEqual(teachers);
  });

  it('issues PUT /api/user/:id with the given payload on update', () => {
    const payload = {
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
    const updated: UserDto = { id: 7, username: 'jdoe' };

    let received: UserDto | undefined;
    service.update(7, payload).subscribe((v) => (received = v));

    const req = http.expectOne(
      (r) =>
        r.method === 'PUT' && r.url === `${environment.apiBaseUrl}/api/user/7`
    );
    expect(req.request.body).toEqual(payload);
    req.flush(updated);

    expect(received).toEqual(updated);
  });
});
