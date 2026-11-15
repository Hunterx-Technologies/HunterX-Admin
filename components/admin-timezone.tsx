'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { DEFAULT_ADMIN_TIMEZONE, TZ_COOKIE, isValidTimeZone } from '@/lib/admin-timezone';

const AdminTimeZoneContext = React.createContext<string>(DEFAULT_ADMIN_TIMEZONE);

/** The admin's zone, the same on the server render and in the browser. */
export function useAdminTimeZone(): string {
  return React.useContext(AdminTimeZoneContext);
}

/**
 * Provides the zone the server rendered with (from the hx_tz cookie) and
 * keeps that cookie on the browser's real zone. When it differs (first
 * visit, travel, a new machine) the cookie is saved and the page refreshed
 * once, so dates and dashboards follow the admin's own calendar.
 */
export function AdminTimeZoneProvider({ timeZone, children }: { timeZone: string; children: React.ReactNode }) {
  const router = useRouter();

  React.useEffect(() => {
    let browserZone: string | undefined;
    try {
      browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return;
    }
    if (!isValidTimeZone(browserZone) || browserZone === timeZone) return;
    document.cookie = `${TZ_COOKIE}=${encodeURIComponent(browserZone)}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }, [timeZone, router]);

  return <AdminTimeZoneContext.Provider value={timeZone}>{children}</AdminTimeZoneContext.Provider>;
}
