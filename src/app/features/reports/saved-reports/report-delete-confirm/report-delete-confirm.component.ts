import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { filter } from 'rxjs';

import { parseApiError } from '@core/errors/api-error';
import { REPORT_DELETE_FAILED_MESSAGE } from '@core/errors/error-messages';
import { ReportService } from '@core/services/report.service';
import { SavedReport } from '../../models/report.model';

export const DIALOG_TITLE = 'Borrar reporte';
export const CONFIRM_MESSAGE = '¿Estás seguro de eliminar este reporte?';

export interface ReportDeleteConfirmData {
  report: SavedReport;
}

/**
 * `undefined` means the admin dismissed the dialog without deleting. On `not-found` the report no longer exists
 * on the server, so the opener removes it from its list as well.
 */
export type ReportDeleteConfirmResult = { outcome: 'deleted' } | { outcome: 'not-found' };

/**
 * Opened with `disableClose: true`: Escape, backdrop clicks and "No" are routed through `cancel()`, which ignores
 * them while the request is in flight. The dialog makes the request itself because it has to stay open, and let
 * the admin retry, when a delete fails for a reason other than the report being gone.
 */
@Component({
  selector: 'app-report-delete-confirm',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatDialogModule, MatProgressSpinnerModule, MatSnackBarModule],
  templateUrl: './report-delete-confirm.component.html',
  styleUrl: './report-delete-confirm.component.scss',
  host: { 'data-testid': 'report-delete-dialog' }
})
export class ReportDeleteConfirmComponent {
  private readonly reportService = inject(ReportService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogRef = inject(MatDialogRef<ReportDeleteConfirmComponent, ReportDeleteConfirmResult>);
  private readonly data = inject<ReportDeleteConfirmData>(MAT_DIALOG_DATA);

  readonly title = DIALOG_TITLE;
  readonly message = CONFIRM_MESSAGE;
  readonly reportName = this.data.report.name;

  readonly deleting = signal(false);

  constructor() {
    this.dialogRef
      .backdropClick()
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.cancel());
    this.dialogRef
      .keydownEvents()
      .pipe(
        filter((event) => event.key === 'Escape' && !event.defaultPrevented),
        takeUntilDestroyed()
      )
      .subscribe(() => this.cancel());
  }

  onConfirm(): void {
    if (this.deleting()) return;

    this.deleting.set(true);
    this.reportService
      .delete(this.data.report.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.dialogRef.close({ outcome: 'deleted' }),
        error: (err: unknown) => this.handleError(err)
      });
  }

  /** Closes without a result, unless a request is in flight. */
  cancel(): void {
    if (this.deleting()) return;
    this.dialogRef.close();
  }

  private handleError(err: unknown): void {
    const { status } = parseApiError(err);
    // Only the status is logged: never the report name or the response body.
    console.warn('[SavedReports] failed to delete saved report', status);

    if (status === 404) {
      this.dialogRef.close({ outcome: 'not-found' });
      return;
    }

    this.deleting.set(false);
    // `401` and `403` are already handled by `authInterceptor` (logout, "not allowed" snackbar).
    if (status === 401 || status === 403) return;

    this.snackBar.open(REPORT_DELETE_FAILED_MESSAGE, 'Cerrar', {
      duration: 5000,
      panelClass: 'snackbar-error'
    });
  }
}
