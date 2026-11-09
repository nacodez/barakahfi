import { MetalsService } from '../src/market/metals.service';
import { createContext, type Agent, type TestContext } from './support';

interface Calc {
  currency: string;
  nisabMethod: string;
  items: Array<{ kind: string; label: string; amount: string }>;
  assetsTotal: string;
  liabilities: string;
  netWealth: string;
  nisabGold: string;
  nisabSilver: string;
  nisabUsed: string;
  meetsNisab: boolean;
  zakatDue: string;
  goldPricePerGram: string;
  silverPricePerGram: string;
  pricesSource: string;
}

describe('zakat (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createContext();
    // Gold $100/g and silver $1/g (the feed quotes USD per troy ounce). AED is pegged at 3.6725.
    ctx.prices.set('GC=F', 3110.34768);
    ctx.prices.set('SI=F', 31.1034768);
  });
  afterAll(() => ctx.close());

  const account = async (
    a: Agent,
    name: string,
    balance: string,
    opts: { isZakatable?: boolean; currency?: string } = {},
  ) =>
    (
      await a
        .post('/api/v1/accounts')
        .send({
          name,
          type: 'BANK',
          currency: opts.currency ?? 'AED',
          balance,
          isZakatable: opts.isZakatable ?? true,
        })
        .expect(201)
    ).body.data as { id: string };
  const calc = (a: Agent, body: Record<string, unknown>) =>
    a.post('/api/v1/zakat/calculate').send(body);

  describe('context', () => {
    it('lists accounts and holdings with values in the default currency, plus metal prices and nisab', async () => {
      const { agent } = await ctx.newUser('ctx');
      await account(agent, 'Savings', '1000.00');
      await account(agent, 'Wise USD', '100.00', { currency: 'USD', isZakatable: false });
      const asset = await ctx.makeAsset('Z1', { price: 50, currency: 'USD' });
      await agent
        .post('/api/v1/holdings')
        .send({
          symbol: asset.symbol,
          quantity: '2',
          avgBuyPrice: '40',
          purchaseDate: '2026-01-01',
        })
        .expect(201);

      const { body } = await agent.get('/api/v1/zakat/context').expect(200);
      const c = body.data;
      expect(c).toMatchObject({
        currency: 'AED',
        nisabMethod: 'GOLD',
        goldPricePerGram: '367.25',
        silverPricePerGram: '3.67',
        pricesSource: 'live',
      });
      expect(c.nisabGold).toBe('31216.25'); // 85 g x 367.25
      expect(c.nisabSilver).toBe('2185.14'); // 595 g x 3.6725
      expect(c.hijriYear).toBeGreaterThanOrEqual(1447);

      const usd = (c.accounts as Array<{ name: string }>).find((a) => a.name === 'Wise USD');
      expect(usd).toMatchObject({ balance: '100.00', balanceBase: '367.25', isZakatable: false });
      expect(c.holdings[0]).toMatchObject({
        value: '100.00',
        valueBase: '367.25',
        status: 'COMPLIANT',
      });
    });
  });

  describe('calculate', () => {
    it('is 2.5% of net wealth once the gold nisab is reached', async () => {
      const { agent } = await ctx.newUser('calc');
      const acc = await account(agent, 'Savings', '40000.00');
      const { body } = await calc(agent, { accountIds: [acc.id] }).expect(201);
      const r = body.data as Calc;
      expect(r).toMatchObject({
        netWealth: '40000.00',
        meetsNisab: true,
        zakatDue: '1000.00',
        nisabUsed: '31216.25',
        nisabMethod: 'GOLD',
      });
      expect(r.items).toEqual([{ kind: 'ACCOUNT', label: 'Savings', amount: '40000.00' }]);
    });

    it('is zero below the nisab, and exactly at it zakat is due', async () => {
      const { agent } = await ctx.newUser('nisab');
      const below = await calc(agent, { cashOnHand: '31216.24' }).expect(201);
      expect(below.body.data).toMatchObject({ meetsNisab: false, zakatDue: '0.00' });
      const exact = await calc(agent, { cashOnHand: '31216.25' }).expect(201);
      expect(exact.body.data).toMatchObject({ meetsNisab: true, zakatDue: '780.41' }); // 780.40625 rounds up
    });

    it('deducts liabilities before testing the nisab, and the silver method has a lower bar', async () => {
      const { agent } = await ctx.newUser('liab');
      const acc = await account(agent, 'Savings', '40000.00');
      const gold = await calc(agent, { accountIds: [acc.id], liabilities: '10000' }).expect(201);
      expect(gold.body.data).toMatchObject({
        assetsTotal: '40000.00',
        liabilities: '10000.00',
        netWealth: '30000.00',
        meetsNisab: false,
        zakatDue: '0.00',
      });
      const silver = await calc(agent, {
        accountIds: [acc.id],
        liabilities: '10000',
        nisabMethod: 'SILVER',
      }).expect(201);
      expect(silver.body.data).toMatchObject({
        nisabMethod: 'SILVER',
        nisabUsed: '2185.14',
        meetsNisab: true,
        zakatDue: '750.00',
      });
    });

    it('never goes negative when debts exceed assets', async () => {
      const { agent } = await ctx.newUser('debt');
      const r = (await calc(agent, { cashOnHand: '100', liabilities: '900' }).expect(201)).body
        .data as Calc;
      expect(r).toMatchObject({ netWealth: '0.00', zakatDue: '0.00', meetsNisab: false });
    });

    it('adds manual assets, pricing gold and silver by weight from the live price', async () => {
      const { agent } = await ctx.newUser('manual');
      const r = (
        await calc(agent, {
          cashOnHand: '1000',
          receivables: '500.50',
          goldJewelryGrams: '100',
          silverGrams: '200',
          otherAssets: '50',
        }).expect(201)
      ).body.data as Calc;
      const by = Object.fromEntries(r.items.map((i) => [i.kind, i.amount]));
      expect(by).toMatchObject({
        CASH: '1000.00',
        RECEIVABLES: '500.50',
        GOLD: '36725.00',
        SILVER: '734.50',
        OTHER: '50.00',
      });
      expect(r.assetsTotal).toBe('39010.00');
    });

    it('converts accounts and holdings in other currencies', async () => {
      const { agent } = await ctx.newUser('fx');
      const usd = await account(agent, 'USD account', '1000.00', { currency: 'USD' });
      const asset = await ctx.makeAsset('Z2', { price: 200, currency: 'USD' });
      const h = (
        await agent
          .post('/api/v1/holdings')
          .send({
            symbol: asset.symbol,
            quantity: '5',
            avgBuyPrice: '1',
            purchaseDate: '2026-01-01',
          })
          .expect(201)
      ).body.data as { id: string };
      const r = (await calc(agent, { accountIds: [usd.id], holdingIds: [h.id] }).expect(201)).body
        .data as Calc;
      expect(r.assetsTotal).toBe('7345.00'); // (1000 + 5 x 200) USD = 2000 USD x 3.6725
    });

    it('reports when it had to reuse a cached metal price instead of a live one', async () => {
      const { agent } = await ctx.newUser('stale');
      const cache = Reflect.get(ctx.app.get(MetalsService), 'cache') as Map<string, { at: number }>;
      cache.forEach((v) => (v.at = Date.now() - 20 * 60_000)); // expire the cache
      const saved = new Map(ctx.prices.data);
      ctx.prices.data.clear(); // the feed goes down
      try {
        const r = (await calc(agent, { cashOnHand: '10' }).expect(201)).body.data as Calc;
        expect(r.pricesSource).toBe('cached');
        expect(r.goldPricePerGram).toBe('367.25');
      } finally {
        saved.forEach((v, k) => ctx.prices.data.set(k, v));
      }
    });

    it("never trusts amounts from the browser and can't use other users' accounts", async () => {
      const owner = await ctx.newUser('own');
      const other = await ctx.newUser('oth');
      const acc = await account(owner.agent, 'Private', '99999.00');
      await calc(other.agent, { accountIds: [acc.id] }).expect(404);
      await calc(other.agent, { cashOnHand: '1', accountBalance: '99999' }).expect(400); // unknown field
      await calc(other.agent, { cashOnHand: '-5' }).expect(400);
      await calc(other.agent, { cashOnHand: 5 }).expect(400); // number, not a decimal string
      await calc(other.agent, { goldJewelryGrams: '1.2345' }).expect(400); // max 3 decimals
      await calc(other.agent, { nisabMethod: 'COPPER' }).expect(400);
    });

    it('does not save anything (it is a preview)', async () => {
      const { agent } = await ctx.newUser('preview');
      await calc(agent, { cashOnHand: '50000' }).expect(201);
      expect((await agent.get('/api/v1/zakat/records').expect(200)).body.data).toEqual([]);
    });
  });

  describe('records', () => {
    it('saves a calculation (recomputed on the server), lists it, and tracks payment', async () => {
      const { agent } = await ctx.newUser('rec');
      const acc = await account(agent, 'Savings', '40000.00');

      const saved = (
        await agent
          .post('/api/v1/zakat/records')
          .send({ accountIds: [acc.id], notes: 'Ramadan' })
          .expect(201)
      ).body.data;
      expect(saved).toMatchObject({
        currency: 'AED',
        nisabMethod: 'GOLD',
        totalAssets: '40000.00',
        zakatDue: '1000.00',
        zakatPaid: '0.00',
        notes: 'Ramadan',
      });
      expect(saved.hijriYear).toBeGreaterThanOrEqual(1447);
      expect(saved.breakdown.items).toHaveLength(1); // the inputs are kept so the figure can be explained later

      const paid = (
        await agent
          .patch(`/api/v1/zakat/records/${saved.id}`)
          .send({ zakatPaid: '250.00' })
          .expect(200)
      ).body.data;
      expect(paid).toMatchObject({ zakatPaid: '250.00', notes: 'Ramadan' }); // notes untouched

      const list = (await agent.get('/api/v1/zakat/records').expect(200)).body.data as Array<{
        id: string;
        zakatPaid: string;
      }>;
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({ id: saved.id, zakatPaid: '250.00' });

      await agent.patch(`/api/v1/zakat/records/${saved.id}`).send({ zakatPaid: '-1' }).expect(400);
    });

    it('lists newest first and keeps records private', async () => {
      const a = await ctx.newUser('ra');
      const b = await ctx.newUser('rb');
      const first = (
        await a.agent
          .post('/api/v1/zakat/records')
          .send({ cashOnHand: '40000', notes: 'first' })
          .expect(201)
      ).body.data;
      const second = (
        await a.agent
          .post('/api/v1/zakat/records')
          .send({ cashOnHand: '50000', notes: 'second' })
          .expect(201)
      ).body.data;

      const list = (await a.agent.get('/api/v1/zakat/records').expect(200)).body.data as Array<{
        id: string;
      }>;
      expect(list.map((r) => r.id)).toEqual([second.id, first.id]);
      expect((await b.agent.get('/api/v1/zakat/records').expect(200)).body.data).toEqual([]);
      await b.agent.patch(`/api/v1/zakat/records/${first.id}`).send({ zakatPaid: '1' }).expect(404);
    });
  });

  describe('summary and hawl', () => {
    it('estimates from zakatable accounts and holdings only, and counts down the hawl', async () => {
      const { agent } = await ctx.newUser('sum');
      await account(agent, 'Zakatable', '40000.00');
      await account(agent, 'Property fund', '900000.00', { isZakatable: false });

      let s = (await agent.get('/api/v1/zakat/summary').expect(200)).body.data;
      expect(s).toMatchObject({
        estimatedZakat: '1000.00',
        netWealth: '40000.00',
        meetsNisab: true,
        hawlStartDate: null,
        hawlEndDate: null,
        daysRemaining: null,
        latestRecord: null,
      });

      const start = new Date(Date.now() - 100 * 86_400_000).toISOString().slice(0, 10);
      await agent.patch('/api/v1/users/me').send({ zakatStartDate: start }).expect(200);
      s = (await agent.get('/api/v1/zakat/summary').expect(200)).body.data;
      expect(s.hawlStartDate).toBe(start);
      expect(s.daysRemaining).toBe(254); // 354 - 100
      expect(s.hawlEndDate).toBe(
        new Date(new Date(start).getTime() + 354 * 86_400_000).toISOString().slice(0, 10),
      );
    });

    it('goes negative once the hawl is over, and the date can be cleared or rejected', async () => {
      const { agent } = await ctx.newUser('over');
      await agent.patch('/api/v1/users/me').send({ zakatStartDate: '2024-01-01' }).expect(200);
      expect(
        (await agent.get('/api/v1/zakat/summary').expect(200)).body.data.daysRemaining,
      ).toBeLessThan(0);
      expect(
        (await agent.patch('/api/v1/users/me').send({ zakatStartDate: null }).expect(200)).body.data
          .zakatStartDate,
      ).toBeNull();
      await agent.patch('/api/v1/users/me').send({ zakatStartDate: '2026-02-31' }).expect(400);
      await agent.patch('/api/v1/users/me').send({ zakatStartDate: 'tomorrow' }).expect(400);
    });

    it('shows the latest saved record', async () => {
      const { agent } = await ctx.newUser('latest');
      await agent.post('/api/v1/zakat/records').send({ cashOnHand: '40000' }).expect(201);
      const s = (await agent.get('/api/v1/zakat/summary').expect(200)).body.data;
      expect(s.latestRecord).toMatchObject({ zakatDue: '1000.00', zakatPaid: '0.00' });
    });
  });
});
