import { describe, expect, it } from 'vitest';
import type { TransactionDto } from '@barakahfi/shared';
import { monthLabel, monthRange, toDateString } from './date';
import { buildQuery, insertSorted, matchesFilters } from './transaction-utils';

const t = (over: Partial<TransactionDto> = {}): TransactionDto => ({
  id: '1',
  type: 'EXPENSE',
  amount: '10.00',
  description: '',
  date: '2026-11-09',
  accountId: 'a',
  accountName: 'A',
  currency: 'AED',
  transferAccountId: null,
  transferAccountName: null,
  categoryId: 'c',
  categoryName: 'Groceries',
  categoryIcon: '🛒',
  categoryHalalStatus: 'NEUTRAL',
  createdAt: '2026-11-09T00:00:00Z',
  ...over,
});

describe('matchesFilters', () => {
  it('matches everything when no filter is set', () => expect(matchesFilters(t(), {})).toBe(true));
  it('filters by type, category and date range (inclusive)', () => {
    expect(matchesFilters(t(), { type: 'INCOME' })).toBe(false);
    expect(matchesFilters(t(), { categoryId: 'x' })).toBe(false);
    expect(matchesFilters(t(), { from: '2026-11-09', to: '2026-11-09' })).toBe(true);
    expect(matchesFilters(t(), { from: '2026-11-10' })).toBe(false);
    expect(matchesFilters(t(), { to: '2026-11-08' })).toBe(false);
  });
  it('an account filter also matches the destination of a transfer', () => {
    const transfer = t({ type: 'TRANSFER', transferAccountId: 'b' });
    expect(matchesFilters(transfer, { accountId: 'a' })).toBe(true);
    expect(matchesFilters(transfer, { accountId: 'b' })).toBe(true);
    expect(matchesFilters(transfer, { accountId: 'z' })).toBe(false);
  });
});

describe('buildQuery', () => {
  it('skips empty values and encodes the rest', () => {
    expect(buildQuery({ limit: 20, cursor: null, type: '', from: '2026-01-01' })).toBe(
      '?limit=20&from=2026-01-01',
    );
    expect(buildQuery({})).toBe('');
  });
});

describe('insertSorted', () => {
  it('places a new row among older ones by date, newest first', () => {
    const list = [t({ id: 'a', date: '2026-11-09' }), t({ id: 'b', date: '2026-11-01' })];
    expect(insertSorted(list, t({ id: 'n', date: '2026-11-05' })).map((x) => x.id)).toEqual([
      'a',
      'n',
      'b',
    ]);
    expect(insertSorted(list, t({ id: 'n', date: '2026-12-01' }))[0]!.id).toBe('n');
    expect(insertSorted(list, t({ id: 'n', date: '2025-01-01' })).at(-1)!.id).toBe('n');
  });
});

describe('date helpers', () => {
  it('formats local dates with zero padding', () =>
    expect(toDateString(new Date(2026, 0, 5))).toBe('2026-01-05'));
  it('gives the first and last day of a month, including leap February', () => {
    expect(monthRange(new Date(2026, 10, 9))).toEqual({ from: '2026-11-01', to: '2026-11-30' });
    expect(monthRange(new Date(2028, 1, 10))).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });
  it('labels a year-month', () => expect(monthLabel('2026-11')).toBe('Nov'));
});
