import {
  EMPTY_CELL,
  formatReportCell,
  resolveCellKind,
  toSortValue
} from './report-cell-format';

describe('resolveCellKind', () => {
  it.each([
    ['DATE', 'date'],
    ['DATETIME', 'datetime'],
    ['TIMESTAMP', 'datetime'],
    ['BIT', 'boolean'],
    ['BOOLEAN', 'boolean'],
    ['TINYINT', 'number'],
    ['SMALLINT', 'number'],
    ['INT', 'number'],
    ['INTEGER', 'number'],
    ['BIGINT', 'number'],
    ['BIGINT UNSIGNED', 'number'],
    ['INT UNSIGNED', 'number'],
    ['DECIMAL', 'number'],
    ['NUMERIC', 'number'],
    ['FLOAT', 'number'],
    ['DOUBLE', 'number'],
    ['VARCHAR', 'text'],
    ['TEXT', 'text'],
    ['SOMETHING_NEW', 'text'],
    ['', 'text']
  ])('maps %s to %s', (type, kind) => {
    expect(resolveCellKind(type)).toBe(kind);
  });

  it('is case-insensitive and ignores surrounding whitespace', () => {
    expect(resolveCellKind(' bigint unsigned ')).toBe('number');
    expect(resolveCellKind('date')).toBe('date');
  });
});

describe('formatReportCell', () => {
  it.each([null, undefined, ''])('shows the placeholder for %p', (value) => {
    expect(formatReportCell(value, 'text')).toBe(EMPTY_CELL);
    expect(formatReportCell(value, 'number')).toBe(EMPTY_CELL);
    expect(formatReportCell(value, 'date')).toBe(EMPTY_CELL);
  });

  it('formats a date-only value as dd/MM/yyyy without shifting the day', () => {
    expect(formatReportCell('2024-01-05', 'date')).toBe('05/01/2024');
    expect(formatReportCell('2024-12-31', 'date')).toBe('31/12/2024');
  });

  it('formats a date value that carries a time part using its date portion', () => {
    expect(formatReportCell('2024-01-05T00:00:00.000+00:00', 'date')).toBe('05/01/2024');
  });

  it('formats a datetime without offset as dd/MM/yyyy HH:mm', () => {
    expect(formatReportCell('2024-01-05T10:30:00', 'datetime')).toBe('05/01/2024 10:30');
    expect(formatReportCell('2024-01-05 08:05:09', 'datetime')).toBe('05/01/2024 08:05');
  });

  it('formats a datetime with offset in the browser timezone', () => {
    const iso = '2024-01-05T10:30:00.000+00:00';
    const local = new Date(iso);
    const pad = (n: number): string => String(n).padStart(2, '0');
    const expected = `${pad(local.getDate())}/${pad(local.getMonth() + 1)}/${local.getFullYear()} ${pad(local.getHours())}:${pad(local.getMinutes())}`;

    expect(formatReportCell(iso, 'datetime')).toBe(expected);
  });

  it('formats an epoch number as a datetime', () => {
    const epoch = new Date(2024, 0, 5, 10, 30).getTime();

    expect(formatReportCell(epoch, 'datetime')).toBe('05/01/2024 10:30');
  });

  it('keeps an unparsable date as plain text', () => {
    expect(formatReportCell('not a date', 'date')).toBe('not a date');
    expect(formatReportCell('not a date', 'datetime')).toBe('not a date');
  });

  it('formats booleans as Sí / No for true, false, 1 and 0', () => {
    expect(formatReportCell(true, 'boolean')).toBe('Sí');
    expect(formatReportCell(false, 'boolean')).toBe('No');
    expect(formatReportCell(1, 'boolean')).toBe('Sí');
    expect(formatReportCell(0, 'boolean')).toBe('No');
  });

  it('formats numbers with the es-MX grouping and keeps decimals', () => {
    expect(formatReportCell(1234567, 'number')).toBe('1,234,567');
    expect(formatReportCell(1234.5, 'number')).toBe('1,234.5');
    expect(formatReportCell(0, 'number')).toBe('0');
  });

  it('formats a numeric string and keeps a non-numeric one as plain text', () => {
    expect(formatReportCell('2500', 'number')).toBe('2,500');
    expect(formatReportCell('abc', 'number')).toBe('abc');
  });

  it('shows text as is, including markup, and stringifies other values', () => {
    expect(formatReportCell('<b>x</b>', 'text')).toBe('<b>x</b>');
    expect(formatReportCell(42, 'text')).toBe('42');
    expect(formatReportCell(true, 'text')).toBe('true');
  });
});

describe('toSortValue', () => {
  it('returns null for empty values so they can be sorted last', () => {
    expect(toSortValue(null, 'number')).toBeNull();
    expect(toSortValue(undefined, 'text')).toBeNull();
    expect(toSortValue('', 'date')).toBeNull();
  });

  it('returns numbers for number columns, even from numeric strings', () => {
    expect(toSortValue(9, 'number')).toBe(9);
    expect(toSortValue('100', 'number')).toBe(100);
  });

  it('returns epoch milliseconds for date and datetime columns', () => {
    const a = toSortValue('2024-01-05', 'date') as number;
    const b = toSortValue('2024-01-06', 'date') as number;

    expect(typeof a).toBe('number');
    expect(a).toBeLessThan(b);
    expect(toSortValue('2024-01-05T10:30:00', 'datetime')).toBe(new Date(2024, 0, 5, 10, 30).getTime());
  });

  it('returns 0 or 1 for booleans', () => {
    expect(toSortValue(false, 'boolean')).toBe(0);
    expect(toSortValue(true, 'boolean')).toBe(1);
    expect(toSortValue(1, 'boolean')).toBe(1);
  });

  it('returns lower-cased text for text columns and the raw text for unparsable values', () => {
    expect(toSortValue('Ana', 'text')).toBe('ana');
    expect(toSortValue('abc', 'number')).toBe('abc');
  });
});
