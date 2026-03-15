import Constants from 'expo-constants';

function getApiBaseUrl(): string {
  const debuggerHost =
    Constants.expoConfig?.hostUri ??
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost ??
    (Constants as any).manifest?.debuggerHost;

  if (debuggerHost) {
    const host = debuggerHost.split(':')[0];
    return `http://${host}:8000`;
  }

  return 'https://dev.zod.ailoo.co';
}

export const API_BASE = getApiBaseUrl();
export const API_V1 = `${API_BASE}/api/v1`;
export const WS_V1 = `${API_BASE.replace('http', 'ws')}/api/v1`;

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

/**
 * Core fetch helper.
 * - Attaches Content-Type: application/json and optionally Authorization: Bearer <token>
 * - On 401, attempts a token refresh once and retries the request
 * - On second 401 (refresh failed), calls signOut so the user goes back to login
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: Omit<RequestInit, 'headers'> & { token?: string; headers?: Record<string, string> } = {},
): Promise<T> {
  const { token, headers: extraHeaders, ...fetchOptions } = options;
  const url = `${API_V1}${path}`;

  function buildHeaders(t?: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
      ...(extraHeaders ?? {}),
    };
  }

  async function doFetch(t?: string): Promise<Response> {
    return fetch(url, { ...fetchOptions, headers: buildHeaders(t) });
  }

  let res = await doFetch(token);

  // Auto-refresh on 401 and retry once
  if (res.status === 401 && _tryRefresh) {
    const newToken = await _tryRefresh();
    if (newToken) {
      res = await doFetch(newToken);
    } else {
      // Refresh failed — session is dead, sign out
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
