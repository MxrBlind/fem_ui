import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  CreateCycleRequest,
  CycleDto,
  UpdateCycleRequest,
} from '../../features/enrollments/models/cycle.model';
import { CycleService } from './cycle.service';

describe('CycleService', () => {
  let service: CycleService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CycleService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getCurrent() issues GET /api/cycle/current and returns the CycleDto', async () => {
    const cycle: CycleDto = {
      id: 1,
      description: '2026-I',
      startDate: '2026-01-01T00:00:00Z',
      endDate: '2026-06-30T00:00:00Z',
      current: true,
      active: true,
    };
    const promise = firstValueFrom(service.getCurrent());
    const req = http.expectOne(`${environment.apiBaseUrl}/api/cycle/current`);
    expect(req.request.method).toBe('GET');
    req.flush(cycle);
    await expect(promise).resolves.toEqual(cycle);
  });

  it('surfaces errors via the observable error channel', async () => {
    const promise = firstValueFrom(service.getCurrent());
    http
      .expectOne(`${environment.apiBaseUrl}/api/cycle/current`)
      .flush('boom', { status: 500, statusText: 'Server Error' });
    await expect(promise).rejects.toBeInstanceOf(HttpErrorResponse);
  });

  it('getAll() issues GET /api/cycle and returns the CycleDto array', async () => {
    const cycles: CycleDto[] = [
      {
        id: 1,
        description: '2026-I',
        startDate: '2026-01-01T00:00:00Z',
        endDate: '2026-06-30T00:00:00Z',
        current: true,
        active: true,
      },
      {
        id: 2,
        description: '2026-II',
        startDate: '2026-07-01T00:00:00Z',
        endDate: '2026-12-15T00:00:00Z',
        current: false,
        active: true,
      },
    ];
    const promise = firstValueFrom(service.getAll());
    const req = http.expectOne(`${environment.apiBaseUrl}/api/cycle`);
    expect(req.request.method).toBe('GET');
    req.flush(cycles);
    await expect(promise).resolves.toEqual(cycles);
  });

  it('getAll() surfaces HTTP errors via the observable error channel', async () => {
    const promise = firstValueFrom(service.getAll());
    http
      .expectOne(`${environment.apiBaseUrl}/api/cycle`)
      .flush('boom', { status: 500, statusText: 'Server Error' });
    await expect(promise).rejects.toBeInstanceOf(HttpErrorResponse);
  });

  it('create() issues POST /api/cycle with the given payload and returns the created CycleDto', async () => {
    const payload: CreateCycleRequest = {
      description: '2027-A',
      startDate: '2027-01-15',
      endDate: '2027-06-15',
      principal: { id: 42 },
    };
    const created: CycleDto = {
      id: 99,
      description: '2027-A',
      startDate: '2027-01-15',
      endDate: '2027-06-15',
      current: false,
      active: true,
      principal: { id: 42, username: 'teacher' },
    };
    const promise = firstValueFrom(service.create(payload));
    const req = http.expectOne(`${environment.apiBaseUrl}/api/cycle`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(created);
    await expect(promise).resolves.toEqual(created);
  });

  it('create() surfaces HTTP errors via the observable error channel', async () => {
    const payload: CreateCycleRequest = {
      description: '2027-A',
      startDate: '2027-01-15',
      endDate: '2027-06-15',
      principal: { id: 42 },
    };
    const promise = firstValueFrom(service.create(payload));
    http
      .expectOne(`${environment.apiBaseUrl}/api/cycle`)
      .flush('boom', { status: 500, statusText: 'Server Error' });
    await expect(promise).rejects.toBeInstanceOf(HttpErrorResponse);
  });

  it('update() issues PUT /api/cycle/{id} with the given payload and returns the updated CycleDto', async () => {
    const payload: UpdateCycleRequest = {
      description: '2027-A',
      startDate: '2027-01-15',
      endDate: '2027-06-15',
      principal: { id: 42 },
      current: true,
    };
    const updated: CycleDto = {
      id: 7,
      description: '2027-A',
      startDate: '2027-01-15',
      endDate: '2027-06-15',
      current: true,
      active: true,
      principal: { id: 42, username: 'teacher' },
    };
    const promise = firstValueFrom(service.update(7, payload));
    const req = http.expectOne(`${environment.apiBaseUrl}/api/cycle/7`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(payload);
    req.flush(updated);
    await expect(promise).resolves.toEqual(updated);
  });

  it('update() surfaces HTTP errors via the observable error channel', async () => {
    const payload: UpdateCycleRequest = {
      description: '2027-A',
      startDate: '2027-01-15',
      endDate: '2027-06-15',
      principal: { id: 42 },
      current: false,
    };
    const promise = firstValueFrom(service.update(7, payload));
    http
      .expectOne(`${environment.apiBaseUrl}/api/cycle/7`)
      .flush('boom', { status: 500, statusText: 'Server Error' });
    await expect(promise).rejects.toBeInstanceOf(HttpErrorResponse);
  });

  it('delete() issues DELETE /api/cycle/{id} and completes on empty body', async () => {
    const promise = firstValueFrom(service.delete(42), { defaultValue: undefined });
    const req = http.expectOne(`${environment.apiBaseUrl}/api/cycle/42`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.body).toBeNull();
    req.flush(null, { status: 204, statusText: 'No Content' });
    await expect(promise).resolves.toBeNull();
  });

  it('delete() surfaces HTTP errors via the observable error channel', async () => {
    const promise = firstValueFrom(service.delete(42));
    http
      .expectOne(`${environment.apiBaseUrl}/api/cycle/42`)
      .flush('boom', { status: 500, statusText: 'Server Error' });
    await expect(promise).rejects.toBeInstanceOf(HttpErrorResponse);
  });

  it('shares a single request across multiple subscribers within the session', async () => {
    const cycle: CycleDto = {
      id: 1,
      description: '2026-I',
      startDate: '',
      endDate: '',
      current: true,
      active: true,
    };
    const first = firstValueFrom(service.getCurrent());
    const second = firstValueFrom(service.getCurrent());
    const req = http.expectOne(`${environment.apiBaseUrl}/api/cycle/current`);
    req.flush(cycle);
    await expect(first).resolves.toEqual(cycle);
    await expect(second).resolves.toEqual(cycle);
    const third = firstValueFrom(service.getCurrent());
    http.expectNone(`${environment.apiBaseUrl}/api/cycle/current`);
    await expect(third).resolves.toEqual(cycle);
  });
});
