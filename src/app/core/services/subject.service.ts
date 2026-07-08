import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '@env/environment';
import { SubjectDto } from '@features/enrollments/models/enrollment.model';

@Injectable({ providedIn: 'root' })
export class SubjectService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/subject`;

  list(): Observable<SubjectDto[]> {
    return this.http.get<SubjectDto[]>(this.baseUrl);
  }
}
