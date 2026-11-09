import request from 'supertest';
import { SCREENING_TTL_MS } from '../src/screener/screener.service';
import { createContext, type Agent, type TestContext } from './support';

describe('screener (e2e)', () => {
  let ctx: TestContext;
  let agent: Agent;

  beforeAll(async () => {
    ctx = await createContext();
    agent = (await ctx.newUser()).agent;
  });
  afterAll(() => ctx.close());

  const search = async (q: Record<string, string | number> = {}) => {
    const res = await agent.get('/api/v1/screener').query(q).expect(200);
    return res.body as {
      data: Array<{
        asset: { symbol: string; exchange: string; sector: string; marketCapUsd: string };
        status: string;
        isSample: boolean;
      }>;
      meta: { page: number; limit: number; total: number };
    };
  };

  it('requires a login', async () => {
    await ctx.newUser(); // ensure the app is warm, then try without cookies
    await request(ctx.server).get('/api/v1/screener').expect(401);
  });

  describe('search', () => {
    it('lists the seeded sample stocks with paging metadata', async () => {
      const r = await search({ limit: 10 });
      expect(r.data).toHaveLength(10);
      expect(r.meta).toMatchObject({ page: 1, limit: 10 });
      expect(r.meta.total).toBeGreaterThanOrEqual(60);
      expect(r.data.every((row) => row.isSample)).toBe(true);
    });

    it('pages without overlap', async () => {
      const a = await search({ limit: 5, page: 1 });
      const b = await search({ limit: 5, page: 2 });
      const overlap = a.data.filter((x) => b.data.some((y) => y.asset.symbol === x.asset.symbol));
      expect(overlap).toHaveLength(0);
      expect(b.meta.page).toBe(2);
    });

    it('matches a name or a ticker, case-insensitively', async () => {
      expect((await search({ q: 'apple' })).data.map((r) => r.asset.symbol)).toContain('AAPL');
      expect((await search({ q: 'aapl' })).data.map((r) => r.asset.symbol)).toEqual(['AAPL']);
    });

    it('treats % and _ as plain text, not wildcards', async () => {
      expect((await search({ q: '%' })).meta.total).toBe(0);
      expect((await search({ q: '_' })).meta.total).toBe(0);
    });

    it('filters by compliance status', async () => {
      const bad = (await search({ status: 'NON_COMPLIANT', limit: 50 })).data.map(
        (r) => r.asset.symbol,
      );
      expect(bad).toEqual(expect.arrayContaining(['JPM', 'BUD', 'MO', 'LVS', 'LMT']));
      expect(bad).not.toContain('AAPL');
      expect(
        (await search({ status: 'COMPLIANT', limit: 50 })).data.every(
          (r) => r.status === 'COMPLIANT',
        ),
      ).toBe(true);
    });

    it('filters by exchange and sector', async () => {
      const dfm = (await search({ exchange: 'DFM', limit: 50 })).data;
      expect(dfm.length).toBeGreaterThanOrEqual(5);
      expect(dfm.every((r) => r.asset.exchange === 'DFM')).toBe(true);
      const energy = (await search({ sector: 'Energy' })).data.map((r) => r.asset.symbol);
      expect(energy).toEqual(expect.arrayContaining(['XOM', 'CVX']));
    });

    it('filters by market cap range in US dollars (billions)', async () => {
      const mega = (await search({ minCapBn: 1000, limit: 50 })).data.map((r) => r.asset.symbol);
      expect(mega).toContain('AAPL');
      expect(mega).not.toContain('DFM.AE');
      const small = (await search({ maxCapBn: 20, limit: 50 })).data.map((r) => r.asset.symbol);
      expect(small).toContain('DFM.AE');
      expect(small).not.toContain('AAPL');
    });

    it('combines filters', async () => {
      const r = await search({ status: 'NON_COMPLIANT', exchange: 'DFM', limit: 50 });
      // DEWA fails the 30% debt limit, DFM the cash limit, Emirates NBD is a conventional bank
      expect(r.data.map((x) => x.asset.symbol).sort()).toEqual([
        'DEWA.AE',
        'DFM.AE',
        'EMIRATESNBD.AE',
      ]);
    });

    it('sorts by market cap, largest first', async () => {
      const caps = (await search({ sort: 'marketCap', dir: 'desc', limit: 10 })).data.map((r) =>
        Number(r.asset.marketCapUsd),
      );
      expect(caps).toEqual([...caps].sort((a, b) => b - a));
    });

    it('rejects bad parameters', async () => {
      await agent.get('/api/v1/screener').query({ limit: 500 }).expect(400);
      await agent.get('/api/v1/screener').query({ status: 'MAYBE' }).expect(400);
      await agent.get('/api/v1/screener').query({ sort: 'password' }).expect(400);
      await agent.get('/api/v1/screener').query({ page: 0 }).expect(400);
    });

    it('returns the filter options for the dropdowns', async () => {
      const { body } = await agent.get('/api/v1/screener/filters').expect(200);
      expect(body.data.exchanges).toEqual(expect.arrayContaining(['DFM', 'NASDAQ', 'NYSE']));
      expect(body.data.sectors).toEqual(expect.arrayContaining(['Technology', 'Energy']));
    });
  });

  describe('detail', () => {
    it('explains the verdict check by check', async () => {
      const { body } = await agent.get('/api/v1/screener/AAPL').expect(200);
      expect(body.data.asset.symbol).toBe('AAPL');
      expect(body.data.screening).toMatchObject({ status: 'COMPLIANT', isSample: true });
      expect((body.data.screening.checks as Array<{ key: string }>).map((c) => c.key)).toEqual([
        'BUSINESS_ACTIVITY',
        'DEBT',
        'CASH',
        'RECEIVABLES',
        'HARAM_REVENUE',
      ]);
      expect(body.data.screening.explanation).toContain('Passes');
      expect(body.data.history.length).toBeGreaterThanOrEqual(1);
    });

    it('is case-insensitive and 404s for an unknown ticker', async () => {
      await agent.get('/api/v1/screener/aapl').expect(200);
      await agent.get('/api/v1/screener/NOPE').expect(404);
    });

    it('shows why a prohibited business fails', async () => {
      const { body } = await agent.get('/api/v1/screener/BUD').expect(200);
      expect(body.data.screening.status).toBe('NON_COMPLIANT');
      expect(body.data.screening.explanation).toContain('alcohol');
      expect(body.data.screening.purificationPercent).toBe(0);
    });

    it('flags the borderline case as doubtful', async () => {
      const { body } = await agent.get('/api/v1/screener/DIS').expect(200);
      expect(body.data.screening.status).toBe('DOUBTFUL');
      expect(body.data.screening.purificationPercent).toBeGreaterThan(0);
    });
  });

  describe('24-hour cache and re-screening', () => {
    const stale = (assetId: string) =>
      ctx.prisma.screeningResult.updateMany({
        where: { assetId },
        data: { screenedAt: new Date(Date.now() - SCREENING_TTL_MS - 60_000) },
      });

    it('serves a fresh result from the cache', async () => {
      const a = await ctx.makeAsset('C1');
      const { body } = await agent.get(`/api/v1/screener/${a.symbol}`).expect(200);
      expect(body.data.cached).toBe(true);
    });

    it('re-checks a stale result; unchanged data just refreshes the timestamp (no new history row)', async () => {
      const a = await ctx.makeAsset('C2');
      await stale(a.id);
      const before = await ctx.prisma.screeningResult.count({ where: { assetId: a.id } });

      const { body } = await agent.get(`/api/v1/screener/${a.symbol}`).expect(200);
      expect(body.data.cached).toBe(false);
      expect(await ctx.prisma.screeningResult.count({ where: { assetId: a.id } })).toBe(before);
      expect(
        Date.now() - new Date(body.data.screening.screenedAt as string).getTime(),
      ).toBeLessThan(60_000);

      // and now it is fresh again
      expect((await agent.get(`/api/v1/screener/${a.symbol}`).expect(200)).body.data.cached).toBe(
        true,
      );
    });

    it('records a new history row when the data source reports a different verdict', async () => {
      const a = await ctx.makeAsset('C3');
      await stale(a.id);
      ctx.financial.overrides.set(a.symbol, { debtRatio: '0.45' }); // over the 30% limit

      const { body } = await agent.get(`/api/v1/screener/${a.symbol}`).expect(200);
      expect(body.data.screening.status).toBe('NON_COMPLIANT');
      expect((body.data.history as Array<{ status: string }>).map((h) => h.status)).toEqual([
        'NON_COMPLIANT',
        'COMPLIANT',
      ]);
      expect(body.data.screening.purificationPercent).toBe(0);
    });

    it('lets only one of several simultaneous requests perform the re-screening', async () => {
      const a = await ctx.makeAsset('C4');
      await stale(a.id);
      ctx.financial.overrides.set(a.symbol, { debtRatio: '0.50' });

      await Promise.all(
        Array.from({ length: 6 }, () => agent.get(`/api/v1/screener/${a.symbol}`).expect(200)),
      );
      expect(await ctx.prisma.screeningResult.count({ where: { assetId: a.id } })).toBe(2); // original + exactly one new
    });
  });
});
