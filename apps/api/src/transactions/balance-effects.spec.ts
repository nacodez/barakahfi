import { Prisma } from '../generated/prisma/client';
import { balanceEffects } from './balance-effects';

const D = (v: string) => new Prisma.Decimal(v);
const entry = (over: Partial<Parameters<typeof balanceEffects>[0]> = {}) => ({
  type: 'EXPENSE' as const,
  accountId: 'a',
  transferAccountId: null,
  amount: D('10.50'),
  ...over,
});

describe('balanceEffects', () => {
  it('income adds to the account', () => {
    const [e] = balanceEffects(entry({ type: 'INCOME' }));
    expect(e!.accountId).toBe('a');
    expect(e!.delta.toFixed(2)).toBe('10.50');
  });

  it('expense subtracts from the account', () => {
    const [e] = balanceEffects(entry());
    expect(e!.delta.toFixed(2)).toBe('-10.50');
  });

  it('transfer moves money between two accounts and nets to zero', () => {
    const effects = balanceEffects(entry({ type: 'TRANSFER', transferAccountId: 'b' }));
    expect(effects.map((e) => [e.accountId, e.delta.toFixed(2)])).toEqual([
      ['a', '-10.50'],
      ['b', '10.50'],
    ]);
    expect(effects.reduce((sum, e) => sum.plus(e.delta), D('0')).isZero()).toBe(true);
  });

  it('refuses a transfer without a destination', () => {
    expect(() => balanceEffects(entry({ type: 'TRANSFER' }))).toThrow();
  });

  it('avoids float drift on decimal amounts (0.1 + 0.2)', () => {
    const total = [D('0.1'), D('0.2')].reduce((s, v) => s.plus(v), D('0'));
    expect(total.toFixed(2)).toBe('0.30');
  });
});
