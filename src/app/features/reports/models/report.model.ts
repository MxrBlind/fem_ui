/** Column metadata of a generated report. `type` is the raw database type name (e.g. `VARCHAR`, `DATE`). */
export interface ReportColumn {
  name: string;
  label: string;
  type: string;
}

export type ReportCellValue = string | number | boolean | null;

/** Result of `POST /api/report/generate`. Each row holds its cell values in column order. */
export interface ReportResult {
  reportToken: string | null;
  interpretation: string;
  columns: ReportColumn[];
  rows: ReportCellValue[][];
  rowCount: number;
  executionMs: number;
}
