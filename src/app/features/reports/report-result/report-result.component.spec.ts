import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { By } from '@angular/platform-browser';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, of } from 'rxjs';

import {
  REPORT_SAVED_MESSAGE,
  REPORT_TOKEN_EXPIRED_MESSAGE
} from '@core/errors/error-messages';
import { ReportCellValue, ReportColumn, ReportResult, SavedReport } from '../models/report.model';
import { SaveReportDialogComponent, SaveReportDialogResult } from '../report-save/save-report-dialog.component';
import { ReportResultComponent } from './report-result.component';

function makeResult(
  columns: ReportColumn[],
  rows: ReportCellValue[][],
  interpretation: string | null = 'Alumnos inscritos'
): ReportResult {
  return { reportToken: null, interpretation, columns, rows, rowCount: rows.length, executionMs: 5 };
}

function textColumns(count: number): ReportColumn[] {
  return Array.from({ length: count }, (_, i) => ({ name: `c_${i}`, label: `Col ${i}`, type: 'VARCHAR' }));
}

function setup(result: ReportResult): ComponentFixture<ReportResultComponent> {
  TestBed.configureTestingModule({
    imports: [ReportResultComponent],
    providers: [provideAnimationsAsync()]
  });
  const fixture = TestBed.createComponent(ReportResultComponent);
  fixture.componentRef.setInput('result', result);
  fixture.detectChanges();
  fixture.detectChanges();
  return fixture;
}

/** `MatTableDataSource` pushes the row total to the paginator in a microtask. */
async function settle(fixture: ComponentFixture<ReportResultComponent>): Promise<void> {
  await fixture.whenStable();
  fixture.detectChanges();
}

function update(fixture: ComponentFixture<ReportResultComponent>, result: ReportResult): void {
  fixture.componentRef.setInput('result', result);
  fixture.detectChanges();
  fixture.detectChanges();
}

