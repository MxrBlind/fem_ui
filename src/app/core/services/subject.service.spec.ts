import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { SubjectDto } from '../../features/enrollments/models/enrollment.model';
import { SubjectService } from './subject.service';

describe('SubjectService', () => {
  let service: SubjectService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SubjectService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('list() issues a single GET /api/subject and emits the array', async () => {
    const subjects: SubjectDto[] = [
      {
        id: 1,
        code: 'MAT101',
        description: 'Matemáticas I',
        category: { title: 'Núcleo', description: '', code: 'NUC' },
        level: {},
      },
    ];
    const promise = firstValueFrom(service.list());
    const req = http.expectOne(`${environment.apiBaseUrl}/api/subject`);
    expect(req.request.method).toBe('GET');
    req.flush(subjects);
    await expect(promise).resolves.toEqual(subjects);
  });

  it('propagates HTTP errors', async () => {
    const promise = firstValueFrom(service.list());
    http
      .expectOne(`${environment.apiBaseUrl}/api/subject`)
      .flush('boom', { status: 500, statusText: 'Server Error' });
    await expect(promise).rejects.toBeInstanceOf(HttpErrorResponse);
  });
});
