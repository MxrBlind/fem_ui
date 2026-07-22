import { Injectable, inject } from '@angular/core';

import type { Workbook, Worksheet } from 'exceljs';
import { ExcelExportConfig, ExcelExportColumn } from './excel-export.types';
import { guardFormula } from './formula-guard.util';
import { saveBlob } from './file-saver.util';
import { TableExportAnalytics } from './table-export-analytics';

type ExcelJsModule = typeof import('exceljs');

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@Injectable({ providedIn: 'root' })
export class ExcelExportService {
  private readonly analytics = inject(TableExportAnalytics);
  private modulePromise: Promise<ExcelJsModule> | null = null;

  async exportToExcel<T>(config: ExcelExportConfig<T>): Promise<void> {
    const excel = await this.loadExcelJs();
    const workbook = new excel.Workbook();
    const sheet = workbook.addWorksheet(config.sheetName ?? config.entitySlug);

    this.writeHeader(sheet, config.columns);
    this.writeRows(sheet, config.rows, config.columns);
    this.applyColumnWidths(sheet, config.columns);

    try {
      const buffer = await workbook.xlsx.writeBuffer();
      const filename = this.buildFilename(config.entitySlug);
      saveBlob(new Blob([buffer as ArrayBuffer], { type: XLSX_MIME }), filename);
      this.analytics.tableExported({
        entitySlug: config.entitySlug,
        rowCount: config.rows.length,
        filteredBy: config.filteredBy ?? '',
      });
    } catch (err) {
      console.error('[excel-export] failed to generate workbook', err);
      throw err;
    }
  }

  buildFilename(entitySlug: string, now: Date = new Date()): string {
    const pad = (n: number): string => String(n).padStart(2, '0');
    const stamp =
      `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
      `-${pad(now.getHours())}${pad(now.getMinutes())}`;
    return `${entitySlug}-${stamp}.xlsx`;
  }

  private loadExcelJs(): Promise<ExcelJsModule> {
    if (!this.modulePromise) {
      this.modulePromise = import('exceljs');
    }
    return this.modulePromise;
  }

  private writeHeader<T>(sheet: Worksheet, columns: ExcelExportColumn<T>[]): void {
    const headerRow = sheet.addRow(columns.map((c) => c.header));
    headerRow.font = { bold: true };
    const lastCol = String.fromCharCode('A'.charCodeAt(0) + columns.length - 1);
    sheet.autoFilter = `A1:${lastCol}1`;
  }

  private writeRows<T>(
    sheet: Worksheet,
    rows: T[],
    columns: ExcelExportColumn<T>[]
  ): void {
    for (const row of rows) {
      const values = columns.map((c) => this.sanitize(c.value(row)));
      sheet.addRow(values);
    }
  }

  private applyColumnWidths<T>(
    sheet: Worksheet,
    columns: ExcelExportColumn<T>[]
  ): void {
    sheet.columns = columns.map((c) => ({
      width: c.width ?? Math.max(12, Math.min(40, c.header.length + 4)),
    }));
  }

  private sanitize(
    value: string | number | boolean | Date | null | undefined
  ): string | number | boolean | Date | null {
    if (value === undefined || value === null) return null;
    if (typeof value === 'string') return guardFormula(value);
    return value;
  }
}

export function _resetExcelJsCacheForTests(service: ExcelExportService): void {
  (service as unknown as { modulePromise: unknown }).modulePromise = null;
}