function el(fixture: ComponentFixture<ReportResultComponent>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function headers(fixture: ComponentFixture<ReportResultComponent>): string[] {
  return Array.from(el(fixture).querySelectorAll('th[mat-header-cell]')).map((h) => h.textContent?.trim() ?? '');
}

function bodyRows(fixture: ComponentFixture<ReportResultComponent>): string[][] {
  return Array.from(el(fixture).querySelectorAll('tr[mat-row]')).map((tr) =>
    Array.from(tr.querySelectorAll('td[mat-cell]')).map((td) => td.textContent?.trim() ?? '')
  );
}

function typeFilter(fixture: ComponentFixture<ReportResultComponent>, value: string): void {
  const input = el(fixture).querySelector('[data-testid="report-filter"]') as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
  fixture.detectChanges();
  fixture.detectChanges();
}

function clickHeader(fixture: ComponentFixture<ReportResultComponent>, index: number): void {
  const header = el(fixture).querySelectorAll('th[mat-header-cell]')[index] as HTMLElement;
  header.click();
  fixture.detectChanges();
  fixture.detectChanges();
}

describe('ReportResultComponent', () => {
  describe('columns and cells', () => {
    it.each([1, 5, 40])('renders %i columns with headers taken from the labels', (count) => {
      const columns = textColumns(count);
      const fixture = setup(makeResult(columns, [columns.map((_, i) => `v${i}`)]));

      expect(headers(fixture)).toEqual(columns.map((c) => c.label));
      expect(bodyRows(fixture)[0]).toEqual(columns.map((_, i) => `v${i}`));
    });

    it('falls back to the column name when the label is empty', () => {
      const fixture = setup(makeResult([{ name: 'raw_name', label: '  ', type: 'VARCHAR' }], [['x']]));

      expect(headers(fixture)).toEqual(['raw_name']);
    });

    it('matches cells to columns by position and formats them by type', () => {
      const fixture = setup(
        makeResult(
          [
            { name: 'name', label: 'Nombre', type: 'VARCHAR' },
            { name: 'start_date', label: 'Inicio', type: 'DATE' },
            { name: 'active', label: 'Activo', type: 'BIT' },
            { name: 'amount', label: 'Monto', type: 'DECIMAL' }
          ],
          [['Ana', '2024-01-05', true, 1234.5]]
        )
      );

      expect(bodyRows(fixture)).toEqual([['Ana', '05/01/2024', 'Sí', '1,234.5']]);
    });

    it('shows the placeholder for null values and for cells missing from a short row', () => {
      const fixture = setup(makeResult(textColumns(3), [['a', null], ['b']]));

      expect(bodyRows(fixture)).toEqual([
        ['a', '—', '—'],
        ['b', '—', '—']
      ]);
    });

    it('renders columns that share the same name and label', () => {
      const columns: ReportColumn[] = [
        { name: 'id', label: 'ID', type: 'INT' },
        { name: 'id', label: 'ID', type: 'INT' }
      ];
      const fixture = setup(makeResult(columns, [[1, 2]]));

      expect(headers(fixture)).toEqual(['ID', 'ID']);
      expect(bodyRows(fixture)).toEqual([['1', '2']]);
    });
  });

  describe('interpretation and safety', () => {
    it('shows the interpretation line as plain text', () => {
      const fixture = setup(makeResult(textColumns(1), [['x']], 'Alumnos con <b>beca</b>'));

      const line = el(fixture).querySelector('[data-testid="report-interpretation"]') as HTMLElement;
      expect(line.textContent?.trim()).toBe('Se interpretó como: Alumnos con <b>beca</b>');
      expect(line.querySelector('b')).toBeNull();
    });

    describe('optional interpretation line', () => {
      function interpretationLine(fixture: ComponentFixture<ReportResultComponent>): HTMLElement | null {
        return el(fixture).querySelector('[data-testid="report-interpretation"]');
      }

      it.each([[null], [''], ['   ']])('does not render the line for the interpretation %j', (interpretation) => {
        const fixture = setup(makeResult(textColumns(1), [['x']], interpretation));

        expect(interpretationLine(fixture)).toBeNull();
        expect(el(fixture).textContent).not.toContain('Se interpretó como');
      });

      it('does not render the line when showInterpretation is false, even with a non-blank interpretation', () => {
        TestBed.configureTestingModule({
          imports: [ReportResultComponent],
          providers: [provideAnimationsAsync()]
        });
        const fixture = TestBed.createComponent(ReportResultComponent);
        fixture.componentRef.setInput('result', makeResult(textColumns(1), [['x']], 'Ciclo actual'));
        fixture.componentRef.setInput('showInterpretation', false);
        fixture.detectChanges();
        fixture.detectChanges();

        expect(interpretationLine(fixture)).toBeNull();
        expect(el(fixture).textContent).not.toContain('Se interpretó como');
        expect(headers(fixture)).toEqual(['Col 0']);
        expect(bodyRows(fixture)).toEqual([['x']]);
      });

      it('shows the line by default so the report builder keeps it', () => {
        const fixture = setup(makeResult(textColumns(1), [['x']], 'Alumnos inscritos'));

        expect(interpretationLine(fixture)?.textContent?.trim()).toBe('Se interpretó como: Alumnos inscritos');
      });

      it('still renders the table, filter, paginator and export button when the interpretation is null', () => {
        const fixture = setup(makeResult(textColumns(2), [['a', 'b']], null));

        expect(headers(fixture)).toEqual(['Col 0', 'Col 1']);
        expect(bodyRows(fixture)).toEqual([['a', 'b']]);
        expect(el(fixture).querySelector('[data-testid="report-filter"]')).not.toBeNull();
        expect(el(fixture).querySelector('mat-paginator')).not.toBeNull();
        expect(el(fixture).querySelector('[data-testid="report-export-btn"]')).not.toBeNull();
      });
    });

    it('renders backend cell text as plain text', () => {
      const fixture = setup(makeResult(textColumns(1), [['<img src=x onerror=alert(1)>']]));

      expect(el(fixture).querySelector('td img')).toBeNull();
      expect(bodyRows(fixture)[0][0]).toBe('<img src=x onerror=alert(1)>');
    });

    it('never shows SQL even if the response carried an extra sql field', () => {
      const result = { ...makeResult(textColumns(1), [['x']]), sql: 'SELECT * FROM student' };
      const fixture = setup(result as unknown as ReportResult);

      expect(el(fixture).textContent).not.toContain('SELECT');
    });
  });

  describe('empty state and row count', () => {
    it('shows the empty message and no table when there are no rows', () => {
      const fixture = setup(makeResult(textColumns(2), []));

      expect(el(fixture).querySelector('[data-testid="report-empty"]')?.textContent).toContain(
        'El reporte no devolvió resultados.'
      );
      expect(el(fixture).querySelector('table')).toBeNull();
    });

    it('shows the empty message when there are no columns', () => {
      const fixture = setup(makeResult([], [[], []]));

      expect(el(fixture).querySelector('[data-testid="report-empty"]')).not.toBeNull();
      expect(el(fixture).querySelector('table')).toBeNull();
    });

    it('shows the row count', () => {
      const rows = Array.from({ length: 42 }, (_, i) => [`r${i}`]);
      const fixture = setup(makeResult(textColumns(1), rows));

      expect(el(fixture).querySelector('[data-testid="report-row-count"]')?.textContent?.trim()).toBe('42 filas');
    });

    it('uses the singular for a single row', () => {
      const fixture = setup(makeResult(textColumns(1), [['only']]));

      expect(el(fixture).querySelector('[data-testid="report-row-count"]')?.textContent?.trim()).toBe('1 fila');
    });

    it('shows filtered versus total while a filter is active', () => {
      const fixture = setup(makeResult(textColumns(1), [['ana'], ['beto'], ['andrea']]));

      typeFilter(fixture, 'an');

      expect(el(fixture).querySelector('[data-testid="report-row-count"]')?.textContent?.trim()).toBe(
        '2 de 3 filas'
      );
    });
  });

  describe('filter', () => {
    it('matches against the formatted text of every column', () => {
      const fixture = setup(
        makeResult(
          [
            { name: 'name', label: 'Nombre', type: 'VARCHAR' },
            { name: 'start_date', label: 'Inicio', type: 'DATE' }
          ],
          [
            ['Ana', '2024-01-05'],
            ['Beto', '2024-03-10']
          ]
        )
      );

      typeFilter(fixture, '05/01');

      expect(bodyRows(fixture)).toEqual([['Ana', '05/01/2024']]);
    });

    it('is case-insensitive', () => {
      const fixture = setup(makeResult(textColumns(1), [['Ana'], ['Beto']]));

      typeFilter(fixture, 'BETO');

      expect(bodyRows(fixture)).toEqual([['Beto']]);
    });

    it('goes back to the first page when the filter changes', async () => {
      const rows = Array.from({ length: 60 }, (_, i) => [`row ${i}`]);
      const fixture = setup(makeResult(textColumns(1), rows));
      await settle(fixture);
      const paginator = fixture.debugElement.query(By.directive(MatPaginator)).componentInstance as MatPaginator;

      paginator.nextPage();
      fixture.detectChanges();
      expect(paginator.pageIndex).toBe(1);

      typeFilter(fixture, 'row');

      expect(paginator.pageIndex).toBe(0);
    });
  });

  describe('sorting', () => {
    const numberResult = (): ReportResult =>
      makeResult([{ name: 'n', label: 'Número', type: 'INT' }], [[10], [9], [null], [100]]);

    it('sorts numbers numerically and keeps empty values last', () => {
      const fixture = setup(numberResult());

      clickHeader(fixture, 0);
      expect(bodyRows(fixture).map((r) => r[0])).toEqual(['9', '10', '100', '—']);

      clickHeader(fixture, 0);
      expect(bodyRows(fixture).map((r) => r[0])).toEqual(['100', '10', '9', '—']);
    });

    it('sorts dates chronologically', () => {
      const fixture = setup(
        makeResult(
          [{ name: 'd', label: 'Fecha', type: 'DATE' }],
          [['2024-12-01'], ['2023-02-15'], ['2024-01-31']]
        )
      );

      clickHeader(fixture, 0);

      expect(bodyRows(fixture).map((r) => r[0])).toEqual(['15/02/2023', '31/01/2024', '01/12/2024']);
    });

    it('sorts text alphabetically ignoring case', () => {
      const fixture = setup(makeResult(textColumns(1), [['beto'], ['Ana'], ['carla']]));

      clickHeader(fixture, 0);

      expect(bodyRows(fixture).map((r) => r[0])).toEqual(['Ana', 'beto', 'carla']);
    });
  });

  describe('pagination', () => {
    it('renders only the current page of a large result', async () => {
      const rows = Array.from({ length: 5000 }, (_, i) => [`row ${i}`]);
      const fixture = setup(makeResult(textColumns(1), rows));
      await settle(fixture);
      const paginator = fixture.debugElement.query(By.directive(MatPaginator)).componentInstance as MatPaginator;

      expect(bodyRows(fixture)).toHaveLength(25);
      expect(paginator.pageSizeOptions).toEqual([10, 25, 50, 100]);
      expect(paginator.length).toBe(5000);
    });
  });

  describe('when the result input changes', () => {
    it('rebuilds the columns, clears the filter and returns to the first page', async () => {
      const rows = Array.from({ length: 60 }, (_, i) => [`row ${i}`]);
      const fixture = setup(makeResult(textColumns(1), rows));
      await settle(fixture);
      const paginator = fixture.debugElement.query(By.directive(MatPaginator)).componentInstance as MatPaginator;
      paginator.nextPage();
      expect(paginator.pageIndex).toBe(1);
      typeFilter(fixture, 'row 5');

      update(fixture, makeResult([{ name: 'x', label: 'Nuevo', type: 'VARCHAR' }], [['uno'], ['dos']]));

      expect(headers(fixture)).toEqual(['Nuevo']);
      expect(bodyRows(fixture)).toEqual([['uno'], ['dos']]);
      expect((el(fixture).querySelector('[data-testid="report-filter"]') as HTMLInputElement).value).toBe('');
      expect(paginator.pageIndex).toBe(0);
    });
  });

  describe('Excel export', () => {
    const typedResult = (): ReportResult =>
      makeResult(
        [
          { name: 'name', label: 'Nombre', type: 'VARCHAR' },
          { name: 'start_date', label: 'Inicio', type: 'DATE' },
          { name: 'grant', label: 'Beca', type: 'INT' },
          { name: 'active', label: 'Activo', type: 'BIT' }
        ],
        [
          ['Ana', '2024-01-05', 50, true],
          ['Beto', null, null, false],
          ['Alan', '2024-02-01', '1250', 0]
        ]
      );

    it('exports the filtered rows with the column labels as headers and typed cells', () => {
      const fixture = setup(typedResult());
      typeFilter(fixture, 'a');

      const config = fixture.componentInstance.excelConfig();

      expect(config.entitySlug).toBe('reporte');
      expect(config.sheetName).toBe('Reporte');
      expect(config.filteredBy).toBe('a');
      expect(config.columns.map((c) => c.header)).toEqual(['Nombre', 'Inicio', 'Beca', 'Activo']);
      expect(config.rows).toHaveLength(2);
      expect(config.rows.map((row) => config.columns.map((c) => c.value(row)))).toEqual([
        ['Ana', new Date(Date.UTC(2024, 0, 5)), 50, 'Sí'],
        ['Alan', new Date(Date.UTC(2024, 1, 1)), 1250, 'No']
      ]);
    });

    it('exports empty cells as null', () => {
      const fixture = setup(typedResult());

      const config = fixture.componentInstance.excelConfig();
      const beto = config.rows.find((row) => config.columns[0].value(row) === 'Beto')!;

      expect(config.columns.map((c) => c.value(beto))).toEqual(['Beto', null, null, 'No']);
    });

    it('exports every column even when names and labels repeat', () => {
      const fixture = setup(
        makeResult(
          [
            { name: 'x', label: 'Valor', type: 'INT' },
            { name: 'x', label: 'Valor', type: 'VARCHAR' }
          ],
          [[7, 'siete']]
        )
      );

      const config = fixture.componentInstance.excelConfig();

      expect(config.columns.map((c) => c.header)).toEqual(['Valor', 'Valor']);
      expect(config.columns.map((c) => c.value(config.rows[0]))).toEqual([7, 'siete']);
    });

    it('declares a number format for date and datetime columns only', () => {
      const fixture = setup(
        makeResult(
          [
            { name: 'a', label: 'Fecha', type: 'DATE' },
            { name: 'b', label: 'Fecha y hora', type: 'DATETIME' },
            { name: 'c', label: 'Marca', type: 'TIMESTAMP' },
            { name: 'd', label: 'Número', type: 'BIGINT' },
            { name: 'e', label: 'Texto', type: 'VARCHAR' },
            { name: 'f', label: 'Activo', type: 'BIT' }
          ],
          [['2024-01-05', '2024-01-05T14:30:00', '2024-01-05 08:05:00', 1, 'x', true]]
        )
      );

      const config = fixture.componentInstance.excelConfig();

      expect(config.columns.map((c) => c.numFmt)).toEqual([
        'dd/mm/yyyy',
        'dd/mm/yyyy hh:mm',
        'dd/mm/yyyy hh:mm',
        undefined,
        undefined,
        undefined
      ]);
    });

    it('computes the typed cells once per result, not on every export', () => {
      const fixture = setup(typedResult());
      const first = fixture.componentInstance.excelConfig();
      const firstDate = first.columns[1].value(first.rows[0]);

      typeFilter(fixture, 'an');
      typeFilter(fixture, '');
      const second = fixture.componentInstance.excelConfig();
      const secondDate = second.columns[1].value(second.rows[0]);

      expect(secondDate).toBeInstanceOf(Date);
      expect(secondDate).toBe(firstDate);
    });

    it('exports a value that does not fit its column type as text without failing', () => {
      const fixture = setup(
        makeResult(
          [
            { name: 'd', label: 'Fecha', type: 'DATE' },
            { name: 'n', label: 'Número', type: 'BIGINT' }
          ],
          [['not a date', '9007199254740993']]
        )
      );

      const config = fixture.componentInstance.excelConfig();

      expect(config.columns.map((c) => c.value(config.rows[0]))).toEqual(['not a date', '9007199254740993']);
    });

    describe('export button state', () => {
      const exportButton = (fixture: ComponentFixture<ReportResultComponent>): HTMLButtonElement =>
        el(fixture).querySelector('[data-testid="export-to-excel-btn"]') as HTMLButtonElement;

      it('is enabled when there are rows to export', () => {
        const fixture = setup(typedResult());

        expect(exportButton(fixture).disabled).toBe(false);
      });

      it('is disabled while the filter matches no rows and enabled again after clearing it', () => {
        const fixture = setup(typedResult());

        typeFilter(fixture, 'zzz-no-match');
        expect(exportButton(fixture).disabled).toBe(true);

        typeFilter(fixture, '');
        expect(exportButton(fixture).disabled).toBe(false);
      });
    });

    it('keeps the toolbar, and so the export button, 16px away from the card right edge', () => {
      setup(makeResult(textColumns(1), [['x']]));

      // Reads the component stylesheet instead of using getComputedStyle, which is slow in jsdom.
      const css = Array.from(document.querySelectorAll('style'))
        .map((style) => style.textContent ?? '')
        .join(' ');

      expect(css).toMatch(/\.report-result__toolbar[^{]*\{[^}]*padding-right:\s*16px/);
    });

    it('renders the export button', () => {
      const fixture = setup(makeResult(textColumns(1), [['x']]));

      expect(el(fixture).querySelector('app-export-to-excel-button')).not.toBeNull();
    });
  });

  describe('save report', () => {
    const savedReport: SavedReport = {
      id: 9,
      name: 'Alumnos activos',
      description: null,
      originalPrompt: 'alumnos activos',
      createdDate: '2026-11-22T01:00:00',
      updatedDate: null,
      lastRunDate: null
    };

    function tokenResult(reportToken: string | null = 't-1', rows: ReportCellValue[][] = [['a', 'b']]): ReportResult {
      return { ...makeResult(textColumns(2), rows), reportToken };
    }

    function saveButton(fixture: ComponentFixture<ReportResultComponent>): HTMLButtonElement | null {
      return el(fixture).querySelector('[data-testid="report-save-btn"]');
    }

    function clickSave(fixture: ComponentFixture<ReportResultComponent>): void {
      saveButton(fixture)?.click();
      fixture.detectChanges();
      fixture.detectChanges();
    }

    /** Stubs the dialog (it answers `dialogResult` at once) and the snackbar, then renders `result`. */
    function setupSave(dialogResult: SaveReportDialogResult | undefined, result: ReportResult = tokenResult()) {
      const dialogOpen = vi
        .spyOn(MatDialog.prototype, 'open')
        .mockReturnValue({ afterClosed: () => of(dialogResult) } as never);
      const snackAction$ = new Subject<void>();
      const snackRef = { onAction: () => snackAction$.asObservable(), dismiss: vi.fn() };
      const snackOpen = vi.spyOn(MatSnackBar.prototype, 'open').mockReturnValue(snackRef as never);

      const fixture = setup(result);
      const reportSaved = vi.fn();
      const regenerateRequested = vi.fn();
      fixture.componentInstance.reportSaved.subscribe(reportSaved);
      fixture.componentInstance.regenerateRequested.subscribe(regenerateRequested);

      return { fixture, dialogOpen, snackOpen, snackRef, snackAction$, reportSaved, regenerateRequested };
    }

    afterEach(() => vi.restoreAllMocks());

    describe('button visibility', () => {
      it('is shown for a result with a token, immediately before the export action', () => {
        const fixture = setup(tokenResult());

        const button = saveButton(fixture);
        expect(button).not.toBeNull();
        expect(button?.textContent).toContain('Guardar reporte');
        expect(el(fixture).querySelector('[data-testid="report-export-btn"]')?.previousElementSibling).toBe(button);
      });

      it('is not rendered for a result without a token', () => {
        const fixture = setup(tokenResult(null));

        expect(saveButton(fixture)).toBeNull();
      });

      it('is not rendered for an empty result', () => {
        const fixture = setup(tokenResult('t-1', []));

        expect(saveButton(fixture)).toBeNull();
      });
    });

    it('opens the save dialog with the report token and without the default close paths', () => {
      const { fixture, dialogOpen } = setupSave(undefined);

      clickSave(fixture);

      expect(dialogOpen).toHaveBeenCalledTimes(1);
      const [component, config] = dialogOpen.mock.calls[0] as unknown as [unknown, MatDialogConfig<unknown>];
      expect(component).toBe(SaveReportDialogComponent);
      expect(config.data).toEqual({ reportToken: 't-1' });
      expect(config.disableClose).toBe(true);
    });

    describe('when the report is saved', () => {
      it('shows the success snackbar, hides the button and emits the saved report', () => {
        const { fixture, snackOpen, reportSaved, regenerateRequested } = setupSave({
          outcome: 'saved',
          report: savedReport
        });

        clickSave(fixture);

        expect(snackOpen).toHaveBeenCalledTimes(1);
        expect(snackOpen.mock.calls[0][0]).toBe(REPORT_SAVED_MESSAGE);
        expect(saveButton(fixture)).toBeNull();
        expect(reportSaved).toHaveBeenCalledTimes(1);
        expect(reportSaved).toHaveBeenCalledWith(savedReport);
        expect(regenerateRequested).not.toHaveBeenCalled();
      });

      it('keeps the table and the export action working', () => {
        const { fixture } = setupSave({ outcome: 'saved', report: savedReport });

        clickSave(fixture);

        expect(bodyRows(fixture)).toEqual([['a', 'b']]);
        expect(el(fixture).querySelector('[data-testid="report-filter"]')).not.toBeNull();
        expect(el(fixture).querySelector('[data-testid="report-export-btn"]')).not.toBeNull();
      });

      it('shows the button again when a new result with a token arrives', () => {
        const { fixture } = setupSave({ outcome: 'saved', report: savedReport });

        clickSave(fixture);
        update(fixture, tokenResult('t-2'));

        expect(saveButton(fixture)).not.toBeNull();
      });
    });

    describe('when the token has expired', () => {
      it('hides the button and offers to generate the report again, without emitting a saved event', () => {
        const { fixture, snackOpen, reportSaved } = setupSave({ outcome: 'expired' });

        clickSave(fixture);

        expect(saveButton(fixture)).toBeNull();
        expect(snackOpen).toHaveBeenCalledTimes(1);
        const [message, action, config] = snackOpen.mock.calls[0] as unknown as [
          string,
          string,
          { duration: number }
        ];
        expect(message).toBe(REPORT_TOKEN_EXPIRED_MESSAGE);
        expect(action).toBe('Generar de nuevo');
        expect(config.duration).toBeGreaterThanOrEqual(10_000);
        expect(reportSaved).not.toHaveBeenCalled();
      });

      it('emits regenerateRequested once when "Generar de nuevo" is activated', () => {
        const { snackAction$, fixture, regenerateRequested } = setupSave({ outcome: 'expired' });

        clickSave(fixture);
        expect(regenerateRequested).not.toHaveBeenCalled();
        snackAction$.next();

        expect(regenerateRequested).toHaveBeenCalledTimes(1);
      });

      it('dismisses the expiry snackbar when a new result arrives', () => {
        const { fixture, snackRef } = setupSave({ outcome: 'expired' });

        clickSave(fixture);
        expect(snackRef.dismiss).not.toHaveBeenCalled();
        update(fixture, tokenResult('t-2'));

        expect(snackRef.dismiss).toHaveBeenCalledTimes(1);
      });

      it('shows the button again when a new result with a token arrives', () => {
        const { fixture } = setupSave({ outcome: 'expired' });

        clickSave(fixture);
        update(fixture, tokenResult('t-2'));

        expect(saveButton(fixture)).not.toBeNull();
      });
    });

    it('keeps the button and stays silent when the dialog is dismissed or the name was a duplicate', () => {
      const { fixture, snackOpen, reportSaved, regenerateRequested } = setupSave(undefined);

      clickSave(fixture);

      expect(saveButton(fixture)).not.toBeNull();
      expect(snackOpen).not.toHaveBeenCalled();
      expect(reportSaved).not.toHaveBeenCalled();
      expect(regenerateRequested).not.toHaveBeenCalled();
    });
  });
});
