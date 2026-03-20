/**
 * Shared hook for fetching and caching lookup options from the backend API.
 * Both DateFilterSheet and EditProfilePage use this so they always show
 * the exact same data that lives in the database.
 */
import { useEffect, useState } from 'react';
import { apiFetch } from '@/constants/api';

export interface LookupOption {
  id: number;
  emoji?: string;
  label: string;
}

export type LookupMap = Record<string, LookupOption[]>;

// Module-level cache — fetched once per app session
let _cache: LookupMap | null = null;
let _inflight: Promise<LookupMap> | null = null;

/** Force a fresh fetch on next use (call after DB-side changes). */
export function bustLookupsCache() {
  _cache = null;
  _inflight = null;
}

export async function fetchLookups(): Promise<LookupMap> {
  if (_cache) return _cache;
  if (_inflight) return _inflight;
  _inflight = (async () => {
    try {
      const data = await apiFetch<Record<string, Array<{ id: number; emoji?: string; label: string }>>>('/lookup/options');
      const map: LookupMap = {};
      for (const [cat, rows] of Object.entries(data)) {
        map[cat] = rows.map(r => ({ id: r.id, emoji: r.emoji ?? undefined, label: r.label }));
      }
      _cache = map;
      return map;
    } finally {
      _inflight = null;
    }
  })();
  return _inflight;
}

/** Returns the full lookup map, loading from API on first use. */
export function useLookups(): { lookups: LookupMap; ready: boolean } {
  const [lookups, setLookups] = useState<LookupMap>(_cache ?? {});
  const [ready,   setReady]   = useState(_cache !== null);

  useEffect(() => {
    if (_cache) { setLookups(_cache); setReady(true); return; }
    fetchLookups().then(map => { setLookups(map); setReady(true); });
  }, []);

  return { lookups, ready };
}

/** Convenience: get options for one category as ChipOption-compatible objects */
export function useLookupsCategory(category: string): LookupOption[] {
  const { lookups } = useLookups();
  return lookups[category] ?? [];
}
