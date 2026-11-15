// The admin's time zone: the browser's zone, saved in the hx_tz cookie by
// components/admin-timezone.tsx so the server renders (and the backend
// computes) with the same calendar as the browser. The server API client
// forwards it as X-Timezone (HunterX-Backend src/utils/adminClock.js).
// Without the cookie yet (first visit) everything uses IST.

export const TZ_COOKIE = 'hx_tz';
export const DEFAULT_ADMIN_TIMEZONE = 'Asia/Kolkata';

export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || !tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** A cookie value → a usable zone (IST when missing or invalid). */
export function resolveTimeZone(tz: string | null | undefined): string {
  return isValidTimeZone(tz) ? tz : DEFAULT_ADMIN_TIMEZONE;
}

type WallParts = { y: number; mo: number; d: number; h: number; mi: number };

function wallParts(tz: string, ms: number): WallParts {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
      .formatToParts(new Date(ms))
      .map((p) => [p.type, p.value])
  );
  return { y: +parts.year, mo: +parts.month, d: +parts.day, h: +parts.hour, mi: +parts.minute };
}

/** Today in `tz` as 'YYYY-MM-DD'. */
export function todayIn(tz: string, now = Date.now()): string {
  const { y, mo, d } = wallParts(tz, now);
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// How far `tz`'s wall clock is ahead of UTC at instant `ms`, to the minute.
function offsetAt(tz: string, ms: number): number {
  const { y, mo, d, h, mi } = wallParts(tz, ms);
  return Date.UTC(y, mo - 1, d, h, mi) - Math.floor(ms / 60_000) * 60_000;
}

/**
 * Wall clock 'YYYY-MM-DD' + 'HH:MM' in `tz` → epoch ms (NaN when malformed).
 * Two passes settle DST, like the backend's localToUtc.
 */
export function wallToEpoch(date: string, time: string, tz: string): number {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const tm = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!dm || !tm) return NaN;
  const wall = Date.UTC(+dm[1], +dm[2] - 1, +dm[3], +tm[1], +tm[2]);
  const first = wall - offsetAt(tz, wall);
  return wall - offsetAt(tz, first);
}
