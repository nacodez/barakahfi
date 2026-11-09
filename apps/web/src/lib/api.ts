import type { ApiResponse } from '@barakahfi/shared';

const BASE = '/api/v1';

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly messages: string[] = [message],
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

/** Auth endpoints are never retried through a refresh (a 401 there means bad credentials). */
const NO_REFRESH = new Set(['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout']);

let inflightRefresh: Promise<boolean> | null = null;

/**
 * Single-flight: simultaneous 401s share one refresh call. Refresh tokens are one-time
 * use, so firing several in parallel would look like token theft to the server.
 */
function refreshSession(): Promise<boolean> {
  inflightRefresh ??= fetch(`${BASE}/auth/refresh`, { method: 'POST' })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      inflightRefresh = null;
    });
  return inflightRefresh;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
}

function send(path: string, { method = 'GET', body }: RequestOptions) {
  return fetch(`${BASE}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function request<T>(path: string, options: RequestOptions): Promise<ApiResponse<T, unknown>> {
  let res = await send(path, options);

  if (res.status === 401 && !NO_REFRESH.has(path) && (await refreshSession())) {
    res = await send(path, options);
  }

  const payload = (await res.json().catch(() => null)) as ApiResponse<T, unknown> | null;

  if (!res.ok) {
    const raw = payload?.error?.message;
    const messages = Array.isArray(raw) ? raw : [raw ?? res.statusText ?? 'Request failed'];
    throw new ApiRequestError(res.status, messages[0] ?? 'Request failed', messages);
  }
  return payload as ApiResponse<T, unknown>;
}

/** Returns just `data` from the `{ data, meta, error }` envelope. */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return (await request<T>(path, options)).data as T;
}

/** For paginated endpoints: returns both `data` and `meta` (e.g. the next cursor). */
export async function apiPage<T, M>(
  path: string,
  options: RequestOptions = {},
): Promise<{ data: T; meta: M }> {
  const payload = await request<T>(path, options);
  return { data: payload.data as T, meta: payload.meta as M };
}
