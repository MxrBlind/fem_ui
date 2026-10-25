import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '@env/environment';
import { ReportResult } from '@features/reports/models/report.model';

@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/report`;

  generate(prompt: string): Observable<ReportResult> {
    return this.http.post<ReportResult>(`${this.baseUrl}/generate`, { prompt });
  }
}
