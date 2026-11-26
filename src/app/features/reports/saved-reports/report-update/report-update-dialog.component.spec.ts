import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';

import { REPORT_NAME_CONFLICT_MESSAGE, REPORT_UPDATE_FAILED_MESSAGE } from '@core/errors/error-messages';
import { ReportService } from '@core/services/report.service';
import { SavedReport, UpdateSavedReportRequest } from '../../models/report.model';
import { DESCRIPTION_MAX_LENGTH, NAME_MAX_LENGTH } from '../../report-save/save-report-dialog.component';
import { ReportUpdateDialogComponent, ReportUpdateDialogData } from './report-update-dialog.component';

const report: SavedReport = {
  id: 7,
  name: 'Alumnos activos',
  description: 'Ciclo actual',
  originalPrompt: 'SECRET-PROMPT alumnos activos',
  createdDate: '2026-11-22T01:00:00',
  updatedDate: null,
  lastRunDate: '2026-11-23T08:15:00'
};

const updatedReport: SavedReport = {
  ...report,
  name: 'Alumnos 2026',
  updatedDate: '2026-11-26T10:30:00'
};

function httpError(status: number, body: unknown): HttpErrorResponse {
  return new HttpErrorResponse({ status, statusText: 'Error', error: body });
}

interface Harness {
  fixture: ComponentFixture<ReportUpdateDialogComponent>;
  update: ReturnType<typeof vi.fn>;
  dialogClose: ReturnType<typeof vi.fn>;
  snackOpen: ReturnType<typeof vi.spyOn>;
  backdropClick$: Subject<MouseEvent>;
  keydown$: Subject<KeyboardEvent>;
  /** Controls the request issued by the latest `update()` call. */
  currentRequest: () => Subject<SavedReport>;
}

function setup(data: ReportUpdateDialogData = { report }): Harness {
  const requests: Subject<SavedReport>[] = [];
  const update = vi.fn((_id: number, _request: UpdateSavedReportRequest) => {
    const request = new Subject<SavedReport>();
    requests.push(request);
    return request.asObservable();
  });
  const dialogClose = vi.fn();
  const backdropClick$ = new Subject<MouseEvent>();
  const keydown$ = new Subject<KeyboardEvent>();

  TestBed.configureTestingModule({
    imports: [ReportUpdateDialogComponent],
    providers: [
      provideAnimationsAsync(),
      { provide: ReportService, useValue: { update } },
      { provide: MAT_DIALOG_DATA, useValue: data },
      {
        provide: MatDialogRef,
        useValue: {
          close: dialogClose,
          backdropClick: () => backdropClick$.asObservable(),
          keydownEvents: () => keydown$.asObservable()
        }
      }
    ]
  });
  const snackOpen = vi.spyOn(MatSnackBar.prototype, 'open').mockReturnValue({} as never);

  const fixture = TestBed.createComponent(ReportUpdateDialogComponent);
  fixture.detectChanges();

  return {
    fixture,
    update,
    dialogClose,
    snackOpen,
    backdropClick$,
    keydown$,
    currentRequest: () => requests[requests.length - 1]
  };
}

type Fixture = ComponentFixture<ReportUpdateDialogComponent>;

function root(fixture: Fixture): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function byTestId<T extends HTMLElement>(fixture: Fixture, id: string): T {
  return root(fixture).querySelector(`[data-testid="${id}"]`) as T;
}

function fill(fixture: Fixture, id: string, value: string): void {
  const field = byTestId<HTMLInputElement | HTMLTextAreaElement>(fixture, id);
  field.value = value;
  field.dispatchEvent(new Event('input'));
  fixture.detectChanges();
}

function submitButton(fixture: Fixture): HTMLButtonElement {
  return byTestId<HTMLButtonElement>(fixture, 'report-update-submit');
}

function cancelButton(fixture: Fixture): HTMLButtonElement {
  return byTestId<HTMLButtonElement>(fixture, 'report-update-cancel');
}

function submit(fixture: Fixture): void {
  submitButton(fixture).click();
  fixture.detectChanges();
}

function errorText(fixture: Fixture): string {
  return Array.from(root(fixture).querySelectorAll('mat-error'))
    .map((el) => el.textContent?.trim() ?? '')
    .join(' | ');
}

function escapeEvent(): KeyboardEvent {
  return new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
}

