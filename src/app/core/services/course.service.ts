import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '@env/environment';
import { CourseDto } from '@features/enrollments/models/enrollment.model';

@Injectable({ providedIn: 'root' })
export class CourseService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/course`;

  listByCycle(cycleId: number): Observable<CourseDto[]> {
    return this.http.get<CourseDto[]>(`${this.baseUrl}/cycle/${cycleId}`);
  }
}
