// Date/time helpers for scheduled notifications. A schedule is a wall clock
// every hunter receives it at in their OWN timezone (9 AM India, then 9 AM
// London, ...); only "is it in the future?" is judged on the admin's IST
// clock (fixed UTC+05:30, no DST) — mirrors HunterX-Backend
// src/utils/broadcastSchedule.js.

import type { BroadcastRecurrence } from '@/types/notification';

const IST_OFFSET_MS = 330 * 60 * 1000;

/** IST wall-clock 'YYYY-MM-DD' + 'HH:MM' → epoch ms. NaN when malformed. */
export function istToEpoch(date: string, time: string): number {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!d || !t) return NaN;
  return Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2])) - IST_OFFSET_MS;
}

/** A sensible default send moment: the next full hour, at least 30 min away, in IST. */
export function defaultSendMoment(now = Date.now()): { date: string; time: string } {
  const ist = new Date(now + IST_OFFSET_MS + 30 * 60 * 1000);
  ist.setUTCMinutes(0, 0, 0);
  ist.setUTCHours(ist.getUTCHours() + 1);
  const iso = ist.toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

/** 'YYYY-MM-DDTHH:MM' wall clock → e.g. "Thu, 12 Nov 2026, 09:00 local time". */
export function formatWall(wall: string | null | undefined, { withYear = true } = {}): string {
  if (!wall) return '—';
  const d = new Date(`${wall}:00Z`); // read back in UTC = the wall clock itself
  if (Number.isNaN(d.getTime())) return '—';
  const text = d.toLocaleString('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  return `${text} local time`;
}

function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
}

/** Plain-English summary of when a schedule sends. */
export function describeSchedule(date: string, time: string, recurrence: BroadcastRecurrence): string {
  const epoch = istToEpoch(date, time);
  if (Number.isNaN(epoch)) return '';
  const day = new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))));
  const weekday = day.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });
  const start = day.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const dom = day.getUTCDate();

  switch (recurrence) {
    case 'DAILY':
      return `Every day at ${time} local time, starting ${start}`;
    case 'WEEKLY':
      return `Every ${weekday} at ${time} local time, starting ${start}`;
    case 'MONTHLY':
      return `Monthly on the ${ordinal(dom)} at ${time} local time, starting ${start}${dom > 28 ? ' (last day of shorter months)' : ''}`;
    default:
      return `Once, on ${weekday} ${start} at ${time} local time`;
  }
}

export const RECURRENCE_LABEL: Record<BroadcastRecurrence, string> = {
  NONE: 'One-time',
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
};

/** True when HH:MM falls in the push quiet hours (22:00–07:00). */
export function inQuietHours(time: string): boolean {
  const hour = Number(time.slice(0, 2));
  return hour >= 22 || hour < 7;
}
