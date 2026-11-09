import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { ApiResponse } from '@barakahfi/shared';
import { map, type Observable } from 'rxjs';

/** Handlers may return `{ data, meta }` (paginated) or a bare value. */
export interface Paginated<T, M> {
  data: T;
  meta: M;
}

function isPaginated(v: unknown): v is Paginated<unknown, unknown> {
  return typeof v === 'object' && v !== null && 'data' in v && 'meta' in v;
}

@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<ApiResponse<unknown, unknown>> {
    return next
      .handle()
      .pipe(
        map((value: unknown) =>
          isPaginated(value)
            ? { data: value.data, meta: value.meta, error: null }
            : { data: value ?? null, meta: null, error: null },
        ),
      );
  }
}
