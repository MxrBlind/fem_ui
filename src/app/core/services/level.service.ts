import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '@env/environment';
import { LevelDto } from '@features/enrollments/models/enrollment.model';

@Injectable({ providedIn: 'root' })
export class LevelService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/level`;

  list(): Observable<LevelDto[]> {
    return this.http.get<LevelDto[]>(this.baseUrl);
  }
}
