import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

describe('rate limiting (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    delete process.env.THROTTLE_DISABLED;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(() => app.close());

  it('allows 5 login attempts per minute per IP, then returns 429 in the standard envelope', async () => {
    const server = app.getHttpServer() as App;
    const attempt = () =>
      request(server)
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@test.barakahfi.dev', password: 'Wrong1234' });

    for (let i = 0; i < 5; i++) await attempt().expect(401);

    const blocked = await attempt().expect(429);
    expect(blocked.body).toMatchObject({ data: null, error: { statusCode: 429 } });
  });
});
