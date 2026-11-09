import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PriceTickDto } from '@barakahfi/shared';
import type { Env } from '../config/env';
import { PriceProvider } from '../market/price-provider';
import { PrismaService } from '../prisma/prisma.service';
import { isMarketOpen } from './market-hours';
import { RealtimeGateway } from './realtime.gateway';

@Injectable()
export class PriceTicker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PriceTicker.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: PriceProvider,
    private readonly gateway: RealtimeGateway,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onModuleInit(): void {
    if (!this.config.get('PRICE_TICKER_ENABLED', { infer: true })) return;
    const every = this.config.get('PRICE_TICK_SECONDS', { infer: true }) * 1000;
    this.timer = setInterval(() => void this.tick(), every);
    this.timer.unref(); // never keeps the process alive on its own
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /**
   * One refresh cycle. Only fetches prices for stocks held by users who are connected right now,
   * and only on exchanges that are open (unless `force`). Each user receives just their own
   * holdings. Returns how many prices changed hands, which keeps it easy to test.
   */
  async tick(options: { force?: boolean; now?: Date } = {}): Promise<number> {
    if (this.running) return 0; // never overlap with a slow previous cycle
    this.running = true;
    try {
      const userIds = this.gateway.connectedUserIds();
      if (userIds.length === 0) return 0;

      const holdings = await this.prisma.holding.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, asset: { select: { symbol: true, exchange: true } } },
      });
      const open = new Set(
        holdings
          .map((h) => h.asset)
          .filter((a) => options.force || isMarketOpen(a.exchange, options.now))
          .map((a) => a.symbol),
      );
      if (open.size === 0) return 0;

      const quotes = await this.provider.quote([...open]);
      const at = new Date();
      const ticks = new Map<string, PriceTickDto>();
      for (const [symbol, q] of quotes) {
        const asset = await this.prisma.asset.update({
          where: { symbol },
          data: {
            currentPrice: q.price,
            ...(q.previousClose && { previousClose: q.previousClose }),
            lastUpdated: at,
          },
        });
        ticks.set(symbol, {
          symbol,
          price: asset.currentPrice.toFixed(),
          previousClose: asset.previousClose?.toFixed() ?? null,
          currency: asset.currency,
          at: at.toISOString(),
        });
      }

      for (const userId of userIds) {
        const mine = holdings
          .filter((h) => h.userId === userId)
          .map((h) => ticks.get(h.asset.symbol))
          .filter((t): t is PriceTickDto => !!t);
        if (mine.length > 0) this.gateway.emitPrices(userId, { prices: mine });
      }
      return ticks.size;
    } catch (e) {
      this.logger.warn(`Price refresh failed: ${e instanceof Error ? e.message : String(e)}`);
      return 0;
    } finally {
      this.running = false;
    }
  }
}
