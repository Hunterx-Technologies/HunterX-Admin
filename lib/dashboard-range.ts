// The Dashboard's date filter, kept in the URL (?range=30d or ?from=&to=)
// so a reload or a shared link shows the same period. The backend reads
// the same params (HunterX-Backend src/utils/dashboardRange.js) and
// defaults to the last 7 days. Dates are IST calendar days, inclusive.

export const RANGE_PRESETS = [
  { key: '7d', label: 'Last 7 days', short: '7 days' },
  { key: '30d', label: 'Last 30 days', short: '30 days' },
  { key: '60d', label: 'Last 60 days', short: '60 days' },
  { key: '90d', label: 'Last 90 days', short: '90 days' },
  { key: '6m', label: 'Last 6 months', short: '6 months' },
  { key: '1y', label: 'Last 1 year', short: '1 year' },
  { key: '3y', label: 'Last 3 years', short: '3 years' },
] as const;

export type RangePreset = (typeof RANGE_PRESETS)[number]['key'];

export type DashboardRange =
  | { preset: RangePreset }
  | { preset: 'custom'; from: string; to: string }; // 'YYYY-MM-DD'

/** Query params the backend takes for a range. */
export type RangeParams = { range: RangePreset } | { from: string; to: string };

export const DEFAULT_RANGE: DashboardRange = { preset: '7d' };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isPreset = (v: unknown): v is RangePreset => RANGE_PRESETS.some((p) => p.key === v);
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Today in IST as 'YYYY-MM-DD' (the backend's notion of "today"). */
export function todayIst(now: number): string {
  return new Date(now + 330 * 60 * 1000).toISOString().slice(0, 10);
}

/** Reads the range from the page's search params; anything malformed → last 7 days. */
export function parseDashboardRange(sp: Record<string, string | string[] | undefined>): DashboardRange {
  const from = first(sp.from);
  const to = first(sp.to);
  if (from && to && DATE_RE.test(from) && DATE_RE.test(to) && from <= to) return { preset: 'custom', from, to };
  const range = first(sp.range);
  return isPreset(range) ? { preset: range } : DEFAULT_RANGE;
}

export function rangeParams(r: DashboardRange): RangeParams {
  return r.preset === 'custom' ? { from: r.from, to: r.to } : { range: r.preset };
}

/** The URL search string for a range ('' for the default, so the plain URL stays clean). */
export function rangeSearch(r: DashboardRange): string {
  if (r.preset === DEFAULT_RANGE.preset) return '';
  return `?${new URLSearchParams(rangeParams(r) as Record<string, string>).toString()}`;
}

/** Stable identity, e.g. for resetting a list's page when the range changes. */
export function rangeKey(r: DashboardRange): string {
  return r.preset === 'custom' ? `${r.from}_${r.to}` : r.preset;
}

function formatDay(iso: string, withYear: boolean) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  });
}

/** "Last 30 days", or "Sep 1 – Sep 30, 2026" for a custom range. */
export function rangeLabel(r: DashboardRange): string {
  if (r.preset !== 'custom') return RANGE_PRESETS.find((p) => p.key === r.preset)!.label;
  const sameYear = r.from.slice(0, 4) === r.to.slice(0, 4);
  if (r.from === r.to) return formatDay(r.from, true);
  return `${formatDay(r.from, !sameYear)} – ${formatDay(r.to, true)}`;
}

/** Short form for the floating chip: "30 days", "Sep 1 – Sep 30, 2026". */
export function rangeChipLabel(r: DashboardRange): string {
  return r.preset === 'custom' ? rangeLabel(r) : RANGE_PRESETS.find((p) => p.key === r.preset)!.short;
}
