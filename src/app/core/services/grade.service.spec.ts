import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { GradeDto } from '../../features/grades/models/grade.model';
import { GradeService } from './grade.service';

function makeGrade(overrides: Partial<GradeDto> = {}): GradeDto {
  return {
    enrollmentId: 1,
    studentName: 'Estudiante Uno',
    teacherName: 'Maestro Uno',
    studentId: 10,
    courseName: 'Curso Uno',
    courseId: 100,
    subjectCode: 'MAT-101',
    cycleName: '2026-I',
    cycleId: 1,
    active: false,
    grade: 85,
    startDate: '2026-01-15T00:00:00Z',
    ...overrides,
  };
}

describe('GradeService', () => {
  let service: GradeService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(GradeService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getForStudent(id) issues GET /api/grade/{id} and returns the GradeDto array', async () => {
    const grades = [makeGrade(), makeGrade({ enrollmentId: 2, courseId: 200, grade: 60 })];
    const promise = firstValueFrom(service.getForStudent(10));
    const req = http.expectOne(`${environment.apiBaseUrl}/api/grade/10`);
    expect(req.request.method).toBe('GET');
    req.flush(grades);
    await expect(promise).resolves.toEqual(grades);
  });

  it('getForStudent() surfaces HTTP errors via the observable error channel', async () => {
    const promise = firstValueFrom(service.getForStudent(10));
    http
      .expectOne(`${environment.apiBaseUrl}/api/grade/10`)
      .flush('boom', { status: 500, statusText: 'Server Error' });
    await expect(promise).rejects.toBeInstanceOf(HttpErrorResponse);
  });

  it('downloadCertificate issues GET /api/grade/certificate with query params and blob response type', async () => {
    const blob = new Blob(['%PDF-1.4 fake'], { type: 'application/pdf' });
    const promise = firstValueFrom(service.downloadCertificate(42, 10));
    const req = http.expectOne(
      (r) => r.url === `${environment.apiBaseUrl}/api/grade/certificate`
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    expect(req.request.params.get('enrollmentId')).toBe('42');
    expect(req.request.params.get('studentId')).toBe('10');
    req.flush(blob);
    await expect(promise).resolves.toBeInstanceOf(Blob);
  });

  it('downloadCertificate() surfaces HTTP errors via the observable error channel', async () => {
    const promise = firstValueFrom(service.downloadCertificate(42, 10));
    http
      .expectOne((r) => r.url === `${environment.apiBaseUrl}/api/grade/certificate`)
      .flush(new Blob(['boom']), { status: 500, statusText: 'Server Error' });
    await expect(promise).rejects.toBeInstanceOf(HttpErrorResponse);
  });
});
