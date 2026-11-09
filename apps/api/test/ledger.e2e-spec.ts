import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

// Rate limiting is verified in throttle.e2e-spec.ts.
process.env.THROTTLE_DISABLED = 'true';

const RUN = Date.now().toString(36);
const PASSWORD = 'Barakah123';
const TODAY = new Date().toISOString().slice(0, 10);
/** First day of last month: always outside the current month/quarter-start window of a MONTHLY budget. */
const LAST_MONTH = (() => {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 10);
})();

type Agent = ReturnType<typeof request.agent>;
interface Acc {
  id: string;
  balance: string;
}

describe('ledger: transactions, categories, budgets, reports (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let server: App;
  let n = 0;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    server = app.getHttpServer() as App;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: `ledger-${RUN}` } } });
    await app.close();
  });

  // ---- helpers ----
  async function newUser(): Promise<Agent> {
    const agent = request.agent(server);
    await agent
      .post('/api/v1/auth/register')
      .send({
        name: 'Ledger Tester',
        email: `ledger-${RUN}-${n++}@test.barakahfi.dev`,
        password: PASSWORD,
      })
      .expect(201);
    return agent;
  }
  const account = async (a: Agent, name: string, balance = '1000.00', currency = 'AED') =>
    (await a.post('/api/v1/accounts').send({ name, type: 'BANK', currency, balance }).expect(201))
      .body.data as Acc;
  const balanceOf = async (a: Agent, id: string) =>
    ((await a.get('/api/v1/accounts').expect(200)).body.data as Acc[]).find((x) => x.id === id)!
      .balance;
  const category = async (a: Agent, name: string, type: 'INCOME' | 'EXPENSE') =>
    (
      (await a.get('/api/v1/categories').expect(200)).body.data as Array<{
        id: string;
        name: string;
        type: string;
      }>
    ).find((c) => c.name === name && c.type === type)!.id;
  const tx = (a: Agent, body: Record<string, unknown>) =>
    a.post('/api/v1/transactions').send({ description: '', date: TODAY, ...body });

  // ---- tests ----

  describe('balances stay in sync with the ledger', () => {
    it('create -> edit -> delete keeps the balance exact and restores it at the end', async () => {
      const a = await newUser();
      const acc = await account(a, 'Main', '1000.00');

      const income = (
        await tx(a, { type: 'INCOME', accountId: acc.id, amount: '200.00' }).expect(201)
      ).body.data;
      expect(await balanceOf(a, acc.id)).toBe('1200.00');

      const expense = (
        await tx(a, { type: 'EXPENSE', accountId: acc.id, amount: '50.25' }).expect(201)
      ).body.data;
      expect(await balanceOf(a, acc.id)).toBe('1149.75');

      await a.patch(`/api/v1/transactions/${expense.id}`).send({ amount: '100.00' }).expect(200);
      expect(await balanceOf(a, acc.id)).toBe('1100.00');

      // changing the type flips the effect: -100 becomes +100
      await a.patch(`/api/v1/transactions/${expense.id}`).send({ type: 'INCOME' }).expect(200);
      expect(await balanceOf(a, acc.id)).toBe('1300.00');

      await a.delete(`/api/v1/transactions/${expense.id}`).expect(200);
      expect(await balanceOf(a, acc.id)).toBe('1200.00');
      await a.delete(`/api/v1/transactions/${income.id}`).expect(200);
      expect(await balanceOf(a, acc.id)).toBe('1000.00');
    });

    it('moving a transaction to another account updates both balances', async () => {
      const a = await newUser();
      const one = await account(a, 'One', '500.00');
      const two = await account(a, 'Two', '500.00');
      const t = (await tx(a, { type: 'EXPENSE', accountId: one.id, amount: '40.00' }).expect(201))
        .body.data;
      expect([await balanceOf(a, one.id), await balanceOf(a, two.id)]).toEqual([
        '460.00',
        '500.00',
      ]);

      await a.patch(`/api/v1/transactions/${t.id}`).send({ accountId: two.id }).expect(200);
      expect([await balanceOf(a, one.id), await balanceOf(a, two.id)]).toEqual([
        '500.00',
        '460.00',
      ]);
    });

    it('transfers move money between accounts and are exactly reversible', async () => {
      const a = await newUser();
      const from = await account(a, 'From', '500.00');
      const to = await account(a, 'To', '100.00');

      const t = (
        await tx(a, {
          type: 'TRANSFER',
          accountId: from.id,
          transferAccountId: to.id,
          amount: '120.00',
        }).expect(201)
      ).body.data;
      expect([await balanceOf(a, from.id), await balanceOf(a, to.id)]).toEqual([
        '380.00',
        '220.00',
      ]);

      await a.patch(`/api/v1/transactions/${t.id}`).send({ amount: '20.00' }).expect(200);
      expect([await balanceOf(a, from.id), await balanceOf(a, to.id)]).toEqual([
        '480.00',
        '120.00',
      ]);

      await a.delete(`/api/v1/transactions/${t.id}`).expect(200);
      expect([await balanceOf(a, from.id), await balanceOf(a, to.id)]).toEqual([
        '500.00',
        '100.00',
      ]);
    });

    it('is atomic under concurrency: 10 parallel expenses of 10.00 subtract exactly 100.00', async () => {
      const a = await newUser();
      const acc = await account(a, 'Busy', '1000.00');
      await Promise.all(
        Array.from({ length: 10 }, () =>
          tx(a, { type: 'EXPENSE', accountId: acc.id, amount: '10.00' }).expect(201),
        ),
      );
      expect(await balanceOf(a, acc.id)).toBe('900.00');
    });

    it('serialises simultaneous edits of one transaction: balance always matches the stored amount', async () => {
      const a = await newUser();
      const acc = await account(a, 'Race', '1000.00');
      const t = (await tx(a, { type: 'EXPENSE', accountId: acc.id, amount: '10.00' }).expect(201))
        .body.data;

      await Promise.all(
        ['20.00', '30.00', '40.00', '50.00'].map((amount) =>
          a.patch(`/api/v1/transactions/${t.id}`).send({ amount }).expect(200),
        ),
      );

      const [stored] = (await a.get('/api/v1/transactions').expect(200)).body.data as Array<{
        amount: string;
      }>;
      const expected = (1000 - Number(stored!.amount)).toFixed(2);
      expect(await balanceOf(a, acc.id)).toBe(expected);
    });

    it('leaves balances untouched when an edit is rejected', async () => {
      const a = await newUser();
      const acc = await account(a, 'Safe', '300.00');
      const income = await category(a, 'Salary', 'INCOME');
      const t = (await tx(a, { type: 'EXPENSE', accountId: acc.id, amount: '30.00' }).expect(201))
        .body.data;

      // an income category on an expense is invalid, so the whole edit (amount included) must roll back
      await a
        .patch(`/api/v1/transactions/${t.id}`)
        .send({ amount: '99.00', categoryId: income })
        .expect(400);
      expect(await balanceOf(a, acc.id)).toBe('270.00');
    });
  });

  describe('validation and ownership', () => {
    it('rejects bad amounts, dates, transfers and category mismatches', async () => {
      const a = await newUser();
      const aed = await account(a, 'AED', '100.00');
      const usd = await account(a, 'USD', '100.00', 'USD');
      const salary = await category(a, 'Salary', 'INCOME');

      for (const amount of ['0', '0.00', '-5', '1.234', 'abc']) {
        await tx(a, { type: 'EXPENSE', accountId: aed.id, amount }).expect(400);
      }
      await tx(a, { type: 'EXPENSE', accountId: aed.id, amount: 12.5 }).expect(400); // a JSON number, not a string
      await tx(a, {
        type: 'EXPENSE',
        accountId: aed.id,
        amount: '5.00',
        date: '2026-02-31',
      }).expect(400);
      await tx(a, {
        type: 'EXPENSE',
        accountId: aed.id,
        amount: '5.00',
        categoryId: salary,
      }).expect(400);
      await tx(a, { type: 'TRANSFER', accountId: aed.id, amount: '5.00' }).expect(400); // no destination
      await tx(a, {
        type: 'TRANSFER',
        accountId: aed.id,
        transferAccountId: aed.id,
        amount: '5.00',
      }).expect(400);
      await tx(a, {
        type: 'TRANSFER',
        accountId: aed.id,
        transferAccountId: usd.id,
        amount: '5.00',
      }).expect(400); // FX
      expect(await balanceOf(a, aed.id)).toBe('100.00');
    });

    it("hides other users' accounts, transactions and categories (404)", async () => {
      const owner = await newUser();
      const other = await newUser();
      const acc = await account(owner, 'Private', '100.00');
      const t = (
        await tx(owner, { type: 'EXPENSE', accountId: acc.id, amount: '10.00' }).expect(201)
      ).body.data;
      const custom = (
        await owner.post('/api/v1/categories').send({ name: 'Mine', type: 'EXPENSE' }).expect(201)
      ).body.data;

      await tx(other, { type: 'EXPENSE', accountId: acc.id, amount: '1.00' }).expect(404);
      await other.patch(`/api/v1/transactions/${t.id}`).send({ amount: '1.00' }).expect(404);
      await other.delete(`/api/v1/transactions/${t.id}`).expect(404);
      await tx(other, {
        type: 'EXPENSE',
        accountId: (await account(other, 'Own')).id,
        amount: '1.00',
        categoryId: custom.id,
      }).expect(404);
      expect(await balanceOf(owner, acc.id)).toBe('90.00');
      expect((await other.get('/api/v1/transactions').expect(200)).body.data).toHaveLength(0);
    });

    it('does not accept new transactions on an archived account', async () => {
      const a = await newUser();
      const acc = await account(a, 'Old', '100.00');
      await a.delete(`/api/v1/accounts/${acc.id}`).expect(200);
      await tx(a, { type: 'INCOME', accountId: acc.id, amount: '5.00' }).expect(404);
    });
  });

  describe('listing, pagination, filters and summary', () => {
    it('pages through results with a cursor: no duplicates, newest first, ends cleanly', async () => {
      const a = await newUser();
      const acc = await account(a, 'Paged', '0.00');
      for (const day of ['01', '02', '03', '04', '05']) {
        await tx(a, {
          type: 'INCOME',
          accountId: acc.id,
          amount: '1.00',
          date: `2026-03-${day}`,
          description: day,
        }).expect(201);
      }

      const seen: string[] = [];
      let cursor: string | null = null;
      let pages = 0;
      do {
        const res: request.Response = await a
          .get('/api/v1/transactions')
          .query({ limit: 2, ...(cursor && { cursor }) })
          .expect(200);
        seen.push(...(res.body.data as Array<{ description: string }>).map((t) => t.description));
        cursor = res.body.meta.nextCursor as string | null;
        pages++;
      } while (cursor);

      expect(seen).toEqual(['05', '04', '03', '02', '01']);
      expect(pages).toBe(3);
    });

    it('filters by type, account, category and date range', async () => {
      const a = await newUser();
      const one = await account(a, 'One', '0.00');
      const two = await account(a, 'Two', '0.00');
      const groceries = await category(a, 'Groceries', 'EXPENSE');
      await tx(a, {
        type: 'EXPENSE',
        accountId: one.id,
        amount: '5.00',
        categoryId: groceries,
        date: '2026-01-10',
      }).expect(201);
      await tx(a, {
        type: 'EXPENSE',
        accountId: two.id,
        amount: '6.00',
        date: '2026-02-10',
      }).expect(201);
      await tx(a, { type: 'INCOME', accountId: one.id, amount: '7.00', date: '2026-03-10' }).expect(
        201,
      );
      await tx(a, {
        type: 'TRANSFER',
        accountId: one.id,
        transferAccountId: two.id,
        amount: '1.00',
        date: '2026-03-11',
      }).expect(201);

      const count = async (q: Record<string, string>) =>
        ((await a.get('/api/v1/transactions').query(q).expect(200)).body.data as unknown[]).length;

      expect(await count({ type: 'EXPENSE' })).toBe(2);
      expect(await count({ accountId: two.id })).toBe(2); // its own expense + the incoming transfer
      expect(await count({ categoryId: groceries })).toBe(1);
      expect(await count({ from: '2026-02-01', to: '2026-03-10' })).toBe(2);
      await a.get('/api/v1/transactions').query({ limit: 500 }).expect(400);
      await a.get('/api/v1/transactions').query({ from: 'yesterday' }).expect(400);
    });

    it('summarises income, expense and net per currency, ignoring transfers', async () => {
      const a = await newUser();
      const aed = await account(a, 'AED', '0.00');
      const aed2 = await account(a, 'AED 2', '0.00');
      const usd = await account(a, 'USD', '0.00', 'USD');
      await tx(a, { type: 'INCOME', accountId: aed.id, amount: '1000.50' }).expect(201);
      await tx(a, { type: 'EXPENSE', accountId: aed.id, amount: '200.25' }).expect(201);
      await tx(a, {
        type: 'TRANSFER',
        accountId: aed.id,
        transferAccountId: aed2.id,
        amount: '300.00',
      }).expect(201);
      await tx(a, { type: 'EXPENSE', accountId: usd.id, amount: '10.00' }).expect(201);

      const { body } = await a.get('/api/v1/transactions/summary').expect(200);
      expect(body.data).toEqual([
        { currency: 'AED', income: '1000.50', expense: '200.25', net: '800.25' },
        { currency: 'USD', income: '0.00', expense: '10.00', net: '-10.00' },
      ]);
    });
  });

  describe('categories', () => {
    it('lists system and own categories; system ones are read-only', async () => {
      const a = await newUser();
      const created = (
        await a
          .post('/api/v1/categories')
          .send({ name: 'Zakat al-Fitr', type: 'EXPENSE', icon: '🌙', halalStatus: 'HALAL' })
          .expect(201)
      ).body.data;
      expect(created).toMatchObject({ isSystem: false, halalStatus: 'HALAL' });

      const list = (await a.get('/api/v1/categories').expect(200)).body.data as Array<{
        name: string;
        isSystem: boolean;
      }>;
      expect(list.some((c) => c.name === 'Groceries' && c.isSystem)).toBe(true);
      expect(list.some((c) => c.name === 'Zakat al-Fitr' && !c.isSystem)).toBe(true);

      await a
        .post('/api/v1/categories')
        .send({ name: 'Zakat al-Fitr', type: 'EXPENSE' })
        .expect(409);
      const groceries = await category(a, 'Groceries', 'EXPENSE');
      await a.patch(`/api/v1/categories/${groceries}`).send({ name: 'Hacked' }).expect(403);
      await a.delete(`/api/v1/categories/${groceries}`).expect(403);
    });

    it('deleting a category keeps its transactions, just uncategorised', async () => {
      const a = await newUser();
      const acc = await account(a, 'Acc');
      const cat = (
        await a.post('/api/v1/categories').send({ name: 'Temp', type: 'EXPENSE' }).expect(201)
      ).body.data;
      await tx(a, {
        type: 'EXPENSE',
        accountId: acc.id,
        amount: '5.00',
        categoryId: cat.id,
      }).expect(201);
      await a.delete(`/api/v1/categories/${cat.id}`).expect(200);

      const [t] = (await a.get('/api/v1/transactions').expect(200)).body.data as Array<{
        categoryId: string | null;
        categoryName: string | null;
      }>;
      expect(t).toMatchObject({ categoryId: null, categoryName: null });
    });
  });

  describe('budgets', () => {
    it('computes spend, percent and status from real transactions', async () => {
      const a = await newUser();
      const aed = await account(a, 'AED', '5000.00');
      const usd = await account(a, 'USD', '5000.00', 'USD');
      const groceries = await category(a, 'Groceries', 'EXPENSE');
      const dining = await category(a, 'Dining Out', 'EXPENSE');

      const budget = (
        await a
          .post('/api/v1/budgets')
          .send({
            categoryId: groceries,
            amount: '100.00',
            period: 'MONTHLY',
            startDate: '2020-01-01',
          })
          .expect(201)
      ).body.data;
      expect(budget).toMatchObject({
        spent: '0.00',
        percent: 0,
        status: 'ON_TRACK',
        remaining: '100.00',
      });

      const get = async () =>
        (
          (await a.get('/api/v1/budgets').expect(200)).body.data as Array<Record<string, unknown>>
        )[0]!;

      await tx(a, {
        type: 'EXPENSE',
        accountId: aed.id,
        amount: '40.00',
        categoryId: groceries,
      }).expect(201);
      expect(await get()).toMatchObject({ spent: '40.00', percent: 40, status: 'ON_TRACK' });

      await tx(a, {
        type: 'EXPENSE',
        accountId: aed.id,
        amount: '40.00',
        categoryId: groceries,
      }).expect(201);
      expect(await get()).toMatchObject({ spent: '80.00', percent: 80, status: 'WARNING' });

      // none of these may count: other category, last month, income, other currency
      await tx(a, {
        type: 'EXPENSE',
        accountId: aed.id,
        amount: '500.00',
        categoryId: dining,
      }).expect(201);
      await tx(a, {
        type: 'EXPENSE',
        accountId: aed.id,
        amount: '500.00',
        categoryId: groceries,
        date: LAST_MONTH,
      }).expect(201);
      await tx(a, {
        type: 'EXPENSE',
        accountId: usd.id,
        amount: '500.00',
        categoryId: groceries,
      }).expect(201);
      expect(await get()).toMatchObject({ spent: '80.00', percent: 80 });

      await tx(a, {
        type: 'EXPENSE',
        accountId: aed.id,
        amount: '15.00',
        categoryId: groceries,
      }).expect(201);
      expect(await get()).toMatchObject({
        spent: '95.00',
        percent: 95,
        status: 'OVER',
        remaining: '5.00',
      });

      await a.patch(`/api/v1/budgets/${budget.id}`).send({ amount: '200.00' }).expect(200);
      expect(await get()).toMatchObject({ percent: 47.5, status: 'ON_TRACK' });
    });

    it('can be evaluated as of another date', async () => {
      const a = await newUser();
      const acc = await account(a, 'AED', '1000.00');
      const groceries = await category(a, 'Groceries', 'EXPENSE');
      await a
        .post('/api/v1/budgets')
        .send({
          categoryId: groceries,
          amount: '100.00',
          period: 'MONTHLY',
          startDate: '2020-01-01',
        })
        .expect(201);
      await tx(a, {
        type: 'EXPENSE',
        accountId: acc.id,
        amount: '30.00',
        categoryId: groceries,
        date: '2026-03-15',
      }).expect(201);

      const [b] = (await a.get('/api/v1/budgets').query({ on: '2026-03-20' }).expect(200)).body
        .data as Array<Record<string, unknown>>;
      expect(b).toMatchObject({
        spent: '30.00',
        windowStart: '2026-03-01',
        windowEnd: '2026-04-01',
      });
    });

    it('enforces rules: expense categories only, one per category+period, owner only', async () => {
      const a = await newUser();
      const other = await newUser();
      const salary = await category(a, 'Salary', 'INCOME');
      const groceries = await category(a, 'Groceries', 'EXPENSE');
      const body = {
        categoryId: groceries,
        amount: '50.00',
        period: 'MONTHLY',
        startDate: '2026-01-01',
      };

      await a
        .post('/api/v1/budgets')
        .send({ ...body, categoryId: salary })
        .expect(400);
      const created = (await a.post('/api/v1/budgets').send(body).expect(201)).body.data;
      await a.post('/api/v1/budgets').send(body).expect(409);
      await a
        .post('/api/v1/budgets')
        .send({ ...body, period: 'YEARLY' })
        .expect(201); // different period is fine

      await other.patch(`/api/v1/budgets/${created.id}`).send({ amount: '1.00' }).expect(404);
      await other.delete(`/api/v1/budgets/${created.id}`).expect(404);
      expect((await other.get('/api/v1/budgets').expect(200)).body.data).toHaveLength(0);
      await a.delete(`/api/v1/budgets/${created.id}`).expect(200);
    });
  });

  describe('monthly report', () => {
    it('returns six months oldest-first with empty months as zero', async () => {
      const a = await newUser();
      const acc = await account(a, 'AED', '0.00');
      await tx(a, { type: 'INCOME', accountId: acc.id, amount: '1000.00' }).expect(201);
      await tx(a, { type: 'EXPENSE', accountId: acc.id, amount: '250.50' }).expect(201);
      await tx(a, {
        type: 'EXPENSE',
        accountId: acc.id,
        amount: '100.00',
        date: LAST_MONTH,
      }).expect(201);

      const { body } = await a.get('/api/v1/reports/monthly').expect(200);
      const months = body.data as Array<{ month: string; income: string; expense: string }>;
      expect(months).toHaveLength(6);
      expect(months.map((m) => m.month)).toEqual([...months.map((m) => m.month)].sort());
      expect(months[5]).toMatchObject({
        month: TODAY.slice(0, 7),
        income: '1000.00',
        expense: '250.50',
      });
      expect(months[4]).toMatchObject({
        month: LAST_MONTH.slice(0, 7),
        income: '0.00',
        expense: '100.00',
      });
      expect(months[0]).toMatchObject({ income: '0.00', expense: '0.00' });
      await a.get('/api/v1/reports/monthly').query({ months: 99 }).expect(400);
    });
  });
});
