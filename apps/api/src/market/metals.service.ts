import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { FxService } from './fx.service';
import { PriceProvider } from './price-provider';

const GRAMS_PER_TROY_OUNCE = new Prisma.Decimal('31.1034768');
const TTL_MS = 10 * 60 * 1000;
const SYMBOL = { gold: 'GC=F', silver: 'SI=F' } as const;

export type Metal = keyof typeof SYMBOL;

export interface MetalPrice {
  /** Price of one gram in the requested currency. */
  perGram: Prisma.Decimal;
  asOf: Date;
  /** "live" if fetched just now, "cached" if the last known price had to be reused. */
  source: 'live' | 'cached';
}

@Injectable()
export class MetalsService {
  private readonly cache = new Map<Metal, { usdPerOunce: Prisma.Decimal; at: number }>();

  constructor(
    private readonly prices: PriceProvider,
    private readonly fx: FxService,
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
    const hit = this.cache.get(metal);
    if (hit && Date.now() - hit.at < TTL_MS) return { ...hit, source: 'live' as const };

    const quote = (await this.prices.quote([SYMBOL[metal]])).get(SYMBOL[metal]);
    if (quote) {
      const fresh = { usdPerOunce: quote.price, at: Date.now() };
      this.cache.set(metal, fresh);
      return { ...fresh, source: 'live' as const };
    }
    if (hit) return { ...hit, source: 'cached' as const };
    throw new ServiceUnavailableException(`The ${metal} price is unavailable right now`);
  }
}
