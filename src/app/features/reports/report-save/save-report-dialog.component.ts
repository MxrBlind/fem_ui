import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { filter } from 'rxjs';

import { parseApiError } from '@core/errors/api-error';
import { REPORT_NAME_CONFLICT_MESSAGE, REPORT_SAVE_FAILED_MESSAGE } from '@core/errors/error-messages';
import { showSaveError } from '@core/errors/field-errors';
import { ReportService } from '@core/services/report.service';
import { notBlank } from '@shared/validators/not-blank.validator';
import { SaveReportRequest, SavedReport } from '../models/report.model';

export const NAME_MAX_LENGTH = 100;
export const DESCRIPTION_MAX_LENGTH = 255;
export const DIALOG_TITLE = 'Guardar reporte';

const NAME_CONFLICT_CODE = 'REPORT_NAME_CONFLICT';

export interface SaveReportDialogData {
  reportToken: string;
}

/** `undefined` means the admin dismissed the dialog without saving. */
export type SaveReportDialogResult = { outcome: 'saved'; report: SavedReport } | { outcome: 'expired' };

/**
 * Opened with `disableClose: true`: Escape, backdrop clicks and "Cancelar" are routed through `cancel()`, which
 * ignores them while a request is in flight so the single-use report token is never left without an answer.
 * The dialog makes the request itself because it has to stay open (and keep the typed values) on a duplicate name.
 */
@Component({
  selector: 'app-save-report-dialog',
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
  templateUrl: './save-report-dialog.component.html',
  styleUrl: './save-report-dialog.component.scss',
  host: { 'data-testid': 'report-save-dialog' }
})
export class SaveReportDialogComponent {
  private readonly reportService = inject(ReportService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogRef = inject(MatDialogRef<SaveReportDialogComponent, SaveReportDialogResult>);
  private readonly data = inject<SaveReportDialogData>(MAT_DIALOG_DATA);

  readonly title = DIALOG_TITLE;
  readonly nameMaxLength = NAME_MAX_LENGTH;
  readonly descriptionMaxLength = DESCRIPTION_MAX_LENGTH;

  readonly saving = signal(false);

  readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, notBlank, Validators.maxLength(NAME_MAX_LENGTH)]],
    description: ['', [Validators.maxLength(DESCRIPTION_MAX_LENGTH)]]
  });

  private readonly nameValue = toSignal(this.form.controls.name.valueChanges, { initialValue: '' });
  private readonly descriptionValue = toSignal(this.form.controls.description.valueChanges, { initialValue: '' });
  readonly nameLength = computed(() => this.nameValue().length);
  readonly descriptionLength = computed(() => this.descriptionValue().length);

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
    if (this.form.invalid || this.saving()) return;

    this.saving.set(true);
    this.form.disable();

    this.reportService
      .save(this.buildRequest())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (report) => this.dialogRef.close({ outcome: 'saved', report }),
        error: (err: unknown) => this.handleError(err)
      });
  }

  /** Closes without a result, unless a request is in flight. */
  cancel(): void {
    if (this.saving()) return;
    this.dialogRef.close();
  }

  private buildRequest(): SaveReportRequest {
    const { name, description } = this.form.getRawValue();
    const trimmedDescription = description.trim();
    return {
      reportToken: this.data.reportToken,
      name: name.trim(),
      ...(trimmedDescription ? { description: trimmedDescription } : {})
    };
  }

  private handleError(err: unknown): void {
    const { status, code } = parseApiError(err);
    // Only the status is logged: never the token, the typed name or the response body.
    console.error('[report-save] failed to save the report, status', status);

    this.saving.set(false);
    this.form.enable();

    if (status === 404) {
      this.dialogRef.close({ outcome: 'expired' });
      return;
    }
    if (status === 409 && code === NAME_CONFLICT_CODE) {
      // After enable(): enabling revalidates and would wipe the error. It clears when the name is edited.
      const name = this.form.controls.name;
      name.setErrors({ ...name.errors, server: REPORT_NAME_CONFLICT_MESSAGE });
      name.markAsTouched();
      return;
    }
    showSaveError(this.form, err, REPORT_SAVE_FAILED_MESSAGE, this.snackBar);
  }
}
