import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { environment } from '../../../environments/environment';
import { UserDto } from '../models/auth.model';
import { CreateStudentRequest } from '@features/students/models/create-student.request';
import { StudentService } from './student.service';

describe('StudentService', () => {
  let service: StudentService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(StudentService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('issues GET /api/user?role=ROLE_STUDENT and forwards the response', () => {
    const students: UserDto[] = [
      { id: 1, username: 'a', profile: { name: 'A' } },
      { id: 2, username: 'b', profile: { name: 'B' } },
    ];

    let received: UserDto[] | undefined;
    service.getAll().subscribe((value) => (received = value));

    const req = http.expectOne(
      (r) =>
        r.method === 'GET' &&
        r.url === `${environment.apiBaseUrl}/api/user` &&
        r.params.get('role') === 'ROLE_STUDENT'
    );
    req.flush(students);

    expect(received).toEqual(students);
  });

  it('exposes getAll and create only (no update/delete methods)', () => {
    const svc = service as unknown as Record<string, unknown>;
    expect(typeof svc['getAll']).toBe('function');
    expect(typeof svc['create']).toBe('function');
    expect(svc['update']).toBeUndefined();
    expect(svc['delete']).toBeUndefined();
  });

  describe('create', () => {
    const payload: CreateStudentRequest = {
      username: 'jdoe',
      password: 'secret12',
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
      role: { id: 3 },
    };

    it('POSTs to /api/user with the exact payload and forwards the response', () => {
      const created: UserDto = { id: 42, username: 'jdoe' };
      let received: UserDto | undefined;
      service.create(payload).subscribe((v) => (received = v));

      const req = http.expectOne(`${environment.apiBaseUrl}/api/user`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(payload);
      req.flush(created);

      expect(received).toEqual(created);
    });

    it('propagates non-2xx as an HttpErrorResponse', () => {
      let errorStatus: number | undefined;
      service.create(payload).subscribe({
        error: (err: { status?: number }) => (errorStatus = err.status),
      });
      http
        .expectOne(`${environment.apiBaseUrl}/api/user`)
        .flush('boom', { status: 500, statusText: 'Server Error' });
      expect(errorStatus).toBe(500);
    });
  });
});
