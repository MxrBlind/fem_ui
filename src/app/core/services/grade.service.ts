import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '@env/environment';
import { GradeDto } from '@features/grades/models/grade.model';

@Injectable({ providedIn: 'root' })
export class GradeService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/grade`;

  getForStudent(studentId: number): Observable<GradeDto[]> {
    return this.http.get<GradeDto[]>(`${this.baseUrl}/${studentId}`);
  }

  downloadCertificate(enrollmentId: number, studentId: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/certificate`, {
      params: {
        enrollmentId: String(enrollmentId),
        studentId: String(studentId),
      },
      responseType: 'blob',
    });
  }
}
