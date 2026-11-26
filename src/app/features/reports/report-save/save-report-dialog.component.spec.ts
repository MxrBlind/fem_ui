import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';

import { REPORT_NAME_CONFLICT_MESSAGE, REPORT_SAVE_FAILED_MESSAGE } from '@core/errors/error-messages';
import { ReportService } from '@core/services/report.service';
import { SaveReportRequest, SavedReport } from '../models/report.model';
import {
  DESCRIPTION_MAX_LENGTH,
  NAME_MAX_LENGTH,
  SaveReportDialogComponent,
  SaveReportDialogData
} from './save-report-dialog.component';

const TOKEN = 'secret-token-123';

const savedReport: SavedReport = {
  id: 7,
  name: 'Alumnos activos',
  description: null,
  originalPrompt: 'alumnos activos',
  createdDate: '2026-11-22T01:00:00',
  updatedDate: null,
  lastRunDate: null
};

function httpError(status: number, body: unknown): HttpErrorResponse {
  return new HttpErrorResponse({ status, statusText: 'Error', error: body });
}

interface Harness {
  fixture: ComponentFixture<SaveReportDialogComponent>;
  save: ReturnType<typeof vi.fn>;
  dialogClose: ReturnType<typeof vi.fn>;
  snackOpen: ReturnType<typeof vi.spyOn>;
  backdropClick$: Subject<MouseEvent>;
  keydown$: Subject<KeyboardEvent>;
  /** Controls the request issued by the latest `save()` call. */
  currentRequest: () => Subject<SavedReport>;
}

