import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '@env/environment';
import { ReportResult, SaveReportRequest, SavedReport } from '@features/reports/models/report.model';

@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/report`;

  generate(prompt: string): Observable<ReportResult> {
    return this.http.post<ReportResult>(`${this.baseUrl}/generate`, { prompt });
  }

  /** Saves a generated report by its single-use token. The backend keeps the SQL; it is never sent or received. */
  save(request: SaveReportRequest): Observable<SavedReport> {
    return this.http.post<SavedReport>(`${this.baseUrl}/saved`, request);
  }
}
