import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  linkedSignal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule, Sort } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';

import {
  ExcelExportColumn,
  ExcelExportConfig,
  ExportToExcelButtonComponent,
} from '@shared/table-export';
import { ReportResult } from '../models/report.model';
import {
  ExcelCell,
  ReportCellKind,
  formatReportCell,
  resolveCellKind,
  toCell,
  toSortValue
} from './report-cell-format';

export const EMPTY_RESULT_MESSAGE = 'El reporte no devolvió resultados.';

/** Spreadsheet number formats of the date columns; other kinds keep the default format. */
export const EXCEL_DATE_FORMAT = 'dd/mm/yyyy';
export const EXCEL_DATETIME_FORMAT = 'dd/mm/yyyy hh:mm';

type SortValue = number | string | null;

/** One report row with its cells already formatted for display, sorting, filtering and Excel export. */
export interface ReportDisplayRow {
  display: string[];
  sort: SortValue[];
  cells: ExcelCell[];
  haystack: string;
}

interface ReportColumnDef {
  id: string;
  index: number;
  header: string;
  numFmt: string | undefined;
}

function excelNumberFormat(kind: ReportCellKind): string | undefined {
  if (kind === 'date') return EXCEL_DATE_FORMAT;
  if (kind === 'datetime') return EXCEL_DATETIME_FORMAT;
  return undefined;
}

@Component({
  selector: 'app-report-result',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatSortModule,
    MatTableModule,
    ExportToExcelButtonComponent,
  ],
  templateUrl: './report-result.component.html',
  styleUrl: './report-result.component.scss',
})
export class ReportResultComponent {
  readonly result = input.required<ReportResult>();

  readonly emptyMessage = EMPTY_RESULT_MESSAGE;
  readonly pageSizeOptions = [10, 25, 50, 100];

  /** Cleared whenever a new result arrives. */
  readonly filterText = linkedSignal<ReportResult, string>({
    source: this.result,
    computation: () => '',
  });

  /** Column ids are positional, so repeated names or labels cannot collide. */
  readonly columnDefs = computed<ReportColumnDef[]>(() =>
    this.result().columns.map((column, index) => ({
      id: `c${index}`,
      index,
      header: column.label.trim() || column.name,
      numFmt: excelNumberFormat(resolveCellKind(column.type)),
    }))
  );
  readonly displayedColumns = computed(() => this.columnDefs().map((column) => column.id));

  private readonly displayRows = computed<ReportDisplayRow[]>(() => {
    const { columns, rows } = this.result();
    const kinds = columns.map((column) => resolveCellKind(column.type));
    return rows.map((row) => {
      const display = kinds.map((kind, index) => formatReportCell(row[index], kind));
      return {
        display,
        sort: kinds.map((kind, index) => toSortValue(row[index], kind)),
        cells: kinds.map((kind, index) => toCell(row[index], kind)),
        haystack: display.join(' ').toLowerCase(),
      };
    });
  });

  readonly isEmpty = computed(() => this.columnDefs().length === 0 || this.displayRows().length === 0);

  private readonly normalizedFilter = computed(() => this.filterText().trim().toLowerCase());

  /** Rows matching the current filter; drives the row count label and the export button state. */
  readonly filteredCount = computed(() => {
    const term = this.normalizedFilter();
    const rows = this.displayRows();
    return term ? rows.filter((row) => row.haystack.includes(term)).length : rows.length;
  });

  readonly rowCountLabel = computed(() => {
    const total = this.displayRows().length;
    const shown = this.filteredCount();
    const noun = total === 1 ? 'fila' : 'filas';
    return this.normalizedFilter() ? `${shown} de ${total} ${noun}` : `${total} ${noun}`;
  });

  readonly dataSource = new MatTableDataSource<ReportDisplayRow>([]);

  private readonly sort = viewChild(MatSort);
  private readonly paginator = viewChild(MatPaginator);

  private readonly excelColumns = computed<ExcelExportColumn<ReportDisplayRow>[]>(() =>
    this.columnDefs().map((column) => ({
      header: column.header,
      key: column.id,
      value: (row) => row.cells[column.index],
      numFmt: column.numFmt,
    }))
  );

  readonly excelConfig = (): ExcelExportConfig<ReportDisplayRow> => ({
    rows: this.dataSource.filteredData,
    columns: this.excelColumns(),
    entitySlug: 'reporte',
    sheetName: 'Reporte',
    filteredBy: this.filterText(),
  });

  constructor() {
    this.dataSource.filterPredicate = (row, filter) => !filter || row.haystack.includes(filter);
    this.dataSource.sortData = sortReportRows;

    effect(() => {
      const rows = this.displayRows();
      const sort = this.sort();
      const paginator = this.paginator();

      if (this.isEmpty()) {
        this.dataSource.data = [];
        return;
      }
      // Wait for the table view: without the paginator wired first, the initial render would paint every row.
      if (!sort || !paginator) return;

      this.dataSource.sort = sort;
      this.dataSource.paginator = paginator;
      this.dataSource.data = rows;
      paginator.firstPage();
    });
    effect(() => {
      this.dataSource.filter = this.normalizedFilter();
      // The data source only clamps the page index on filter changes; the page must restart at the first one.
      this.paginator()?.firstPage();
    });
  }

  onFilterInput(value: string): void {
    this.filterText.set(value);
  }

  clearFilter(): void {
    this.filterText.set('');
  }
}

/** Sorts by the active positional column; empty values always go last, numbers before text. */
function sortReportRows(data: ReportDisplayRow[], sort: MatSort | Sort): ReportDisplayRow[] {
  if (!sort.active || sort.direction === '') return data;

  const index = Number(sort.active.slice(1));
  const factor = sort.direction === 'asc' ? 1 : -1;

  return [...data].sort((a, b) => {
    const left = a.sort[index] ?? null;
    const right = b.sort[index] ?? null;
    if (left === null && right === null) return 0;
    if (left === null) return 1;
    if (right === null) return -1;
    return compareValues(left, right) * factor;
  });
}

function compareValues(left: number | string, right: number | string): number {
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  if (typeof left === 'string' && typeof right === 'string') return left.localeCompare(right, 'es');
  return typeof left === 'number' ? -1 : 1;
}
