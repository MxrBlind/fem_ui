import { describe, expect, it } from 'vitest';
import { guardFormula } from './formula-guard.util';

describe('guardFormula', () => {
  it('prefixes strings starting with formula triggers', () => {
    expect(guardFormula('=SUM(A1:A2)')).toBe("'=SUM(A1:A2)");
    expect(guardFormula('+1')).toBe("'+1");
    expect(guardFormula('-1')).toBe("'-1");
    expect(guardFormula('@cmd')).toBe("'@cmd");
  });

  it('leaves safe strings untouched', () => {
    expect(guardFormula('hello')).toBe('hello');
    expect(guardFormula('123')).toBe('123');
    expect(guardFormula('')).toBe('');
  });
});
