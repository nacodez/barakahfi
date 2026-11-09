import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { tap, type Observable } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<Request & { user?: { sub: string } }>();
    const start = performance.now();
    return next.handle().pipe(
      tap({
        finalize: () => {
          const res = ctx.switchToHttp().getResponse<Response>();
          this.logger.log(
            JSON.stringify({
              method: req.method,
              path: req.originalUrl,
              status: res.statusCode,
              ms: Math.round(performance.now() - start),
              userId: req.user?.sub ?? null,
            }),
          );
        },
      }),
    );
  }
}
