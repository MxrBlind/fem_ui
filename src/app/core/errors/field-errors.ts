import { AbstractControl } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';

import { parseApiError } from './api-error';
import { resolveErrorMessage } from './error-messages';

/**
 * Shows backend `fieldErrors` on the matching form controls as a `server`
 * validation error (render it with `<mat-error>{{ control.errors?.['server'] }}</mat-error>`).
 * The error disappears on the next edit because Angular recomputes validity.
 *
 * Call it AFTER re-enabling the form: `enable()` revalidates and would wipe it.
 *
 * A nested path such as `profile.name` falls back to its last segment (`name`).
 *
 * @param fieldMap maps backend field names to control names when they differ.
 * @returns messages of entries that matched no control, for the caller to surface.
 */
export function applyFieldErrors(
  form: AbstractControl,
  err: unknown,
  fieldMap: Readonly<Record<string, string>> = {}
): string[] {
  const unmatched: string[] = [];

  for (const { field, message } of parseApiError(err).fieldErrors) {
    const control = form.get(fieldMap[field] ?? field) ?? form.get(field.slice(field.lastIndexOf('.') + 1));
    if (!control) {
      unmatched.push(message);
      continue;
    }
    control.setErrors({ ...control.errors, server: message });
    control.markAsTouched();
  }

  return unmatched;
}

/**
 * Reports a failed create/update from a form. Field errors that landed on a
 * control are shown inline; everything else goes to one error snackbar (the
 * unmatched field messages, or the message resolved from status/code).
 * Call it after re-enabling the form (see {@link applyFieldErrors}).
 */
export function showSaveError(
  form: AbstractControl,
  err: unknown,
  fallback: string,
  snackBar: MatSnackBar,
  fieldMap: Readonly<Record<string, string>> = {}
): void {
  const hasFieldErrors = parseApiError(err).fieldErrors.length > 0;
  const unmatched = applyFieldErrors(form, err, fieldMap);
  if (hasFieldErrors && unmatched.length === 0) return;

  snackBar.open(unmatched.length > 0 ? unmatched.join(' ') : resolveErrorMessage(err, fallback), 'Cerrar', {
    duration: 3000,
    panelClass: 'snackbar-error'
  });
}
