const FORMULA_TRIGGERS = new Set(['=', '+', '-', '@']);

export function guardFormula(value: string): string {
  if (value.length === 0) return value;
  return FORMULA_TRIGGERS.has(value.charAt(0)) ? `'${value}` : value;
}
