import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { finalize } from 'rxjs';

import { parseApiError } from '@core/errors/api-error';
import { ReportService } from '@core/services/report.service';
import { SavedReport } from '../models/report.model';

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
    this.selectedReportId.set(reportId);
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
