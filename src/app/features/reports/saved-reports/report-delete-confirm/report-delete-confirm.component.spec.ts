import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';

import { REPORT_DELETE_FAILED_MESSAGE } from '@core/errors/error-messages';
import { ReportService } from '@core/services/report.service';
import { SavedReport } from '../../models/report.model';
import {
  CONFIRM_MESSAGE,
  DIALOG_TITLE,
  ReportDeleteConfirmComponent,
  ReportDeleteConfirmData
} from './report-delete-confirm.component';

const report: SavedReport = {
  id: 7,
  name: 'Alumnos activos',
  description: 'Solo activos',
  originalPrompt: 'secret original prompt',
  createdDate: '2026-11-22T01:00:00',
  lastRunDate: '2026-11-23T10:30:00'
};

function httpError(status: number, body: unknown = null): HttpErrorResponse {
  return new HttpErrorResponse({ status, statusText: 'Error', error: body });
}

interface Harness {
  fixture: ComponentFixture<ReportDeleteConfirmComponent>;
  deleteReport: ReturnType<typeof vi.fn>;
  dialogClose: ReturnType<typeof vi.fn>;
  snackOpen: ReturnType<typeof vi.spyOn>;
  consoleWarn: ReturnType<typeof vi.spyOn>;
  backdropClick$: Subject<MouseEvent>;
  keydown$: Subject<KeyboardEvent>;
  /** Controls the request issued by the latest `delete()` call. */
  currentRequest: () => Subject<void>;
}

