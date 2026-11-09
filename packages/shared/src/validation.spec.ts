import { describe, expect, it } from 'vitest';
import { createAccountSchema, registerSchema } from './validation';

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
