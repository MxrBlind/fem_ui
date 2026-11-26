/** Column metadata of a generated report. `type` is the raw database type name (e.g. `VARCHAR`, `DATE`). */
export interface ReportColumn {
  name: string;
  label: string;
  type: string;
}

export type ReportCellValue = string | number | boolean | null;

/**
 * Result of `POST /api/report/generate` or `POST /api/report/saved/{id}/execute`. Each row holds its cell values
 * in column order. A saved-report run has no save token and carries the stored description (or `null`) as
 * its interpretation.
 */
export interface ReportResult {
  reportToken: string | null;
  interpretation: string | null;
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

/**
 * Body of `PUT /api/report/saved/{id}`, a full replacement of name and description. A `null` description clears it.
 */
export interface UpdateSavedReportRequest {
  name: string;
  description: string | null;
}

/** Saved report metadata returned by the saved-reports endpoints. The SQL is never exposed. */
export interface SavedReport {
  id: number;
  name: string;
  description: string | null;
  originalPrompt: string;
  createdDate: string;
  /** `null` until the name or description is updated. */
  updatedDate: string | null;
  lastRunDate: string | null;
}
