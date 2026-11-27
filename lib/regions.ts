import { CONTINENTS, COUNTRY_CONTINENT, COUNTRY_FALLBACK_NAME, type ContinentId } from '@/lib/region-data';

export { CONTINENTS, type ContinentId };

let displayNames: Intl.DisplayNames | null | undefined;

/** Every country code, by continent, sorted by display name. */
const BY_CONTINENT: Record<ContinentId, string[]> = Object.fromEntries(
  CONTINENTS.map((c) => [c.id, [] as string[]])
) as unknown as Record<ContinentId, string[]>;
for (const [code, continent] of Object.entries(COUNTRY_CONTINENT)) BY_CONTINENT[continent].push(code);
for (const list of Object.values(BY_CONTINENT)) list.sort((a, b) => regionName(a).localeCompare(regionName(b)));

/** "IN" → "India". */
export function regionName(code: string): string {
  if (displayNames === undefined) {
    try {
      displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
    } catch {
      displayNames = null;
    }
  }
  return displayNames?.of(code) ?? COUNTRY_FALLBACK_NAME[code] ?? code;
}

/** "IN" → 🇮🇳 */
export function regionFlag(code: string): string {
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export function countriesIn(continent: ContinentId): string[] {
  return BY_CONTINENT[continent];
}

export function continentName(id: ContinentId): string {
  return CONTINENTS.find((c) => c.id === id)?.name ?? id;
}

export type RegionGroup =
  | { kind: 'continent'; id: ContinentId; label: string; codes: string[] }
  | { kind: 'country'; code: string; label: string };

/**
 * Selected codes → what to show: a continent whose every country is
 * selected collapses into one entry ("Asia"); the rest are listed as countries.
 */
export function groupRegions(codes: string[]): RegionGroup[] {
  const selected = new Set(codes);
  const groups: RegionGroup[] = [];
  const loose: string[] = [];
  for (const c of CONTINENTS) {
    const all = BY_CONTINENT[c.id];
    if (all.every((code) => selected.has(code))) {
      groups.push({ kind: 'continent', id: c.id, label: c.name, codes: all });
    } else {
      loose.push(...all.filter((code) => selected.has(code)));
    }
  }
  loose.sort((a, b) => regionName(a).localeCompare(regionName(b)));
  for (const code of loose) groups.push({ kind: 'country', code, label: regionName(code) });
  return groups;
}

/** One line for summaries: "Worldwide", "India", "Asia, Europe + 2 countries". */
export function regionsLabel(codes: string[] | null | undefined, max = 3): string {
  if (!codes || codes.length === 0) return 'Worldwide';
  const groups = groupRegions(codes);
  const continents = groups.filter((g) => g.kind === 'continent').map((g) => g.label);
  const countries = groups.filter((g) => g.kind === 'country').map((g) => g.label);
  const parts = [...continents, ...countries];
  if (parts.length <= max) return parts.join(', ');
  const shown = parts.slice(0, max);
  return `${shown.join(', ')} + ${parts.length - max} more`;
}
