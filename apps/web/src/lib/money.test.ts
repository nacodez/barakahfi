import { describe, expect, it } from 'vitest';
import { toCents, totalsByCurrency } from './money';
import { safeNext } from './redirect';

describe('money', () => {
  it('parses decimal strings to exact cents', () => {
    expect(toCents('1250.50')).toBe(125050n);
    expect(toCents('0.5')).toBe(50n);
    expect(toCents('-3')).toBe(-300n);
  });

  it('rejects malformed input', () => {
    expect(() => toCents('1.234')).toThrow();
    expect(() => toCents('abc')).toThrow();
  });

  it('sums per currency without float drift (0.1 + 0.2)', () => {
    const totals = totalsByCurrency([
      { balance: '0.10', currency: 'AED' },
      { balance: '0.20', currency: 'AED' },
      { balance: '5.00', currency: 'USD' },
    ]);
    expect(totals).toEqual([
      { currency: 'AED', cents: 30n },
      { currency: 'USD', cents: 500n },
    ]);
  });
});

describe('safeNext', () => {
  it.each([
    ['/dashboard/accounts', '/dashboard/accounts'],
    [null, '/dashboard'],
    ['https://evil.example', '/dashboard'],
    ['//evil.example', '/dashboard'],
    ['/\\evil.example', '/dashboard'],
  ])('%s -> %s', (input, expected) => expect(safeNext(input)).toBe(expected));
});
