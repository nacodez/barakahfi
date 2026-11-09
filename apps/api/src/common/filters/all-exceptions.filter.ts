import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ApiError, ApiResponse } from '@barakahfi/shared';
import type { Request, Response } from 'express';

/** Maps every thrown error to the `{ data: null, meta: null, error }` envelope. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const statusCode = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = isHttp ? exception.getResponse() : null;

    let message: string | string[] = 'Internal server error';
    if (typeof body === 'string') message = body;
    else if (body && typeof body === 'object' && 'message' in body) {
      message = (body as { message: string | string[] }).message;
    }

    if (statusCode >= 500) {
      this.logger.error(
        `${req.method} ${req.originalUrl} → ${statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const error: ApiError = {
      statusCode,
      // Never leak internals on 5xx.
      message: statusCode >= 500 ? 'Internal server error' : message,
      error: HttpStatus[statusCode] ?? 'Error',
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
    };
    const payload: ApiResponse<null> = { data: null, meta: null, error };
    res.status(statusCode).json(payload);
  }
}
