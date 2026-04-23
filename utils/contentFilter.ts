/**
 * Client-side content restriction checker + sanitiser.
 * Mirrors the backend check so the user gets instant feedback while typing —
 * the backend also sanitises as a second line of defence.
 *
 * Restricted content is replaced with *** rather than blocked outright.
 */

// ── Contact-info patterns ─────────────────────────────────────────────────────

// Phone numbers: +1 (555) 123-4567 · 555.123.4567 · 07911 123456 etc.
const PHONE_RE =
  /(\+?\d{1,3}[\s\-]?)?(\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}|\b\d{10,11}\b)/g;

// Email addresses
const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/gi;

// HTTP / www links
const URL_RE = /(https?:\/\/|www\.)\S+/gi;

// @handle pattern (catches @username, @user.name, @user_name)
const AT_HANDLE_RE = /(?<![a-zA-Z0-9])@[a-zA-Z0-9_.]{2,}/g;

// Explicit contact-sharing phrases
const SHARE_PHRASES_RE =
  /\b(my\s+(number|phone|cell|mobile|ig|insta|snap|whatsapp|telegram|handle|username)|(text|call|reach|dm|message|add)\s+me(\s+(on|at|via))?|hit\s+me\s+up|hmu)\b/gi;

// ── 18+ / Adult content patterns ─────────────────────────────────────────────

const ADULT_RE = new RegExp(
  [
    // Explicit sexual acts / anatomy
    'sex', 'sexy', 'sexual', 'sexually', 'intercourse', 'orgasm', 'climax',
    'erotic', 'erotica', 'masturbat\\w*', 'fingering', 'blowjob', 'handjob',
    'cumshot', 'cum\\b', 'jizz', 'penis', 'vagina', 'dick\\b', 'cock\\b',
    'pussy\\b', 'boobs?\\b', 'tits?\\b', 'ass\\b', 'arse\\b', 'nipple\\w*',
    'boner', 'hardon', 'hard.?on', 'bdsm', 'fetish', 'kinky', 'kink\\b',
    'naked', 'nude', 'nudity', 'nudes\\b', 'nsfw', 'horny', 'aroused',
    'wet\\b', 'turned.?on', 'sleep\\s+with\\s+me', 'fuck\\w*', 'fck\\b',
    'fcuk\\b', 'shit\\b', 'shitting', 'bullshit', 'slut\\b', 'whore\\b',
    'bitch\\b', 'bastard\\b', 'rape\\w*', 'molest\\w*', 'porn\\w*', 'xxx\\b',
    'onlyfans', 'strip\\s*club', 'prostitut\\w*', 'escort\\b', 'hookup',
    'hook.?up', 'one.?night.?stand', 'friends?\\s+with\\s+benefits', 'fwb\\b',
    'sexting', 'sext\\b',
    // Drug references
    'cocaine', 'heroin', 'meth\\b', 'methamphetamine', 'mdma\\b', 'ecstasy',
    'lsd\\b', 'molly\\b', 'weed\\b', 'marijuana', 'cannabis\\b', 'stoned\\b',
    'getting\\s+high', 'roll\\s+a\\s+joint', 'smoke\\s+weed',
  ].map(w => `\\b${w}\\b`).join('|'),
  'gi',
);

// ── All patterns in order ─────────────────────────────────────────────────────

const ALL_PATTERNS: [RegExp, string][] = [
  [PHONE_RE,         'Phone numbers are not allowed in chat.'],
  [EMAIL_RE,         'Email addresses are not allowed in chat.'],
  [URL_RE,           'Links are not allowed in chat.'],
  [AT_HANDLE_RE,     'Social media handles are not allowed in chat.'],
  [SHARE_PHRASES_RE, 'Sharing personal contact details is not allowed in chat.'],
  [ADULT_RE,         'Explicit or adult content is not allowed in chat.'],
];

export interface FilterResult {
  blocked: boolean;
  reason: string | null;
}

/**
 * Returns { blocked: true, reason: "..." } when restricted content is found,
 * or { blocked: false, reason: null } when the message is clean.
 * Used for real-time typing indicators — does NOT mutate the text.
 */
export function checkContent(text: string): FilterResult {
  const t = text.trim();
  if (!t) return { blocked: false, reason: null };

  for (const [re, reason] of ALL_PATTERNS) {
    // Reset lastIndex so test() works correctly on global regexes
    re.lastIndex = 0;
    if (re.test(t)) {
      re.lastIndex = 0;
      return { blocked: true, reason };
    }
  }

  return { blocked: false, reason: null };
}

/**
 * Returns the text with all restricted content replaced by ***.
 * Call this on the text just before sending so the sanitised version
 * is what actually goes to the server.
 */
export function sanitizeContent(text: string): string {
  let out = text;
  for (const [re] of ALL_PATTERNS) {
    re.lastIndex = 0;
    out = out.replace(re, '***');
    re.lastIndex = 0;
  }
  return out;
}
