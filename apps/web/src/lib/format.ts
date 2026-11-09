/** 0.0123 -> "1.2%". Ratios in the API are fractions. */
export function formatPercent(fraction: number, digits = 1): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

/** A plain percentage that is already ×100 (e.g. gain 25 -> "+25.0%"). */
export function formatSignedPercent(percent: number, digits = 1): string {
  return `${percent > 0 ? '+' : ''}${percent.toFixed(digits)}%`;
}

/** "5200000000000" -> "$5.2T". Approximate by design: market caps are estimates. */
export function formatMarketCap(usd: string | null): string {
  if (usd === null) return '—';
  const n = Number(usd);
  const units: Array<[number, string]> = [
    [1e12, 'T'],
    [1e9, 'B'],
    [1e6, 'M'],
  ];
  for (const [size, suffix] of units) {
    if (n >= size) return `$${(n / size).toFixed(n / size >= 100 ? 0 : 1)}${suffix}`;
  }
  return `$${Math.round(n).toLocaleString('en')}`;
}

/** Quantities and prices: no trailing zeros, thousands separators on the integer part. */
export function formatNumber(value: string, maxDecimals = 6): string {
  const n = Number(value);
  return n.toLocaleString('en', { maximumFractionDigits: maxDecimals });
}
