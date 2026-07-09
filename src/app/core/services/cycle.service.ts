import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';

import { environment } from '@env/environment';
import {
  CreateCycleRequest,
  CycleDto,
  UpdateCycleRequest,
} from '@features/enrollments/models/cycle.model';

@Injectable({ providedIn: 'root' })
export class CycleService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/cycle`;

  // Session-scoped cache: current cycle is effectively immutable within a
  // session and is consumed by both the enrollment list and the new-enrollment
  // modal. shareReplay avoids a duplicate GET on every modal open.
  private readonly current$: Observable<CycleDto> = this.http
    .get<CycleDto>(`${this.baseUrl}/current`)
    .pipe(shareReplay({ bufferSize: 1, refCount: false }));

  getCurrent(): Observable<CycleDto> {
    return this.current$;
  }

  getAll(): Observable<CycleDto[]> {
    return this.http.get<CycleDto[]>(this.baseUrl);
  }

  create(payload: CreateCycleRequest): Observable<CycleDto> {
    return this.http.post<CycleDto>(this.baseUrl, payload);
  }

  update(id: number, payload: UpdateCycleRequest): Observable<CycleDto> {
    return this.http.put<CycleDto>(`${this.baseUrl}/${id}`, payload);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
