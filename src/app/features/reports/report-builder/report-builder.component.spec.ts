import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';

import {
  REPORT_EXECUTION_FAILED_MESSAGE,
  REPORT_GENERATION_FAILED_MESSAGE,
  REPORT_UNSAFE_QUERY_MESSAGE
} from '@core/errors/error-messages';
import { ReportService } from '@core/services/report.service';
import { ReportResult } from '../models/report.model';
import { ReportBuilderComponent } from './report-builder.component';

const result: ReportResult = {
  reportToken: null,
  interpretation: 'Alumnos inscritos en el ciclo actual',
  columns: [{ name: 'name', label: 'Nombre', type: 'VARCHAR' }],
  rows: [['Ana'], ['Beto']],
  rowCount: 2,
  executionMs: 7
};

interface Harness {
  fixture: ComponentFixture<ReportBuilderComponent>;
  generate: ReturnType<typeof vi.fn>;
  snackOpen: ReturnType<typeof vi.spyOn>;
  /** Controls the request issued by the next `generate()` call. */
  nextRequest: () => Subject<ReportResult>;
}

function setup(): Harness {
  const requests: Subject<ReportResult>[] = [];
  const generate = vi.fn(() => {
    const request = new Subject<ReportResult>();
    requests.push(request);
    return request.asObservable();
  });

  TestBed.configureTestingModule({
    imports: [ReportBuilderComponent],
    providers: [provideAnimationsAsync(), { provide: ReportService, useValue: { generate } }]
  });
  const snackOpen = vi.spyOn(MatSnackBar.prototype, 'open').mockReturnValue({} as never);

  const fixture = TestBed.createComponent(ReportBuilderComponent);
  fixture.detectChanges();

  return { fixture, generate, snackOpen, nextRequest: () => requests[requests.length - 1] };
}

