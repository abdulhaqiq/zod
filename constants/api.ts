import Constants from 'expo-constants';

const PROD_API_URL = 'https://dev.zod.ailoo.co';

// Set to true to always point at production, even when running in dev/Expo Go.
// Set to false to use the local dev server at LOCAL_DEV_IP.
const USE_PROD_API = true;

const LOCAL_DEV_IP = '172.20.10.2'; // only used when USE_PROD_API is false

const APP_API_KEY: string =
  (Constants.expoConfig?.extra as any)?.APP_API_KEY ?? '';

function getApiBaseUrl(): string {
  if (USE_PROD_API) return PROD_API_URL;

  const debuggerHost =
    Constants.expoConfig?.hostUri ??
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost ??
    (Constants as any).manifest?.debuggerHost;

  if (debuggerHost) {
    const host = debuggerHost.split(':')[0];
    return `http://${host}:8000`;
  }

  if (__DEV__) {
    return `http://${LOCAL_DEV_IP}:8000`;
  }

  return PROD_API_URL;
}

export const API_BASE = getApiBaseUrl();
export const API_V1 = `${API_BASE}/api/v1`;
export const WS_V1 = `${API_BASE.replace('http', 'ws')}/api/v1`;

// ── Global fetch interceptor ──────────────────────────────────────────────────
// Patches the native fetch so that EVERY request to our own API — whether made
// via apiFetch, authedFetch, or a raw fetch() call anywhere in the codebase —
// automatically carries the X-App-Key header. Third-party URLs are untouched.
if (APP_API_KEY) {
  const _nativeFetch = global.fetch;
  global.fetch = function patchedFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;

    if (url.startsWith(API_BASE)) {
      const headers = new Headers(init?.headers as HeadersInit | undefined);
      if (!headers.has('X-App-Key')) {
        headers.set('X-App-Key', APP_API_KEY);
      }
      return _nativeFetch(input, { ...init, headers });
    }
    return _nativeFetch(input, init);
  };
}

// Injected by AuthContext so apiFetch can auto-refresh expired tokens
let _tryRefresh: (() => Promise<string | null>) | null = null;
let _signOut: (() => Promise<void>) | null = null;

export function registerAuthHandlers(
  tryRefresh: () => Promise<string | null>,
  signOut: () => Promise<void>,
) {
  _tryRefresh = tryRefresh;
  _signOut = signOut;
}

// Default request timeout in milliseconds. Long-running uploads/AI calls
// can pass a larger value via the `timeoutMs` option.
const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Core fetch helper.
 * - Attaches Content-Type: application/json and optionally Authorization: Bearer <token>
 * - Cancels requests that take longer than `timeoutMs` (default 15 s)
 * - On 401, attempts a token refresh once and retries the request
 * - On second 401 (refresh failed), calls signOut so the user goes back to login
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: Omit<RequestInit, 'headers'> & {
    token?: string;
    headers?: Record<string, string>;
    timeoutMs?: number;
  } = {},
): Promise<T> {
  const { token, headers: extraHeaders, timeoutMs = DEFAULT_TIMEOUT_MS, ...fetchOptions } = options;
  const url = `${API_V1}${path}`;

  function buildHeaders(t?: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      ...(APP_API_KEY ? { 'X-App-Key': APP_API_KEY } : {}),
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
      ...(extraHeaders ?? {}),
    };
  }

  async function doFetch(t?: string): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...fetchOptions, headers: buildHeaders(t), signal: controller.signal });
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        throw new Error('Request timed out. Check your connection and try again.');
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  let res = await doFetch(token);

  // Auto-refresh on 401 and retry once
  if (res.status === 401 && _tryRefresh) {
    let newToken: string | null = null;
    try {
      newToken = await _tryRefresh();
    } catch {
      // _tryRefresh threw — this means the refresh endpoint was unreachable
      // (network error), NOT that the session is invalid. Do NOT sign out;
      // just surface a connectivity error to the caller.
      throw new Error('No internet connection. Please try again.');
    }
    if (newToken) {
      res = await doFetch(newToken);
    } else {
      // Refresh token was rejected by the server — session is genuinely expired
      await _signOut?.();
      throw new Error('Session expired. Please log in again.');
    }
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message =
      typeof data?.detail === 'string'
        ? data.detail
        : JSON.stringify(data?.detail ?? data);
    throw new Error(message);
  }

  return data as T;
}

/**
 * Convenience wrapper that always attaches a Bearer token.
 */
export function authedFetch<T = unknown>(
  path: string,
  token: string,
  options: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> } = {},
): Promise<T> {
  return apiFetch<T>(path, { ...options, token });
}
