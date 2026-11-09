import { describe, expect, it } from 'vitest';
import { formatMarketCap, formatNumber, formatPercent, formatSignedPercent } from './format';

describe('format', () => {
  it('formats fractions as percentages', () => {
    expect(formatPercent(0.0123)).toBe('1.2%');
    expect(formatPercent(0.3)).toBe('30.0%');
    expect(formatPercent(0.0475, 2)).toBe('4.75%');
  });

  it('signs gains but not losses twice', () => {
    expect(formatSignedPercent(25)).toBe('+25.0%');
    expect(formatSignedPercent(-3.456)).toBe('-3.5%');
    expect(formatSignedPercent(0)).toBe('0.0%');
  });

  it('abbreviates market caps', () => {
    expect(formatMarketCap('5180000000000')).toBe('$5.2T');
    expect(formatMarketCap('415000000000')).toBe('$415B');
    expect(formatMarketCap('12800000000')).toBe('$12.8B');
    expect(formatMarketCap('950000000')).toBe('$950M');
    expect(formatMarketCap('12345')).toBe('$12,345');
    expect(formatMarketCap(null)).toBe('—');
  });

  it('keeps quantities readable', () => {
    expect(formatNumber('1500.250000')).toBe('1,500.25');
    expect(formatNumber('10')).toBe('10');
    expect(formatNumber('0.123456789', 6)).toBe('0.123457');
  });
});
