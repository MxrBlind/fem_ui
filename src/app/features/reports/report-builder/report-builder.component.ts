import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { finalize } from 'rxjs';

import { parseApiError } from '@core/errors/api-error';
import { REPORT_GENERATION_FAILED_MESSAGE, resolveErrorMessage } from '@core/errors/error-messages';
import { ReportService } from '@core/services/report.service';
import { ReportResult } from '../models/report.model';
import { ReportResultComponent } from '../report-result/report-result.component';

export const PROMPT_MAX_LENGTH = 2000;
export const PAGE_TITLE = 'Generador inteligente';

/** Rejects text that is empty once trimmed, which `Validators.required` lets through. */
function notBlank(control: AbstractControl<string>): ValidationErrors | null {
  return control.value.trim().length === 0 ? { blank: true } : null;
}

@Component({
  selector: 'app-report-builder',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    ReportResultComponent,
  ],
  templateUrl: './report-builder.component.html',
  styleUrl: './report-builder.component.scss',
})
export class ReportBuilderComponent {
  private readonly reportService = inject(ReportService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly title = PAGE_TITLE;
  readonly maxLength = PROMPT_MAX_LENGTH;

  readonly loading = signal(false);
  readonly result = signal<ReportResult | null>(null);

  readonly form = inject(FormBuilder).nonNullable.group({
    prompt: ['', [Validators.required, notBlank, Validators.maxLength(PROMPT_MAX_LENGTH)]],
  });

  private readonly promptValue = toSignal(this.form.controls.prompt.valueChanges, { initialValue: '' });
  readonly promptLength = computed(() => this.promptValue().length);

  onSubmit(): void {
    if (this.form.invalid || this.loading()) return;

    this.loading.set(true);
    this.reportService
      .generate(this.form.controls.prompt.value.trim())
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (report) => this.result.set(report),
        error: (err: unknown) => {
          console.error('[report-builder] failed to generate the report, status', parseApiError(err).status);
          this.snackBar.open(resolveErrorMessage(err, REPORT_GENERATION_FAILED_MESSAGE), 'Cerrar', {
            duration: 5000,
            panelClass: 'snackbar-error',
          });
        },
      });
  }
}
