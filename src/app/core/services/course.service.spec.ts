import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  CourseDto,
  CreateCourseRequest,
} from '../../features/enrollments/models/enrollment.model';
import { CourseService } from './course.service';

describe('CourseService', () => {
  let service: CourseService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CourseService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listByCycle() issues GET /api/course/cycle/{id} and returns the DTO array', async () => {
    const courses: CourseDto[] = [
      {
        credits: 4,
        teacher: { id: 99, username: 'tch' },
        cycle: { description: '2026-I', startDate: '', endDate: '' },
        subject: {
          code: 'MAT101',
          description: 'Matemáticas I',
          category: { title: 'Núcleo', description: '', code: 'NUC' },
          level: {},
        },
      },
    ];
    const promise = firstValueFrom(service.listByCycle(7));
    const req = http.expectOne(`${environment.apiBaseUrl}/api/course/cycle/7`);
    expect(req.request.method).toBe('GET');
    req.flush(courses);
    await expect(promise).resolves.toEqual(courses);
  });

  it('surfaces errors via the observable error channel', async () => {
    const promise = firstValueFrom(service.listByCycle(7));
    http
      .expectOne(`${environment.apiBaseUrl}/api/course/cycle/7`)
      .flush('boom', { status: 500, statusText: 'Server Error' });
    await expect(promise).rejects.toBeInstanceOf(HttpErrorResponse);
  });

  describe('create()', () => {
    const payload: CreateCourseRequest = {
      subject: { id: 12 },
      teacher: { id: 34 },
      cycle: { id: 56 },
      credits: 3,
    };

    it('POSTs the exact payload to /api/course and returns the created course', async () => {
      const created: CourseDto = {
        id: 900,
        credits: 3,
        teacher: { id: 34, username: 'tch' },
        cycle: { id: 56, description: '2026-I', startDate: '', endDate: '' },
        subject: {
          id: 12,
          code: 'MAT101',
          description: 'Matemáticas I',
          category: { title: 'Núcleo', description: '', code: 'NUC' },
          level: {},
        },
      };
      const promise = firstValueFrom(service.create(payload));
      const req = http.expectOne(`${environment.apiBaseUrl}/api/course`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(payload);
      req.flush(created);
      await expect(promise).resolves.toEqual(created);
    });

    it('propagates HTTP errors from POST /api/course', async () => {
      const promise = firstValueFrom(service.create(payload));
      http
        .expectOne(`${environment.apiBaseUrl}/api/course`)
        .flush('boom', { status: 500, statusText: 'Server Error' });
      await expect(promise).rejects.toBeInstanceOf(HttpErrorResponse);
    });
  });
});
