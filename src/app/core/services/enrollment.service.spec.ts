import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { EnrollmentDto } from '../../features/enrollments/models/enrollment.model';
import { EnrollmentService, toRow } from './enrollment.service';

function buildDto(overrides: Partial<EnrollmentDto> = {}): EnrollmentDto {
  return {
    id: 1,
    grade: 85,
    student: {
      id: 10,
      username: 'apr',
      profile: {
        name: 'Ana',
        parentLastName: 'Pérez',
        motherLastName: 'Ruiz',
        church: 'Bethel',
      },
    },
    course: {
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
    ...overrides,
  };
}

describe('EnrollmentService', () => {
  let service: EnrollmentService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(EnrollmentService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listAll() issues GET /api/enrollment and returns the DTO array unchanged', async () => {
    const dtos = [buildDto()];
    const promise = firstValueFrom(service.listAll());
    const req = http.expectOne(`${environment.apiBaseUrl}/api/enrollment`);
    expect(req.request.method).toBe('GET');
    req.flush(dtos);
    await expect(promise).resolves.toEqual(dtos);
  });

  it('surfaces errors via the observable error channel', async () => {
    const promise = firstValueFrom(service.listAll());
    http
      .expectOne(`${environment.apiBaseUrl}/api/enrollment`)
      .flush('boom', { status: 500, statusText: 'Server Error' });
    await expect(promise).rejects.toBeInstanceOf(HttpErrorResponse);
  });

  describe('toRow mapper', () => {
    it('derives fullName from profile name + parentLastName + motherLastName', () => {
      expect(toRow(buildDto()).fullName).toBe('Ana Pérez Ruiz');
    });

    it('falls back to username when profile name parts are empty', () => {
      const row = toRow(
        buildDto({
          student: {
            id: 10,
            username: 'apr',
            profile: { name: '', parentLastName: '', motherLastName: '' },
          },
        })
      );
      expect(row.fullName).toBe('apr');
    });

    it('projects all nested paths into flat fields', () => {
      const row = toRow(buildDto());
      expect(row.id).toBe(1);
      expect(row.church).toBe('Bethel');
      expect(row.subject).toBe('Matemáticas I');
      expect(row.category).toBe('Núcleo');
      expect(row.grade).toBe(85);
    });

    it('returns empty string for missing church', () => {
      const row = toRow(
        buildDto({
          student: {
            id: 10,
            username: 'apr',
            profile: { name: 'Ana', parentLastName: 'Pérez' },
          },
        })
      );
      expect(row.church).toBe('');
    });

    it('preserves raw DTO reference unmodified', () => {
      const dto = buildDto();
      const row = toRow(dto);
      expect(row.raw).toBe(dto);
    });

    it('returns zero grade as numeric 0 (not em-dash)', () => {
      expect(toRow(buildDto({ grade: 0 })).grade).toBe(0);
    });
  });
});
