import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { Prisma } from '../src/generated/prisma/client';
import { PriceProvider, type Quote } from '../src/market/price-provider';
import { PrismaService } from '../src/prisma/prisma.service';
import { FinancialDataProvider } from '../src/screener/financial-data.provider';
import type { ScreeningInput } from '../src/screener/screening.engine';

// Rate limiting has its own spec (throttle.e2e-spec.ts); here it would only make logins flaky.
process.env.THROTTLE_DISABLED = 'true';

export const PASSWORD = 'Barakah123';
export type Agent = ReturnType<typeof request.agent>;

/** Controllable stand-in for the live price feed: tests decide exactly what the market "says". */
export class FakePriceProvider extends PriceProvider {
  readonly data = new Map<string, Quote>();
  calls = 0;

  set(symbol: string, price: number, previousClose: number | null = null, currency = 'USD'): void {
    this.data.set(symbol, {
      symbol,
      price: new Prisma.Decimal(price),
      previousClose: previousClose === null ? null : new Prisma.Decimal(previousClose),
      currency,
    });
  }

  quote(symbols: string[]): Promise<Map<string, Quote>> {
    this.calls++;
    const out = new Map<string, Quote>();
    for (const s of symbols) {
      const q = this.data.get(s);
      if (q) out.set(s, q);
    }
    return Promise.resolve(out);
  }
}

/** Lets a test pretend the screening data source returned new figures for a stock. */
export class FakeFinancialData extends FinancialDataProvider {
  readonly overrides = new Map<string, Partial<ScreeningInput>>();

  fetch(asset: { symbol: string }, stored: ScreeningInput): Promise<ScreeningInput> {
    return Promise.resolve({ ...stored, ...this.overrides.get(asset.symbol) });
  }
}

export interface TestContext {
  app: INestApplication;
  server: App;
  prisma: PrismaService;
  prices: FakePriceProvider;
  financial: FakeFinancialData;
  run: string;
  newUser: (label?: string) => Promise<{ agent: Agent; id: string; email: string }>;
  /** Creates a throwaway stock (with a COMPLIANT screening) that is removed again in `close()`. */
  makeAsset: (
    suffix: string,
    opts?: Partial<{
      price: number;
      previousClose: number;
      currency: string;
      exchange: string;
      purification: number;
      sector: string;
    }>,
  ) => Promise<{ id: string; symbol: string }>;
  close: () => Promise<void>;
}

/** Boots the real app (same pipeline as production) with the price feed and data source faked. */
export async function createContext(options: { listen?: boolean } = {}): Promise<TestContext> {
  const prices = new FakePriceProvider();
  const financial = new FakeFinancialData();

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PriceProvider)
    .useValue(prices)
    .overrideProvider(FinancialDataProvider)
    .useValue(financial)
    .compile();

  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  if (options.listen) await app.listen(0);

  const prisma = app.get(PrismaService);
  const server = app.getHttpServer() as App;
  // Unique per context: test files run in parallel against one database, and cleanup is by prefix.
  const run = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  let n = 0;

  return {
    app,
    server,
    prisma,
    prices,
    financial,
    run,

    async newUser(label = 'u') {
      const agent = request.agent(server);
      const email = `p3-${run}-${label}-${n++}@test.barakahfi.dev`;
      const res = await agent
        .post('/api/v1/auth/register')
        .send({ name: 'Phase3 Tester', email, password: PASSWORD })
        .expect(201);
      return { agent, id: (res.body as { data: { id: string } }).data.id, email };
    },

    async makeAsset(suffix, opts = {}) {
      const symbol = `E${run}${suffix}`.toUpperCase().slice(0, 20);
      const asset = await prisma.asset.create({
        data: {
          symbol,
          name: `E2E ${suffix}`,
          type: 'STOCK',
          exchange: opts.exchange ?? 'NASDAQ',
          sector: opts.sector ?? 'E2E',
          marketCap: new Prisma.Decimal(1_000_000_000),
          currentPrice: new Prisma.Decimal(opts.price ?? 100),
          previousClose: new Prisma.Decimal(opts.previousClose ?? 95),
          currency: opts.currency ?? 'USD',
        },
      });
      await prisma.screeningResult.create({
        data: {
          assetId: asset.id,
          complianceStatus: 'COMPLIANT',
          debtRatio: new Prisma.Decimal('0.10'),
          cashRatio: new Prisma.Decimal('0.05'),
          receivablesRatio: new Prisma.Decimal('0.20'),
          revenueScreening: {
            haramRevenueRatio: '0.0300',
            sources: ['interest income'],
            primaryActivity: 'PERMISSIBLE',
          },
          purificationPercent: new Prisma.Decimal(opts.purification ?? '0.03'),
          source: 'e2e',
        },
      });
      return { id: asset.id, symbol };
    },

    async close() {
      // Users first (cascades holdings), then the throwaway assets.
      await prisma.user.deleteMany({ where: { email: { startsWith: `p3-${run}` } } });
      await prisma.asset.deleteMany({ where: { symbol: { startsWith: `E${run}`.toUpperCase() } } });
      await app.close();
    },
  };
}
