import request from 'supertest';
import { io, type Socket } from 'socket.io-client';
import { REALTIME_EVENTS, type ComplianceAlertDto, type PricesEventDto } from '@barakahfi/shared';
import { PriceTicker } from '../src/realtime/price-ticker.service';
import { SCREENING_TTL_MS } from '../src/screener/screener.service';
import { createContext, PASSWORD, type Agent, type TestContext } from './support';

type Outcome = 'ready' | 'unauthorized' | 'error';

describe('realtime (e2e)', () => {
  let ctx: TestContext;
  let url: string;
  let ticker: PriceTicker;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    ctx = await createContext({ listen: true });
    url = await ctx.app.getUrl();
    ticker = ctx.app.get(PriceTicker);
  });

  afterAll(async () => {
    sockets.forEach((s) => s.close());
    await ctx.close();
  });

  const ticketFor = async (a: Agent) =>
    ((await a.post('/api/v1/realtime/ticket').expect(201)).body.data as { ticket: string }).ticket;

  /** Open a socket and wait for the server's verdict on the handshake. */
  const connect = async (ticket: unknown): Promise<{ socket: Socket; outcome: Outcome }> => {
    const socket = io(url, {
      auth: { ticket },
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
    });
    sockets.push(socket);
    const outcome = await new Promise<Outcome>((resolve) => {
      socket.once('ready', () => resolve('ready'));
      socket.once('unauthorized', () => resolve('unauthorized'));
      socket.once('connect_error', () => resolve('error'));
      setTimeout(() => resolve('error'), 3000);
    });
    return { socket, outcome };
  };

  const waitFor = <T>(socket: Socket, event: string, ms = 2000): Promise<T | null> =>
    new Promise((resolve) => {
      const t = setTimeout(() => resolve(null), ms);
      socket.once(event, (payload: T) => {
        clearTimeout(t);
        resolve(payload);
      });
    });

  const hold = (a: Agent, symbol: string) =>
    a
      .post('/api/v1/holdings')
      .send({ symbol, quantity: '1', avgBuyPrice: '10', purchaseDate: '2026-01-01' })
      .expect(201);

  describe('tickets and authentication', () => {
    it('needs a login to get a ticket', async () => {
      await (
        await import('supertest')
      )
        .default(ctx.server)
        .post('/api/v1/realtime/ticket')
        .expect(401);
    });

    it('accepts a valid ticket', async () => {
      const { agent } = await ctx.newUser('ok');
      const { outcome } = await connect(await ticketFor(agent));
      expect(outcome).toBe('ready');
    });

    it.each([
      ['missing', undefined],
      ['garbage', 'not.a.jwt'],
      ['a number', 12345],
    ])('rejects a %s ticket', async (_label, ticket) => {
      const { socket, outcome } = await connect(ticket);
      expect(outcome).toBe('unauthorized');
      await new Promise((r) => setTimeout(r, 100));
      expect(socket.connected).toBe(false);
    });

    it('rejects the login (access) token used as a ticket: they are signed with different keys', async () => {
      const { email } = await ctx.newUser('swap');
      const login = await request(ctx.server)
        .post('/api/v1/auth/login')
        .send({ email, password: PASSWORD })
        .expect(200);
      const cookies = (login.headers['set-cookie'] as unknown as string[]).join(';');
      const access = /access_token=([^;]+)/.exec(cookies)?.[1];
      expect(access).toBeTruthy();
      expect((await connect(access)).outcome).toBe('unauthorized');
    });

    it('a ticket is not accepted as an API credential either', async () => {
      const { agent } = await ctx.newUser('rev');
      const ticket = await ticketFor(agent);
      await (
        await import('supertest')
      )
        .default(ctx.server)
        .get('/api/v1/accounts')
        .set('Authorization', `Bearer ${ticket}`)
        .expect(401);
    });
  });

  describe('live prices', () => {
    it('sends each user only the prices of the stocks they hold, and updates the database', async () => {
      const a = await ctx.newUser('pa');
      const b = await ctx.newUser('pb');
      const idle = await ctx.newUser('pc'); // connected but holds nothing
      const s1 = await ctx.makeAsset('T1', { price: 100, previousClose: 100 });
      const s2 = await ctx.makeAsset('T2', { price: 50, previousClose: 50 });
      await hold(a.agent, s1.symbol);
      await hold(b.agent, s2.symbol);

      const sa = (await connect(await ticketFor(a.agent))).socket;
      const sb = (await connect(await ticketFor(b.agent))).socket;
      const sc = (await connect(await ticketFor(idle.agent))).socket;
      const gotA = waitFor<PricesEventDto>(sa, REALTIME_EVENTS.prices);
      const gotB = waitFor<PricesEventDto>(sb, REALTIME_EVENTS.prices);
      const gotC = waitFor<PricesEventDto>(sc, REALTIME_EVENTS.prices, 600);

      ctx.prices.set(s1.symbol, 120, 100);
      ctx.prices.set(s2.symbol, 45.5, 50);
      const updated = await ticker.tick({ force: true });
      expect(updated).toBeGreaterThanOrEqual(2);

      expect((await gotA)?.prices).toEqual([
        expect.objectContaining({
          symbol: s1.symbol,
          price: '120',
          previousClose: '100',
          currency: 'USD',
        }),
      ]);
      expect((await gotB)?.prices).toEqual([
        expect.objectContaining({ symbol: s2.symbol, price: '45.5' }),
      ]);
      expect(await gotC).toBeNull(); // nothing for someone with no holdings

      const row = await ctx.prisma.asset.findUniqueOrThrow({ where: { symbol: s1.symbol } });
      expect(row.currentPrice.toFixed()).toBe('120');
    });

    it('fetches nothing when nobody is connected or all markets are closed', async () => {
      const { agent } = await ctx.newUser('closed');
      const s = await ctx.makeAsset('T3', { price: 10, previousClose: 10 });
      await hold(agent, s.symbol);
      await connect(await ticketFor(agent));

      ctx.prices.set(s.symbol, 99, 10);
      const saturday = new Date('2026-11-14T16:00:00Z');
      expect(await ticker.tick({ now: saturday })).toBe(0); // NASDAQ is shut at the weekend
      expect(
        (
          await ctx.prisma.asset.findUniqueOrThrow({ where: { symbol: s.symbol } })
        ).currentPrice.toFixed(),
      ).toBe('10');
    });

    it('keeps the last known price when the feed has no quote', async () => {
      const { agent } = await ctx.newUser('nofeed');
      const s = await ctx.makeAsset('T4', { price: 77, previousClose: 70 });
      await hold(agent, s.symbol);
      const sock = (await connect(await ticketFor(agent))).socket;
      const got = waitFor<PricesEventDto>(sock, REALTIME_EVENTS.prices, 600);
      ctx.prices.data.delete(s.symbol);
      await ticker.tick({ force: true });
      expect(await got).toBeNull();
      expect(
        (
          await ctx.prisma.asset.findUniqueOrThrow({ where: { symbol: s.symbol } })
        ).currentPrice.toFixed(),
      ).toBe('77');
    });
  });

  describe('compliance alerts', () => {
    it('pushes an alert to holders (and only holders) when a stock changes verdict', async () => {
      const holder = await ctx.newUser('ah');
      const bystander = await ctx.newUser('ab');
      const s = await ctx.makeAsset('A1');
      await hold(holder.agent, s.symbol);

      const sh = (await connect(await ticketFor(holder.agent))).socket;
      const sb = (await connect(await ticketFor(bystander.agent))).socket;
      const gotH = waitFor<ComplianceAlertDto>(sh, REALTIME_EVENTS.alerts);
      const gotB = waitFor<ComplianceAlertDto>(sb, REALTIME_EVENTS.alerts, 600);

      // the stored screening is now over a day old, and the data source reports much higher debt
      await ctx.prisma.screeningResult.updateMany({
        where: { assetId: s.id },
        data: { screenedAt: new Date(Date.now() - SCREENING_TTL_MS - 60_000) },
      });
      ctx.financial.overrides.set(s.symbol, { debtRatio: '0.55' });
      await bystander.agent.get(`/api/v1/screener/${s.symbol}`).expect(200); // anyone viewing it triggers the re-check

      expect(await gotH).toMatchObject({
        type: 'COMPLIANCE_CHANGED',
        symbol: s.symbol,
        from: 'COMPLIANT',
        to: 'NON_COMPLIANT',
      });
      expect(await gotB).toBeNull();
    });
  });
});
