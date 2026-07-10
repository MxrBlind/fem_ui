import { AbstractControl, ValidationErrors } from '@angular/forms';

export function toBirthDateIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}T00:00:00.000+00:00`;
}

export function optionalLengthValidator(
  min: number,
  max: number
): (control: AbstractControl) => ValidationErrors | null {
  return (control) => {
    const value = (control.value ?? '') as string;
    if (value.length === 0) return null;
    if (value.length < min) return { minlength: { requiredLength: min, actualLength: value.length } };
    if (value.length > max) return { maxlength: { requiredLength: max, actualLength: value.length } };
    return null;
  };
}
