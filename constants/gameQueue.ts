/**
 * Module-level slot for passing a pending mini-game payload from MiniGamesPage
 * back to ChatConversationPage without relying on router.setParams (which is
 * unreliable immediately after router.back() due to focus-animation timing).
 */

export interface PendingGamePayload {
  msgType: string;
  content: string;
  extra: Record<string, any>;
}

let _pending: PendingGamePayload | null = null;

export function setPendingGame(payload: PendingGamePayload): void {
  _pending = payload;
}

export function takePendingGame(): PendingGamePayload | null {
  const p = _pending;
  _pending = null;
  return p;
}
