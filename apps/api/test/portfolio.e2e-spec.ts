import request from 'supertest';
import { createContext, type Agent, type TestContext } from './support';

interface Holding {
  id: string;
  symbol: string;
  value: string;
  cost: string;
  gainLoss: string;
  gainLossPercent: number;
  dayChange: string;
  valueBase: string;
  allocationPercent: number;
  purificationDue: string;
  status: string | null;
  quantity: string;
}
interface Portfolio {
  data: { totals: Record<string, string | number>; rows: Holding[] };
  meta: { page: number; limit: number; total: number };
}

describe('portfolio and holdings (e2e)', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await createContext();
  });
  afterAll(() => ctx.close());

  const portfolio = async (a: Agent, q: Record<string, string | number> = {}) =>
    (await a.get('/api/v1/portfolio').query(q).expect(200)).body as Portfolio;
  const add = (a: Agent, body: Record<string, unknown>) =>
    a.post('/api/v1/holdings').send({ purchaseDate: '2026-01-15', ...body });

  describe('valuation maths', () => {
    it('works out gain, day change, allocation and purification in the default currency (AED)', async () => {
      const { agent } = await ctx.newUser('maths');
      // USD stock: 10 x 100 = 1000 (cost 800), day change 10 x (100 - 95) = +50, 3% purification on 100 dividends
      const usd = await ctx.makeAsset('M1', { price: 100, previousClose: 95, currency: 'USD' });
      // AED stock: 100 x 10 = 1000 AED (cost 800), flat on the day
      const aed = await ctx.makeAsset('M2', {
        price: 10,
        previousClose: 10,
        currency: 'AED',
        exchange: 'DFM',
      });
      await add(agent, {
        symbol: usd.symbol,
        quantity: '10',
        avgBuyPrice: '80',
        dividendsReceived: '100',
      }).expect(201);
      await add(agent, { symbol: aed.symbol, quantity: '100', avgBuyPrice: '8' }).expect(201);

      const { data, meta } = await portfolio(agent);
      expect(meta.total).toBe(2);

      const u = data.rows.find((r) => r.symbol === usd.symbol)!;
      expect(u).toMatchObject({
        value: '1000.00',
        cost: '800.00',
        gainLoss: '200.00',
        gainLossPercent: 25,
        dayChange: '50.00',
        purificationDue: '3.00',
        status: 'COMPLIANT',
      });
      expect(u.valueBase).toBe('3672.50'); // 1000 USD x 3.6725 (the AED peg; the fake feed has no live FX)

      const a = data.rows.find((r) => r.symbol === aed.symbol)!;
      expect(a).toMatchObject({
        value: '1000.00',
        valueBase: '1000.00',
        gainLoss: '200.00',
        dayChange: '0.00',
        purificationDue: '0.00',
      });

      // allocation by base value: 3672.50 / 4672.50 and 1000 / 4672.50
      expect(u.allocationPercent).toBe(78.6);
      expect(a.allocationPercent).toBe(21.4);

      expect(data.totals).toMatchObject({
        currency: 'AED',
        value: '4672.50',
        cost: '3738.00', // 800 USD (2938.00 AED) + 800 AED
        gainLoss: '934.50',
        gainLossPercent: 25,
        dayChange: '183.63', // 50 USD x 3.6725
        purificationDue: '11.02', // 3 USD x 3.6725
      });
    });

    it('is empty and zeroed for a new user', async () => {
      const { agent } = await ctx.newUser('empty');
      const { data, meta } = await portfolio(agent);
      expect(data.rows).toEqual([]);
      expect(meta.total).toBe(0);
      expect(data.totals).toMatchObject({
        value: '0.00',
        gainLoss: '0.00',
        gainLossPercent: 0,
        dayChange: '0.00',
      });
    });

    it('follows a price change straight away', async () => {
      const { agent } = await ctx.newUser('reprice');
      const a = await ctx.makeAsset('R1', { price: 100, previousClose: 100 });
      await add(agent, { symbol: a.symbol, quantity: '2', avgBuyPrice: '100' }).expect(201);
      await ctx.prisma.asset.update({ where: { id: a.id }, data: { currentPrice: 150 } });
      expect((await portfolio(agent)).data.rows[0]).toMatchObject({
        value: '300.00',
        gainLoss: '100.00',
        gainLossPercent: 50,
      });
    });
  });

  describe('sorting and paging (server side)', () => {
    it('sorts by any column, both directions, and pages with a stable total', async () => {
      const { agent } = await ctx.newUser('sort');
      const specs = [
        ['S1', 100, '10', '50'], // gain 500  (+100%)
        ['S2', 100, '10', '90'], // gain 100  (+11.1%)
        ['S3', 100, '10', '100'], // gain 0
      ] as const;
      for (const [suffix, price, qty, avg] of specs) {
        const a = await ctx.makeAsset(suffix, { price, previousClose: price });
        await add(agent, { symbol: a.symbol, quantity: qty, avgBuyPrice: avg }).expect(201);
      }
      const order = async (q: Record<string, string | number>) =>
        (await portfolio(agent, q)).data.rows.map((r) => r.symbol.slice(-2));

      expect(await order({ sort: 'gainLossPercent', dir: 'desc' })).toEqual(['S1', 'S2', 'S3']);
      expect(await order({ sort: 'gainLossPercent', dir: 'asc' })).toEqual(['S3', 'S2', 'S1']);
      expect(await order({ sort: 'avgBuyPrice', dir: 'asc' })).toEqual(['S1', 'S2', 'S3']);

      const page2 = await portfolio(agent, {
        sort: 'gainLossPercent',
        dir: 'desc',
        limit: 1,
        page: 2,
      });
      expect(page2.meta).toEqual({ page: 2, limit: 1, total: 3 });
      expect(page2.data.rows.map((r) => r.symbol.slice(-2))).toEqual(['S2']);
      // totals describe the WHOLE portfolio, not just this page
      expect(page2.data.totals.value).toBe((3 * 1000 * 3.6725).toFixed(2));
    });

    it('sorts gain/loss by its value in the default currency, not the raw native number', async () => {
      const { agent } = await ctx.newUser('fxsort');
      // +200 USD gain (= 734.50 AED) versus +500 AED gain: 500 > 200 as raw numbers, but 734.50 > 500 in AED.
      const usd = await ctx.makeAsset('G1', { price: 100, previousClose: 100, currency: 'USD' });
      const aed = await ctx.makeAsset('G2', {
        price: 100,
        previousClose: 100,
        currency: 'AED',
        exchange: 'DFM',
      });
      await add(agent, { symbol: usd.symbol, quantity: '10', avgBuyPrice: '80' }).expect(201);
      await add(agent, { symbol: aed.symbol, quantity: '10', avgBuyPrice: '50' }).expect(201);

      const rows = (await portfolio(agent, { sort: 'gainLoss', dir: 'desc' })).data.rows;
      expect(rows.map((r) => r.symbol.slice(-2))).toEqual(['G1', 'G2']);
      expect(rows.map((r) => r.gainLoss)).toEqual(['200.00', '500.00']);
    });

    it('rejects an unknown sort column', async () => {
      const { agent } = await ctx.newUser('badsort');
      await agent.get('/api/v1/portfolio').query({ sort: 'password' }).expect(400);
    });
  });

  describe('holdings CRUD', () => {
    it('creates, edits and removes a holding', async () => {
      const { agent } = await ctx.newUser('crud');
      const a = await ctx.makeAsset('K1');
      const created = (
        await add(agent, {
          symbol: a.symbol.toLowerCase(),
          quantity: '1.5',
          avgBuyPrice: '99.5',
        }).expect(201)
      ).body.data as Holding;
      expect(created).toMatchObject({ symbol: a.symbol, quantity: '1.5' }); // symbol was upper-cased

      const edited = (
        await agent
          .patch(`/api/v1/holdings/${created.id}`)
          .send({ quantity: '4', dividendsReceived: '200' })
          .expect(200)
      ).body.data as Holding;
      expect(edited).toMatchObject({ quantity: '4', purificationDue: '6.00' });

      await agent.delete(`/api/v1/holdings/${created.id}`).expect(200);
      expect((await portfolio(agent)).meta.total).toBe(0);
    });

    it('allows one holding per stock (409 on a duplicate) and 404s for an unknown ticker', async () => {
      const { agent } = await ctx.newUser('dupe');
      const a = await ctx.makeAsset('D1');
      await add(agent, { symbol: a.symbol, quantity: '1', avgBuyPrice: '10' }).expect(201);
      const dup = await add(agent, { symbol: a.symbol, quantity: '2', avgBuyPrice: '10' }).expect(
        409,
      );
      expect(dup.body.error.message).toContain('already hold');
      await add(agent, { symbol: 'NOPE', quantity: '1', avgBuyPrice: '10' }).expect(404);
    });

    it('validates amounts, prices and dates', async () => {
      const { agent } = await ctx.newUser('valid');
      const a = await ctx.makeAsset('V1');
      const ok = { symbol: a.symbol, quantity: '1', avgBuyPrice: '10' };
      for (const quantity of ['0', '-1', '1.1234567', 'abc', ''])
        await add(agent, { ...ok, quantity }).expect(400);
      for (const avgBuyPrice of ['0', '1.12345', 'x'])
        await add(agent, { ...ok, avgBuyPrice }).expect(400);
      await add(agent, { ...ok, quantity: 1 }).expect(400); // a JSON number, not a string
      await add(agent, { ...ok, purchaseDate: '2999-01-01' }).expect(400); // future
      await add(agent, { ...ok, purchaseDate: '2026-02-31' }).expect(400); // not a date
      await add(agent, { ...ok, dividendsReceived: '-5' }).expect(400);
      await add(agent, { ...ok, extra: 'nope' }).expect(400); // unknown field
    });

    it("keeps one user's holdings private (404, never 403)", async () => {
      const owner = await ctx.newUser('own');
      const other = await ctx.newUser('oth');
      const a = await ctx.makeAsset('P1');
      const h = (
        await add(owner.agent, { symbol: a.symbol, quantity: '1', avgBuyPrice: '10' }).expect(201)
      ).body.data as Holding;

      expect((await portfolio(other.agent)).meta.total).toBe(0);
      await other.agent.patch(`/api/v1/holdings/${h.id}`).send({ quantity: '9' }).expect(404);
      await other.agent.delete(`/api/v1/holdings/${h.id}`).expect(404);

      // and another user's account can't be attached to a holding
      const acc = (
        await owner.agent
          .post('/api/v1/accounts')
          .send({ name: 'Broker', type: 'INVESTMENT', currency: 'USD', balance: '0' })
          .expect(201)
      ).body.data as { id: string };
      const b = await ctx.makeAsset('P2');
      await add(other.agent, {
        symbol: b.symbol,
        quantity: '1',
        avgBuyPrice: '10',
        accountId: acc.id,
      }).expect(404);
    });

    it('requires a login', async () => {
      await request(ctx.server).get('/api/v1/portfolio').expect(401);
    });
  });
});
