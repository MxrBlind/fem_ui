import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injector,
  OnInit,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelect, MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subscription, finalize } from 'rxjs';

import { parseApiError } from '@core/errors/api-error';
import {
  NOT_FOUND_MESSAGE,
  REPORT_DELETED_MESSAGE,
  REPORT_UPDATED_MESSAGE,
  SAVED_REPORT_EXECUTION_FAILED_MESSAGE,
  SAVED_REPORT_RUN_FAILED_MESSAGE,
} from '@core/errors/error-messages';
import { ReportService } from '@core/services/report.service';
import { ReportResult, SavedReport } from '../models/report.model';
import { ReportResultComponent } from '../report-result/report-result.component';
import {
  ReportDeleteConfirmComponent,
  ReportDeleteConfirmData,
  ReportDeleteConfirmResult,
} from './report-delete-confirm/report-delete-confirm.component';
import {
  ReportUpdateDialogComponent,
  ReportUpdateDialogData,
  ReportUpdateDialogResult,
} from './report-update/report-update-dialog.component';

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
  private readonly dialog = inject(MatDialog);
  private readonly injector = inject(Injector);

  /** Absent while the list is loading, failed or empty. */
  private readonly reportSelect = viewChild(MatSelect);

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

  /** Asks for confirmation; the dialog makes the request and reports how it ended. */
  onDelete(): void {
    const report = this.selectedReport();
    if (report === null) return;

    this.dialog
      .open<ReportDeleteConfirmComponent, ReportDeleteConfirmData, ReportDeleteConfirmResult>(
        ReportDeleteConfirmComponent,
        { data: { report }, disableClose: true }
      )
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((outcome) => this.handleDeleteOutcome(report.id, outcome));
  }

  /** Opens the edit dialog; it makes the request itself and reports how it ended. */
  onUpdate(): void {
    const report = this.selectedReport();
    if (report === null) return;

    this.dialog
      .open<ReportUpdateDialogComponent, ReportUpdateDialogData, ReportUpdateDialogResult>(
        ReportUpdateDialogComponent,
        { data: { report }, disableClose: true }
      )
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((outcome) => this.handleUpdateOutcome(report.id, outcome));
  }

  /** `undefined` means the dialog was dismissed, so nothing changes. */
  private handleUpdateOutcome(reportId: number, outcome: ReportUpdateDialogResult | undefined): void {
    if (outcome === undefined) return;

    if (outcome.outcome === 'updated') {
      this.replaceReport(outcome.report);
      this.snackBar.open(REPORT_UPDATED_MESSAGE, 'Cerrar', { duration: 3000 });
      return;
    }
    // `not-found`: the report is already gone from the server, so it leaves the list too.
    this.removeReport(reportId);
    this.snackBar.open(NOT_FOUND_MESSAGE, 'Cerrar', { duration: 5000, panelClass: 'snackbar-error' });
  }

  /**
   * Only the name and description changed, so the selection, the shown result and a run in flight are kept. The list
   * is re-sorted locally to match the order the backend would return, which avoids a refetch.
   */
  private replaceReport(updated: SavedReport): void {
    this.reports.update((reports) =>
      reports.map((report) => (report.id === updated.id ? updated : report)).sort(compareByName)
    );
  }

  /** `undefined` means the dialog was dismissed, so nothing changes. */
  private handleDeleteOutcome(reportId: number, outcome: ReportDeleteConfirmResult | undefined): void {
    if (outcome === undefined) return;

    this.removeReport(reportId);
    if (outcome.outcome === 'deleted') {
      this.snackBar.open(REPORT_DELETED_MESSAGE, 'Cerrar', { duration: 3000 });
      return;
    }
    // `not-found`: the report is already gone from the server, so it leaves the list too.
    this.snackBar.open(NOT_FOUND_MESSAGE, 'Cerrar', { duration: 5000, panelClass: 'snackbar-error' });
  }

  /** The list is updated locally: a refetch would add a request for something the page already knows. */
  private removeReport(reportId: number): void {
    if (this.selectedReportId() === reportId) {
      // Unsubscribing cancels a run in flight and runs `finalize`, so its late response is never shown.
      this.runSubscription?.unsubscribe();
      this.runSubscription = null;
      this.result.set(null);
      this.selectedReportId.set(null);
    }
    this.reports.update((reports) => reports.filter((report) => report.id !== reportId));

    // `restoreFocus` would target the "Borrar" button, which is gone once the selection clears.
    afterNextRender(() => this.reportSelect()?.focus(), { injector: this.injector });
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

/** Name ascending, ignoring case and accents, like the backend list. The sort is stable, so ties keep their order. */
function compareByName(a: SavedReport, b: SavedReport): number {
  return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
}

function runErrorMessage(status: number, code: string | undefined): string {
  if (status === 404) return NOT_FOUND_MESSAGE;
  if (status === 422 && code === 'REPORT_EXECUTION_FAILED') return SAVED_REPORT_EXECUTION_FAILED_MESSAGE;
  return SAVED_REPORT_RUN_FAILED_MESSAGE;
}
