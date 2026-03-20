/**
 * Client-side content restriction checker.
 * Mirrors the backend check so the user gets instant feedback before the
 * message is even sent — the backend also validates as a second line of defence.
 */

// Phone numbers: +1 (555) 123-4567 · 555.123.4567 · 07911 123456 etc.
const PHONE_RE =
  /(\+?\d{1,3}[\s\-]?)?(\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}|\b\d{10,11}\b)/;

// Email addresses
const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/i;

// HTTP / www links
const URL_RE = /(https?:\/\/|www\.)\S+/i;

// @handle pattern (catches @username, @user.name, @user_name)
const AT_HANDLE_RE = /(?<![a-zA-Z0-9])@[a-zA-Z0-9_.]{2,}/;

// Explicit contact-sharing phrases
const SHARE_PHRASES_RE = /\b(my\s+(number|phone|cell|mobile|ig|insta|snap|whatsapp|telegram|handle|username)|(text|call|reach|dm|message|add)\s+me(\s+(on|at|via))?|hit\s+me\s+up|hmu)\b/i;

export interface FilterResult {
  blocked: boolean;
  reason: string | null;
}

/**
 * Returns { blocked: true, reason: "..." } when restricted content is found,
 * or { blocked: false, reason: null } when the message is clean.
 */
export function checkContent(text: string): FilterResult {
  const t = text.trim();
  if (!t) return { blocked: false, reason: null };

  if (PHONE_RE.test(t))
    return { blocked: true, reason: 'Phone numbers are not allowed in chat.' };
  if (EMAIL_RE.test(t))
    return { blocked: true, reason: 'Email addresses are not allowed in chat.' };
  if (URL_RE.test(t))
    return { blocked: true, reason: 'Links are not allowed in chat.' };
  if (AT_HANDLE_RE.test(t))
    return { blocked: true, reason: 'Social media handles are not allowed in chat.' };
  if (SHARE_PHRASES_RE.test(t))
    return { blocked: true, reason: 'Sharing personal contact details is not allowed in chat.' };

  return { blocked: false, reason: null };
}
