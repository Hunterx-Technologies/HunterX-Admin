import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

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

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Retrieve auth status and user details from cookies
  const accessToken = request.cookies.get('access_token')?.value?.trim();
  const refreshToken = request.cookies.get('refresh_token')?.value?.trim();
  const userCookie = request.cookies.get('user')?.value;

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
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';
        const res = await fetch(`${apiUrl}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        const data = await res.json();
        const newAccessToken = data?.data?.access_token || data?.data?.accessToken;
        const newRefreshToken = data?.data?.refresh_token || data?.data?.refreshToken || refreshToken;

        if (res.ok && newAccessToken) {
          const response = NextResponse.next();
          response.cookies.set('access_token', newAccessToken, {
            path: '/',
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 60 * 60 * 24 * 7,
          });
          response.cookies.set('refresh_token', newRefreshToken, {
            path: '/',
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 60 * 60 * 24 * 30,
          });
          return response;
        }
      } catch {}
    }

    const url = request.nextUrl.clone();
    url.pathname = '/login';
    if (pathname !== '/' && pathname !== '/login') {
      url.searchParams.set('redirectTo', pathname);
    }
    const response = NextResponse.redirect(url);
    response.cookies.delete('access_token');
    response.cookies.delete('refresh_token');
    response.cookies.delete('user');
    return response;
  }

  // Redirect authenticated admins away from the login page
  if (isPublicRoute && hasToken && !tokenExpired && isAdmin) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
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
