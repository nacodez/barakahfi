import { ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { FxService } from './fx.service';
import { MetalsService } from './metals.service';
import { PriceProvider, type Quote } from './price-provider';

class FakeProvider extends PriceProvider {
  calls = 0;
  constructor(private data: Record<string, number> = {}) {
    super();
  }
  set(data: Record<string, number>) {
    this.data = data;
  }
  quote(symbols: string[]): Promise<Map<string, Quote>> {
    this.calls++;
    const m = new Map<string, Quote>();
    for (const s of symbols) {
      const price = this.data[s];
      if (price !== undefined)
        m.set(s, {
          symbol: s,
          price: new Prisma.Decimal(price),
          previousClose: null,
          currency: 'USD',
        });
    }
    return Promise.resolve(m);
  }
}

describe('FxService', () => {
  it('is 1 for the same currency and never calls the provider', async () => {
    const p = new FakeProvider();
    expect((await new FxService(p).rate('AED', 'AED')).toNumber()).toBe(1);
    expect(p.calls).toBe(0);
  });

  it('uses the live rate and caches it', async () => {
    const p = new FakeProvider({ 'USDAED=X': 3.67 });
    const fx = new FxService(p);
    expect((await fx.rate('USD', 'AED')).toNumber()).toBe(3.67);
    await fx.rate('USD', 'AED');
    expect(p.calls).toBe(1);
  });

  it('falls back to the peg when the provider has nothing', async () => {
    const fx = new FxService(new FakeProvider());
    expect((await fx.rate('USD', 'AED')).toFixed(4)).toBe('3.6725');
    expect((await fx.rate('AED', 'USD')).toFixed(4)).toBe('0.2723');
    expect((await fx.rate('SAR', 'AED')).toFixed(4)).toBe('0.9793'); // cross via USD
  });

  it('fails clearly for an unpegged currency with no live rate', async () => {
    await expect(new FxService(new FakeProvider()).rate('USD', 'EUR')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('converts amounts', async () => {
    const fx = new FxService(new FakeProvider());
    expect((await fx.convert('100', 'USD', 'AED')).toFixed(2)).toBe('367.25');
  });
});

describe('MetalsService', () => {
  it('converts USD per troy ounce to price per gram in the requested currency', async () => {
    const m = new MetalsService(
      new FakeProvider({ 'GC=F': 3110.34768 }),
      new FxService(new FakeProvider()),
    );
    const usd = await m.perGram('gold', 'USD');
    expect(usd.perGram.toFixed(2)).toBe('100.00'); // 3110.34768 oz-price / 31.1034768 g
    expect(usd.source).toBe('live');
    expect((await m.perGram('gold', 'AED')).perGram.toFixed(2)).toBe('367.25');
  });

  it('reuses the last known price (flagged as cached) when the provider fails later', async () => {
    const provider = new FakeProvider({ 'SI=F': 50 });
    const m = new MetalsService(provider, new FxService(provider));
    await m.perGram('silver', 'USD');
    // expire the cache entry, then let the provider fail
    (m as unknown as { cache: Map<string, { at: number }> }).cache.get('silver')!.at =
      Date.now() - 11 * 60_000;
    provider.set({});
    const r = await m.perGram('silver', 'USD');
    expect(r.source).toBe('cached');
    expect(r.perGram.toFixed(4)).toBe((50 / 31.1034768).toFixed(4));
  });

  it('errors when there is no price and nothing cached', async () => {
    const m = new MetalsService(new FakeProvider(), new FxService(new FakeProvider()));
    await expect(m.perGram('gold', 'USD')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
