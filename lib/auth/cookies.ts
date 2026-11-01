// Auth cookies for the admin panel — one place that decides how the access
// and refresh tokens are stored. Used by Server Functions (lib/auth/actions,
// lib/api/client) and by proxy.ts.
//
// The tokens are HttpOnly: page JavaScript (and so any injected script)
// can't read them. Every API call already runs on the server (the lib/api
// modules are 'use server'), so nothing in the browser needs them. What
// the browser does need — when the session runs out, for the timeout
// warning — is in `session_expires_at`, which holds no secret.
//
// Rollback: ADMIN_AUTH_COOKIES_HTTP_ONLY=false writes the tokens readable
// again (the pre-2026-11 behaviour); proxy.ts rewrites existing cookies to
// whichever mode is active on the next page load, so switching either way
// signs nobody out.

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';
export const USER_COOKIE = 'user';
export const SESSION_EXPIRES_COOKIE = 'session_expires_at';
/** Which storage mode the browser's cookies were last written in. */
export const AUTH_MODE_COOKIE = 'auth_cookie_mode';

const ACCESS_MAX_AGE = 60 * 60 * 24 * 7; // 7 days (the JWT itself expires sooner)
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export const tokensHttpOnly = process.env.ADMIN_AUTH_COOKIES_HTTP_ONLY !== 'false';
export const authCookieMode = tokensHttpOnly ? 'httponly' : 'readable';

const secure = process.env.NODE_ENV === 'production';

// Lax, not Strict: an admin opening a dashboard link from email or chat
// arrives signed in. Mutations are Server Actions (POST, and Next.js
// refuses any whose Origin doesn't match the host), so Lax is enough
// against CSRF.
function options(maxAge: number, httpOnly: boolean) {
  return { path: '/', httpOnly, secure, sameSite: 'lax' as const, maxAge };
}

type CookieJar = {
  set(name: string, value: string, options?: Record<string, unknown>): unknown;
  delete(name: string): unknown;
};

/** `exp` (seconds) from a JWT, without verifying it — display only. */
export function jwtExpiry(token: string | undefined | null): number | null {
  try {
    const part = token?.split('.')[1];
    if (!part) return null;
    const json = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof json.exp === 'number' ? json.exp : null;
  } catch {
    return null;
  }
}

export function writeAuthCookies(jar: CookieJar, tokens: { accessToken: string; refreshToken?: string | null }) {
  jar.set(ACCESS_TOKEN_COOKIE, tokens.accessToken, options(ACCESS_MAX_AGE, tokensHttpOnly));
  if (tokens.refreshToken) {
    jar.set(REFRESH_TOKEN_COOKIE, tokens.refreshToken, options(REFRESH_MAX_AGE, tokensHttpOnly));
  }
  const exp = jwtExpiry(tokens.accessToken);
  if (exp) jar.set(SESSION_EXPIRES_COOKIE, String(exp), options(ACCESS_MAX_AGE, false));
  jar.set(AUTH_MODE_COOKIE, authCookieMode, options(REFRESH_MAX_AGE, false));
}

/** The signed-in admin's profile for the UI. Not a secret and not trusted — the API checks the role. */
export function writeUserCookie(jar: CookieJar, user: unknown) {
  jar.set(USER_COOKIE, JSON.stringify(user), options(ACCESS_MAX_AGE, false));
}

export function clearAuthCookies(jar: CookieJar) {
  for (const name of [ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, USER_COOKIE, SESSION_EXPIRES_COOKIE, AUTH_MODE_COOKIE]) {
    jar.delete(name);
  }
}
