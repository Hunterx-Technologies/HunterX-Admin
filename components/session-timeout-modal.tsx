'use client';

import * as React from 'react';
import { refreshTokenAction, logoutAction } from '@/lib/auth/actions';
import { Button } from '@/components/ui/button';
import { Clock, LogOut, RefreshCw } from 'lucide-react';

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(
    new RegExp('(?:^|; )' + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + '=([^;]*)')
  );
  if (!match) return null;
  try {
    const val = decodeURIComponent(match[1]);
    return val.replace(/^"(.*)"$/, '$1');
  } catch {
    return match[1].replace(/^"(.*)"$/, '$1');
  }
}

function parseJwtExp(token: string): number | null {
  try {
    const cleanToken = token.replace(/^"(.*)"$/, '$1').trim();
    const parts = cleanToken.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const parsed = JSON.parse(jsonPayload);
    return typeof parsed.exp === 'number' ? parsed.exp : null;
  } catch {
    return null;
  }
}

function isUserAdmin(): boolean {
  try {
    const userCookie = getCookie('user');
    if (userCookie) {
      try {
        const user = JSON.parse(userCookie);
        if (user?.role && String(user.role).toLowerCase() === 'admin') {
          return true;
        }
      } catch {}
    }
    const accessToken = getCookie('access_token');
    if (accessToken) {
      const parts = accessToken.split('.');
      if (parts.length === 3) {
        try {
          const base64Url = parts[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeURIComponent(
            atob(base64)
              .split('')
              .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
              .join('')
          );
          const parsed = JSON.parse(jsonPayload);
          const role = parsed.role || parsed.userRole || parsed.roles;
          if (typeof role === 'string' && role.toLowerCase() === 'admin') return true;
          if (Array.isArray(role) && role.some((r) => String(r).toLowerCase() === 'admin')) return true;
        } catch {}
      }
      return true; // Default to true if access token exists in admin dashboard
    }
    return false;
  } catch {
    return false;
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.max(0, seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function SessionTimeoutModal() {
  const [open, setOpen] = React.useState(false);
  const [isAlreadyExpired, setIsAlreadyExpired] = React.useState(false);
  const [remainingSeconds, setRemainingSeconds] = React.useState<number>(30);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Warning window: 2 minutes (120 seconds) before token expiration
  const WARNING_THRESHOLD = 120;
  // Idle inactivity limit: 15 minutes without user interaction
  const IDLE_TIMEOUT_MS = 15 * 60 * 1000;

  const countdownIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const expireTargetMsRef = React.useRef<number | null>(null);
  const lastActivityMsRef = React.useRef<number>(Date.now());
  const openRef = React.useRef(false);
  const isLoggingOutRef = React.useRef(false);
  const silentRefreshRef = React.useRef(false);

  const clearTimers = React.useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  const performLogout = React.useCallback(async () => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;

    openRef.current = false;
    expireTargetMsRef.current = null;
    setOpen(false);
    clearTimers();

    try {
      await logoutAction();
    } catch {
      // Best-effort logout
    }

    if (typeof window !== 'undefined') {
      window.location.href = '/login?expired=1';
    }
  }, [clearTimers]);

  const openSessionModal = React.useCallback((targetMs: number, alreadyExpired: boolean) => {
    if (openRef.current) return;

    openRef.current = true;
    expireTargetMsRef.current = targetMs;
    setIsAlreadyExpired(alreadyExpired);

    const initialSecs = Math.max(0, Math.ceil((targetMs - Date.now()) / 1000));
    setRemainingSeconds(initialSecs);
    setError(null);
    setOpen(true);
  }, []);

  // The admin is actively using the panel: renew the token quietly instead of
  // interrupting them. The modal only appears if that renewal fails.
  const silentRefresh = React.useCallback(async (onFail: () => void) => {
    if (silentRefreshRef.current) return;
    silentRefreshRef.current = true;
    try {
      const res = await refreshTokenAction();
      if (!res.success || !res.accessToken) onFail();
    } catch {
      onFail();
    } finally {
      silentRefreshRef.current = false;
    }
  }, []);

  const isRecentlyActive = React.useCallback(
    () => Date.now() - lastActivityMsRef.current < IDLE_TIMEOUT_MS,
    [IDLE_TIMEOUT_MS]
  );

  // Periodic heartbeat session check (runs every 3s + on visibility/focus)
  const checkSession = React.useCallback(() => {
    if (openRef.current) return;
    if (!isUserAdmin()) return;

    // Check user inactivity (idle timeout)
    const idleMs = Date.now() - lastActivityMsRef.current;
    if (idleMs >= IDLE_TIMEOUT_MS) {
      openSessionModal(Date.now() + 60 * 1000, false);
      return;
    }

    const accessToken = getCookie('access_token');
    if (!accessToken) return;

    const exp = parseJwtExp(accessToken);
    if (!exp) return;

    const nowMs = Date.now();
    const expMs = exp * 1000;
    const msLeft = expMs - nowMs;
    const secsLeft = Math.floor(msLeft / 1000);

    if (secsLeft > WARNING_THRESHOLD) return;

    // Token is about to expire (or has) while the admin is active: renew it
    // silently. Only fall back to the modal if the renewal fails.
    silentRefresh(() => {
      if (secsLeft <= 0) {
        // Token expired: 30s grace period to refresh or logout
        openSessionModal(Date.now() + 30 * 1000, true);
      } else {
        // Within warning threshold: countdown to expiration
        openSessionModal(expMs, false);
      }
    });
  }, [openSessionModal, silentRefresh, WARNING_THRESHOLD, IDLE_TIMEOUT_MS]);

  // Track user activity to detect idle state
  React.useEffect(() => {
    const recordActivity = () => {
      lastActivityMsRef.current = Date.now();
    };

    window.addEventListener('mousemove', recordActivity, { passive: true });
    window.addEventListener('keydown', recordActivity, { passive: true });
    window.addEventListener('click', recordActivity, { passive: true });
    window.addEventListener('scroll', recordActivity, { passive: true });

    return () => {
      window.removeEventListener('mousemove', recordActivity);
      window.removeEventListener('keydown', recordActivity);
      window.removeEventListener('click', recordActivity);
      window.removeEventListener('scroll', recordActivity);
    };
  }, []);

  // Check every 3 seconds so backgrounding or tab switching never misses the window
  React.useEffect(() => {
    checkSession();
    const interval = setInterval(checkSession, 3000);
    return () => clearInterval(interval);
  }, [checkSession]);

  // Handle visibility change and tab focus immediately
  React.useEffect(() => {
    const handleActivity = () => {
      if (document.visibilityState === 'visible') {
        if (openRef.current && expireTargetMsRef.current) {
          const msLeft = expireTargetMsRef.current - Date.now();
          const secs = Math.max(0, Math.ceil(msLeft / 1000));
          setRemainingSeconds(secs);
          if (msLeft <= 0) {
            performLogout();
          }
        } else {
          checkSession();
        }
      }
    };

    document.addEventListener('visibilitychange', handleActivity);
    window.addEventListener('focus', handleActivity);
    return () => {
      document.removeEventListener('visibilitychange', handleActivity);
      window.removeEventListener('focus', handleActivity);
    };
  }, [checkSession, performLogout]);

  // Listen for custom API session-expired events (triggered by 401s in client.ts)
  React.useEffect(() => {
    const handleSessionEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.immediateLogout) {
        performLogout();
        return;
      }

      if (openRef.current) return;
      const showModal = () => openSessionModal(Date.now() + 30 * 1000, true);
      if (isRecentlyActive()) silentRefresh(showModal);
      else showModal();
    };

    window.addEventListener('hunterx-session-expired', handleSessionEvent);
    return () => window.removeEventListener('hunterx-session-expired', handleSessionEvent);
  }, [openSessionModal, performLogout, isRecentlyActive, silentRefresh]);

  // Expose browser console test helper: window.__testSessionTimeout(30)
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__testSessionTimeout = (seconds = 60) => {
        openSessionModal(Date.now() + seconds * 1000, false);
      };
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).__testSessionTimeout;
      }
    };
  }, [openSessionModal]);

  // Countdown timer: ONLY runs while modal is open, based on wall-clock target timestamp
  React.useEffect(() => {
    if (!open) {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      return;
    }

    const tick = () => {
      if (!expireTargetMsRef.current) return;
      const msLeft = expireTargetMsRef.current - Date.now();
      const secs = Math.max(0, Math.ceil(msLeft / 1000));
      setRemainingSeconds(secs);

      if (msLeft <= 0) {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        performLogout();
      }
    };

    // Immediate tick when modal opens
    tick();

    // Tick every 500ms to guarantee responsive, smooth second transitions with zero drift
    countdownIntervalRef.current = setInterval(tick, 500);

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [open, performLogout]);

  const handleContinueSession = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await refreshTokenAction();
      if (res.success && res.accessToken) {
        openRef.current = false;
        expireTargetMsRef.current = null;
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        setOpen(false);
        setError(null);
        lastActivityMsRef.current = Date.now();
        checkSession();
      } else {
        setError(res.error || 'Failed to extend session.');
      }
    } catch {
      setError('Network error extending session.');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const isLowTime = remainingSeconds <= 30;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-sm rounded-xl border border-line bg-surface shadow-2xl p-5 space-y-4 text-ink z-10 animate-in zoom-in-95 duration-200">
        <div className="flex items-start gap-3.5">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center border shrink-0 mt-0.5 transition-colors ${
              isLowTime
                ? 'bg-red-500/10 border-red-500/25 text-red-400'
                : 'bg-amber-500/10 border-amber-500/25 text-amber-400'
            }`}
          >
            <Clock className="w-4.5 h-4.5" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-ink">
                {isAlreadyExpired ? 'Session Expired' : 'Session Expiring Soon'}
              </h3>
              <span
                className={`font-mono text-xs font-semibold px-2 py-0.5 rounded border tabular-nums transition-colors ${
                  isLowTime
                    ? 'bg-red-500/10 text-red-400 border-red-500/25 animate-pulse'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/25'
                }`}
              >
                {formatTime(remainingSeconds)}
              </span>
            </div>
            <p className="text-xs text-ink-muted mt-1 leading-relaxed">
              {isAlreadyExpired
                ? 'Your admin access has expired. Extend your session now to stay signed in.'
                : 'You will be signed out soon due to inactivity. Would you like to stay signed in?'}
            </p>
          </div>
        </div>

        {error && (
          <div className="p-2.5 rounded-lg border border-red-500/20 bg-red-500/10 text-bad-ink text-xs">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-line/60">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={performLogout}
            disabled={loading}
            className="text-xs text-ink-muted hover:text-bad-ink"
          >
            <LogOut className="w-3.5 h-3.5 mr-1.5" />
            Sign Out
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleContinueSession}
            disabled={loading}
            className="text-xs font-medium"
          >
            {loading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                Extending...
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Continue Session
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

