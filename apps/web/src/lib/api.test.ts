import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiRequestError } from './api';

const ok = (data: unknown) =>
  new Response(JSON.stringify({ data, meta: null, error: null }), { status: 200 });
const fail = (status: number, message: string | string[]) =>
  new Response(JSON.stringify({ data: null, meta: null, error: { statusCode: status, message } }), {
    status,
  });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('api', () => {
  it('unwraps the { data } envelope', async () => {
    fetchMock.mockResolvedValueOnce(ok({ id: 1 }));
    await expect(api('/users/me')).resolves.toEqual({ id: 1 });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/users/me',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('sends JSON bodies and surfaces validation messages', async () => {
    fetchMock.mockResolvedValueOnce(fail(400, ['email must be an email', 'password too short']));
    const err = await api('/auth/register', { method: 'POST', body: { a: 1 } }).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(ApiRequestError);
    expect((err as ApiRequestError).status).toBe(400);
    expect((err as ApiRequestError).messages).toEqual([
      'email must be an email',
      'password too short',
    ]);
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({
      body: '{"a":1}',
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('refreshes once on 401 and retries the original request', async () => {
    fetchMock
      .mockResolvedValueOnce(fail(401, 'Unauthorized'))
      .mockResolvedValueOnce(ok(null)) // POST /auth/refresh
      .mockResolvedValueOnce(ok({ id: 'u1' }));
    await expect(api('/auth/me')).resolves.toEqual({ id: 'u1' });
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      '/api/v1/auth/me',
      '/api/v1/auth/refresh',
      '/api/v1/auth/me',
    ]);
  });

  it('shares ONE refresh between concurrent 401s (refresh tokens are single-use)', async () => {
    let unauthorized = 0;
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith('/auth/refresh')) return Promise.resolve(ok(null));
      return Promise.resolve(unauthorized++ < 3 ? fail(401, 'Unauthorized') : ok('fine'));
    });
    await Promise.all([api('/accounts'), api('/auth/me'), api('/users/me')]);
    const refreshCalls = fetchMock.mock.calls.filter((c) => String(c[0]).endsWith('/auth/refresh'));
    expect(refreshCalls).toHaveLength(1);
  });

  it('gives up with the 401 when the refresh itself fails', async () => {
    fetchMock
      .mockResolvedValueOnce(fail(401, 'Unauthorized'))
      .mockResolvedValueOnce(fail(401, 'Invalid refresh token'));
    await expect(api('/auth/me')).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('never tries to refresh for login (401 means bad credentials)', async () => {
    fetchMock.mockResolvedValueOnce(fail(401, 'Invalid email or password'));
    await expect(api('/auth/login', { method: 'POST', body: {} })).rejects.toMatchObject({
      status: 401,
      message: 'Invalid email or password',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
