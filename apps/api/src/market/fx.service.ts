import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { CacheService, LAST_KNOWN_TTL_SECONDS } from '../cache/cache.service';
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

const TTL_MS = 60 * 60 * 1000; // how long a rate counts as fresh

interface CachedRate {
  rate: string;
  at: number;
}

@Injectable()
export class FxService {
  constructor(
    private readonly prices: PriceProvider,
    private readonly cache: CacheService,
  ) {}

  /** How many `to` you get for 1 `from`. Live rate if available, pegged fallback otherwise. */
  async rate(from: string, to: string): Promise<Prisma.Decimal> {
    if (from === to) return new Prisma.Decimal(1);

    const key = `fx:${from}:${to}`;
    const hit = await this.cache.get<CachedRate>(key);
    if (hit && Date.now() - hit.at < TTL_MS) return new Prisma.Decimal(hit.rate);

    const live = (await this.prices.quote([`${from}${to}=X`])).get(`${from}${to}=X`);
    if (live) {
      await this.cache.set(
        key,
        { rate: live.price.toString(), at: Date.now() },
        LAST_KNOWN_TTL_SECONDS,
      );
      return live.price;
    }

    const a = PEGGED_PER_USD[from];
    const b = PEGGED_PER_USD[to];
    if (a && b) return new Prisma.Decimal(b).div(a);
    if (hit) return new Prisma.Decimal(hit.rate); // stale beats nothing
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
