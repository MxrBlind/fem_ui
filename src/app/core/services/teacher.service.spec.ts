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
});
