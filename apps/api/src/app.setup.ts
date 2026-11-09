import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';
import type { Env } from './config/env';

/** Shared by main.ts and the e2e tests so both run the exact same pipeline. */
export function configureApp(app: INestApplication): void {
  const webOrigin = app
    .get<ConfigService<Env, true>>(ConfigService)
    .get('WEB_ORIGIN', { infer: true });
  const origin = new URL(webOrigin).origin;

  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin, credentials: true });

  // CSRF defence in depth on top of SameSite=Lax: browsers always send Origin on
  // cross-site unsafe requests, so reject any that isn't our web app.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const safe = req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS';
    if (safe || !req.headers.origin || req.headers.origin === origin) return next();
    res.status(403).json({
      data: null,
      meta: null,
      error: {
        statusCode: 403,
        message: 'Origin not allowed',
        error: 'FORBIDDEN',
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
      },
    });
  });

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor(), new ResponseEnvelopeInterceptor());
}
