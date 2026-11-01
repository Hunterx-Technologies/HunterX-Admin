import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { env } from '@/config/env';
import {
  ACCESS_TOKEN_COOKIE,
  AUTH_MODE_COOKIE,
  REFRESH_TOKEN_COOKIE,
  USER_COOKIE,
  authCookieMode,
  clearAuthCookies,
  writeAuthCookies,
} from '@/lib/auth/cookies';

function isJwtExpired(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload =
      typeof Buffer !== 'undefined'
        ? Buffer.from(base64, 'base64').toString('utf-8')
        : decodeURIComponent(
            atob(base64)
              .split('')
              .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
              .join('')
          );
    const payload = JSON.parse(jsonPayload);
    if (payload.exp && typeof payload.exp === 'number') {
      return payload.exp * 1000 < Date.now();
    }
    return false;
  } catch {
    return false;
  }
}

// Puts freshly written auth cookies on the request too, so the page that
// renders in this same request sees the new token, not the expired one.
function nextWithCookies(request: NextRequest, write: (response: NextResponse) => void) {
  const staged = NextResponse.next();
  write(staged);
  for (const cookie of staged.cookies.getAll()) request.cookies.set(cookie.name, cookie.value);
  const response = NextResponse.next({ request: { headers: request.headers } });
  for (const cookie of staged.cookies.getAll()) response.cookies.set(cookie);
  return response;
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Retrieve auth status and user details from cookies
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value?.trim();
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value?.trim();
  const userCookie = request.cookies.get(USER_COOKIE)?.value;

  const hasToken = Boolean(accessToken && accessToken.length > 0);
  const tokenExpired = hasToken ? isJwtExpired(accessToken!) : false;

  let isAdmin = false;
  if (userCookie) {
    try {
      const user = JSON.parse(userCookie);
      if (user?.role && String(user.role).toLowerCase() === 'admin') {
        isAdmin = true;
      }
    } catch {}
  }

  const isPublicRoute = pathname === '/login';

  // Handle unauthenticated or expired sessions
  if (!isPublicRoute && (!hasToken || tokenExpired || !isAdmin)) {
    // If access token is expired but refresh token exists, attempt refresh
    if (tokenExpired && refreshToken && isAdmin) {
      try {
        const res = await fetch(`${env.apiUrl}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        const data = await res.json();
        const newAccessToken = data?.data?.access_token || data?.data?.accessToken;
        const newRefreshToken = data?.data?.refresh_token || data?.data?.refreshToken || refreshToken;

        if (res.ok && newAccessToken) {
          return nextWithCookies(request, (response) =>
            writeAuthCookies(response.cookies, { accessToken: newAccessToken, refreshToken: newRefreshToken })
          );
        }
      } catch {}
    }

    const url = request.nextUrl.clone();
    url.pathname = '/login';
    if (pathname !== '/' && pathname !== '/login') {
      url.searchParams.set('redirectTo', pathname);
    }
    const response = NextResponse.redirect(url);
    clearAuthCookies(response.cookies);
    return response;
  }

  // Redirect authenticated admins away from the login page
  if (isPublicRoute && hasToken && !tokenExpired && isAdmin) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  // Cookies written before HttpOnly (or under the other rollback mode):
  // rewrite them once, same values, so nobody is signed out by the switch.
  if (hasToken && request.cookies.get(AUTH_MODE_COOKIE)?.value !== authCookieMode) {
    return nextWithCookies(request, (response) =>
      writeAuthCookies(response.cookies, { accessToken: accessToken!, refreshToken })
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
