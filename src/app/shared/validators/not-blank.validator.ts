import { AbstractControl, ValidationErrors } from '@angular/forms';

/** Rejects text that is empty once trimmed, which `Validators.required` lets through. */
export function notBlank(control: AbstractControl<string>): ValidationErrors | null {
  return control.value.trim().length === 0 ? { blank: true } : null;
}
