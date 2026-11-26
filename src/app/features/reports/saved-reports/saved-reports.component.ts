import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subscription, finalize } from 'rxjs';

import { parseApiError } from '@core/errors/api-error';
import {
  NOT_FOUND_MESSAGE,
  SAVED_REPORT_EXECUTION_FAILED_MESSAGE,
  SAVED_REPORT_RUN_FAILED_MESSAGE,
} from '@core/errors/error-messages';
import { ReportService } from '@core/services/report.service';
import { ReportResult, SavedReport } from '../models/report.model';
import { ReportResultComponent } from '../report-result/report-result.component';

export const SAVED_REPORTS_LOAD_FAILED_MESSAGE = 'No se pudieron cargar los reportes guardados.';
export const NO_SAVED_REPORTS_MESSAGE = 'No hay reportes guardados.';
export const EMPTY_DESCRIPTION = '—';

@Component({
  selector: 'app-saved-reports',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSnackBarModule,
    ReportResultComponent,
  ],
  templateUrl: './saved-reports.component.html',
  styleUrl: './saved-reports.component.scss',
})
export class SavedReportsComponent implements OnInit {
  private readonly reportService = inject(ReportService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly noSavedReportsMessage = NO_SAVED_REPORTS_MESSAGE;

  readonly loading = signal(true);
  readonly loadFailed = signal(false);
  readonly reports = signal<SavedReport[]>([]);
  readonly selectedReportId = signal<number | null>(null);
  /** Result of the last run of the selected report; cleared whenever the selection changes. */
  readonly result = signal<ReportResult | null>(null);
  readonly executing = signal(false);

  /** The in-flight run, cancelled when the selection changes so a late response is never shown. */
  private runSubscription: Subscription | null = null;

  readonly selectedReport = computed<SavedReport | null>(() => {
    const id = this.selectedReportId();
    return this.reports().find((report) => report.id === id) ?? null;
  });

  readonly selectedDescription = computed(() => {
    const description = this.selectedReport()?.description;
    return description?.trim() ? description : EMPTY_DESCRIPTION;
  });

  ngOnInit(): void {
    this.reportService
      .listSaved()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (reports) => this.reports.set(reports),
        error: (err: unknown) => this.handleLoadError(err),
      });
  }

  onSelect(reportId: number): void {
    if (reportId === this.selectedReportId()) return;

    // Unsubscribing cancels the request and runs `finalize`, so `executing` is false for the new selection.
    this.runSubscription?.unsubscribe();
    this.runSubscription = null;
    this.result.set(null);
    this.selectedReportId.set(reportId);
  }

  /** Runs the selected report against current data. Ignored while a run is in flight. */
  onRun(): void {
    const reportId = this.selectedReportId();
    if (reportId === null || this.executing()) return;

    this.executing.set(true);
    this.runSubscription = this.reportService
      .execute(reportId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.executing.set(false))
      )
      .subscribe({
        next: (report) => this.result.set(report),
        error: (err: unknown) => this.handleRunError(err),
      });
  }

  /**
   * The message is resolved here and not with `resolveErrorMessage`, because its `REPORT_EXECUTION_FAILED`
   * text asks the admin to rephrase a request that a saved report does not have. A failed run keeps the result
   * already shown for the same report.
   */
  private handleRunError(err: unknown): void {
    const { status, code } = parseApiError(err);
    if (status === 401 || status === 403) return;

    console.warn('[SavedReports] failed to run saved report', status);
    this.snackBar.open(runErrorMessage(status, code), 'Cerrar', {
      duration: 5000,
      panelClass: 'snackbar-error',
    });
  }

  /** `401` and `403` are already handled by `authInterceptor` (logout, "not allowed" snackbar). */
  private handleLoadError(err: unknown): void {
    this.loadFailed.set(true);
    const { status } = parseApiError(err);
    if (status === 401 || status === 403) return;

    console.warn('[SavedReports] failed to load saved reports', status);
    this.snackBar.open(SAVED_REPORTS_LOAD_FAILED_MESSAGE, 'Cerrar', {
      duration: 5000,
      panelClass: 'snackbar-error',
    });
  }
}

function runErrorMessage(status: number, code: string | undefined): string {
  if (status === 404) return NOT_FOUND_MESSAGE;
  if (status === 422 && code === 'REPORT_EXECUTION_FAILED') return SAVED_REPORT_EXECUTION_FAILED_MESSAGE;
  return SAVED_REPORT_RUN_FAILED_MESSAGE;
}
