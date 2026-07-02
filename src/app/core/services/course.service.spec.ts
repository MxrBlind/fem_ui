import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { CourseDto } from '../../features/enrollments/models/enrollment.model';
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
});
