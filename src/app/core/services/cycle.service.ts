import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { CycleDto } from '../../features/enrollments/models/cycle.model';

@Injectable({ providedIn: 'root' })
export class CycleService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/cycle`;

  getCurrent(): Observable<CycleDto> {
    return this.http.get<CycleDto>(`${this.baseUrl}/current`);
  }
}
