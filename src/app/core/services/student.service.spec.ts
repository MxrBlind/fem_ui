import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { environment } from '../../../environments/environment';
import { UserDto } from '../models/auth.model';
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

  it('exposes only getAll (no create/update/delete methods)', () => {
    const svc = service as unknown as Record<string, unknown>;
    expect(typeof svc['getAll']).toBe('function');
    expect(svc['create']).toBeUndefined();
    expect(svc['update']).toBeUndefined();
    expect(svc['delete']).toBeUndefined();
  });
});
