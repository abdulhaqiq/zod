/**
 * Throttled navigation helpers.
 *
 * Prevents duplicate stack entries that occur when a user taps a navigation
 * target multiple times before the transition completes. All router.push /
 * router.replace calls in the app should go through these helpers.
 */
import { router } from 'expo-router';

const THROTTLE_MS = 1000;
let _lastNavAt = 0;

function _canNavigate(): boolean {
  const now = Date.now();
  if (now - _lastNavAt < THROTTLE_MS) return false;
  _lastNavAt = now;
  return true;
}

export function navPush(href: Parameters<typeof router.push>[0]): void {
  if (_canNavigate()) router.push(href);
}

export function navReplace(href: Parameters<typeof router.replace>[0]): void {
  if (_canNavigate()) router.replace(href);
}
