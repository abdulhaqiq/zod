/**
 * Shared utility for fetching and caching work-mode lookup options from the DB.
 * Module-level cache persists across component re-renders.
 *
 * ChipOption.value  = the DB row ID (as string) — stored in user profile
 * ChipOption.label  = human-readable text        — displayed in the UI
 * ChipOption.emoji  = optional emoji prefix
 */
import { API_V1 } from '@/constants/api';
import type { ChipOption } from '@/components/ui/ChipSelectorSheet';

export type WorkLookupMap = Record<string, ChipOption[]>;

/** Raw API shape per row */
interface LookupRow { id: number; emoji?: string | null; label: string; }

let _cache: WorkLookupMap | null = null;

const WORK_CATEGORIES = [
  'work_matching_goals',
  'work_commitment_level',
  'work_skills',
  'work_equity_split',
  'work_industries',
  'work_who_to_show',
  'work_prompt_questions',
  'work_stage',
  'work_role',
];

export async function fetchWorkLookups(): Promise<WorkLookupMap> {
  if (_cache) return _cache;
  try {
    const res = await fetch(`${API_V1}/lookup/options`);
    if (!res.ok) throw new Error('lookup fetch failed');
    const data = await res.json() as Record<string, LookupRow[]>;
    const map: WorkLookupMap = {};
    for (const cat of WORK_CATEGORIES) {
      const rows = data[cat] ?? [];
      map[cat] = rows.map(r => ({
        value: String(r.id),   // stable DB ID — stored in profile
        emoji: r.emoji ?? undefined,
        label: r.label,        // display text
      }));
    }
    _cache = map;
    return map;
  } catch {
    return {};
  }
}

export function getCachedWorkLookups(): WorkLookupMap | null {
  return _cache;
}

/** Resolve a single ID string → label for display */
export function resolveLabel(map: WorkLookupMap, category: string, id: string): string {
  return map[category]?.find(o => o.value === id)?.label ?? id;
}

/** Resolve multiple ID strings → labels for display */
export function resolveLabels(map: WorkLookupMap, category: string, ids: string[]): string[] {
  const opts = map[category] ?? [];
  return ids.map(id => opts.find(o => o.value === id)?.label ?? id);
}
