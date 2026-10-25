import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { By } from '@angular/platform-browser';
import { MatPaginator } from '@angular/material/paginator';

import { ReportCellValue, ReportColumn, ReportResult } from '../models/report.model';
import { ReportResultComponent } from './report-result.component';

function makeResult(
  columns: ReportColumn[],
  rows: ReportCellValue[][],
  interpretation = 'Alumnos inscritos'
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
    it('exports the filtered rows with the column labels as headers and the displayed values', () => {
      const fixture = setup(
        makeResult(
          [
            { name: 'name', label: 'Nombre', type: 'VARCHAR' },
            { name: 'start_date', label: 'Inicio', type: 'DATE' }
          ],
          [
            ['Ana', '2024-01-05'],
            ['Beto', null],
            ['Alan', '2024-02-01']
          ]
        )
      );
      typeFilter(fixture, 'a');

      const config = fixture.componentInstance.excelConfig();

      expect(config.entitySlug).toBe('reporte');
      expect(config.columns.map((c) => c.header)).toEqual(['Nombre', 'Inicio']);
      expect(config.rows).toHaveLength(2);
      expect(config.rows.map((row) => config.columns.map((c) => c.value(row)))).toEqual([
        ['Ana', '05/01/2024'],
        ['Alan', '01/02/2024']
      ]);
    });

    it('exports empty cells as empty strings', () => {
      const fixture = setup(makeResult(textColumns(1), [[null]]));

      const config = fixture.componentInstance.excelConfig();

      expect(config.columns[0].value(config.rows[0])).toBe('');
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
});
