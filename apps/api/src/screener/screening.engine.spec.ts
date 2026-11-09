import { purificationAmount, screen, type ScreeningInput } from './screening.engine';

const ok: ScreeningInput = {
  primaryActivity: 'PERMISSIBLE',
  debtRatio: '0.10',
  cashRatio: '0.05',
  receivablesRatio: '0.20',
  haramRevenueRatio: '0.01',
};
const run = (over: Partial<ScreeningInput> = {}) => screen({ ...ok, ...over });
const check = (r: ReturnType<typeof run>, key: string) => r.checks.find((c) => c.key === key)!;

describe('screen: verdicts', () => {
  it('passes a clean company', () => {
    expect(run().status).toBe('COMPLIANT');
  });

  it('a prohibited main business is non-compliant whatever the ratios say', () => {
    const r = run({
      primaryActivity: 'PROHIBITED',
      prohibitedReason: 'alcohol',
      debtRatio: '0',
      haramRevenueRatio: '0',
    });
    expect(r.status).toBe('NON_COMPLIANT');
    expect(r.explanation).toContain('alcohol');
    expect(check(r, 'BUSINESS_ACTIVITY')).toMatchObject({ passed: false, note: 'alcohol' });
  });

  it.each([
    ['debtRatio', '0.31', 'DEBT'],
    ['cashRatio', '0.31', 'CASH'],
    ['receivablesRatio', '0.70', 'RECEIVABLES'],
    ['haramRevenueRatio', '0.06', 'HARAM_REVENUE'],
  ] as const)('fails when %s is over its limit', (field, value, key) => {
    const r = run({ [field]: value });
    expect(r.status).toBe('NON_COMPLIANT');
    expect(check(r, key).passed).toBe(false);
  });

  it('limits are strict: exactly at the limit fails ("under 30%", "under 5%")', () => {
    expect(run({ debtRatio: '0.30' }).status).toBe('NON_COMPLIANT');
    expect(run({ haramRevenueRatio: '0.05' }).status).toBe('NON_COMPLIANT');
    expect(run({ receivablesRatio: '0.67' }).status).toBe('NON_COMPLIANT');
  });

  it('reports every failing screen, not just the first', () => {
    const r = run({ debtRatio: '0.5', cashRatio: '0.5' });
    expect(r.checks.filter((c) => c.passed === false).map((c) => c.key)).toEqual(['DEBT', 'CASH']);
  });
});

describe('screen: doubtful', () => {
  it('is doubtful when a ratio is within 10% of its limit (>= 90% of it)', () => {
    expect(run({ debtRatio: '0.27' }).status).toBe('DOUBTFUL');
    expect(run({ debtRatio: '0.2699' }).status).toBe('COMPLIANT');
    expect(run({ haramRevenueRatio: '0.045' }).status).toBe('DOUBTFUL');
  });

  it('is doubtful when a figure is missing, and says so', () => {
    const r = run({ receivablesRatio: null });
    expect(r.status).toBe('DOUBTFUL');
    expect(check(r, 'RECEIVABLES')).toMatchObject({ passed: null, value: null });
    expect(r.explanation).toContain('no data');
  });

  it('a failure outranks a missing figure', () => {
    expect(run({ receivablesRatio: null, debtRatio: '0.4' }).status).toBe('NON_COMPLIANT');
  });
});

describe('screen: purification', () => {
  it('equals the non-compliant revenue share for compliant stocks', () => {
    const r = run({ haramRevenueRatio: '0.03' });
    expect(r.purificationPercent.toFixed(4)).toBe('0.0300');
    expect(r.explanation).toContain('Donate 3.0% of dividends');
  });

  it('is zero for non-compliant stocks (the advice is to divest, not to purify)', () => {
    expect(run({ debtRatio: '0.5', haramRevenueRatio: '0.03' }).purificationPercent.isZero()).toBe(
      true,
    );
  });

  it('is zero when there is no non-compliant revenue, and nothing is added to the explanation', () => {
    const r = run({ haramRevenueRatio: '0' });
    expect(r.purificationPercent.isZero()).toBe(true);
    expect(r.explanation).not.toContain('Donate');
  });
});

describe('purificationAmount', () => {
  it('3% of 100 in dividends is 3.00 (the spec example)', () => {
    expect(purificationAmount('100', '0.03').toFixed(2)).toBe('3.00');
  });

  it('rounds half up to cents', () => {
    expect(purificationAmount('10.50', '0.0123').toFixed(2)).toBe('0.13'); // 0.12915
    expect(purificationAmount('0.50', '0.01').toFixed(2)).toBe('0.01'); // 0.005 rounds up
  });

  it('handles zero dividends', () => {
    expect(purificationAmount('0', '0.04').toFixed(2)).toBe('0.00');
  });
});
