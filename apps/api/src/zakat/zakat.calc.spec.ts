import { computeZakat } from './zakat.calc';
import { hawl, hijriYear } from './hijri.util';

const calc = (over: Partial<Parameters<typeof computeZakat>[0]> = {}) =>
  computeZakat({ assets: ['10000'], liabilities: '0', nisab: '5000', rate: '0.025', ...over });

describe('computeZakat', () => {
  it('is 2.5% of net wealth once the nisab is reached', () => {
    const r = calc();
    expect(r.meetsNisab).toBe(true);
    expect(r.zakatDue.toFixed(2)).toBe('250.00');
    expect(r.netWealth.toFixed(2)).toBe('10000.00');
  });

  it('is zero below the nisab', () => {
    const r = calc({ assets: ['4999.99'] });
    expect(r.meetsNisab).toBe(false);
    expect(r.zakatDue.isZero()).toBe(true);
  });

  it('is due when wealth EQUALS the nisab (reaching it is enough)', () => {
    const r = calc({ assets: ['5000'] });
    expect(r.meetsNisab).toBe(true);
    expect(r.zakatDue.toFixed(2)).toBe('125.00');
  });

  it('sums every asset and deducts liabilities before testing the nisab', () => {
    const r = calc({ assets: ['3000', '2500.50', '1000'], liabilities: '1500.50' });
    expect(r.assetsTotal.toFixed(2)).toBe('6500.50');
    expect(r.netWealth.toFixed(2)).toBe('5000.00');
    expect(r.zakatDue.toFixed(2)).toBe('125.00');
  });

  it('liabilities can push a rich person under the nisab', () => {
    expect(calc({ assets: ['10000'], liabilities: '6000' }).meetsNisab).toBe(false);
  });

  it('never goes negative when debts exceed assets', () => {
    const r = calc({ assets: ['100'], liabilities: '900' });
    expect(r.netWealth.toFixed(2)).toBe('0.00');
    expect(r.zakatDue.toFixed(2)).toBe('0.00');
    expect(r.meetsNisab).toBe(false);
  });

  it('handles no assets at all (and a zero nisab does not make nothing zakatable)', () => {
    const r = calc({ assets: [], nisab: '0' });
    expect(r.meetsNisab).toBe(false);
    expect(r.zakatDue.isZero()).toBe(true);
  });

  it('rounds to cents, half up', () => {
    expect(calc({ assets: ['5000.20'] }).zakatDue.toFixed(2)).toBe('125.01'); // 125.005
    expect(calc({ assets: ['5000.19'] }).zakatDue.toFixed(2)).toBe('125.00'); // 125.00475
  });

  it('has no float drift (0.1 + 0.2 style sums)', () => {
    expect(calc({ assets: ['0.1', '0.2'], nisab: '0.3' }).assetsTotal.toFixed(2)).toBe('0.30');
  });

  it('uses whichever nisab it is given (gold vs silver changes the outcome)', () => {
    const wealth = { assets: ['40000'] };
    expect(calc({ ...wealth, nisab: '35000' }).meetsNisab).toBe(true); // lower, silver-based
    expect(calc({ ...wealth, nisab: '50000' }).meetsNisab).toBe(false); // higher, gold-based
  });
});

describe('hijriYear', () => {
  it('returns the Umm al-Qura year', () => {
    expect(hijriYear(new Date('2026-11-09T00:00:00Z'))).toBe(1448);
    expect(hijriYear(new Date('2025-03-01T00:00:00Z'))).toBe(1446);
  });

  it('rolls over at the Islamic new year', () => {
    expect(hijriYear(new Date('2025-06-25T00:00:00Z'))).toBe(1446);
    expect(hijriYear(new Date('2025-06-28T00:00:00Z'))).toBe(1447);
  });
});

describe('hawl', () => {
  const day = (s: string) => new Date(`${s}T00:00:00Z`);

  it('is null when no start date is set', () => {
    expect(hawl(null, day('2026-11-09'))).toBeNull();
  });

  it('ends 354 days after the start and counts the days left', () => {
    const h = hawl(day('2026-01-01'), day('2026-11-09'))!;
    expect(h.end.toISOString().slice(0, 10)).toBe('2026-12-21');
    expect(h.daysRemaining).toBe(42);
  });

  it('goes negative once the year has completed', () => {
    expect(hawl(day('2025-01-01'), day('2026-11-09'))!.daysRemaining).toBeLessThan(0);
  });
});
