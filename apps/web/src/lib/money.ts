/**
 * The API sends money as decimal strings ("1250.50"). Sum in integer cents (BigInt)
 * so totals never pick up floating-point error; convert to Number only to display.
 */
export function toCents(amount: string): bigint {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(amount);
  if (!match) throw new Error(`Invalid money string: ${amount}`);
  const [, sign, whole, frac = ''] = match;
  const cents = BigInt(whole!) * 100n + BigInt(frac.padEnd(2, '0'));
  return sign === '-' ? -cents : cents;
}

export function formatCents(cents: bigint, currency: string): string {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).format(Number(cents) / 100);
}

export function totalsByCurrency(items: Array<{ balance: string; currency: string }>) {
  const totals = new Map<string, bigint>();
  for (const { balance, currency } of items) {
    totals.set(currency, (totals.get(currency) ?? 0n) + toCents(balance));
  }
  return [...totals.entries()].map(([currency, cents]) => ({ currency, cents }));
}
