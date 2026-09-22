'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { refreshTokenAction, logoutAction } from '@/lib/auth/actions';
import { Button } from '@/components/ui/button';
import { Clock, LogOut, RefreshCw, AlertTriangle } from 'lucide-react';

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

function parseJwtExp(token: string): number | null {
  try {
    const parts = token.split('.');
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

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function SessionTimeoutModal() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [remainingSeconds, setRemainingSeconds] = React.useState<number>(120);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Warning threshold in seconds (2 minutes before token exp)
  const WARNING_THRESHOLD = 120;

  const performLogout = React.useCallback(async () => {
    setOpen(false);
    await logoutAction();
    router.push('/login?expired=1');
    router.refresh();
  }, [router]);

  const checkSession = React.useCallback(() => {
    const accessToken = getCookie('access_token');
    if (!accessToken) return;

    const exp = parseJwtExp(accessToken);
    if (!exp) return; // If dev mock or non-JWT token, handled via events or default timer

    const nowSeconds = Math.floor(Date.now() / 1000);
    const secsLeft = exp - nowSeconds;

    if (secsLeft <= 0) {
      performLogout();
    } else if (secsLeft <= WARNING_THRESHOLD) {
      setRemainingSeconds(secsLeft);
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [performLogout]);

  // Periodic check for token expiration
  React.useEffect(() => {
    const timer = setTimeout(() => {
      checkSession();
    }, 0);

    const interval = setInterval(() => {
      checkSession();
    }, 1000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [checkSession]);

  // Listen for custom API session-expired events
  React.useEffect(() => {
    const handleSessionEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.immediateLogout) {
        performLogout();
      } else {
        setRemainingSeconds(60);
        setOpen(true);
      }
    };

    window.addEventListener('hunterx-session-expired', handleSessionEvent);
    return () => window.removeEventListener('hunterx-session-expired', handleSessionEvent);
  }, [performLogout]);

  const handleContinueSession = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await refreshTokenAction();
      if (res.success) {
        setOpen(false);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md animate-in fade-in duration-200" />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md rounded-2xl border border-amber-500/30 bg-surface/95 shadow-[0_0_50px_rgba(245,158,11,0.15)] p-6 space-y-6 text-ink z-10 animate-in zoom-in-95 duration-200">
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)] animate-pulse">
            <Clock className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-bold tracking-tight text-ink">Session Expiring Soon</h3>
          <p className="text-sm text-ink-muted max-w-xs">
            Your security session is about to time out. Would you like to extend your session and stay signed in?
          </p>
        </div>

        {/* Countdown Timer Display */}
        <div className="flex flex-col items-center justify-center py-4 px-6 rounded-xl bg-amber-500/10 border border-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.1)] space-y-1">
          <span className="text-[11px] font-semibold text-amber-400/80 uppercase tracking-widest flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Time Remaining
          </span>
          <span className="text-4xl font-extrabold font-mono text-amber-400 tracking-wider">
            {formatTime(remainingSeconds)}
          </span>
        </div>

        {error && (
          <div className="p-3 rounded-lg border border-red-500/20 bg-red-500/10 text-bad-ink text-xs text-center">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-1">
          <Button
            variant="primary"
            className="w-full py-3 text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-lg"
            onClick={handleContinueSession}
            disabled={loading}
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Extending Session...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                <span>Continue Session</span>
              </>
            )}
          </Button>

          <Button
            variant="ghost"
            className="w-full py-2.5 text-sm font-medium text-ink-muted hover:text-bad-ink hover:bg-red-950/20 border border-line hover:border-red-900/30 flex items-center justify-center gap-2 cursor-pointer transition-colors"
            onClick={performLogout}
            disabled={loading}
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out Now</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
