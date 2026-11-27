'use client';

import * as React from 'react';
import { ChevronDown, ChevronRight, Globe2, MapPin, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  CONTINENTS,
  countriesIn,
  groupRegions,
  regionFlag,
  regionName,
  type ContinentId,
} from '@/lib/regions';

type Props = {
  /** ISO country codes; [] with limited=false = worldwide. */
  value: string[];
  onChange: (codes: string[]) => void;
  /** false = worldwide. Kept apart from value so "Specific regions" with nothing picked yet stays open. */
  limited: boolean;
  onLimitedChange: (limited: boolean) => void;
  disabled?: boolean;
};

/**
 * Who a task is for: worldwide, or any mix of whole continents and single
 * countries — one or many. Always yields country codes; picking a
 * continent selects all of its countries.
 */
export function RegionPicker({ value, onChange, limited, onLimitedChange, disabled }: Props) {
  const selected = React.useMemo(() => new Set(value), [value]);
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState<Set<ContinentId>>(() => new Set());

  const set = (codes: Iterable<string>) => onChange([...new Set(codes)].sort());
  const toggleCountry = (code: string) => {
    const next = new Set(selected);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    set(next);
  };
  const toggleContinent = (id: ContinentId) => {
    const all = countriesIn(id);
    const next = new Set(selected);
    if (all.every((c) => next.has(c))) all.forEach((c) => next.delete(c));
    else all.forEach((c) => next.add(c));
    set(next);
  };
  const removeGroup = (codes: string[]) => {
    const next = new Set(selected);
    codes.forEach((c) => next.delete(c));
    set(next);
  };
  const toggleOpen = (id: ContinentId) =>
    setOpen((o) => {
      const next = new Set(o);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const q = query.trim().toLowerCase();
  const matches = (code: string) => !q || regionName(code).toLowerCase().includes(q) || code.toLowerCase() === q;
  const groups = groupRegions(value);

  return (
    <div className="space-y-4">
      {/* Worldwide / specific */}
      <div className="grid grid-cols-2 gap-2 p-1 rounded-xl border border-line bg-surface-inset/40" role="radiogroup" aria-label="Region">
        {[
          { on: false, icon: Globe2, title: 'Worldwide', hint: 'Every hunter' },
          { on: true, icon: MapPin, title: 'Specific regions', hint: 'Continents or countries' },
        ].map(({ on, icon: Icon, title, hint }) => (
          <button
            key={title}
            type="button"
            role="radio"
            aria-checked={limited === on}
            disabled={disabled}
            onClick={() => onLimitedChange(on)}
            className={cn(
              'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors disabled:opacity-50',
              limited === on ? 'bg-accent/15 ring-1 ring-accent text-ink' : 'text-ink-muted hover:bg-surface-inset'
            )}
          >
            <Icon className={cn('w-4 h-4 shrink-0', limited === on ? 'text-accent-ink' : '')} />
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{title}</span>
              <span className="block text-[11px] text-ink-faint">{hint}</span>
            </span>
          </button>
        ))}
      </div>

      {limited && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Continents: one click selects / clears all of a continent's countries */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Continents</span>
            <div className="flex flex-wrap gap-2">
              {CONTINENTS.map((c) => {
                const all = countriesIn(c.id);
                const count = all.filter((code) => selected.has(code)).length;
                const full = count === all.length;
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={disabled}
                    aria-pressed={full}
                    onClick={() => toggleContinent(c.id)}
                    className={cn(
                      'px-3 py-1.5 rounded-full border text-xs font-medium transition-colors disabled:opacity-50',
                      full
                        ? 'border-accent bg-accent/15 text-accent-ink'
                        : count > 0
                        ? 'border-accent/50 text-ink'
                        : 'border-line text-ink-muted hover:border-accent/50 hover:text-ink'
                    )}
                  >
                    {c.name}
                    {count > 0 && !full && <span className="ml-1.5 text-ink-faint">{count}/{all.length}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Countries */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Countries</span>
            <div className="relative">
              <Search className="w-4 h-4 text-ink-faint absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search countries, e.g. India or IN"
                disabled={disabled}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-line bg-surface-inset/50 text-ink placeholder-ink-faint text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
              />
            </div>
            <div className="max-h-80 overflow-y-auto rounded-lg border border-line divide-y divide-line/60">
              {CONTINENTS.map((c) => {
                const all = countriesIn(c.id);
                const shown = all.filter(matches);
                if (shown.length === 0) return null;
                const count = all.filter((code) => selected.has(code)).length;
                const expanded = Boolean(q) || open.has(c.id);
                return (
                  <div key={c.id}>
                    <div className="flex items-center gap-2 px-3 py-2 bg-surface-inset/40 sticky top-0 z-[1] backdrop-blur">
                      <button
                        type="button"
                        onClick={() => toggleOpen(c.id)}
                        className="flex items-center gap-1.5 flex-1 min-w-0 text-left text-sm font-semibold text-ink"
                        aria-expanded={expanded}
                      >
                        {expanded ? <ChevronDown className="w-4 h-4 text-ink-faint" /> : <ChevronRight className="w-4 h-4 text-ink-faint" />}
                        {c.name}
                        <span className="text-xs font-normal text-ink-faint">{count > 0 ? `${count} of ${all.length}` : all.length}</span>
                      </button>
                      <Checkbox
                        checked={count === all.length}
                        indeterminate={count > 0 && count < all.length}
                        onChange={() => toggleContinent(c.id)}
                        disabled={disabled}
                        label={`All of ${c.name}`}
                      />
                    </div>
                    {expanded && (
                      <ul className="grid sm:grid-cols-2">
                        {shown.map((code) => (
                          <li key={code}>
                            <label className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-surface-inset/60 text-sm">
                              <Checkbox checked={selected.has(code)} onChange={() => toggleCountry(code)} disabled={disabled} />
                              <span aria-hidden>{regionFlag(code)}</span>
                              <span className="flex-1 min-w-0 truncate text-ink">{regionName(code)}</span>
                              <span className="text-[11px] font-mono text-ink-faint">{code}</span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
              {CONTINENTS.every((c) => countriesIn(c.id).filter(matches).length === 0) && (
                <p className="px-3 py-6 text-center text-sm text-ink-faint">No country matches “{query}”.</p>
              )}
            </div>
          </div>

          {/* Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
                Selected · {value.length} {value.length === 1 ? 'country' : 'countries'}
              </span>
              {value.length > 0 && (
                <button type="button" onClick={() => onChange([])} disabled={disabled} className="text-xs text-ink-muted hover:text-bad-ink">
                  Clear all
                </button>
              )}
            </div>
            {groups.length === 0 ? (
              <p className="text-xs text-bad-ink">Pick at least one continent or country, or switch back to Worldwide.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {groups.map((g) => (
                  <span
                    key={g.kind === 'continent' ? g.id : g.code}
                    className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-full border border-line bg-surface-inset/50 text-xs text-ink"
                  >
                    {g.kind === 'continent' ? <Globe2 className="w-3.5 h-3.5 text-accent-ink" /> : <span aria-hidden>{regionFlag(g.code)}</span>}
                    {g.kind === 'continent' ? `${g.label} (all ${g.codes.length})` : g.label}
                    <button
                      type="button"
                      onClick={() => removeGroup(g.kind === 'continent' ? g.codes : [g.code])}
                      disabled={disabled}
                      className="p-0.5 rounded-full text-ink-faint hover:text-bad-ink"
                      aria-label={`Remove ${g.label}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Checkbox({
  checked,
  indeterminate = false,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  disabled?: boolean;
  label?: string;
}) {
  const ref = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      aria-label={label}
      className="w-4 h-4 shrink-0 rounded accent-accent cursor-pointer disabled:cursor-not-allowed"
    />
  );
}
