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

/** Body of `POST /api/report/saved`. `description` is left out when the admin does not provide one. */
export interface SaveReportRequest {
  reportToken: string;
  name: string;
  description?: string;
}

/** Saved report metadata returned by `POST /api/report/saved`. The SQL is never exposed. */
export interface SavedReport {
  id: number;
  name: string;
  description: string | null;
  originalPrompt: string;
  createdDate: string;
  lastRunDate: string | null;
}
