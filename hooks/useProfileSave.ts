import { useState } from 'react';
import { Alert } from 'react-native';
import { authedFetch } from '@/constants/api';
import { useAuth, UserProfile } from '@/context/AuthContext';

/**
 * Hook that wraps PATCH /profile/me.
 * After a successful save, the local profile cache in AuthContext is updated
 * so every screen always has fresh data without an extra GET.
 */
export function useProfileSave() {
  const { token, updateProfile } = useAuth();
  const [saving, setSaving] = useState(false);

  const save = async (fields: Record<string, unknown>): Promise<boolean> => {
    if (!token) return false;
    setSaving(true);
    try {
      const updated = await authedFetch<UserProfile>('/profile/me', token, {
        method: 'PATCH',
        body: JSON.stringify(fields),
      });
      // Keep context in sync — no extra GET needed
      updateProfile(updated);
      return true;
    } catch (err: any) {
      Alert.alert('Could not save', err.message ?? 'Please try again.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  return { save, saving };
}
