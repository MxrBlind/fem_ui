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

  /** Lists the caller's saved reports, ordered by name ascending by the backend. The SQL is never returned. */
  listSaved(): Observable<SavedReport[]> {
    return this.http.get<SavedReport[]>(`${this.baseUrl}/saved`);
  }

  /**
   * Runs a saved report against current data. The backend keeps the SQL, so it is never sent or received.
   * The result has no save token and its `interpretation` is the stored description.
   */
  execute(id: number): Observable<ReportResult> {
    return this.http.post<ReportResult>(`${this.baseUrl}/saved/${id}/execute`, null);
  }

  /** Permanently deletes one of the caller's saved reports. The backend answers `204` with an empty body. */
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/saved/${id}`);
  }
}
