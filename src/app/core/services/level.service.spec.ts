import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { LevelDto } from '../../features/enrollments/models/enrollment.model';
import { LevelService } from './level.service';

describe('LevelService', () => {
  let service: LevelService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(LevelService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('list() issues a single GET /api/level and emits the array', async () => {
    const levels: LevelDto[] = [{ id: 1, title: 'Primaria', code: 'PRI' }];
    const promise = firstValueFrom(service.list());
    const req = http.expectOne(`${environment.apiBaseUrl}/api/level`);
    expect(req.request.method).toBe('GET');
    req.flush(levels);
    await expect(promise).resolves.toEqual(levels);
  });

  it('propagates HTTP errors', async () => {
    const promise = firstValueFrom(service.list());
    http
      .expectOne(`${environment.apiBaseUrl}/api/level`)
      .flush('boom', { status: 500, statusText: 'Server Error' });
    await expect(promise).rejects.toBeInstanceOf(HttpErrorResponse);
  });
});