function setup(data: ReportDeleteConfirmData = { report }): Harness {
  const requests: Subject<void>[] = [];
  const deleteReport = vi.fn((_id: number) => {
    const request = new Subject<void>();
    requests.push(request);
    return request.asObservable();
  });
  const dialogClose = vi.fn();
  const backdropClick$ = new Subject<MouseEvent>();
  const keydown$ = new Subject<KeyboardEvent>();

  TestBed.configureTestingModule({
    imports: [ReportDeleteConfirmComponent],
    providers: [
      provideAnimationsAsync(),
      { provide: ReportService, useValue: { delete: deleteReport } },
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
  const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

  const fixture = TestBed.createComponent(ReportDeleteConfirmComponent);
  fixture.detectChanges();

  return {
    fixture,
    deleteReport,
    dialogClose,
    snackOpen,
    consoleWarn,
    backdropClick$,
    keydown$,
    currentRequest: () => requests[requests.length - 1]
  };
}

function root(fixture: ComponentFixture<ReportDeleteConfirmComponent>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function byTestId<T extends HTMLElement>(fixture: ComponentFixture<ReportDeleteConfirmComponent>, id: string): T {
  return root(fixture).querySelector(`[data-testid="${id}"]`) as T;
}

function confirmButton(fixture: ComponentFixture<ReportDeleteConfirmComponent>): HTMLButtonElement {
  return byTestId<HTMLButtonElement>(fixture, 'report-delete-confirm');
}

function cancelButton(fixture: ComponentFixture<ReportDeleteConfirmComponent>): HTMLButtonElement {
  return byTestId<HTMLButtonElement>(fixture, 'report-delete-cancel');
}

function escapeKey(): KeyboardEvent {
  return new KeyboardEvent('keydown', { key: 'Escape' });
}

describe('ReportDeleteConfirmComponent', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('content', () => {
    it('shows the title, the confirmation message and the report name', () => {
      const { fixture } = setup();

      const text = root(fixture).textContent ?? '';
      expect(DIALOG_TITLE).toBe('Borrar reporte');
      expect(CONFIRM_MESSAGE).toBe('¿Estás seguro de eliminar este reporte?');
      expect(root(fixture).querySelector('[mat-dialog-title]')?.textContent?.trim()).toBe('Borrar reporte');
      expect(text).toContain('¿Estás seguro de eliminar este reporte?');
      expect(text).toContain('Alumnos activos');
    });

    it('renders the report name as text, never as markup', () => {
      const { fixture } = setup({ report: { ...report, name: '<img src=x data-testid="injected">' } });

      expect(byTestId(fixture, 'injected')).toBeNull();
      expect(root(fixture).textContent).toContain('<img src=x data-testid="injected">');
    });

    it('shows "No" before "Sí"', () => {
      const { fixture } = setup();

      const labels = Array.from(root(fixture).querySelectorAll('mat-dialog-actions button')).map((button) =>
        button.textContent?.trim()
      );
      expect(labels).toEqual(['No', 'Sí']);
    });

    it('does not show the original prompt, the dates or the description', () => {
      const { fixture } = setup();

      const text = root(fixture).textContent ?? '';
      expect(text).not.toContain('secret original prompt');
      expect(text).not.toContain('2026-11-22');
      expect(text).not.toContain('2026-11-23');
      expect(text).not.toContain('Solo activos');
    });

    it('sends no request when it opens', () => {
      const { deleteReport } = setup();

      expect(deleteReport).not.toHaveBeenCalled();
    });
  });

  describe('dismissal', () => {
    it('closes without a result and without a request when "No" is clicked', () => {
      const { fixture, dialogClose, deleteReport } = setup();

      cancelButton(fixture).click();

      expect(dialogClose).toHaveBeenCalledTimes(1);
      expect(dialogClose).toHaveBeenCalledWith();
      expect(deleteReport).not.toHaveBeenCalled();
    });

    it('closes without a result when Escape is pressed', () => {
      const { keydown$, dialogClose, deleteReport } = setup();

      keydown$.next(escapeKey());

      expect(dialogClose).toHaveBeenCalledWith();
      expect(deleteReport).not.toHaveBeenCalled();
    });

    it('closes without a result when the backdrop is clicked', () => {
      const { backdropClick$, dialogClose, deleteReport } = setup();

      backdropClick$.next(new MouseEvent('click'));

      expect(dialogClose).toHaveBeenCalledWith();
      expect(deleteReport).not.toHaveBeenCalled();
    });

    it('ignores other keys', () => {
      const { keydown$, dialogClose } = setup();

      keydown$.next(new KeyboardEvent('keydown', { key: 'a' }));

      expect(dialogClose).not.toHaveBeenCalled();
    });

    it('cannot be dismissed while the request is in flight', () => {
      const { fixture, keydown$, backdropClick$, dialogClose } = setup();

      confirmButton(fixture).click();
      fixture.detectChanges();
      cancelButton(fixture).click();
      keydown$.next(escapeKey());
      backdropClick$.next(new MouseEvent('click'));

      expect(dialogClose).not.toHaveBeenCalled();
    });

    it('disables "No" while the request is in flight', () => {
      const { fixture } = setup();

      confirmButton(fixture).click();
      fixture.detectChanges();

      expect(cancelButton(fixture).disabled).toBe(true);
    });
  });

  describe('request', () => {
    it('deletes the report of the dialog data once when "Sí" is clicked', () => {
      const { fixture, deleteReport } = setup();

      confirmButton(fixture).click();

      expect(deleteReport).toHaveBeenCalledTimes(1);
      expect(deleteReport).toHaveBeenCalledWith(7);
    });

    it('sends no second request when "Sí" is activated again while pending', () => {
      const { fixture, deleteReport } = setup();

      confirmButton(fixture).click();
      confirmButton(fixture).click();
      fixture.detectChanges();
      confirmButton(fixture).click();

      expect(deleteReport).toHaveBeenCalledTimes(1);
    });

    it('disables "Sí" and shows the inline spinner next to its unchanged label while pending', () => {
      const { fixture } = setup();
      expect(root(fixture).querySelector('mat-progress-spinner')).toBeNull();

      confirmButton(fixture).click();
      fixture.detectChanges();

      const button = confirmButton(fixture);
      const spinner = button.querySelector('mat-progress-spinner');
      expect(button.disabled).toBe(true);
      expect(spinner).not.toBeNull();
      expect(spinner?.getAttribute('aria-hidden')).toBe('true');
      expect(button.textContent?.trim()).toBe('Sí');
    });
  });

  describe('outcomes', () => {
    it('closes with "deleted" when the request succeeds', () => {
      const { fixture, dialogClose, currentRequest, snackOpen } = setup();

      confirmButton(fixture).click();
      currentRequest().next();
      currentRequest().complete();

      expect(dialogClose).toHaveBeenCalledTimes(1);
      expect(dialogClose).toHaveBeenCalledWith({ outcome: 'deleted' });
      expect(snackOpen).not.toHaveBeenCalled();
    });

    it('closes with "not-found" on 404 and leaves the message to the opener', () => {
      const { fixture, dialogClose, currentRequest, snackOpen } = setup();

      confirmButton(fixture).click();
      currentRequest().error(httpError(404, { code: 'ENTITY_NOT_FOUND' }));

      expect(dialogClose).toHaveBeenCalledWith({ outcome: 'not-found' });
      expect(snackOpen).not.toHaveBeenCalled();
    });

    it.each([
      ['500', httpError(500, { code: 'INTERNAL_ERROR', message: 'database exploded' })],
      ['400', httpError(400, { code: 'BAD_REQUEST', message: 'bad id' })],
      ['network error', httpError(0)]
    ])('keeps the dialog open and shows the failure message on %s', (_label, error) => {
      const { fixture, dialogClose, currentRequest, snackOpen } = setup();

      confirmButton(fixture).click();
      currentRequest().error(error);
      fixture.detectChanges();

      expect(dialogClose).not.toHaveBeenCalled();
      expect(confirmButton(fixture).disabled).toBe(false);
      expect(cancelButton(fixture).disabled).toBe(false);
      expect(root(fixture).querySelector('mat-progress-spinner')).toBeNull();
      expect(snackOpen).toHaveBeenCalledTimes(1);
      expect(snackOpen).toHaveBeenCalledWith(REPORT_DELETE_FAILED_MESSAGE, 'Cerrar', {
        duration: 5000,
        panelClass: 'snackbar-error'
      });
    });

    it('sends a new request when "Sí" is clicked again after a failure', () => {
      const { fixture, deleteReport, currentRequest } = setup();

      confirmButton(fixture).click();
      currentRequest().error(httpError(500));
      fixture.detectChanges();
      confirmButton(fixture).click();

      expect(deleteReport).toHaveBeenCalledTimes(2);
    });

    it.each([401, 403])('keeps the dialog usable and shows no message on %i', (status) => {
      const { fixture, dialogClose, currentRequest, snackOpen } = setup();

      confirmButton(fixture).click();
      currentRequest().error(httpError(status, { code: 'ACCESS_DENIED' }));
      fixture.detectChanges();

      expect(dialogClose).not.toHaveBeenCalled();
      expect(snackOpen).not.toHaveBeenCalled();
      expect(confirmButton(fixture).disabled).toBe(false);
      expect(cancelButton(fixture).disabled).toBe(false);
    });

    it('lets the admin dismiss the dialog after a failure', () => {
      const { fixture, dialogClose, currentRequest } = setup();

      confirmButton(fixture).click();
      currentRequest().error(httpError(500));
      fixture.detectChanges();
      cancelButton(fixture).click();

      expect(dialogClose).toHaveBeenCalledWith();
    });

    it('never shows the server message and logs only the status', () => {
      const { fixture, currentRequest, snackOpen, consoleWarn } = setup();

      confirmButton(fixture).click();
      currentRequest().error(httpError(500, { code: 'INTERNAL_ERROR', message: 'database exploded' }));
      fixture.detectChanges();

      expect(root(fixture).textContent).not.toContain('database exploded');
      expect(JSON.stringify(snackOpen.mock.calls)).not.toContain('database exploded');
      expect(consoleWarn).toHaveBeenCalledWith('[SavedReports] failed to delete saved report', 500);
      expect(JSON.stringify(consoleWarn.mock.calls)).not.toContain('database exploded');
    });
  });
});
