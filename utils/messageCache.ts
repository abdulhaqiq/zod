/**
 * Message Cache — AsyncStorage-backed, per-conversation.
 *
 * Design:
 *  • Cache is the SOURCE OF TRUTH for the UI. On open, messages render from
 *    cache instantly; the network only fills gaps.
 *  • Each message stores `rawTime` (ISO 8601) so we can use it as a
 *    pagination cursor for both catch-up (after=) and load-older (before=).
 *  • MAX_MSGS newest messages are kept.  No time-based expiry.
 *  • Writes are synchronous to the in-memory map and async to AsyncStorage
 *    so the UI never waits on a disk write.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Shared message shape ─────────────────────────────────────────────────────

export interface CachedMsg {
  id:            string;
  text:          string;
  from:          'me' | 'them';
  time:          string;          // display string e.g. "14:32"
  rawTime:       string;          // ISO 8601 — used as pagination cursor
  status?:       'sending' | 'sent' | 'delivered' | 'read';
  isCard?:       boolean;
  isAnswer?:     boolean;
  answerTo?:     string;
  replyToId?:    string;
  isTod?:        boolean;
  todMsgType?:   string;
  todExtra?:     Record<string, any>;
  isGame?:       boolean;
  gameMsgType?:  string;
  gameExtra?:    Record<string, any>;
  imageUrl?:     string;
  audioUrl?:     string;
  audioDuration?: number;
  isCall?:       boolean;
  callType?:     string;
  callKind?:     string;
  callDuration?: number;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const KEY_PREFIX = 'msg_cache_v2_';
const MAX_MSGS   = 200;          // keep latest N messages per conversation

// ─── In-memory write-through layer ───────────────────────────────────────────
// Reads always go to this map first (sync); writes go here then async to disk.

const memCache = new Map<string, CachedMsg[]>();

function _key(partnerId: string) { return KEY_PREFIX + partnerId; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _trim(msgs: CachedMsg[]): CachedMsg[] {
  return msgs.length > MAX_MSGS ? msgs.slice(-MAX_MSGS) : msgs;
}

function _persist(partnerId: string, msgs: CachedMsg[]) {
  // Fire-and-forget: callers never await this
  AsyncStorage.setItem(_key(partnerId), JSON.stringify(msgs)).catch(() => {});
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Load from disk into memory and return.
 * Call once on chat open; subsequent reads come from memCache.
 */
export async function loadCache(partnerId: string): Promise<CachedMsg[]> {
  if (memCache.has(partnerId)) return memCache.get(partnerId)!;
  try {
    const raw = await AsyncStorage.getItem(_key(partnerId));
    if (!raw) return [];
    const msgs: CachedMsg[] = JSON.parse(raw);
    memCache.set(partnerId, msgs);
    return msgs;
  } catch {
    return [];
  }
}

/**
 * Return synchronously from memory (after loadCache has been called).
 */
export function getCachedMessagesSync(partnerId: string): CachedMsg[] {
  return memCache.get(partnerId) ?? [];
}

/**
 * Replace the whole cache for a conversation (used for the very first full load).
 */
export function setCache(partnerId: string, msgs: CachedMsg[]): void {
  const trimmed = _trim(msgs);
  memCache.set(partnerId, trimmed);
  _persist(partnerId, trimmed);
}

/**
 * Append newer messages to the right (tail) of the cache.
 * Deduplicates by id.
 */
export function appendToCache(partnerId: string, newMsgs: CachedMsg[]): void {
  if (!newMsgs.length) return;
  const existing = memCache.get(partnerId) ?? [];
  const existingIds = new Set(existing.map(m => m.id));
  const toAdd = newMsgs.filter(m => !existingIds.has(m.id));
  if (!toAdd.length) return;
  const merged = _trim([...existing, ...toAdd]);
  memCache.set(partnerId, merged);
  _persist(partnerId, merged);
}

/**
 * Prepend older messages to the left (head) — used for load-more pagination.
 * These are NOT trimmed from the right because they are already older than MAX_MSGS.
 */
export function prependToCache(partnerId: string, olderMsgs: CachedMsg[]): void {
  if (!olderMsgs.length) return;
  const existing = memCache.get(partnerId) ?? [];
  const existingIds = new Set(existing.map(m => m.id));
  const toAdd = olderMsgs.filter(m => !existingIds.has(m.id));
  if (!toAdd.length) return;
  // Don't persist the older pages — cache only tracks the recent tail
  memCache.set(partnerId, [...toAdd, ...existing]);
}

/**
 * Update a single message in cache (e.g. status change, optimistic → real).
 */
export function patchCacheMessage(
  partnerId: string,
  id: string,
  patch: Partial<CachedMsg>,
): void {
  const existing = memCache.get(partnerId);
  if (!existing) return;
  const updated = existing.map(m => m.id === id ? { ...m, ...patch } : m);
  memCache.set(partnerId, updated);
  _persist(partnerId, updated);
}

/**
 * Remove a message from cache (e.g. unsend).
 */
export function removeCacheMessage(partnerId: string, id: string): void {
  const existing = memCache.get(partnerId);
  if (!existing) return;
  const updated = existing.filter(m => m.id !== id);
  memCache.set(partnerId, updated);
  _persist(partnerId, updated);
}

/**
 * ISO timestamp of the newest cached message — used as `after=` cursor.
 */
export function getLatestCachedTime(partnerId: string): string | null {
  const msgs = memCache.get(partnerId);
  if (!msgs?.length) return null;
  return msgs[msgs.length - 1].rawTime ?? null;
}

/**
 * ISO timestamp of the oldest cached message — used as `before=` cursor.
 */
export function getOldestCachedTime(partnerId: string): string | null {
  const msgs = memCache.get(partnerId);
  if (!msgs?.length) return null;
  return msgs[0].rawTime ?? null;
}

/**
 * Evict from memory (does NOT clear disk — keeps disk for next open).
 */
export function evictCache(partnerId: string): void {
  memCache.delete(partnerId);
}

/**
 * Clear both memory and disk (e.g. on unmatch / account delete).
 */
export async function clearMessageCache(partnerId: string): Promise<void> {
  memCache.delete(partnerId);
  try { await AsyncStorage.removeItem(_key(partnerId)); } catch {}
}
