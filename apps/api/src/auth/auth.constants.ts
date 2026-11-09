export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';
export const ACCESS_TTL_SECONDS = 15 * 60;
export const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;
/** Refresh cookie is only sent to the auth routes, never to the rest of the API. */
export const REFRESH_COOKIE_PATH = '/api/v1/auth';
