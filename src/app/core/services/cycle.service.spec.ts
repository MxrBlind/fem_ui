import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { CycleDto } from '../../features/enrollments/models/cycle.model';
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
});
