import { useState } from 'react';
import { authedFetch } from '@/constants/api';
import { useAuth, UserProfile } from '@/context/AuthContext';

/** True when the thrown error is a connectivity failure (no internet). */
function isNetworkError(err: unknown): boolean {
  return (
    err instanceof TypeError ||
    (err instanceof Error && err.message === 'Network request failed')
  );
}

/**
 * Hook that wraps PATCH /profile/me.
 * After a successful save, the local profile cache in AuthContext is updated
 * so every screen always has fresh data without an extra GET.
 *
 * Exposes `networkError` so callers can render a NoNetworkOverlay, and
 * `clearNetworkError` to reset it when the user taps "Try Again".
 */
export function useProfileSave() {
  const { token, updateProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [networkError, setNetworkError] = useState(false);

  const clearNetworkError = () => setNetworkError(false);

  const save = async (fields: Record<string, unknown>): Promise<boolean> => {
    if (!token) return false;
    setNetworkError(false);
    setSaving(true);
    try {
      const updated = await authedFetch<UserProfile>('/profile/me', token, {
        method: 'PATCH',
        body: JSON.stringify(fields),
      });
      updateProfile(updated);
      return true;
    } catch (err: unknown) {
      if (isNetworkError(err)) {
        setNetworkError(true);
      }
      // Non-network server errors are swallowed here — the overlay only
      // shows for connectivity failures. Add additional handling if needed.
      return false;
    } finally {
      setSaving(false);
    }
  };

  return { save, saving, networkError, clearNetworkError };
}
