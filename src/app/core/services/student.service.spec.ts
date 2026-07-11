import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { environment } from '../../../environments/environment';
import { UserDto } from '../models/auth.model';
import { CreateStudentRequest } from '@features/students/models/create-student.request';
import { UpdateStudentRequest } from '@features/students/models/update-student.request';
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

  it('exposes getAll, create, update, and delete', () => {
    const svc = service as unknown as Record<string, unknown>;
    expect(typeof svc['getAll']).toBe('function');
    expect(typeof svc['create']).toBe('function');
    expect(typeof svc['update']).toBe('function');
    expect(typeof svc['delete']).toBe('function');
  });

  describe('delete', () => {
    it('issues DELETE /api/user/:id and completes with no body', () => {
      let completed = false;
      let emitted = false;
      service.delete(42).subscribe({
        next: () => (emitted = true),
        complete: () => (completed = true),
      });

      const req = http.expectOne(
        (r) =>
          r.method === 'DELETE' &&
          r.url === `${environment.apiBaseUrl}/api/user/42`
      );
      expect(req.request.body).toBeNull();
      req.flush(null, { status: 204, statusText: 'No Content' });

      expect(emitted).toBe(true);
      expect(completed).toBe(true);
    });

    it('propagates HTTP errors from delete', () => {
      let errorStatus: number | undefined;
      service.delete(3).subscribe({
        error: (err: { status?: number }) => (errorStatus = err.status),
      });

      http
        .expectOne(
          (r) =>
            r.method === 'DELETE' &&
            r.url === `${environment.apiBaseUrl}/api/user/3`
        )
        .flush(null, { status: 500, statusText: 'Server Error' });

      expect(errorStatus).toBe(500);
    });
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

  describe('update', () => {
    const payload: UpdateStudentRequest = {
      username: 'jdoe',
      password: 'secret12',
      role: { id: 3 },
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

    it('PUTs to /api/user/{id} with the exact payload and forwards the response', () => {
      const updated: UserDto = { id: 42, username: 'jdoe' };
      let received: UserDto | undefined;
      service.update(42, payload).subscribe((v) => (received = v));

      const req = http.expectOne(`${environment.apiBaseUrl}/api/user/42`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(payload);
      req.flush(updated);

      expect(received).toEqual(updated);
    });

    it('propagates non-2xx as an HttpErrorResponse', () => {
      let errorStatus: number | undefined;
      service.update(42, payload).subscribe({
        error: (err: { status?: number }) => (errorStatus = err.status),
      });
      http
        .expectOne(`${environment.apiBaseUrl}/api/user/42`)
        .flush('boom', { status: 500, statusText: 'Server Error' });
      expect(errorStatus).toBe(500);
    });
  });
});
