import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, FormGroup, Validators } from '@angular/forms';

import { MatSnackBar } from '@angular/material/snack-bar';

import { NOT_ALLOWED_MESSAGE } from './error-messages';
import { applyFieldErrors, showSaveError } from './field-errors';

function validationError(fieldErrors: { field: string; message: string }[]): HttpErrorResponse {
  return new HttpErrorResponse({
    status: 400,
    statusText: 'Bad Request',
    error: { status: 400, message: 'Validation failed', code: 'VALIDATION_FAILED', fieldErrors }
  });
}

describe('applyFieldErrors', () => {
  let form: FormGroup<{ title: FormControl<string>; teacherId: FormControl<number | null> }>;

  beforeEach(() => {
    form = new FormGroup({
      title: new FormControl('ok', { nonNullable: true, validators: [Validators.required] }),
      teacherId: new FormControl<number | null>(1)
    });
  });

  it('sets a server error on the matching control and marks it touched', () => {
    const unmatched = applyFieldErrors(form, validationError([{ field: 'title', message: 'Title too long' }]));

    expect(unmatched).toEqual([]);
    expect(form.controls.title.errors).toEqual({ server: 'Title too long' });
    expect(form.controls.title.touched).toBe(true);
    expect(form.controls.title.invalid).toBe(true);
  });

  it('preserves existing client-side errors', () => {
    form.controls.title.setValue('');
    applyFieldErrors(form, validationError([{ field: 'title', message: 'Server says no' }]));

    expect(form.controls.title.errors).toEqual({ required: true, server: 'Server says no' });
  });

  it('honors the optional field map', () => {
    const unmatched = applyFieldErrors(
      form,
      validationError([{ field: 'teacher', message: 'Teacher is required' }]),
      { teacher: 'teacherId' }
    );

    expect(unmatched).toEqual([]);
    expect(form.controls.teacherId.errors).toEqual({ server: 'Teacher is required' });
  });

  it('returns messages of entries without a matching control', () => {
    const unmatched = applyFieldErrors(
      form,
      validationError([
        { field: 'unknown', message: 'Unknown is invalid' },
        { field: 'title', message: 'Title too long' }
      ])
    );

    expect(unmatched).toEqual(['Unknown is invalid']);
  });

  it('clears the server error when the user edits the control', () => {
    applyFieldErrors(form, validationError([{ field: 'title', message: 'Title too long' }]));

    form.controls.title.setValue('shorter');

    expect(form.controls.title.errors).toBeNull();
    expect(form.controls.title.valid).toBe(true);
  });

  it('falls back to the last segment of a nested field path', () => {
    const unmatched = applyFieldErrors(form, validationError([{ field: 'profile.title', message: 'Nested' }]));

    expect(unmatched).toEqual([]);
    expect(form.controls.title.errors).toEqual({ server: 'Nested' });
  });

  it('does nothing for errors without fieldErrors', () => {
    const unmatched = applyFieldErrors(form, new HttpErrorResponse({ status: 500, error: null }));

    expect(unmatched).toEqual([]);
    expect(form.valid).toBe(true);
  });
});

describe('showSaveError', () => {
  const open = vi.fn();
  const snackBar = { open } as unknown as MatSnackBar;
  let form: FormGroup<{ title: FormControl<string> }>;

  beforeEach(() => {
    open.mockClear();
    form = new FormGroup({ title: new FormControl('x', { nonNullable: true }) });
  });

  it('shows no snackbar when every field error landed on a control', () => {
    showSaveError(form, validationError([{ field: 'title', message: 'Too long' }]), 'Fallback', snackBar);

    expect(form.controls.title.errors).toEqual({ server: 'Too long' });
    expect(open).not.toHaveBeenCalled();
  });

  it('shows the unmatched field messages in one snackbar', () => {
    showSaveError(
      form,
      validationError([
        { field: 'level', message: 'Level should not be empty' },
        { field: 'category', message: 'Category should not be empty' }
      ]),
      'Fallback',
      snackBar
    );

    expect(open).toHaveBeenCalledWith(
      'Level should not be empty Category should not be empty',
      'Cerrar',
      expect.objectContaining({ panelClass: 'snackbar-error' })
    );
  });

  it('uses the resolved message for errors without fieldErrors', () => {
    showSaveError(form, new HttpErrorResponse({ status: 403, error: { path: '/x' } }), 'Fallback', snackBar);
    expect(open).toHaveBeenCalledWith(NOT_ALLOWED_MESSAGE, 'Cerrar', expect.anything());

    open.mockClear();
    showSaveError(form, new HttpErrorResponse({ status: 500, error: { code: 'INTERNAL_ERROR' } }), 'Fallback', snackBar);
    expect(open).toHaveBeenCalledWith('Fallback', 'Cerrar', expect.anything());
  });
});