/** Changes the name to a valid new value and submits, leaving the request pending. */
function startSaving(harness: Harness, name = 'Alumnos 2026'): void {
  fill(harness.fixture, 'report-update-name', name);
  submit(harness.fixture);
}

describe('ReportUpdateDialogComponent', () => {
  afterEach(() => vi.restoreAllMocks());

  describe('form', () => {
    it('is titled "Actualizar reporte"', () => {
      const { fixture } = setup();

      expect(root(fixture).querySelector('[mat-dialog-title]')?.textContent?.trim()).toBe('Actualizar reporte');
    });

    it('prefills the name and the description from the report', () => {
      const { fixture } = setup();

      expect(byTestId<HTMLInputElement>(fixture, 'report-update-name').value).toBe('Alumnos activos');
      expect(byTestId<HTMLTextAreaElement>(fixture, 'report-update-description').value).toBe('Ciclo actual');
    });

    it('leaves the description empty when the report has none', () => {
      const { fixture } = setup({ report: { ...report, description: null } });

      expect(byTestId<HTMLTextAreaElement>(fixture, 'report-update-description').value).toBe('');
    });

    it('does not render the original prompt or any date', () => {
      const { fixture } = setup();

      const text = root(fixture).textContent ?? '';
      expect(text).not.toContain('SECRET-PROMPT');
      expect(text).not.toContain('2026-11-22');
      expect(text).not.toContain('2026-11-23');
    });

    it('sends no request when it opens', () => {
      const { update } = setup();

      expect(update).not.toHaveBeenCalled();
    });

    it('shows a character counter for each field', () => {
      const { fixture } = setup();

      expect(byTestId(fixture, 'report-update-name-counter').textContent?.trim()).toBe(
        `${'Alumnos activos'.length} / ${NAME_MAX_LENGTH}`
      );
      expect(byTestId(fixture, 'report-update-description-counter').textContent?.trim()).toBe(
        `${'Ciclo actual'.length} / ${DESCRIPTION_MAX_LENGTH}`
      );

      fill(fixture, 'report-update-name', 'Alumnos');
      expect(byTestId(fixture, 'report-update-name-counter').textContent?.trim()).toBe(`7 / ${NAME_MAX_LENGTH}`);
    });

    it.each(['', '   '])('rejects the blank name %j and shows the required error once touched', (value) => {
      const { fixture } = setup();

      fill(fixture, 'report-update-name', value);
      byTestId<HTMLInputElement>(fixture, 'report-update-name').dispatchEvent(new Event('blur'));
      fixture.detectChanges();

      expect(submitButton(fixture).disabled).toBe(true);
      expect(errorText(fixture)).toContain('El nombre es requerido.');
    });

    it('rejects a name over the limit and shows a length error', () => {
      const { fixture } = setup();

      fixture.componentInstance.form.controls.name.setValue('n'.repeat(NAME_MAX_LENGTH + 1));
      fixture.componentInstance.form.controls.name.markAsTouched();
      fixture.detectChanges();

      expect(submitButton(fixture).disabled).toBe(true);
      expect(errorText(fixture)).toContain(`El nombre no puede exceder ${NAME_MAX_LENGTH} caracteres.`);
    });

    it('rejects a description over the limit and shows a length error', () => {
      const { fixture } = setup();

      fixture.componentInstance.form.controls.description.setValue('d'.repeat(DESCRIPTION_MAX_LENGTH + 1));
      fixture.componentInstance.form.controls.description.markAsTouched();
      fixture.detectChanges();

      expect(submitButton(fixture).disabled).toBe(true);
      expect(errorText(fixture)).toContain(`La descripción no puede exceder ${DESCRIPTION_MAX_LENGTH} caracteres.`);
    });
  });

  describe('change detection', () => {
    it('disables "Guardar" while nothing changed', () => {
      const { fixture } = setup();

      expect(submitButton(fixture).disabled).toBe(true);
    });

    it('keeps "Guardar" disabled when only whitespace was added', () => {
      const { fixture } = setup();

      fill(fixture, 'report-update-name', '  Alumnos activos  ');
      fill(fixture, 'report-update-description', '  Ciclo actual ');

      expect(submitButton(fixture).disabled).toBe(true);
    });

    it('disables "Guardar" again when a change is reverted', () => {
      const { fixture } = setup();

      fill(fixture, 'report-update-description', 'Otro texto');
      expect(submitButton(fixture).disabled).toBe(false);

      fill(fixture, 'report-update-description', 'Ciclo actual');
      expect(submitButton(fixture).disabled).toBe(true);
    });

    it('enables "Guardar" after a case-only rename', () => {
      const { fixture } = setup();

      fill(fixture, 'report-update-name', 'ALUMNOS ACTIVOS');

      expect(submitButton(fixture).disabled).toBe(false);
    });

    it('enables "Guardar" after clearing the description', () => {
      const { fixture } = setup();

      fill(fixture, 'report-update-description', '');

      expect(submitButton(fixture).disabled).toBe(false);
    });

    it('treats a null description and an empty one as the same value', () => {
      const { fixture } = setup({ report: { ...report, description: null } });

      fill(fixture, 'report-update-description', '   ');

      expect(submitButton(fixture).disabled).toBe(true);
    });

    it('is disabled while saving and enabled again after a failure, because the change is still detected', () => {
      const harness = setup();

      startSaving(harness);
      expect(submitButton(harness.fixture).disabled).toBe(true);

      harness.currentRequest().error(httpError(500, {}));
      harness.fixture.detectChanges();

      expect(submitButton(harness.fixture).disabled).toBe(false);
    });
  });

  describe('request', () => {
    it('sends the report id with the trimmed name and description', () => {
      const { fixture, update } = setup();

      fill(fixture, 'report-update-name', '  Alumnos 2026  ');
      fill(fixture, 'report-update-description', '  Ciclo 2026  ');
      submit(fixture);

      expect(update).toHaveBeenCalledTimes(1);
      expect(update).toHaveBeenCalledWith(7, { name: 'Alumnos 2026', description: 'Ciclo 2026' });
    });

    it('sends a null description when the description is emptied', () => {
      const { fixture, update } = setup();

      fill(fixture, 'report-update-description', '   ');
      submit(fixture);

      expect(update).toHaveBeenCalledWith(7, { name: 'Alumnos activos', description: null });
    });

    it('never sends an empty name', () => {
      const { fixture, update } = setup();

      fill(fixture, 'report-update-name', '   ');
      fill(fixture, 'report-update-description', 'Otro texto');
      submit(fixture);

      expect(update).not.toHaveBeenCalled();
    });

    it('sends nothing when nothing changed', () => {
      const { fixture, update } = setup();

      submit(fixture);
      fixture.componentInstance.onSubmit();

      expect(update).not.toHaveBeenCalled();
    });

    it('disables the form and the buttons while the request is pending', () => {
      const harness = setup();

      startSaving(harness);

      expect(harness.fixture.componentInstance.form.disabled).toBe(true);
      expect(submitButton(harness.fixture).disabled).toBe(true);
      expect(cancelButton(harness.fixture).disabled).toBe(true);
    });

    it('shows a decorative spinner next to the unchanged label while saving', () => {
      const harness = setup();

      startSaving(harness);

      const button = submitButton(harness.fixture);
      const spinner = button.querySelector('mat-progress-spinner');
      expect(spinner?.getAttribute('aria-hidden')).toBe('true');
      expect(button.textContent?.trim()).toBe('Guardar');
    });

    it('sends no second request while the first is pending', () => {
      const harness = setup();

      startSaving(harness);
      submit(harness.fixture);
      harness.fixture.componentInstance.onSubmit();

      expect(harness.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('dismissal', () => {
    it('closes without a result when "Cancelar" is clicked', () => {
      const { fixture, dialogClose, update } = setup();

      fill(fixture, 'report-update-name', 'Otro nombre');
      cancelButton(fixture).click();

      expect(dialogClose).toHaveBeenCalledWith();
      expect(update).not.toHaveBeenCalled();
    });

    it('closes without a result on Escape', () => {
      const { dialogClose, keydown$, update } = setup();

      keydown$.next(escapeEvent());

      expect(dialogClose).toHaveBeenCalledWith();
      expect(update).not.toHaveBeenCalled();
    });

    it('closes without a result on a backdrop click', () => {
      const { dialogClose, backdropClick$, update } = setup();

      backdropClick$.next(new MouseEvent('click'));

      expect(dialogClose).toHaveBeenCalledWith();
      expect(update).not.toHaveBeenCalled();
    });

    it('does not close through any dismissal while the request is in flight', () => {
      const harness = setup();

      startSaving(harness);
      harness.fixture.componentInstance.cancel();
      harness.keydown$.next(escapeEvent());
      harness.backdropClick$.next(new MouseEvent('click'));

      expect(harness.dialogClose).not.toHaveBeenCalled();
    });

    it('ignores an Escape that was already handled', () => {
      const { dialogClose, keydown$ } = setup();
      const event = escapeEvent();
      event.preventDefault();

      keydown$.next(event);

      expect(dialogClose).not.toHaveBeenCalled();
    });
  });

  describe('outcomes', () => {
    it('closes with the updated report on success and shows no snackbar of its own', () => {
      const harness = setup();

      startSaving(harness);
      harness.currentRequest().next(updatedReport);
      harness.currentRequest().complete();

      expect(harness.dialogClose).toHaveBeenCalledWith({ outcome: 'updated', report: updatedReport });
      expect(harness.snackOpen).not.toHaveBeenCalled();
    });

    it('closes with "not-found" on 404', () => {
      const harness = setup();

      startSaving(harness);
      harness.currentRequest().error(httpError(404, { code: 'ENTITY_NOT_FOUND', message: 'Saved report not found' }));

      expect(harness.dialogClose).toHaveBeenCalledWith({ outcome: 'not-found' });
      expect(harness.snackOpen).not.toHaveBeenCalled();
    });

    describe('409 REPORT_NAME_CONFLICT', () => {
      function conflict(harness: Harness): void {
        startSaving(harness);
        harness.currentRequest().error(httpError(409, { code: 'REPORT_NAME_CONFLICT', message: 'Duplicate' }));
        harness.fixture.detectChanges();
      }

      it('keeps the dialog open, keeps the typed values and shows the inline error', () => {
        const harness = setup();

        conflict(harness);

        expect(harness.dialogClose).not.toHaveBeenCalled();
        expect(byTestId<HTMLInputElement>(harness.fixture, 'report-update-name').value).toBe('Alumnos 2026');
        expect(byTestId<HTMLTextAreaElement>(harness.fixture, 'report-update-description').value).toBe(
          'Ciclo actual'
        );
        expect(errorText(harness.fixture)).toContain(REPORT_NAME_CONFLICT_MESSAGE);
        expect(harness.snackOpen).not.toHaveBeenCalled();
      });

      it('re-enables the form and "Cancelar" but keeps "Guardar" disabled until the name is edited', () => {
        const harness = setup();

        conflict(harness);

        expect(harness.fixture.componentInstance.form.enabled).toBe(true);
        expect(cancelButton(harness.fixture).disabled).toBe(false);
        expect(submitButton(harness.fixture).disabled).toBe(true);
      });

      it('clears the error when the name is edited and a retry sends a new request', () => {
        const harness = setup();

        conflict(harness);
        fill(harness.fixture, 'report-update-name', 'Alumnos 2027');

        expect(errorText(harness.fixture)).not.toContain(REPORT_NAME_CONFLICT_MESSAGE);
        expect(submitButton(harness.fixture).disabled).toBe(false);

        submit(harness.fixture);

        expect(harness.update).toHaveBeenCalledTimes(2);
        expect(harness.update).toHaveBeenLastCalledWith(7, { name: 'Alumnos 2027', description: 'Ciclo actual' });
      });

      it('never shows the server message', () => {
        const harness = setup();

        conflict(harness);

        expect(root(harness.fixture).textContent).not.toContain('Duplicate');
      });
    });

    it('shows a 409 with another code as the generic failure', () => {
      const harness = setup();

      startSaving(harness);
      harness.currentRequest().error(httpError(409, { code: 'SOMETHING_ELSE', message: 'Other conflict' }));
      harness.fixture.detectChanges();

      expect(harness.snackOpen).toHaveBeenCalledWith(REPORT_UPDATE_FAILED_MESSAGE, 'Cerrar', {
        duration: 5000,
        panelClass: 'snackbar-error'
      });
      expect(errorText(harness.fixture)).not.toContain(REPORT_NAME_CONFLICT_MESSAGE);
    });

    it('shows 400 field errors inline, without a snackbar', () => {
      const harness = setup();

      startSaving(harness);
      harness.currentRequest().error(
        httpError(400, {
          code: 'VALIDATION_FAILED',
          fieldErrors: [
            { field: 'name', message: 'El nombre no es válido' },
            { field: 'description', message: 'La descripción no es válida' }
          ]
        })
      );
      harness.fixture.detectChanges();

      expect(harness.dialogClose).not.toHaveBeenCalled();
      expect(errorText(harness.fixture)).toContain('El nombre no es válido');
      expect(errorText(harness.fixture)).toContain('La descripción no es válida');
      expect(harness.snackOpen).not.toHaveBeenCalled();
    });

    it('shows the generic failure for a 400 without field errors', () => {
      const harness = setup();

      startSaving(harness);
      harness.currentRequest().error(httpError(400, { code: 'BAD_REQUEST', message: 'Bad id' }));

      expect(harness.snackOpen).toHaveBeenCalledWith(REPORT_UPDATE_FAILED_MESSAGE, 'Cerrar', {
        duration: 5000,
        panelClass: 'snackbar-error'
      });
    });

    it('shows the generic failure for a 400 whose field errors match no control', () => {
      const harness = setup();

      startSaving(harness);
      harness.currentRequest().error(
        httpError(400, { code: 'VALIDATION_FAILED', fieldErrors: [{ field: 'unknown', message: 'Nope' }] })
      );

      expect(harness.snackOpen).toHaveBeenCalledWith(REPORT_UPDATE_FAILED_MESSAGE, 'Cerrar', {
        duration: 5000,
        panelClass: 'snackbar-error'
      });
    });

    it.each([
      ['a 500 response', httpError(500, { code: 'INTERNAL_ERROR', message: 'SQL exploded' })],
      ['a network error', httpError(0, null)]
    ])('keeps the dialog usable and allows a retry after %s', (_label, error) => {
      const harness = setup();

      startSaving(harness);
      harness.currentRequest().error(error);
      harness.fixture.detectChanges();

      expect(harness.dialogClose).not.toHaveBeenCalled();
      expect(harness.snackOpen).toHaveBeenCalledTimes(1);
      expect(harness.snackOpen).toHaveBeenCalledWith(REPORT_UPDATE_FAILED_MESSAGE, 'Cerrar', {
        duration: 5000,
        panelClass: 'snackbar-error'
      });
      expect(harness.fixture.componentInstance.form.enabled).toBe(true);
      expect(cancelButton(harness.fixture).disabled).toBe(false);
      expect(submitButton(harness.fixture).disabled).toBe(false);
      expect(root(harness.fixture).textContent).not.toContain('SQL exploded');

      submit(harness.fixture);
      expect(harness.update).toHaveBeenCalledTimes(2);
    });

    it.each([401, 403])('keeps the dialog open and shows nothing of its own after a %i', (status) => {
      const harness = setup();

      startSaving(harness);
      harness.currentRequest().error(httpError(status, { code: 'ACCESS_DENIED', message: 'Nope' }));
      harness.fixture.detectChanges();

      expect(harness.dialogClose).not.toHaveBeenCalled();
      expect(harness.snackOpen).not.toHaveBeenCalled();
      expect(harness.fixture.componentInstance.form.enabled).toBe(true);
      expect(cancelButton(harness.fixture).disabled).toBe(false);
      expect(submitButton(harness.fixture).disabled).toBe(false);
    });

    it('logs only the status, never the name, the description or the response body', () => {
      const harness = setup();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      startSaving(harness, 'Nombre privado');
      harness.currentRequest().error(httpError(500, { code: 'INTERNAL_ERROR', message: 'SQL exploded' }));

      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith('[SavedReports] failed to update saved report', 500);
      const logged = JSON.stringify(warn.mock.calls[0]);
      expect(logged).not.toContain('Nombre privado');
      expect(logged).not.toContain('Ciclo actual');
      expect(logged).not.toContain('SQL exploded');
    });
  });

  describe('accessibility', () => {
    it('gives each field a visible label', () => {
      const { fixture } = setup();

      const labels = Array.from(root(fixture).querySelectorAll('mat-label')).map((el) => el.textContent?.trim());
      expect(labels).toEqual(['Nombre', 'Descripción']);
    });

    it('exposes validation errors through mat-error', () => {
      const { fixture } = setup();

      fill(fixture, 'report-update-name', '');
      fixture.componentInstance.form.controls.name.markAsTouched();
      fixture.detectChanges();

      expect(root(fixture).querySelectorAll('mat-error').length).toBe(1);
    });

    it('titles the dialog with an element that names it', () => {
      const { fixture } = setup();

      const title = root(fixture).querySelector('h2[mat-dialog-title]');
      expect(title?.textContent?.trim()).toBe('Actualizar reporte');
    });
  });
});
