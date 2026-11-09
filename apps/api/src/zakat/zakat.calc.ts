import { D, type DecimalLike } from '../common/decimal.util';
import { Prisma } from '../generated/prisma/client';

export interface ZakatMath {
  assetsTotal: Prisma.Decimal;
  netWealth: Prisma.Decimal;
  meetsNisab: boolean;
  zakatDue: Prisma.Decimal;
}

/**
 * Zakat is due on net wealth (assets minus debts due within the year) once it REACHES the nisab,
 * at 2.5%. Below the nisab nothing is due. Wealth never goes below zero, and the result is
 * rounded to cents (half up).
 */
export function computeZakat(input: {
  assets: DecimalLike[];
  liabilities: DecimalLike;
  nisab: DecimalLike;
  rate: DecimalLike;
}): ZakatMath {
  const assetsTotal = input.assets.reduce<Prisma.Decimal>((sum, a) => sum.plus(a), D(0));
  const net = assetsTotal.minus(input.liabilities);
  const netWealth = net.isNegative() ? D(0) : net;
  const meetsNisab = netWealth.gt(0) && netWealth.gte(input.nisab);
  const zakatDue = meetsNisab
    ? netWealth.mul(input.rate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
    : D(0);
  return { assetsTotal, netWealth, meetsNisab, zakatDue };
}
