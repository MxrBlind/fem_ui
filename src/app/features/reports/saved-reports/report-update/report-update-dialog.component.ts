import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { filter, map } from 'rxjs';

import { parseApiError } from '@core/errors/api-error';
import { REPORT_NAME_CONFLICT_MESSAGE, REPORT_UPDATE_FAILED_MESSAGE } from '@core/errors/error-messages';
import { applyFieldErrors } from '@core/errors/field-errors';
import { ReportService } from '@core/services/report.service';
import { notBlank } from '@shared/validators/not-blank.validator';
import { SavedReport, UpdateSavedReportRequest } from '../../models/report.model';
import { DESCRIPTION_MAX_LENGTH, NAME_MAX_LENGTH } from '../../report-save/save-report-dialog.component';

export const DIALOG_TITLE = 'Actualizar reporte';

const NAME_CONFLICT_CODE = 'REPORT_NAME_CONFLICT';

export interface ReportUpdateDialogData {
  report: SavedReport;
}

/** `undefined` means the admin dismissed the dialog without saving. */
export type ReportUpdateDialogResult =
  | { outcome: 'updated'; report: SavedReport }
  | { outcome: 'not-found' };

/**
 * Opened with `disableClose: true`: Escape, backdrop clicks and "Cancelar" are routed through `cancel()`, which
 * ignores them while a request is in flight so the answer of a request already sent is never lost.
 * The dialog makes the request itself because it has to stay open (and keep the typed values) on a duplicate
 * name and on transient failures. The opener shows the success and not-found messages, as the dialog is gone by then.
 */
@Component({
  selector: 'app-report-update-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  templateUrl: './report-update-dialog.component.html',
  styleUrl: './report-update-dialog.component.scss',
  host: { 'data-testid': 'report-update-dialog' }
})
export class ReportUpdateDialogComponent {
  private readonly reportService = inject(ReportService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogRef = inject(MatDialogRef<ReportUpdateDialogComponent, ReportUpdateDialogResult>);
  private readonly report = inject<ReportUpdateDialogData>(MAT_DIALOG_DATA).report;

  readonly title = DIALOG_TITLE;
  readonly nameMaxLength = NAME_MAX_LENGTH;
  readonly descriptionMaxLength = DESCRIPTION_MAX_LENGTH;

  readonly saving = signal(false);

  readonly form = inject(FormBuilder).nonNullable.group({
    name: [this.report.name, [Validators.required, notBlank, Validators.maxLength(NAME_MAX_LENGTH)]],
    description: [this.report.description ?? '', [Validators.maxLength(DESCRIPTION_MAX_LENGTH)]]
  });

  // `getRawValue()` and not `value`: disabling the form during a save removes its controls from `value`.
  private readonly formValue = toSignal(this.form.valueChanges.pipe(map(() => this.form.getRawValue())), {
    initialValue: this.form.getRawValue()
  });
  readonly nameLength = computed(() => this.formValue().name.length);
  readonly descriptionLength = computed(() => this.formValue().description.length);

  /** Whether the trimmed name or description differs from the report's current values. */
  readonly changed = computed(() => {
    const { name, description } = this.formValue();
    return (
      name.trim() !== this.report.name.trim() || description.trim() !== (this.report.description ?? '').trim()
    );
  });

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

  onSubmit(): void {
    if (this.form.invalid || this.saving() || !this.changed()) return;

    this.saving.set(true);
    this.form.disable();

    this.reportService
      .update(this.report.id, this.buildRequest())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (report) => this.dialogRef.close({ outcome: 'updated', report }),
        error: (err: unknown) => this.handleError(err)
      });
  }

  /** Closes without a result, unless a request is in flight. */
  cancel(): void {
    if (this.saving()) return;
    this.dialogRef.close();
  }

  private buildRequest(): UpdateSavedReportRequest {
    const { name, description } = this.form.getRawValue();
    return { name: name.trim(), description: description.trim() || null };
  }

  private handleError(err: unknown): void {
    const { status, code } = parseApiError(err);
    // Only the status is logged: never the typed name or description, nor the response body.
    console.warn('[SavedReports] failed to update saved report', status);

    this.saving.set(false);
    this.form.enable();

    if (status === 404) {
      this.dialogRef.close({ outcome: 'not-found' });
      return;
    }
    // `401` and `403` are already handled by `authInterceptor` (logout, "not allowed" snackbar).
    if (status === 401 || status === 403) return;

    // After enable(): enabling revalidates and would wipe a server error. It clears when the control is edited.
    if (status === 409 && code === NAME_CONFLICT_CODE) {
      const name = this.form.controls.name;
      name.setErrors({ ...name.errors, server: REPORT_NAME_CONFLICT_MESSAGE });
      name.markAsTouched();
      return;
    }

    // `showSaveError` is not used: it would show a second "not allowed" message on `403` and resolve other texts.
    const hasFieldErrors = status === 400 && parseApiError(err).fieldErrors.length > 0;
    const unmatched = hasFieldErrors ? applyFieldErrors(this.form, err) : [];
    if (hasFieldErrors && unmatched.length === 0) return;

    this.snackBar.open(REPORT_UPDATE_FAILED_MESSAGE, 'Cerrar', { duration: 5000, panelClass: 'snackbar-error' });
  }
}
