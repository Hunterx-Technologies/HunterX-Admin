import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { env } from '@/config/env';
import type { ApiResponse } from '@/types/api';
import { ACCESS_TOKEN_COOKIE, AUTH_MODE_COOKIE, REFRESH_TOKEN_COOKIE, authCookieMode, clearAuthCookies, writeAuthCookies } from '@/lib/auth/cookies';

export class ApiError extends Error {
  code: string;
  status?: number;

  constructor(code: string, message: string, status?: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export const apiClient = axios.create({
  baseURL: env.apiUrl,
  timeout: 15000,
});

/**
 * Unwraps an axios call returning the backend's { success, data } envelope.
 * Non-2xx responses already throw ApiError via the response interceptor below;
 * this also guards the (unexpected) case of a 200 with success: false.
 */
export async function unwrap<T>(request: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  const { data } = await request;
  if (!data.success) {
    throw new ApiError(data.error.code, data.error.message);
  }
  return data.data;
}

// Tokens live in HttpOnly cookies (lib/auth/cookies.ts), readable only on
// the server — where every apiClient call runs (the lib/api modules are
// 'use server'). In the browser these find nothing, by design.

async function serverCookies() {
  if (typeof window !== 'undefined') return null;
  try {
    const { cookies } = await import('next/headers');
    return await cookies();
  } catch {
    return null;
  }
}

// Cookies are read-only while a Server Component renders. A refresh there
// would rotate the refresh token without being able to save the new one —
// and the backend treats the old one as reused — so refreshing is left to
// proxy.ts and Server Actions, where cookies can be written.
async function canWriteCookies(): Promise<boolean> {
  const jar = await serverCookies();
  if (!jar) return false;
  try {
    jar.set(AUTH_MODE_COOKIE, authCookieMode, { path: '/', sameSite: 'lax' });
    return true;
  } catch {
    return false;
  }
}

export async function getAccessToken(): Promise<string | null> {
  return (await serverCookies())?.get(ACCESS_TOKEN_COOKIE)?.value || null;
}

export async function getRefreshToken(): Promise<string | null> {
  return (await serverCookies())?.get(REFRESH_TOKEN_COOKIE)?.value || null;
}

export async function setTokens(accessToken: string, refreshToken: string): Promise<void> {
  const jar = await serverCookies();
  if (!jar) return;
  try {
    writeAuthCookies(jar, { accessToken, refreshToken });
  } catch {
    // Cookies can't be written while a Server Component renders; the
    // proxy / next Server Action saves the refreshed pair instead.
  }
}

export async function clearTokens(): Promise<void> {
  const jar = await serverCookies();
  if (!jar) return;
  try {
    clearAuthCookies(jar);
  } catch {}
}

apiClient.interceptors.request.use(async (config) => {
  const requestUrl = config.url || '';
  const isAuthRoute =
    requestUrl.includes('/auth/login') ||
    requestUrl.includes('/auth/register') ||
    requestUrl.includes('/auth/google') ||
    requestUrl.includes('/auth/apple') ||
    requestUrl.includes('/auth/refresh');

  let accessToken = await getAccessToken();

  if (!accessToken && !isAuthRoute) {
    const refreshToken = await getRefreshToken();
    if (refreshToken) {
      accessToken = await refreshOnce(refreshToken);
    }
  }

  if (accessToken) {
    config.headers.set('Authorization', `Bearer ${accessToken}`);
  } else if (!isAuthRoute) {
    throw new ApiError('unauthorized', 'Unauthorized — no token provided', 401);
  }
  return config;
});

// One refresh at a time per session. Keyed by refresh token: this module is
// shared by every request on the server, so a single shared promise would
// hand one admin's new token to another admin's request.
const refreshesInFlight = new Map<string, Promise<string | null>>();

function refreshOnce(refreshToken: string): Promise<string | null> {
  let pending = refreshesInFlight.get(refreshToken);
  if (!pending) {
    pending = refreshAccessToken().finally(() => refreshesInFlight.delete(refreshToken));
    refreshesInFlight.set(refreshToken, pending);
  }
  return pending;
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (refreshToken && !(await canWriteCookies())) return null;
  if (!refreshToken) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hunterx-session-expired', { detail: { immediateLogout: false } }));
    }
    return null;
  }

