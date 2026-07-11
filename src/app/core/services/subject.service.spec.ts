import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  CreateSubjectRequest,
  SubjectDto,
} from '../../features/enrollments/models/enrollment.model';
import { UpdateSubjectRequest } from '../../features/subjects/models/update-subject.request';
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

  it('create() POSTs the exact payload and emits the created DTO', async () => {
    const payload: CreateSubjectRequest = {
      code: 'MAT-101',
      description: 'Matemáticas básicas',
      category: { id: 3 },
      level: { id: 1 },
    };
    const created: SubjectDto = {
      id: 42,
      code: payload.code,
      description: payload.description,
      category: { id: 3, title: 'Ciencias', description: '', code: 'CIE' },
      level: { id: 1, title: 'Primaria' },
    };
    const promise = firstValueFrom(service.create(payload));
    const req = http.expectOne(`${environment.apiBaseUrl}/api/subject`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    expect(typeof req.request.body.category.id).toBe('number');
    expect(typeof req.request.body.level.id).toBe('number');
    req.flush(created);
    await expect(promise).resolves.toEqual(created);
  });

  it('create() propagates HTTP errors', async () => {
    const payload: CreateSubjectRequest = {
      code: 'X',
      description: 'X',
      category: { id: 1 },
      level: { id: 1 },
    };
    const promise = firstValueFrom(service.create(payload));
    http
      .expectOne(`${environment.apiBaseUrl}/api/subject`)
      .flush('boom', { status: 500, statusText: 'Server Error' });
    await expect(promise).rejects.toBeInstanceOf(HttpErrorResponse);
  });

  it('update() PUTs the exact payload to /api/subject/{id} and emits the updated DTO', async () => {
    const payload: UpdateSubjectRequest = {
      code: 'MAT-101',
      description: 'Matemáticas actualizadas',
      category: { id: 3 },
      level: { id: 1 },
    };
    const updated: SubjectDto = {
      id: 42,
      code: payload.code,
      description: payload.description,
      category: { id: 3, title: 'Ciencias', description: '', code: 'CIE' },
      level: { id: 1, title: 'Primaria' },
    };
    const promise = firstValueFrom(service.update(42, payload));
    const req = http.expectOne(
      `${environment.apiBaseUrl}/api/subject/42?includeDependencies=true`
    );
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(payload);
    expect(typeof req.request.body.category.id).toBe('number');
    expect(typeof req.request.body.level.id).toBe('number');
    req.flush(updated);
    await expect(promise).resolves.toEqual(updated);
  });

  it('update() propagates HTTP errors', async () => {
    const payload: UpdateSubjectRequest = {
      code: 'X',
      description: 'X',
      category: { id: 1 },
      level: { id: 1 },
    };
    const promise = firstValueFrom(service.update(99, payload));
    http
      .expectOne(`${environment.apiBaseUrl}/api/subject/99?includeDependencies=true`)
      .flush('boom', { status: 500, statusText: 'Server Error' });
    await expect(promise).rejects.toBeInstanceOf(HttpErrorResponse);
  });
});