function root(fixture: ComponentFixture<ReportBuilderComponent>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function promptField(fixture: ComponentFixture<ReportBuilderComponent>): HTMLTextAreaElement {
  return root(fixture).querySelector('[data-testid="report-prompt"]') as HTMLTextAreaElement;
}

function generateButton(fixture: ComponentFixture<ReportBuilderComponent>): HTMLButtonElement {
  return root(fixture).querySelector('[data-testid="report-generate-btn"]') as HTMLButtonElement;
}

function typePrompt(fixture: ComponentFixture<ReportBuilderComponent>, value: string): void {
  const field = promptField(fixture);
  field.value = value;
  field.dispatchEvent(new Event('input'));
  fixture.detectChanges();
}

function submit(fixture: ComponentFixture<ReportBuilderComponent>): void {
  generateButton(fixture).click();
  fixture.detectChanges();
}

function succeed(h: Harness, value: ReportResult = result): void {
  h.nextRequest().next(value);
  h.nextRequest().complete();
  h.fixture.detectChanges();
}

function fail(h: Harness, status: number, code?: string): void {
  h.nextRequest().error(
    new HttpErrorResponse({ status, statusText: 'Error', error: code ? { status, code, message: 'English text' } : null })
  );
  h.fixture.detectChanges();
}

describe('ReportBuilderComponent', () => {
  afterEach(() => vi.restoreAllMocks());

  describe('form', () => {
    it('shows the title and the labelled prompt field', () => {
      const { fixture } = setup();

      expect(root(fixture).querySelector('[data-testid="reports-title"]')?.textContent?.trim()).toBe(
        'Generador inteligente'
      );
      expect(root(fixture).textContent).toContain('Quiero un reporte que contenga…');
    });

    it('shows the prompt field as a single line by default', () => {
      const { fixture } = setup();

      expect(promptField(fixture).getAttribute('rows')).toBe('1');
    });

    it('disables "Generar" for an empty prompt', () => {
      const { fixture } = setup();

      expect(generateButton(fixture).disabled).toBe(true);
    });

    it('disables "Generar" for a whitespace-only prompt', () => {
      const { fixture } = setup();

      typePrompt(fixture, '    \n  ');

      expect(generateButton(fixture).disabled).toBe(true);
    });

    it('enables "Generar" for a valid prompt', () => {
      const { fixture } = setup();

      typePrompt(fixture, 'alumnos inscritos');

      expect(generateButton(fixture).disabled).toBe(false);
    });

    it('limits the prompt to 2000 characters and shows a counter', () => {
      const { fixture } = setup();

      typePrompt(fixture, 'hola');

      expect(promptField(fixture).getAttribute('maxlength')).toBe('2000');
      expect(root(fixture).querySelector('[data-testid="report-prompt-counter"]')?.textContent?.trim()).toBe(
        '4 / 2000'
      );
    });

    it('rejects a prompt longer than 2000 characters', () => {
      const { fixture } = setup();

      typePrompt(fixture, 'a'.repeat(2001));

      expect(generateButton(fixture).disabled).toBe(true);
    });
  });

  describe('generation', () => {
    it('sends the trimmed prompt', () => {
      const h = setup();

      typePrompt(h.fixture, '  alumnos con beca  ');
      submit(h.fixture);

      expect(h.generate).toHaveBeenCalledTimes(1);
      expect(h.generate).toHaveBeenCalledWith('alumnos con beca');
    });

    it('shows progress and disables the button while the request is in flight', () => {
      const h = setup();
      typePrompt(h.fixture, 'x');

      submit(h.fixture);

      expect(h.fixture.componentInstance.loading()).toBe(true);
      expect(generateButton(h.fixture).disabled).toBe(true);
      expect(root(h.fixture).querySelector('mat-progress-spinner')).not.toBeNull();
    });

    it('does not send a second request while one is in flight', () => {
      const h = setup();
      typePrompt(h.fixture, 'x');

      h.fixture.componentInstance.onSubmit();
      h.fixture.componentInstance.onSubmit();

      expect(h.generate).toHaveBeenCalledTimes(1);
    });

    it('shows the result and stops loading on success', () => {
      const h = setup();
      typePrompt(h.fixture, 'x');
      submit(h.fixture);

      succeed(h);

      expect(h.fixture.componentInstance.loading()).toBe(false);
      expect(h.fixture.componentInstance.result()).toEqual(result);
      expect(root(h.fixture).querySelector('app-report-result')).not.toBeNull();
      expect(root(h.fixture).textContent).toContain('Se interpretó como: Alumnos inscritos en el ciclo actual');
      expect(root(h.fixture).querySelector('mat-progress-spinner')).toBeNull();
    });

    it('shows no result section before the first successful generation', () => {
      const { fixture } = setup();

      expect(root(fixture).querySelector('app-report-result')).toBeNull();
    });

    it('keeps the previous result visible while a new one is loading', () => {
      const h = setup();
      typePrompt(h.fixture, 'first');
      submit(h.fixture);
      succeed(h);

      typePrompt(h.fixture, 'second');
      submit(h.fixture);

      expect(h.fixture.componentInstance.result()).toEqual(result);
      expect(root(h.fixture).querySelector('app-report-result')).not.toBeNull();
    });

    it('replaces the result when a new generation succeeds', () => {
      const h = setup();
      typePrompt(h.fixture, 'first');
      submit(h.fixture);
      succeed(h);
      typePrompt(h.fixture, 'second');
      submit(h.fixture);

      succeed(h, { ...result, interpretation: 'Otra cosa', rows: [], rowCount: 0 });

      expect(root(h.fixture).textContent).toContain('Se interpretó como: Otra cosa');
    });
  });

  describe('errors', () => {
    it.each([
      [400, 'UNSAFE_QUERY', REPORT_UNSAFE_QUERY_MESSAGE],
      [422, 'REPORT_EXECUTION_FAILED', REPORT_EXECUTION_FAILED_MESSAGE],
      [502, 'REPORT_GENERATION_FAILED', REPORT_GENERATION_FAILED_MESSAGE]
    ])('shows the Spanish message for %i %s, never the server message', (status, code, message) => {
      const h = setup();
      typePrompt(h.fixture, 'x');
      submit(h.fixture);

      fail(h, status, code);

      expect(h.snackOpen).toHaveBeenCalledTimes(1);
      expect(h.snackOpen).toHaveBeenCalledWith(
        message,
        'Cerrar',
        expect.objectContaining({ panelClass: 'snackbar-error' })
      );
      expect(h.snackOpen.mock.calls[0][0]).not.toContain('English text');
    });

    it('shows the generic generation-failed message for an unexpected error', () => {
      const h = setup();
      typePrompt(h.fixture, 'x');
      submit(h.fixture);

      fail(h, 500, 'INTERNAL_ERROR');

      expect(h.snackOpen).toHaveBeenCalledWith(
        REPORT_GENERATION_FAILED_MESSAGE,
        'Cerrar',
        expect.objectContaining({ panelClass: 'snackbar-error' })
      );
    });

    it('keeps the prompt, re-enables the button and stops loading after an error', () => {
      const h = setup();
      typePrompt(h.fixture, 'alumnos con beca');
      submit(h.fixture);

      fail(h, 400, 'UNSAFE_QUERY');

      expect(h.fixture.componentInstance.loading()).toBe(false);
      expect(promptField(h.fixture).value).toBe('alumnos con beca');
      expect(generateButton(h.fixture).disabled).toBe(false);
    });

    it('keeps the previous result visible after an error', () => {
      const h = setup();
      typePrompt(h.fixture, 'first');
      submit(h.fixture);
      succeed(h);
      typePrompt(h.fixture, 'second');
      submit(h.fixture);

      fail(h, 502, 'REPORT_GENERATION_FAILED');

      expect(h.fixture.componentInstance.result()).toEqual(result);
      expect(root(h.fixture).querySelector('app-report-result')).not.toBeNull();
    });

    it('allows generating again after an error', () => {
      const h = setup();
      typePrompt(h.fixture, 'x');
      submit(h.fixture);
      fail(h, 422, 'REPORT_EXECUTION_FAILED');

      submit(h.fixture);

      expect(h.generate).toHaveBeenCalledTimes(2);
    });
  });
});
