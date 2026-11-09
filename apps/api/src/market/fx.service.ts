import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PriceProvider } from './price-provider';

/** Units of each currency per 1 USD. Only pegged currencies, which are safe to hard-code. */
const PEGGED_PER_USD: Record<string, string> = {
  USD: '1',
  AED: '3.6725',
  SAR: '3.75',
  QAR: '3.64',
  BHD: '0.376',
  OMR: '0.3845',
};

const TTL_MS = 60 * 60 * 1000;

@Injectable()
export class FxService {
  private readonly cache = new Map<string, { rate: Prisma.Decimal; at: number }>();

  constructor(private readonly prices: PriceProvider) {}

  /** How many `to` you get for 1 `from`. Live rate if available, pegged fallback otherwise. */
  async rate(from: string, to: string): Promise<Prisma.Decimal> {
    if (from === to) return new Prisma.Decimal(1);

    const key = `${from}${to}`;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.rate;

    const live = (await this.prices.quote([`${from}${to}=X`])).get(`${from}${to}=X`);
    if (live) {
      this.cache.set(key, { rate: live.price, at: Date.now() });
      return live.price;
    }

    const a = PEGGED_PER_USD[from];
    const b = PEGGED_PER_USD[to];
    if (a && b) return new Prisma.Decimal(b).div(a);
    if (hit) return hit.rate; // stale beats nothing
    throw new ServiceUnavailableException(
      `Exchange rate ${from} to ${to} is unavailable right now`,
    );
  }

  async convert(
    amount: Prisma.Decimal | number | string,
    from: string,
    to: string,
  ): Promise<Prisma.Decimal> {
    return new Prisma.Decimal(amount).mul(await this.rate(from, to));
  }
}
