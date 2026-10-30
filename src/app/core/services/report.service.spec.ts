import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ReportResult } from '../../features/reports/models/report.model';
import { ReportService } from './report.service';

describe('ReportService', () => {
  let service: ReportService;
  let http: HttpTestingController;

  const url = `${environment.apiBaseUrl}/api/report/generate`;

  const result: ReportResult = {
    reportToken: null,
    interpretation: 'Alumnos inscritos en el ciclo actual',
    columns: [
      { name: 'name', label: 'Nombre', type: 'VARCHAR' },
      { name: 'start_date', label: 'Inicio', type: 'DATE' }
    ],
    rows: [['Ana', '2024-01-05']],
    rowCount: 1,
    executionMs: 12
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(ReportService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('generate() posts the prompt to /api/report/generate and emits the typed result', async () => {
    const promise = firstValueFrom(service.generate('alumnos inscritos'));

    const req = http.expectOne(url);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ prompt: 'alumnos inscritos' });
    req.flush(result);

    await expect(promise).resolves.toEqual(result);
  });

  it.each([
    [400, 'UNSAFE_QUERY'],
    [422, 'REPORT_EXECUTION_FAILED'],
    [502, 'REPORT_GENERATION_FAILED']
  ])('generate() propagates the %i error unchanged', async (status, code) => {
    const promise = firstValueFrom(service.generate('x'));

    http.expectOne(url).flush({ status, code, message: 'boom' }, { status, statusText: 'Error' });

    const error = (await promise.catch((e: unknown) => e)) as HttpErrorResponse;
    expect(error).toBeInstanceOf(HttpErrorResponse);
    expect(error.status).toBe(status);
    expect(error.error.code).toBe(code);
  });
});
