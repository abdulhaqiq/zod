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

// ── Direct card send ─────────────────────────────────────────────────────────
// ChatConversationPage registers a sender so MiniGamesPage can fire the
// question-card message instantly (before router.back()) — eliminates the
// focus-animation delay.

export interface CardSendPayload {
  question: string;
  emoji: string;
  category: string;
  gameName: string;
}

type CardSendFn = (card: CardSendPayload) => void;
let _cardSendFn: CardSendFn | null = null;

export function registerCardSend(fn: CardSendFn | null): void {
  _cardSendFn = fn;
}

export function sendCardDirect(card: CardSendPayload): boolean {
  if (!_cardSendFn) return false;
  _cardSendFn(card);
  return true;
}
