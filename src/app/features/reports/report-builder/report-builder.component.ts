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

/** Prompts are single-line: each line break (`\r\n`, `\r` or `\n`) becomes one space. */
export function toSingleLine(text: string): string {
  return text.replace(/\r\n|\r|\n/g, ' ');
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

  /** Enter (with or without modifiers) submits and never inserts a line break, except while an IME is composing. */
  onPromptKeydown(event: KeyboardEvent): void {
    // keyCode 229 is how Safari reports keys that belong to an IME composition.
    if (event.key !== 'Enter' || event.isComposing || event.keyCode === 229) return;

    event.preventDefault();
    this.onSubmit();
  }

  /** Pasted line breaks become spaces; pastes without line breaks are left to the browser. */
  onPromptPaste(event: ClipboardEvent): void {
    const pasted = event.clipboardData?.getData('text');
    if (!pasted || toSingleLine(pasted) === pasted) return;

    event.preventDefault();
    const field = event.target as HTMLTextAreaElement;
    const { value, selectionStart, selectionEnd } = field;
    // Setting the value programmatically bypasses `maxlength`, so cut the insertion to the remaining room.
    const room = PROMPT_MAX_LENGTH - (value.length - (selectionEnd - selectionStart));
    const inserted = toSingleLine(pasted).slice(0, Math.max(room, 0));

    this.form.controls.prompt.setValue(value.slice(0, selectionStart) + inserted + value.slice(selectionEnd));
    const caret = selectionStart + inserted.length;
    field.setSelectionRange(caret, caret);
  }

  onSubmit(): void {
    if (this.form.invalid || this.loading()) return;

    this.loading.set(true);
    this.reportService
      .generate(toSingleLine(this.form.controls.prompt.value).trim())
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
