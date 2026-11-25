import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { CacheService, LAST_KNOWN_TTL_SECONDS } from '../cache/cache.service';
import { FxService } from './fx.service';
import { PriceProvider } from './price-provider';

const GRAMS_PER_TROY_OUNCE = new Prisma.Decimal('31.1034768');
const TTL_MS = 10 * 60 * 1000; // how long a price counts as fresh
const SYMBOL = { gold: 'GC=F', silver: 'SI=F' } as const;

export type Metal = keyof typeof SYMBOL;

interface CachedPrice {
  usdPerOunce: string;
  at: number;
}

export interface MetalPrice {
  /** Price of one gram in the requested currency. */
  perGram: Prisma.Decimal;
  asOf: Date;
  /** "live" if fetched just now, "cached" if the last known price had to be reused. */
  source: 'live' | 'cached';
}

@Injectable()
export class MetalsService {
  constructor(
    private readonly prices: PriceProvider,
    private readonly fx: FxService,
    private readonly cache: CacheService,
  ) {}

  async perGram(metal: Metal, currency: string): Promise<MetalPrice> {
    const { usdPerOunce, at, source } = await this.usdPerOunce(metal);
    const usdPerGram = usdPerOunce.div(GRAMS_PER_TROY_OUNCE);
    return {
      perGram: await this.fx.convert(usdPerGram, 'USD', currency),
      asOf: new Date(at),
      source,
    };
  }

  private async usdPerOunce(metal: Metal) {
    const key = `metal:${metal}`;
    const hit = await this.cache.get<CachedPrice>(key);
    if (hit && Date.now() - hit.at < TTL_MS) return this.result(hit, 'live');

    const quote = (await this.prices.quote([SYMBOL[metal]])).get(SYMBOL[metal]);
    if (quote) {
      const fresh = { usdPerOunce: quote.price.toString(), at: Date.now() };
      await this.cache.set(key, fresh, LAST_KNOWN_TTL_SECONDS);
      return this.result(fresh, 'live');
    }
    if (hit) return this.result(hit, 'cached');
    throw new ServiceUnavailableException(`The ${metal} price is unavailable right now`);
  }

  private result(entry: CachedPrice, source: 'live' | 'cached') {
    return { usdPerOunce: new Prisma.Decimal(entry.usdPerOunce), at: entry.at, source };
  }
}
