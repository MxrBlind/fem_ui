import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSnackBar, MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';
import { MatSort, MatSortModule, Sort } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { take } from 'rxjs';

import { REPORT_SAVED_MESSAGE, REPORT_TOKEN_EXPIRED_MESSAGE } from '@core/errors/error-messages';
import {
  ExcelExportColumn,
  ExcelExportConfig,
  ExportToExcelButtonComponent,
} from '@shared/table-export';
import { ReportResult, SavedReport } from '../models/report.model';
import {
  SaveReportDialogComponent,
  SaveReportDialogData,
  SaveReportDialogResult
} from '../report-save/save-report-dialog.component';
import {
  ExcelCell,
  ReportCellKind,
  formatReportCell,
  resolveCellKind,
  toCell,
  toSortValue
} from './report-cell-format';

export const EMPTY_RESULT_MESSAGE = 'El reporte no devolvió resultados.';
export const REGENERATE_ACTION_LABEL = 'Generar de nuevo';

/** Long enough to act on the "Generar de nuevo" action. */
const EXPIRY_NOTICE_DURATION_MS = 10_000;

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
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly result = input.required<ReportResult>();

  /** Turn off the "Se interpretó como" line when the interpretation is already shown elsewhere. */
  readonly showInterpretation = input(true);

  /** Emits the saved report so a saved-reports list can refresh. */
  readonly reportSaved = output<SavedReport>();
  /** The report token expired; the owner should generate the same report again. */
  readonly regenerateRequested = output<void>();

  readonly emptyMessage = EMPTY_RESULT_MESSAGE;
  readonly pageSizeOptions = [10, 25, 50, 100];

  /** A token is single use: it is consumed once saved or reported as expired. A new result starts unconsumed. */
  private readonly tokenConsumed = linkedSignal<ReportResult, boolean>({
    source: this.result,
    computation: () => false,
  });

  readonly canSave = computed(() => this.result().reportToken !== null && !this.tokenConsumed());

  /** The open "expired" snackbar, dismissed when a new result arrives so its action cannot regenerate a stale prompt. */
  private expiryNotice: MatSnackBarRef<TextOnlySnackBar> | null = null;

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
      this.result();
      this.expiryNotice?.dismiss();
      this.expiryNotice = null;
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

  onSave(): void {
    const reportToken = this.result().reportToken;
    if (reportToken === null || this.tokenConsumed()) return;

    this.dialog
      .open<SaveReportDialogComponent, SaveReportDialogData, SaveReportDialogResult>(SaveReportDialogComponent, {
        data: { reportToken },
        disableClose: true,
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((outcome) => this.handleSaveOutcome(outcome));
  }

  /** `undefined` means the dialog was dismissed, so the token is still usable. */
  private handleSaveOutcome(outcome: SaveReportDialogResult | undefined): void {
    if (!outcome) return;

    this.tokenConsumed.set(true);
    if (outcome.outcome === 'saved') {
      this.snackBar.open(REPORT_SAVED_MESSAGE, 'Cerrar', { duration: 3000 });
      this.reportSaved.emit(outcome.report);
      return;
    }

    this.expiryNotice = this.snackBar.open(REPORT_TOKEN_EXPIRED_MESSAGE, REGENERATE_ACTION_LABEL, {
      duration: EXPIRY_NOTICE_DURATION_MS,
    });
    this.expiryNotice
      .onAction()
      .pipe(take(1))
      .subscribe(() => this.regenerateRequested.emit());
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
