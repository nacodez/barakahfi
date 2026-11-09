import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

// Rate limiting is verified in throttle.e2e-spec.ts; here it would only make repeated logins flaky.
process.env.THROTTLE_DISABLED = 'true';

const RUN = Date.now().toString(36);
const email = (n: string) => `e2e-${RUN}-${n}@test.barakahfi.dev`;
const PASSWORD = 'Barakah123';

function cookie(res: request.Response, name: string): string {
  const raw = (res.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
  const found = raw.find((c) => c.startsWith(`${name}=`));
  if (!found) throw new Error(`cookie ${name} not set`);
  return found.split(';')[0]!;
}

describe('auth + accounts (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let server: App;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    server = app.getHttpServer() as App;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: `e2e-${RUN}` } } });
    await app.close();
  });

  describe('register / login / session', () => {
    it('registers, sets httpOnly cookies and returns the envelope without secrets', async () => {
      const res = await request(server)
        .post('/api/v1/auth/register')
        .send({ name: 'Nazik', email: email('a'), password: PASSWORD })
        .expect(201);

      expect(res.body).toMatchObject({ data: { email: email('a'), role: 'USER' }, error: null });
      expect(JSON.stringify(res.body)).not.toMatch(/password|hash|token/i);
      const cookies = (res.headers['set-cookie'] as unknown as string[]).join('\n');
      expect(cookies).toMatch(/access_token=.*HttpOnly/);
      expect(cookies).toMatch(/refresh_token=.*Path=\/api\/v1\/auth.*HttpOnly/);
    });

    it('rejects duplicate email, weak passwords and unknown properties', async () => {
      const body = { name: 'N', email: email('a'), password: PASSWORD };
      await request(server).post('/api/v1/auth/register').send(body).expect(409);
      await request(server)
        .post('/api/v1/auth/register')
        .send({ ...body, email: email('weak'), password: 'weakpass' })
        .expect(400);
      await request(server)
        .post('/api/v1/auth/register')
        .send({ ...body, email: email('extra'), role: 'ADMIN' })
        .expect(400);
    });

    it('logs in, serves /me, and refuses a wrong password with a generic message', async () => {
      const agent = request.agent(server);
      await agent
        .post('/api/v1/auth/login')
        .send({ email: email('a'), password: PASSWORD })
        .expect(200);
      const me = await agent.get('/api/v1/auth/me').expect(200);
      expect(me.body.data.email).toBe(email('a'));

      for (const e of [email('a'), email('nobody')]) {
        const bad = await request(server)
          .post('/api/v1/auth/login')
          .send({ email: e, password: 'Wrong1234' });
        expect(bad.status).toBe(401);
        expect(bad.body.error.message).toBe('Invalid email or password');
      }
    });

    it('blocks protected routes without a session and after logout', async () => {
      await request(server).get('/api/v1/accounts').expect(401);
      const agent = request.agent(server);
      await agent
        .post('/api/v1/auth/login')
        .send({ email: email('a'), password: PASSWORD })
        .expect(200);
      await agent.get('/api/v1/accounts').expect(200);
      await agent.post('/api/v1/auth/logout').expect(200);
      await agent.get('/api/v1/accounts').expect(401);
    });

    it('keeps /health public', async () => {
      await request(server).get('/api/v1/health').expect(200);
    });

    it('rejects unsafe requests from a foreign Origin', async () => {
      await request(server)
        .post('/api/v1/auth/login')
        .set('Origin', 'https://evil.example')
        .send({ email: email('a'), password: PASSWORD })
        .expect(403);
    });
  });

  describe('refresh token rotation', () => {
    it('rotates, and revokes the family when an old token is replayed', async () => {
      const login = await request(server)
        .post('/api/v1/auth/login')
        .send({ email: email('a'), password: PASSWORD })
        .expect(200);
      const first = cookie(login, 'refresh_token');

      const rotated = await request(server)
        .post('/api/v1/auth/refresh')
        .set('Cookie', first)
        .expect(200);
      const second = cookie(rotated, 'refresh_token');
      expect(second).not.toBe(first);

      // Replaying the already-used token is treated as theft...
      await request(server).post('/api/v1/auth/refresh').set('Cookie', first).expect(401);
      // ...so the legitimately rotated token is dead too.
      await request(server).post('/api/v1/auth/refresh').set('Cookie', second).expect(401);
    });

    it('rejects a missing refresh cookie', async () => {
      await request(server).post('/api/v1/auth/refresh').expect(401);
    });
  });

  describe('accounts', () => {
    const account = { name: 'ADCB Savings', type: 'BANK', currency: 'AED', balance: '1250.50' };

    it('creates, lists, updates and archives an account, with money as strings', async () => {
      const agent = request.agent(server);
      await agent
        .post('/api/v1/auth/login')
        .send({ email: email('a'), password: PASSWORD })
        .expect(200);

      const created = await agent.post('/api/v1/accounts').send(account).expect(201);
      expect(created.body.data).toMatchObject({ balance: '1250.50', isZakatable: true });
      const id = created.body.data.id as string;

      const list = await agent.get('/api/v1/accounts').expect(200);
      expect(list.body.data).toHaveLength(1);

      const patched = await agent
        .patch(`/api/v1/accounts/${id}`)
        .send({ name: 'Renamed' })
        .expect(200);
      expect(patched.body.data.name).toBe('Renamed');
      // balance is ledger-owned and cannot be edited directly
      await agent.patch(`/api/v1/accounts/${id}`).send({ balance: '9.99' }).expect(400);

      await agent.delete(`/api/v1/accounts/${id}`).expect(200);
      expect((await agent.get('/api/v1/accounts').expect(200)).body.data).toHaveLength(0);
    });

    it('rejects float balances and bad currency codes', async () => {
      const agent = request.agent(server);
      await agent
        .post('/api/v1/auth/login')
        .send({ email: email('a'), password: PASSWORD })
        .expect(200);
      await agent
        .post('/api/v1/accounts')
        .send({ ...account, balance: 12.5 })
        .expect(400);
      await agent
        .post('/api/v1/accounts')
        .send({ ...account, currency: 'dirham' })
        .expect(400);
    });

    it("hides one user's accounts from another (404, not 403)", async () => {
      const owner = request.agent(server);
      await owner
        .post('/api/v1/auth/login')
        .send({ email: email('a'), password: PASSWORD })
        .expect(200);
      const { body } = await owner.post('/api/v1/accounts').send(account).expect(201);

      const other = request.agent(server);
      await other
        .post('/api/v1/auth/register')
        .send({ name: 'Other', email: email('b'), password: PASSWORD })
        .expect(201);
      expect((await other.get('/api/v1/accounts').expect(200)).body.data).toHaveLength(0);
      await other.patch(`/api/v1/accounts/${body.data.id}`).send({ name: 'x' }).expect(404);
      await other.delete(`/api/v1/accounts/${body.data.id}`).expect(404);
    });
  });
});
