import { AbstractControl, ValidationErrors } from '@angular/forms';

export const END_BEFORE_START_MESSAGE =
  'La fecha de término debe ser posterior a la fecha de inicio';

export function endAfterStartValidator(
  group: AbstractControl
): ValidationErrors | null {
  const start = group.get('startDate')?.value as Date | null;
  const end = group.get('endDate')?.value as Date | null;
  if (!start || !end) return null;
  return end.getTime() > start.getTime() ? null : { endBeforeStart: true };
}

export function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  return new Date(Number(y), Number(m) - 1, Number(d));
}

export function toIsoDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function nonBlankValidator(
  control: AbstractControl
): ValidationErrors | null {
  const value = (control.value ?? '') as string;
  if (value.length === 0) return null;
  return value.trim().length > 0 ? null : { required: true };
}
