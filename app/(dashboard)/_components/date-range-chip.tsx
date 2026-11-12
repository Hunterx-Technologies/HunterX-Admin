'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { CalendarRange, Check, ChevronUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { cn } from '@/lib/utils';
import {
  RANGE_PRESETS,
  rangeChipLabel,
  rangeSearch,
  todayIst,
  type DashboardRange,
} from '@/lib/dashboard-range';

const MAX_CUSTOM_DAYS = 5 * 366; // same limit as the backend
// DatePicker's portaled calendar panel.
const CALENDAR = '.popover-pop[data-placement]';

function customRangeError(from: string, to: string, today: string): string | null {
  if (!from || !to) return 'Pick both a start and an end date.';
  if (from > to) return 'The start date must be on or before the end date.';
  if (from > today) return 'The start date can’t be in the future.';
  const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 864e5 + 1;
  if (days > MAX_CUSTOM_DAYS) return 'A custom range can be at most 5 years.';
  return null;
}

/**
 * Floating date-range chip (bottom right of the Dashboard). Picking a range
 * puts it in the URL; the page re-renders and every widget loads it from
 * the API.
 */
export function DateRangeChip({ range }: { range: DashboardRange }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = React.useTransition();
  const [open, setOpen] = React.useState(false);
  const [customOpen, setCustomOpen] = React.useState(range.preset === 'custom');
  const [from, setFrom] = React.useState(range.preset === 'custom' ? range.from : '');
  const [to, setTo] = React.useState(range.preset === 'custom' ? range.to : '');
  const [customError, setCustomError] = React.useState<string | null>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);

  // Close on an outside press or Escape. The custom dates' calendars open in
  // a portal (DatePicker's panel), so presses inside them don't count as
  // outside, and Escape there closes only the calendar.
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Element;
      if (rootRef.current?.contains(target) || target.closest?.(CALENDAR)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector(CALENDAR)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const apply = (next: DashboardRange) => {
    setOpen(false);
    startTransition(() => {
      router.push(`${pathname}${rangeSearch(next)}`, { scroll: false });
    });
  };

  const applyCustom = () => {
    const error = customRangeError(from, to, todayIst(Date.now()));
    setCustomError(error);
    if (!error) apply({ preset: 'custom', from, to });
  };

  return (
    <div ref={rootRef} className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40">
      {open && (
        <div
          role="dialog"
          aria-label="Dashboard date range"
          data-side="top"
          className="popover-pop origin-bottom-right absolute bottom-full right-0 mb-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-line bg-surface shadow-2xl p-2"
        >
          <p className="px-2.5 pt-1.5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Date range</p>
          <ul className="space-y-0.5">
            {RANGE_PRESETS.map((p) => {
              const active = range.preset === p.key;
              return (
                <li key={p.key}>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomOpen(false);
                      if (!active) apply({ preset: p.key });
                      else setOpen(false);
                    }}
                    className={cn(
                      'w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-sm text-left cursor-pointer transition-colors',
                      active ? 'bg-accent/10 text-accent-ink font-medium' : 'text-ink hover:bg-surface-inset'
                    )}
                  >
                    {p.label}
                    {active && <Check className="w-4 h-4 shrink-0" />}
                  </button>
                </li>
              );
            })}
            <li className="pt-1 mt-1 border-t border-line/60">
              <button
                type="button"
                aria-expanded={customOpen}
                onClick={() => setCustomOpen((v) => !v)}
                className={cn(
                  'w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-sm text-left cursor-pointer transition-colors',
                  range.preset === 'custom' ? 'bg-accent/10 text-accent-ink font-medium' : 'text-ink hover:bg-surface-inset'
                )}
              >
                Custom range
                {range.preset === 'custom' ? (
                  <Check className="w-4 h-4 shrink-0" />
                ) : (
                  <ChevronUp className={cn('w-4 h-4 shrink-0 text-ink-faint transition-transform', !customOpen && 'rotate-180')} />
                )}
              </button>
            </li>
          </ul>

          {customOpen && (
            <div className="px-2.5 pt-2 pb-1.5 space-y-3">
              <DatePicker label="Start date" value={from} onChange={(e) => { setFrom(e.target.value); setCustomError(null); }} />
              <DatePicker label="End date" value={to} onChange={(e) => { setTo(e.target.value); setCustomError(null); }} />
              {customError && <p className="text-xs text-bad-ink">{customError}</p>}
              <Button type="button" size="sm" className="w-full" onClick={applyCustom} disabled={pending}>
                Apply
              </Button>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title="Change the dashboard's date range"
        className={cn(
          'flex items-center gap-2 pl-3.5 pr-3 py-2.5 rounded-full border bg-surface text-sm font-medium text-ink shadow-lg cursor-pointer transition-colors',
          open ? 'border-accent ring-1 ring-accent' : 'border-line hover:border-line-strong'
        )}
      >
        {pending ? (
          <Loader2 className="w-4 h-4 text-accent-ink animate-spin" aria-label="Loading" />
        ) : (
          <CalendarRange className="w-4 h-4 text-accent-ink" />
        )}
        <span className="max-w-[60vw] truncate">{rangeChipLabel(range)}</span>
        <ChevronUp className={cn('w-4 h-4 text-ink-faint transition-transform', !open && 'rotate-180')} />
      </button>
    </div>
  );
}
