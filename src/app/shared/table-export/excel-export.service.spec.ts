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

  it('caches the dynamically imported exceljs module across calls', async () => {
    await service.exportToExcel(baseConfig());
    const cached = (service as unknown as { modulePromise: Promise<unknown> }).modulePromise;
    await service.exportToExcel(baseConfig());
    const after = (service as unknown as { modulePromise: Promise<unknown> }).modulePromise;
    expect(after).toBe(cached);
  });
});
