import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';

import { environment } from '../../../environments/environment';
import { CycleDto } from '../../features/enrollments/models/cycle.model';

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
}
