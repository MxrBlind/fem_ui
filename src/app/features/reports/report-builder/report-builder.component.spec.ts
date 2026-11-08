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
import { ReportBuilderComponent, toSingleLine } from './report-builder.component';

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

/** Dispatches a cancelable `keydown` on the prompt field and returns it, to inspect `defaultPrevented`. */
function pressKey(
  fixture: ComponentFixture<ReportBuilderComponent>,
  init: KeyboardEventInit,
  keyCode?: number
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  if (keyCode !== undefined) {
    Object.defineProperty(event, 'keyCode', { value: keyCode });
  }
  promptField(fixture).dispatchEvent(event);
  fixture.detectChanges();
  return event;
}

/** Dispatches a cancelable `paste` carrying `text` (or no clipboard data at all) on the prompt field. */
function paste(fixture: ComponentFixture<ReportBuilderComponent>, text: string | null): Event {
  const event = new Event('paste', { bubbles: true, cancelable: true });
  if (text !== null) {
    Object.defineProperty(event, 'clipboardData', { value: { getData: () => text } });
  }
  promptField(fixture).dispatchEvent(event);
  fixture.detectChanges();
  return event;
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

    it('shows the prompt field two lines tall by default', () => {
      const { fixture } = setup();

      expect(promptField(fixture).getAttribute('rows')).toBe('2');
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
      const spinner = root(h.fixture).querySelector('mat-progress-spinner');
      expect(spinner).not.toBeNull();
      expect(spinner?.classList).toContain('report-builder__spinner');
      expect(spinner?.getAttribute('aria-hidden')).toBe('true');
      expect(generateButton(h.fixture).textContent).toContain('Generando…');
    });

    it('shows "Generar" without a spinner while idle', () => {
      const h = setup();
      typePrompt(h.fixture, 'x');

      expect(generateButton(h.fixture).textContent?.trim()).toBe('Generar');
      expect(root(h.fixture).querySelector('mat-progress-spinner')).toBeNull();
    });

    it('replaces line breaks with spaces and trims the prompt before sending it', () => {
      const h = setup();
      typePrompt(h.fixture, '  alumnos\ncon beca  ');

      submit(h.fixture);

      expect(h.generate).toHaveBeenCalledWith('alumnos con beca');
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

  describe('keyboard submit', () => {
    it('generates the report with the trimmed prompt when Enter is pressed', () => {
      const h = setup();
      typePrompt(h.fixture, '  alumnos con beca  ');

      const event = pressKey(h.fixture, { key: 'Enter' });

      expect(event.defaultPrevented).toBe(true);
      expect(h.generate).toHaveBeenCalledTimes(1);
      expect(h.generate).toHaveBeenCalledWith('alumnos con beca');
    });

    it.each([{ shiftKey: true }, { ctrlKey: true }, { altKey: true }])(
      'never inserts a line break for Enter with %j',
      (modifier) => {
        const h = setup();
        typePrompt(h.fixture, 'x');

        const event = pressKey(h.fixture, { key: 'Enter', ...modifier });

        expect(event.defaultPrevented).toBe(true);
      }
    );

    it.each(['', '   '])('does not generate the report for the prompt %j', (value) => {
      const h = setup();
      typePrompt(h.fixture, value);

      pressKey(h.fixture, { key: 'Enter' });

      expect(h.generate).not.toHaveBeenCalled();
    });

    it('does not send a second request when Enter is pressed again while one is in flight', () => {
      const h = setup();
      typePrompt(h.fixture, 'x');

      pressKey(h.fixture, { key: 'Enter' });
      pressKey(h.fixture, { key: 'Enter' });

      expect(h.generate).toHaveBeenCalledTimes(1);
    });

    it('lets the input method confirm its text instead of submitting while composing', () => {
      const h = setup();
      typePrompt(h.fixture, 'x');

      const event = pressKey(h.fixture, { key: 'Enter', isComposing: true });

      expect(event.defaultPrevented).toBe(false);
      expect(h.generate).not.toHaveBeenCalled();
    });

    it('does not submit for the legacy composition key code 229', () => {
      const h = setup();
      typePrompt(h.fixture, 'x');

      const event = pressKey(h.fixture, { key: 'Enter' }, 229);

      expect(event.defaultPrevented).toBe(false);
      expect(h.generate).not.toHaveBeenCalled();
    });

    it('leaves other keys alone', () => {
      const h = setup();
      typePrompt(h.fixture, 'x');

      const event = pressKey(h.fixture, { key: 'a' });

      expect(event.defaultPrevented).toBe(false);
      expect(h.generate).not.toHaveBeenCalled();
    });
  });

  describe('paste', () => {
    it('replaces pasted line breaks with spaces and updates the counter', () => {
      const h = setup();

      const event = paste(h.fixture, 'alumnos\ncon beca');

      expect(event.defaultPrevented).toBe(true);
      expect(promptField(h.fixture).value).toBe('alumnos con beca');
      expect(h.fixture.componentInstance.form.controls.prompt.value).toBe('alumnos con beca');
      expect(root(h.fixture).querySelector('[data-testid="report-prompt-counter"]')?.textContent?.trim()).toBe(
        '16 / 2000'
      );
    });

    it('replaces only the selection and puts the caret after the pasted text', () => {
      const h = setup();
      typePrompt(h.fixture, 'alumnos XXX beca');
      promptField(h.fixture).setSelectionRange(8, 11);

      paste(h.fixture, 'con\nmucha');

      expect(promptField(h.fixture).value).toBe('alumnos con mucha beca');
      expect(promptField(h.fixture).selectionStart).toBe(17);
      expect(promptField(h.fixture).selectionEnd).toBe(17);
    });

    it('cuts the pasted text so the prompt never exceeds 2000 characters', () => {
      const h = setup();
      typePrompt(h.fixture, 'x'.repeat(1995));
      promptField(h.fixture).setSelectionRange(1995, 1995);

      paste(h.fixture, 'abc\ndefgh');

      expect(promptField(h.fixture).value).toBe('x'.repeat(1995) + 'abc d');
    });

    it('lets the browser paste text without line breaks', () => {
      const h = setup();

      const event = paste(h.fixture, 'alumnos con beca');

      expect(event.defaultPrevented).toBe(false);
    });

    it('ignores a paste without clipboard data', () => {
      const h = setup();
      typePrompt(h.fixture, 'x');

      const event = paste(h.fixture, null);

      expect(event.defaultPrevented).toBe(false);
      expect(promptField(h.fixture).value).toBe('x');
    });
  });
});

describe('toSingleLine', () => {
  it.each([
    ['a\nb', 'a b'],
    ['a\r\nb', 'a b'],
    ['a\rb', 'a b']
  ])('replaces the line break in %j with one space', (input, expected) => {
    expect(toSingleLine(input)).toBe(expected);
  });

  it('replaces every line break with its own space without collapsing them', () => {
    expect(toSingleLine('a\r\n\r\nb')).toBe('a  b');
  });

  it('returns text without line breaks unchanged', () => {
    expect(toSingleLine('  alumnos con beca  ')).toBe('  alumnos con beca  ');
  });

  it('keeps an empty string empty', () => {
    expect(toSingleLine('')).toBe('');
  });
});
