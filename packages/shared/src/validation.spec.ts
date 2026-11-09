import { describe, expect, it } from 'vitest';
import { createAccountSchema, createTransactionSchema, registerSchema } from './validation';
import { budgetStatus } from './budget-status';

describe('registerSchema', () => {
  it('normalises email and accepts a strong password', () => {
    const r = registerSchema.parse({ name: ' Nazik ', email: 'A@B.COM', password: 'Barakah123' });
    expect(r).toEqual({ name: 'Nazik', email: 'a@b.com', password: 'Barakah123' });
  });

  it.each(['short1A', 'nouppercase1', 'NoDigitsHere'])('rejects weak password %s', (password) => {
    expect(registerSchema.safeParse({ name: 'N', email: 'a@b.com', password }).success).toBe(false);
  });
});

describe('createAccountSchema', () => {
  const base = { name: 'ADCB Savings', type: 'BANK', currency: 'AED' } as const;

  it('accepts a 2-dp decimal string', () => {
    expect(createAccountSchema.parse({ ...base, balance: '1250.50' }).isZakatable).toBe(true);
  });

  it.each(['1.234', '1e5', 'abc', '12345678901234'])('rejects balance %s', (balance) => {
    expect(createAccountSchema.safeParse({ ...base, balance }).success).toBe(false);
  });
});

describe('createTransactionSchema', () => {
  const a = '3f1c2b1e-0000-4000-8000-000000000001';
  const b = '3f1c2b1e-0000-4000-8000-000000000002';
  const base = { type: 'EXPENSE', accountId: a, amount: '12.50', date: '2026-11-09' } as const;

  it('accepts a normal expense and defaults the description', () => {
    expect(createTransactionSchema.parse(base).description).toBe('');
  });

  it.each(['0', '0.00', '-5', '1.234', 'abc', '12345678901234'])('rejects amount %s', (amount) => {
    expect(createTransactionSchema.safeParse({ ...base, amount }).success).toBe(false);
  });

  it.each(['2026-02-31', '2026-13-01', '09/11/2026'])('rejects date %s', (date) => {
    expect(createTransactionSchema.safeParse({ ...base, date }).success).toBe(false);
  });

  it('requires a different destination for transfers and forbids a category', () => {
    const t = { ...base, type: 'TRANSFER' } as const;
    expect(createTransactionSchema.safeParse(t).success).toBe(false);
    expect(createTransactionSchema.safeParse({ ...t, transferAccountId: a }).success).toBe(false);
    expect(createTransactionSchema.safeParse({ ...t, transferAccountId: b }).success).toBe(true);
    expect(
      createTransactionSchema.safeParse({ ...t, transferAccountId: b, categoryId: a }).success,
    ).toBe(false);
  });

  it('forbids a destination on non-transfers', () => {
    expect(createTransactionSchema.safeParse({ ...base, transferAccountId: b }).success).toBe(
      false,
    );
  });
});

describe('budgetStatus', () => {
  it.each([
    [0, 'ON_TRACK'],
    [74.9, 'ON_TRACK'],
    [75, 'WARNING'],
    [90, 'WARNING'],
    [90.1, 'OVER'],
    [250, 'OVER'],
  ])('%s%% -> %s', (percent, expected) => expect(budgetStatus(percent)).toBe(expected));
});
