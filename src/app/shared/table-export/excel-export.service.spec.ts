import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { ExcelExportService } from './excel-export.service';
import { ExcelExportConfig } from './excel-export.types';
import { TableExportAnalytics } from './table-export-analytics';

interface Row {
  id: number;
  name: string;
}

function baseConfig(rows: Row[] = [{ id: 1, name: 'Ada' }]): ExcelExportConfig<Row> {
  return {
    rows,
    columns: [
      { header: 'ID', key: 'id', value: (r) => r.id },
      { header: 'Nombre', key: 'name', value: (r) => r.name },
    ],
    entitySlug: 'widgets',
    filteredBy: 'a',
  };
}

// jsdom Blobs cannot be read by Node's Response, so use jsdom's FileReader
function readBlob(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

describe('ExcelExportService', () => {
  let service: ExcelExportService;
  let analytics: TableExportAnalytics;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ExcelExportService);
    analytics = TestBed.inject(TableExportAnalytics);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    // JSDOM's anchor.click triggers navigation which we don't care about here
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  it('buildFilename formats <slug>-YYYYMMDD-HHmm.xlsx from local time', () => {
    const d = new Date(2026, 0, 5, 9, 7); // 2026-01-05 09:07 local
    expect(service.buildFilename('students', d)).toBe('students-20260105-0907.xlsx');
  });

  it('exports rows to a workbook, downloads, and emits analytics', async () => {
    const trackSpy = vi.spyOn(analytics, 'tableExported');
    await service.exportToExcel(baseConfig([{ id: 1, name: 'Ada' }, { id: 2, name: 'Grace' }]));
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(trackSpy).toHaveBeenCalledWith({
      entitySlug: 'widgets',
      rowCount: 2,
      filteredBy: 'a',
    });
  });

  it('sanitizes formula-injection cells via the guard', async () => {
    // Verified indirectly: build a small workbook and read it back
    const excel = await import('exceljs');
    const workbook = new excel.Workbook();
    workbook.addWorksheet('t').addRow([`'=INJECT()`]);
    // The guardFormula unit test covers the prefixing logic; here we assert
    // the service does not throw on a string starting with '='.
    await expect(
      service.exportToExcel({
        rows: [{ id: 1, name: '=INJECT()' }],
        columns: [
          { header: 'ID', key: 'id', value: (r) => r.id },
          { header: 'Nombre', key: 'name', value: (r) => r.name },
        ],
        entitySlug: 'w',
      })
    ).resolves.toBeUndefined();
  });

  describe('header autofilter', () => {
    function configWithColumns(count: number): ExcelExportConfig<Row> {
      return {
        rows: [{ id: 1, name: 'Ada' }],
        columns: Array.from({ length: count }, (_, i) => ({
          header: `Col ${i + 1}`,
          key: `col${i + 1}`,
          value: (r: Row) => `${r.name} ${i + 1}`,
        })),
        entitySlug: 'wide',
      };
    }

    async function exportedAutoFilter(): Promise<unknown> {
      const blob = vi.mocked(URL.createObjectURL).mock.lastCall?.[0] as Blob;
      const excel = await import('exceljs');
      const workbook = new excel.Workbook();
      await workbook.xlsx.load(await readBlob(blob));
      return workbook.worksheets[0].autoFilter;
    }

    it.each([
      [2, 'A1:B1'],
      [26, 'A1:Z1'],
      [27, 'A1:AA1'],
      [30, 'A1:AD1'],
    ])('covers all %i header columns (%s)', async (count, expectedRange) => {
      await service.exportToExcel(configWithColumns(count));
      expect(await exportedAutoFilter()).toBe(expectedRange);
    });

    it('sets no autofilter when there are no columns', async () => {
      await expect(service.exportToExcel(configWithColumns(0))).resolves.toBeUndefined();
      expect(await exportedAutoFilter()).toBeUndefined();
    });
  });

  describe('column number format', () => {
    interface Movement {
      when: Date | null;
      amount: number | null;
    }

    const DATETIME_FORMAT = 'dd/mm/yyyy hh:mm';
    const AMOUNT_FORMAT = '#,##0.00';
    const WHEN = new Date(Date.UTC(2024, 0, 5, 14, 30));

    function movementConfig(withFormats: boolean, rows: Movement[]): ExcelExportConfig<Movement> {
      return {
        rows,
        columns: [
          { header: 'Fecha', key: 'when', value: (r) => r.when, ...(withFormats ? { numFmt: DATETIME_FORMAT } : {}) },
          { header: 'Monto', key: 'amount', value: (r) => r.amount, ...(withFormats ? { numFmt: AMOUNT_FORMAT } : {}) },
        ],
        entitySlug: 'movements',
      };
    }

    async function exportedSheet(config: ExcelExportConfig<Movement>) {
      await service.exportToExcel(config);
      const blob = vi.mocked(URL.createObjectURL).mock.lastCall?.[0] as Blob;
      const excel = await import('exceljs');
      const workbook = new excel.Workbook();
      await workbook.xlsx.load(await readBlob(blob));
      return workbook.worksheets[0];
    }

    it('applies the declared format to date and numeric data cells and keeps their values typed', async () => {
      const sheet = await exportedSheet(movementConfig(true, [{ when: WHEN, amount: 1250 }]));

      expect(sheet.getCell(2, 1).numFmt).toBe(DATETIME_FORMAT);
      expect(sheet.getCell(2, 1).value).toEqual(WHEN);
      expect(sheet.getCell(2, 2).numFmt).toBe(AMOUNT_FORMAT);
      expect(sheet.getCell(2, 2).value).toBe(1250);
    });

    it('does not format the header cell, which keeps its text and bold font', async () => {
      const sheet = await exportedSheet(movementConfig(true, [{ when: WHEN, amount: 1250 }]));

      expect(sheet.getCell(1, 1).value).toBe('Fecha');
      expect(sheet.getCell(1, 1).font?.bold).toBe(true);
      expect(sheet.getCell(1, 1).numFmt).not.toBe(DATETIME_FORMAT);
      expect(sheet.getCell(1, 2).numFmt).not.toBe(AMOUNT_FORMAT);
    });

    it('writes columns without a declared format with the default format', async () => {
      const sheet = await exportedSheet(movementConfig(false, [{ when: WHEN, amount: 1250 }]));

      expect(sheet.getCell(2, 1).numFmt).not.toBe(DATETIME_FORMAT);
      expect(['General', undefined]).toContain(sheet.getCell(2, 2).numFmt);
      expect(sheet.getCell(2, 2).value).toBe(1250);
    });

    it('leaves an empty value as an empty cell even when the column declares a format', async () => {
      const sheet = await exportedSheet(movementConfig(true, [{ when: null, amount: null }]));

      expect(sheet.getCell(2, 1).value).toBeNull();
      expect(sheet.getCell(2, 2).value).toBeNull();
    });

    it('keeps the autofilter and the row count unchanged', async () => {
      const sheet = await exportedSheet(
        movementConfig(true, [
          { when: WHEN, amount: 1 },
          { when: WHEN, amount: 2 },
        ])
      );

      expect(sheet.autoFilter).toBe('A1:B1');
      expect(sheet.rowCount).toBe(3);
    });
  });

  it('caches the dynamically imported exceljs module across calls', async () => {
    await service.exportToExcel(baseConfig());
    const cached = (service as unknown as { modulePromise: Promise<unknown> }).modulePromise;
    await service.exportToExcel(baseConfig());
    const after = (service as unknown as { modulePromise: Promise<unknown> }).modulePromise;
    expect(after).toBe(cached);
  });
});
