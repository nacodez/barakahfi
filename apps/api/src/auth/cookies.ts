import type { Response } from 'express';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  REFRESH_COOKIE_PATH,
  REFRESH_TTL_SECONDS,
} from './auth.constants';

const base = (secure: boolean) => ({ httpOnly: true, secure, sameSite: 'lax' as const });

export function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
  secure: boolean,
): void {
  // The cookie outlives the 15-minute JWT on purpose: the web proxy only checks that a
  // session exists (for redirects), and the client refreshes silently when the JWT expires.
  // Expiry itself is always enforced server-side.
  res.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...base(secure),
    path: '/',
    maxAge: REFRESH_TTL_SECONDS * 1000,
  });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...base(secure),
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_TTL_SECONDS * 1000,
  });
}

export function clearAuthCookies(res: Response, secure: boolean): void {
  res.clearCookie(ACCESS_COOKIE, { ...base(secure), path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...base(secure), path: REFRESH_COOKIE_PATH });
}
