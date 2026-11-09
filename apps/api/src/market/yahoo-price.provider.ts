import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PriceProvider, type Quote } from './price-provider';

interface ChartMeta {
  symbol: string;
  currency?: string;
  regularMarketPrice?: number;
  chartPreviousClose?: number;
  previousClose?: number;
}

const ENDPOINT = 'https://query1.finance.yahoo.com/v8/finance/chart';
const CONCURRENCY = 5;
const TIMEOUT_MS = 8_000;

/**
 * Yahoo's public chart endpoint (the one behind the yahoo-finance2 package), called with plain
 * fetch to avoid another dependency. It is unofficial and can rate-limit or change without notice,
 * so every failure degrades to "no quote" and callers fall back to the last stored price.
 */
@Injectable()
export class YahooPriceProvider extends PriceProvider {
  private readonly logger = new Logger(YahooPriceProvider.name);

  async quote(symbols: string[]): Promise<Map<string, Quote>> {
    const out = new Map<string, Quote>();
    for (let i = 0; i < symbols.length; i += CONCURRENCY) {
      const batch = symbols.slice(i, i + CONCURRENCY);
      const results = await Promise.all(batch.map((s) => this.one(s)));
      results.forEach((q, idx) => q && out.set(batch[idx]!, q));
    }
    return out;
  }

  private async one(symbol: string): Promise<Quote | null> {
    try {
      const res = await fetch(`${ENDPOINT}/${encodeURIComponent(symbol)}?range=1d&interval=1d`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { chart?: { result?: Array<{ meta?: ChartMeta }> } };
      const meta = body.chart?.result?.[0]?.meta;
      if (!meta?.regularMarketPrice || !meta.currency) return null;
      const prev = meta.chartPreviousClose ?? meta.previousClose;
      return {
        symbol,
        price: new Prisma.Decimal(meta.regularMarketPrice),
        previousClose: prev ? new Prisma.Decimal(prev) : null,
        currency: meta.currency,
      };
    } catch (e) {
      this.logger.warn(`Quote for ${symbol} failed: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }
  }
}
