export interface ExcelExportColumn<T> {
  header: string;
  key: keyof T | string;
  value: (row: T) => string | number | boolean | Date | null | undefined;
  width?: number;
}

export interface ExcelExportConfig<T> {
  rows: T[];
  columns: ExcelExportColumn<T>[];
  entitySlug: string;
  sheetName?: string;
  filteredBy?: string;
}

export const EXPORT_ROW_CAP = 50_000;