function setup(data: SaveReportDialogData = { reportToken: TOKEN }): Harness {
  const requests: Subject<SavedReport>[] = [];
  const save = vi.fn((_request: SaveReportRequest) => {
    const request = new Subject<SavedReport>();
    requests.push(request);
    return request.asObservable();
  });
  const dialogClose = vi.fn();
  const backdropClick$ = new Subject<MouseEvent>();
  const keydown$ = new Subject<KeyboardEvent>();

  TestBed.configureTestingModule({
    imports: [SaveReportDialogComponent],
    providers: [
      provideAnimationsAsync(),
      { provide: ReportService, useValue: { save } },
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

  const fixture = TestBed.createComponent(SaveReportDialogComponent);
  fixture.detectChanges();

  return {
    fixture,
    save,
    dialogClose,
    snackOpen,
    backdropClick$,
    keydown$,
    currentRequest: () => requests[requests.length - 1]
  };
}

function root(fixture: ComponentFixture<SaveReportDialogComponent>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function byTestId<T extends HTMLElement>(fixture: ComponentFixture<SaveReportDialogComponent>, id: string): T {
  return root(fixture).querySelector(`[data-testid="${id}"]`) as T;
}

function fill(fixture: ComponentFixture<SaveReportDialogComponent>, id: string, value: string): void {
  const field = byTestId<HTMLInputElement | HTMLTextAreaElement>(fixture, id);
  field.value = value;
  field.dispatchEvent(new Event('input'));
  fixture.detectChanges();
}

function submitButton(fixture: ComponentFixture<SaveReportDialogComponent>): HTMLButtonElement {
  return byTestId<HTMLButtonElement>(fixture, 'report-save-submit');
}

function cancelButton(fixture: ComponentFixture<SaveReportDialogComponent>): HTMLButtonElement {
  return byTestId<HTMLButtonElement>(fixture, 'report-save-cancel');
}

function submit(fixture: ComponentFixture<SaveReportDialogComponent>): void {
  submitButton(fixture).click();
  fixture.detectChanges();
}

function errorText(fixture: ComponentFixture<SaveReportDialogComponent>): string {
  return Array.from(root(fixture).querySelectorAll('mat-error'))
    .map((el) => el.textContent?.trim() ?? '')
    .join(' | ');
}

function escapeEvent(): KeyboardEvent {
  return new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
}

describe('SaveReportDialogComponent', () => {
  afterEach(() => vi.restoreAllMocks());

  describe('form', () => {
    it('starts empty with the save button disabled', () => {
      const { fixture } = setup();

      expect(byTestId<HTMLInputElement>(fixture, 'report-save-name').value).toBe('');
      expect(byTestId<HTMLTextAreaElement>(fixture, 'report-save-description').value).toBe('');
      expect(submitButton(fixture).disabled).toBe(true);
    });

    it('is titled "Guardar reporte"', () => {
      const { fixture } = setup();

      expect(root(fixture).querySelector('[mat-dialog-title]')?.textContent?.trim()).toBe('Guardar reporte');
    });

    it.each(['', '   '])('rejects the blank name %j and shows the required error once touched', (value) => {
      const { fixture } = setup();

      fill(fixture, 'report-save-name', value);
      byTestId<HTMLInputElement>(fixture, 'report-save-name').dispatchEvent(new Event('blur'));
      fixture.detectChanges();

      expect(submitButton(fixture).disabled).toBe(true);
      expect(errorText(fixture)).toContain('El nombre es requerido.');
    });

    it('rejects a name over the limit and shows a length error', () => {
      const { fixture } = setup();

      fixture.componentInstance.form.controls.name.setValue('a'.repeat(NAME_MAX_LENGTH + 1));
      fixture.componentInstance.form.controls.name.markAsTouched();
      fixture.detectChanges();

      expect(submitButton(fixture).disabled).toBe(true);
      expect(errorText(fixture)).toContain(`El nombre no puede exceder ${NAME_MAX_LENGTH} caracteres.`);
    });

    it('accepts a name of exactly the limit', () => {
      const { fixture } = setup();

      fill(fixture, 'report-save-name', 'a'.repeat(NAME_MAX_LENGTH));

      expect(submitButton(fixture).disabled).toBe(false);
    });

    it('rejects a description over the limit and shows a length error', () => {
      const { fixture } = setup();

      fill(fixture, 'report-save-name', 'Alumnos activos');
      fixture.componentInstance.form.controls.description.setValue('d'.repeat(DESCRIPTION_MAX_LENGTH + 1));
      fixture.componentInstance.form.controls.description.markAsTouched();
      fixture.detectChanges();

      expect(submitButton(fixture).disabled).toBe(true);
      expect(errorText(fixture)).toContain(
        `La descripción no puede exceder ${DESCRIPTION_MAX_LENGTH} caracteres.`
      );
    });

    it('treats the description as optional', () => {
      const { fixture } = setup();

      fill(fixture, 'report-save-name', 'Alumnos activos');

      expect(submitButton(fixture).disabled).toBe(false);
    });

    it('shows a character counter for each field', () => {
      const { fixture } = setup();

      fill(fixture, 'report-save-name', 'Alumnos');
      fill(fixture, 'report-save-description', 'Ciclo actual');

      expect(byTestId(fixture, 'report-save-name-counter').textContent?.trim()).toBe(`7 / ${NAME_MAX_LENGTH}`);
      expect(byTestId(fixture, 'report-save-description-counter').textContent?.trim()).toBe(
        `12 / ${DESCRIPTION_MAX_LENGTH}`
      );
    });
  });

  describe('payload', () => {
    it('sends the dialog token with the trimmed name and description', () => {
      const { fixture, save } = setup();

      fill(fixture, 'report-save-name', '  Alumnos activos  ');
      fill(fixture, 'report-save-description', '  Ciclo actual  ');
      submit(fixture);

      expect(save).toHaveBeenCalledTimes(1);
      expect(save).toHaveBeenCalledWith({
        reportToken: TOKEN,
        name: 'Alumnos activos',
        description: 'Ciclo actual'
      });
    });

    it.each(['', '    '])('omits the description when it is %j', (description) => {
      const { fixture, save } = setup();

      fill(fixture, 'report-save-name', 'Alumnos activos');
      fill(fixture, 'report-save-description', description);
      submit(fixture);

      const request = save.mock.calls[0][0] as SaveReportRequest;
      expect(request).toEqual({ reportToken: TOKEN, name: 'Alumnos activos' });
      expect('description' in request).toBe(false);
    });

    it('sends nothing while the form is invalid', () => {
      const { fixture, save } = setup();

      fixture.componentInstance.onSubmit();

      expect(save).not.toHaveBeenCalled();
    });
  });

  describe('outcomes', () => {
    function submitValid(harness: Harness): void {
      fill(harness.fixture, 'report-save-name', 'Alumnos activos');
      submit(harness.fixture);
    }

    it('closes with the saved report on success', () => {
      const harness = setup();

      submitValid(harness);
      harness.currentRequest().next(savedReport);
      harness.fixture.detectChanges();

      expect(harness.dialogClose).toHaveBeenCalledTimes(1);
      expect(harness.dialogClose).toHaveBeenCalledWith({ outcome: 'saved', report: savedReport });
    });

    it('closes as expired on 404', () => {
      const harness = setup();

      submitValid(harness);
      harness.currentRequest().error(httpError(404, { status: 404, code: 'ENTITY_NOT_FOUND', message: 'gone' }));
      harness.fixture.detectChanges();

      expect(harness.dialogClose).toHaveBeenCalledTimes(1);
      expect(harness.dialogClose).toHaveBeenCalledWith({ outcome: 'expired' });
      expect(harness.snackOpen).not.toHaveBeenCalled();
    });

    describe('on 409 REPORT_NAME_CONFLICT', () => {
      function conflict(harness: Harness): void {
        harness
          .currentRequest()
          .error(httpError(409, { status: 409, code: 'REPORT_NAME_CONFLICT', message: 'Ya existe un reporte guardado' }));
        harness.fixture.detectChanges();
      }

      it('keeps the dialog open and shows the inline error without the server message', () => {
        const harness = setup();

        submitValid(harness);
        conflict(harness);

        expect(harness.dialogClose).not.toHaveBeenCalled();
        expect(errorText(harness.fixture)).toBe(REPORT_NAME_CONFLICT_MESSAGE);
        expect(errorText(harness.fixture)).not.toContain('guardado');
        expect(harness.snackOpen).not.toHaveBeenCalled();
      });

      it('keeps "Guardar" disabled until the name is edited and re-enables "Cancelar"', () => {
        const harness = setup();

        submitValid(harness);
        conflict(harness);

        expect(submitButton(harness.fixture).disabled).toBe(true);
        expect(cancelButton(harness.fixture).disabled).toBe(false);
      });

      it('re-enables the form once the error is shown', () => {
        const harness = setup();

        submitValid(harness);
        conflict(harness);

        expect(harness.fixture.componentInstance.form.enabled).toBe(true);
        expect(harness.fixture.componentInstance.saving()).toBe(false);
      });

      it('clears the error when the name is edited', () => {
        const harness = setup();

        submitValid(harness);
        conflict(harness);
        fill(harness.fixture, 'report-save-name', 'Alumnos activos 2');

        expect(errorText(harness.fixture)).toBe('');
        expect(submitButton(harness.fixture).disabled).toBe(false);
      });

      it('retries with the same token and the new name', () => {
        const harness = setup();

        submitValid(harness);
        conflict(harness);
        fill(harness.fixture, 'report-save-name', 'Alumnos activos 2');
        submit(harness.fixture);

        expect(harness.save).toHaveBeenCalledTimes(2);
        expect(harness.save).toHaveBeenLastCalledWith({ reportToken: TOKEN, name: 'Alumnos activos 2' });
      });
    });

    it('shows a server validation error next to the name field on 400', () => {
      const harness = setup();

      submitValid(harness);
      harness
        .currentRequest()
        .error(
          httpError(400, {
            status: 400,
            code: 'VALIDATION_FAILED',
            message: 'Validation failed',
            fieldErrors: [{ field: 'name', message: 'El nombre no es válido' }]
          })
        );
      harness.fixture.detectChanges();

      expect(harness.dialogClose).not.toHaveBeenCalled();
      expect(errorText(harness.fixture)).toBe('El nombre no es válido');
      expect(harness.snackOpen).not.toHaveBeenCalled();
    });

    it.each([
      ['500', httpError(500, { status: 500, code: 'INTERNAL_ERROR', message: 'java.lang.NullPointerException' })],
      ['a network failure', new HttpErrorResponse({ status: 0, statusText: 'Unknown Error' })]
    ])('shows an error snackbar and keeps the dialog usable on %s', (_label, error) => {
      const harness = setup();

      submitValid(harness);
      harness.currentRequest().error(error);
      harness.fixture.detectChanges();

      expect(harness.dialogClose).not.toHaveBeenCalled();
      expect(harness.snackOpen).toHaveBeenCalledTimes(1);
      const [message, action, config] = harness.snackOpen.mock.calls[0] as unknown as [
        string,
        string,
        { panelClass: string }
      ];
      expect(message).toBe(REPORT_SAVE_FAILED_MESSAGE);
      expect(message).not.toContain('NullPointer');
      expect(action).toBe('Cerrar');
      expect(config.panelClass).toBe('snackbar-error');
      expect(harness.fixture.componentInstance.saving()).toBe(false);
      expect(submitButton(harness.fixture).disabled).toBe(false);
    });
  });

  describe('dismissal', () => {
    function startSaving(harness: Harness): void {
      fill(harness.fixture, 'report-save-name', 'Alumnos activos');
      submit(harness.fixture);
    }

    it('ignores Cancelar, Escape and a backdrop click while saving', () => {
      const harness = setup();

      startSaving(harness);
      expect(cancelButton(harness.fixture).disabled).toBe(true);
      harness.fixture.componentInstance.cancel();
      harness.keydown$.next(escapeEvent());
      harness.backdropClick$.next(new MouseEvent('click'));

      expect(harness.dialogClose).not.toHaveBeenCalled();
    });

    it('closes without a result on Cancelar when idle', () => {
      const { fixture, dialogClose, save } = setup();

      cancelButton(fixture).click();

      expect(dialogClose).toHaveBeenCalledTimes(1);
      expect(dialogClose).toHaveBeenCalledWith();
      expect(save).not.toHaveBeenCalled();
    });

    it('closes without a result on Escape when idle', () => {
      const { dialogClose, keydown$, save } = setup();

      keydown$.next(escapeEvent());

      expect(dialogClose).toHaveBeenCalledTimes(1);
      expect(dialogClose).toHaveBeenCalledWith();
      expect(save).not.toHaveBeenCalled();
    });

    it('ignores an Escape that was already handled', () => {
      const { dialogClose, keydown$ } = setup();
      const event = escapeEvent();
      event.preventDefault();

      keydown$.next(event);

      expect(dialogClose).not.toHaveBeenCalled();
    });

    it('closes without a result on a backdrop click when idle', () => {
      const { dialogClose, backdropClick$, save } = setup();

      backdropClick$.next(new MouseEvent('click'));

      expect(dialogClose).toHaveBeenCalledTimes(1);
      expect(dialogClose).toHaveBeenCalledWith();
      expect(save).not.toHaveBeenCalled();
    });

    it('sends one request when the form is submitted twice', () => {
      const harness = setup();

      fill(harness.fixture, 'report-save-name', 'Alumnos activos');
      harness.fixture.componentInstance.onSubmit();
      harness.fixture.componentInstance.onSubmit();

      expect(harness.save).toHaveBeenCalledTimes(1);
    });

    it('shows a decorative spinner next to the label while saving', () => {
      const harness = setup();

      startSaving(harness);

      const spinner = submitButton(harness.fixture).querySelector('mat-progress-spinner');
      expect(spinner?.classList).toContain('button-spinner');
      expect(spinner?.getAttribute('aria-hidden')).toBe('true');
      expect(submitButton(harness.fixture).textContent).toContain('Guardar');
      expect(submitButton(harness.fixture).disabled).toBe(true);
    });
  });

  describe('logging', () => {
    it('logs only the status of a failure, never the token, the name or the response body', () => {
      const harness = setup();
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      fill(harness.fixture, 'report-save-name', 'Nombre confidencial');
      submit(harness.fixture);
      harness.currentRequest().error(httpError(500, { status: 500, code: 'INTERNAL_ERROR', message: 'detalle interno' }));

      expect(consoleError).toHaveBeenCalledTimes(1);
      const logged = JSON.stringify(consoleError.mock.calls[0]);
      expect(logged).toContain('500');
      expect(logged).not.toContain(TOKEN);
      expect(logged).not.toContain('Nombre confidencial');
      expect(logged).not.toContain('detalle interno');
    });
  });
});
