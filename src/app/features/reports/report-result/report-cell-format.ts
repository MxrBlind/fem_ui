import { ReportCellValue } from '../models/report.model';

export type ReportCellKind = 'text' | 'number' | 'boolean' | 'date' | 'datetime';

/** Value shown for an empty cell, matching the placeholder used by the list pages. */
export const EMPTY_CELL = '—';

const NUMBER_TYPES: ReadonlySet<string> = new Set([
  'TINYINT',
  'SMALLINT',
  'MEDIUMINT',
  'INT',
  'INTEGER',
  'BIGINT',
  'DECIMAL',
  'NUMERIC',
  'FLOAT',
  'DOUBLE'
]);

const NUMBER_FORMAT = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 6 });

/** Matches `yyyy-MM-dd`, optionally followed by `T`/space and a time, with an optional offset. */
const DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2})?(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;

/**
 * Maps a database type name (e.g. `BIGINT UNSIGNED`) to how its cells are displayed.
 * Unknown types are shown as plain text so a new type never breaks rendering.
 */
export function resolveCellKind(type: string): ReportCellKind {
  const baseType = type.trim().toUpperCase().split(/\s+/)[0] ?? '';
  if (baseType === 'DATE') return 'date';
  if (baseType === 'DATETIME' || baseType === 'TIMESTAMP') return 'datetime';
  if (baseType === 'BIT' || baseType === 'BOOLEAN') return 'boolean';
  if (NUMBER_TYPES.has(baseType)) return 'number';
  return 'text';
}

/** Returns the text to display for a cell. Never throws; values that do not fit their kind are shown as text. */
export function formatReportCell(value: ReportCellValue | undefined, kind: ReportCellKind): string {
  if (isEmpty(value)) return EMPTY_CELL;

  switch (kind) {
    case 'date': {
      const date = parseDate(value, false);
      return date ? `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}` : String(value);
    }
    case 'datetime': {
      const date = parseDate(value, true);
      return date
        ? `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
        : String(value);
    }
    case 'boolean': {
      const flag = parseBoolean(value);
      return flag === null ? String(value) : flag ? 'Sí' : 'No';
    }
    case 'number': {
      const numeric = parseNumber(value);
      return numeric === null ? String(value) : NUMBER_FORMAT.format(numeric);
    }
    default:
      return String(value);
  }
}

/** Returns a comparable value for sorting, or `null` for empty cells so they can be placed last. */
export function toSortValue(value: ReportCellValue | undefined, kind: ReportCellKind): number | string | null {
  if (isEmpty(value)) return null;

  switch (kind) {
    case 'date':
    case 'datetime': {
      const date = parseDate(value, kind === 'datetime');
      return date ? date.getTime() : String(value).toLowerCase();
    }
    case 'boolean': {
      const flag = parseBoolean(value);
      return flag === null ? String(value).toLowerCase() : flag ? 1 : 0;
    }
    case 'number': {
      const numeric = parseNumber(value);
      return numeric === null ? String(value).toLowerCase() : numeric;
    }
    default:
      return String(value).toLowerCase();
  }
}

function isEmpty(value: ReportCellValue | undefined): value is null | undefined | '' {
  return value === null || value === undefined || value === '';
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function parseBoolean(value: ReportCellValue): boolean | null {
  if (value === true || value === 1 || value === '1' || value === 'true') return true;
  if (value === false || value === 0 || value === '0' || value === 'false') return false;
  return null;
}

function parseNumber(value: ReportCellValue): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
}

/**
 * Builds a local `Date` without letting the browser timezone move calendar values:
 * date-only strings and offset-less datetimes are read from their own parts; only
 * values that carry an explicit offset (or epoch numbers) are converted to local time.
 */
function parseDate(value: ReportCellValue, withTime: boolean): Date | null {
  if (typeof value === 'number') {
    const epoch = new Date(value);
    return Number.isNaN(epoch.getTime()) ? null : epoch;
  }
  if (typeof value !== 'string') return null;

  const match = DATE_TIME_PATTERN.exec(value.trim());
  if (!match) return null;

  const [, year, month, day, hours, minutes, offset] = match;
  if (withTime && offset) {
    const absolute = new Date(value.trim());
    return Number.isNaN(absolute.getTime()) ? null : absolute;
  }

  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    withTime ? Number(hours ?? 0) : 0,
    withTime ? Number(minutes ?? 0) : 0
  );
}
