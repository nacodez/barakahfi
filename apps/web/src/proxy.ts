import { NextResponse, type NextRequest } from 'next/server';

const AUTH_PAGES = new Set(['/login', '/register']);

/**
 * UX-only redirect based on cookie *presence*. It is not a security boundary:
 * the API validates the JWT on every request, and the client refreshes silently
 * (or lands on /login) when the session is really gone.
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has('access_token');
  const { pathname } = request.nextUrl;
  const isAuthPage = AUTH_PAGES.has(pathname);

  if (!hasSession && !isAuthPage) {
    const url = new URL('/login', request.url);
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  if (hasSession && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ['/dashboard/:path*', '/login', '/register'] };
