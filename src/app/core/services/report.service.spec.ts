import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ReportResult, SavedReport } from '../../features/reports/models/report.model';
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

  describe('save()', () => {
    const saveUrl = `${environment.apiBaseUrl}/api/report/saved`;

    const savedReport: SavedReport = {
      id: 7,
      name: 'Alumnos activos',
      description: null,
      originalPrompt: 'alumnos activos',
      createdDate: '2026-11-22T01:00:00',
      lastRunDate: null
    };

    it('posts the token and name to /api/report/saved and emits the saved report', async () => {
      const promise = firstValueFrom(service.save({ reportToken: 't-1', name: 'Alumnos activos' }));

      const req = http.expectOne(saveUrl);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ reportToken: 't-1', name: 'Alumnos activos' });
      expect('description' in req.request.body).toBe(false);
      req.flush(savedReport, { status: 201, statusText: 'Created' });

      await expect(promise).resolves.toEqual(savedReport);
    });

    it('sends the description when it is provided', async () => {
      const promise = firstValueFrom(
        service.save({ reportToken: 't-1', name: 'Alumnos activos', description: 'Ciclo actual' })
      );

      const req = http.expectOne(saveUrl);
      expect(req.request.body).toEqual({ reportToken: 't-1', name: 'Alumnos activos', description: 'Ciclo actual' });
      req.flush({ ...savedReport, description: 'Ciclo actual' }, { status: 201, statusText: 'Created' });

      await expect(promise).resolves.toEqual({ ...savedReport, description: 'Ciclo actual' });
    });

    it.each([
      [404, 'ENTITY_NOT_FOUND'],
      [409, 'REPORT_NAME_CONFLICT']
    ])('propagates the %i error unchanged', async (status, code) => {
      const promise = firstValueFrom(service.save({ reportToken: 't-1', name: 'x' }));

      http.expectOne(saveUrl).flush({ status, code, message: 'boom' }, { status, statusText: 'Error' });

      const error = (await promise.catch((e: unknown) => e)) as HttpErrorResponse;
      expect(error).toBeInstanceOf(HttpErrorResponse);
      expect(error.status).toBe(status);
      expect(error.error.code).toBe(code);
    });
  });

  describe('listSaved()', () => {
    const listUrl = `${environment.apiBaseUrl}/api/report/saved`;

    const savedReports: SavedReport[] = [
      {
        id: 2,
        name: 'Alumnos activos',
        description: 'Ciclo actual',
        originalPrompt: 'alumnos activos',
        createdDate: '2026-11-22T01:00:00',
        lastRunDate: null
      },
      {
        id: 1,
        name: 'Maestros',
        description: null,
        originalPrompt: 'lista de maestros',
        createdDate: '2026-11-20T10:00:00',
        lastRunDate: '2026-11-21T09:30:00'
      }
    ];

    it('sends one GET to /api/report/saved without body or params and emits the reports in order', async () => {
      const promise = firstValueFrom(service.listSaved());

      const req = http.expectOne(listUrl);
      expect(req.request.method).toBe('GET');
      expect(req.request.body).toBeNull();
      expect(req.request.params.keys()).toEqual([]);
      req.flush(savedReports);

      await expect(promise).resolves.toEqual(savedReports);
    });

    it('emits an empty array when the admin has no saved reports', async () => {
      const promise = firstValueFrom(service.listSaved());

      http.expectOne(listUrl).flush([]);

      await expect(promise).resolves.toEqual([]);
    });

    it.each([401, 403, 500])('propagates the %i error unchanged', async (status) => {
      const promise = firstValueFrom(service.listSaved());

      http.expectOne(listUrl).flush({ status, message: 'boom' }, { status, statusText: 'Error' });

      const error = (await promise.catch((e: unknown) => e)) as HttpErrorResponse;
      expect(error).toBeInstanceOf(HttpErrorResponse);
      expect(error.status).toBe(status);
    });
  });

  describe('execute()', () => {
    const executeUrl = `${environment.apiBaseUrl}/api/report/saved/7/execute`;

    const savedRunResult: ReportResult = {
      ...result,
      reportToken: null,
      interpretation: null
    };

    it('sends one POST to /api/report/saved/{id}/execute without body or params and emits the result unchanged', async () => {
      const promise = firstValueFrom(service.execute(7));

      const req = http.expectOne(executeUrl);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toBeNull();
      expect(req.request.params.keys()).toEqual([]);
      req.flush(savedRunResult);

      const emitted = await promise;
      expect(emitted).toEqual(savedRunResult);
      expect(emitted.reportToken).toBeNull();
      expect(emitted.interpretation).toBeNull();
    });

    it('emits the stored description carried in the interpretation', async () => {
      const promise = firstValueFrom(service.execute(7));

      http.expectOne(executeUrl).flush({ ...savedRunResult, interpretation: 'Ciclo actual' });

      await expect(promise).resolves.toEqual({ ...savedRunResult, interpretation: 'Ciclo actual' });
    });

    it.each([
      [400, 'BAD_REQUEST'],
      [401, 'UNAUTHORIZED'],
      [403, 'ACCESS_DENIED'],
      [404, 'ENTITY_NOT_FOUND'],
      [422, 'REPORT_EXECUTION_FAILED'],
      [500, 'INTERNAL_ERROR']
    ])('propagates the %i error unchanged', async (status, code) => {
      const promise = firstValueFrom(service.execute(7));

      http.expectOne(executeUrl).flush({ status, code, message: 'boom' }, { status, statusText: 'Error' });

      const error = (await promise.catch((e: unknown) => e)) as HttpErrorResponse;
      expect(error).toBeInstanceOf(HttpErrorResponse);
      expect(error.status).toBe(status);
      expect(error.error.code).toBe(code);
    });
  });

  describe('delete()', () => {
    const deleteUrl = `${environment.apiBaseUrl}/api/report/saved/7`;

    it('sends one DELETE to /api/report/saved/{id} without body or params and completes with an empty body on 204', async () => {
      const promise = firstValueFrom(service.delete(7));

      const req = http.expectOne(deleteUrl);
      expect(req.request.method).toBe('DELETE');
      expect(req.request.body).toBeNull();
      expect(req.request.params.keys()).toEqual([]);
      req.flush(null, { status: 204, statusText: 'No Content' });

      // HttpClient emits `null` for an empty 204 body; callers ignore the value.
      await expect(promise).resolves.toBeNull();
    });

    it.each([
      [400, 'BAD_REQUEST'],
      [401, 'UNAUTHORIZED'],
      [403, 'ACCESS_DENIED'],
      [404, 'ENTITY_NOT_FOUND'],
      [500, 'INTERNAL_ERROR']
    ])('propagates the %i error unchanged', async (status, code) => {
      const promise = firstValueFrom(service.delete(7));

      http.expectOne(deleteUrl).flush({ status, code, message: 'boom' }, { status, statusText: 'Error' });

      const error = (await promise.catch((e: unknown) => e)) as HttpErrorResponse;
      expect(error).toBeInstanceOf(HttpErrorResponse);
      expect(error.status).toBe(status);
      expect(error.error.code).toBe(code);
    });
  });
});
