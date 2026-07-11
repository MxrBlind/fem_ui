import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { CategoryDto } from '../../features/enrollments/models/enrollment.model';
import { CategoryService } from './category.service';

describe('CategoryService', () => {
  let service: CategoryService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CategoryService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('list() issues a single GET /api/category and emits the array', async () => {
    const categories: CategoryDto[] = [
      { id: 1, title: 'Ciencias exactas', description: '', code: 'CIE' },
    ];
    const promise = firstValueFrom(service.list());
    const req = http.expectOne(`${environment.apiBaseUrl}/api/category`);
    expect(req.request.method).toBe('GET');
    req.flush(categories);
    await expect(promise).resolves.toEqual(categories);
  });

  it('propagates HTTP errors', async () => {
    const promise = firstValueFrom(service.list());
    http
      .expectOne(`${environment.apiBaseUrl}/api/category`)
      .flush('boom', { status: 500, statusText: 'Server Error' });
    await expect(promise).rejects.toBeInstanceOf(HttpErrorResponse);
  });
});