  try {
    const { data } = await axios.post<ApiResponse<{ access_token?: string; accessToken?: string; refresh_token?: string; refreshToken?: string }>>(
      `${env.apiUrl}/auth/refresh`,
      { refreshToken }
    );

    const resData = data as any;
    if (!resData?.success || !resData?.data) {
      const msg = resData?.message || '';
      if (typeof window !== 'undefined') {
        if (msg.toLowerCase().includes('suspended') || msg.toLowerCase().includes('banned')) {
          await clearTokens();
          alert('Your account has been suspended.');
          window.location.href = '/login';
        } else {
          window.dispatchEvent(new CustomEvent('hunterx-session-expired', { detail: { immediateLogout: false } }));
        }
      }
      return null;
    }

    const newAccessToken = resData.data.access_token || resData.data.accessToken;
    const newRefreshToken = resData.data.refresh_token || resData.data.refreshToken;

    if (!newAccessToken || !newRefreshToken) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('hunterx-session-expired', { detail: { immediateLogout: false } }));
      }
      return null;
    }

    await setTokens(newAccessToken, newRefreshToken);
    return newAccessToken;
  } catch (error: any) {
    const msg = error?.response?.data?.message || '';
    if (typeof window !== 'undefined') {
      if (msg.toLowerCase().includes('suspended') || msg.toLowerCase().includes('banned')) {
        await clearTokens();
        alert('Your account has been suspended.');
        window.location.href = '/login';
      } else {
        window.dispatchEvent(new CustomEvent('hunterx-session-expired', { detail: { immediateLogout: false } }));
      }
    }
    return null;
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiResponse<unknown>>) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    const requestUrl = originalRequest?.url || '';

    const isExcluded =
      requestUrl.includes('/auth/login') ||
      requestUrl.includes('/auth/register') ||
      requestUrl.includes('/auth/google') ||
      requestUrl.includes('/auth/apple') ||
      requestUrl.includes('/auth/refresh');

    const status = error.response?.status;
    const body = error.response?.data as any;
    const message = body?.message || body?.error?.message || '';

    const isSelfSuspension =
      status === 403 &&
      !requestUrl.includes('/admin/users') &&
      (message.toLowerCase().includes('your account has been suspended') ||
       message.toLowerCase().includes('your account has been banned') ||
       message.toLowerCase().includes('account is suspended'));

    if (isSelfSuspension) {
      await clearTokens();
      if (typeof window !== 'undefined') {
        alert('Your account has been suspended.');
        window.location.href = '/login';
      }
      throw new ApiError('forbidden', message || 'Your account has been suspended', 403);
    }

    if (status === 401 && originalRequest && !originalRequest._retried && !isExcluded) {
      originalRequest._retried = true;

      const refreshToken = await getRefreshToken();
      const newAccessToken = refreshToken ? await refreshOnce(refreshToken) : null;

      if (newAccessToken) {
        originalRequest.headers.set('Authorization', `Bearer ${newAccessToken}`);
        return apiClient(originalRequest);
      }
    }

    if (status === 401 && typeof window !== 'undefined' && !isExcluded) {
      window.dispatchEvent(new CustomEvent('hunterx-session-expired'));
    }

    if (body && typeof body === 'object') {
      const errorMessage = body.message || body.error?.message || error.message;
      const errorCode = body.error?.code || 'API_ERROR';
      throw new ApiError(errorCode, errorMessage, status);
    }

    throw new ApiError('network_error', error.message, status);
  }
);
