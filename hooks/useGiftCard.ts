/**
 * useGiftCard — gift card redemption hook.
 *
 * Wraps the backend gift-cards API:
 *   POST /gift-cards/redeem   — redeem a code
 *   GET  /gift-cards/my-history — user's own redemption history + slot count
 *
 * Device ID strategy:
 *   iOS  → expo-application getIosIdForVendorAsync()  (resets on re-install)
 *   Android → expo-application androidId
 *   Fallback → expo-secure-store persisted UUID
 */

import { useCallback, useEffect, useState } from 'react';
import * as Application from 'expo-application';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { apiFetch } from '@/constants/api';
import { useAuth } from '@/context/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

export type GiftCardHistoryItem = {
  code: string;
  plan_name: string;
  plan_interval: 'weekly' | 'monthly';
  duration_days: number;
  redeemed_at: string;
  expires_subscription_at: string | null;
};

export type GiftCardHistory = {
  redemptions_used: number;
  redemptions_remaining: number;
  max_redemptions: number;
  history: GiftCardHistoryItem[];
};

export type RedeemResult = {
  message: string;
  tier: string;
  expires_at: string | null;
  plan_name: string;
  duration_days: number;
  redemptions_used: number;
  redemptions_remaining: number;
};

// ─── Device ID helper ─────────────────────────────────────────────────────────

const DEVICE_ID_KEY = 'zod_device_id';

async function getDeviceId(): Promise<string> {
  // iOS: vendor ID (stable per app per device)
  if (Platform.OS === 'ios') {
    const vid = await Application.getIosIdForVendorAsync();
    if (vid) return vid;
  }

  // Android: androidId
  if (Platform.OS === 'android') {
    const aid = Application.getAndroidId();
    if (aid) return aid;
  }

  // Fallback: generate and persist a UUID in SecureStore
  const stored = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (stored) return stored;

  const generated = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  await SecureStore.setItemAsync(DEVICE_ID_KEY, generated);
  return generated;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGiftCard() {
  const { token, updateProfile } = useAuth();

  const [history,    setHistory]    = useState<GiftCardHistory | null>(null);
  const [redeeming,  setRedeeming]  = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<RedeemResult | null>(null);

  // ── Fetch redemption history ───────────────────────────────────────────────

  const fetchHistory = useCallback(async () => {
    if (!token) return;
    setLoadingHistory(true);
    try {
      const data = await apiFetch<GiftCardHistory>('/gift-cards/my-history', { token });
      setHistory(data);
    } catch {
      // Non-fatal — UI can still work without history
    } finally {
      setLoadingHistory(false);
    }
  }, [token]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // ── Redeem a code ─────────────────────────────────────────────────────────

  const redeem = useCallback(async (rawCode: string): Promise<RedeemResult | null> => {
    if (!token) return null;
    setRedeeming(true);
    setError(null);
    setLastResult(null);

    try {
      const device_id = await getDeviceId();
      const code = rawCode.trim().toUpperCase();

      const result = await apiFetch<RedeemResult>('/gift-cards/redeem', {
        method: 'POST',
        token,
        body: JSON.stringify({ code, device_id }),
      });

      setLastResult(result);
      // Keep profile tier in sync immediately
      updateProfile({ subscription_tier: result.tier });
      // Refresh history after a successful redemption
      await fetchHistory();
      return result;
    } catch (e: any) {
      setError(e?.message ?? 'Redemption failed. Please try again.');
      return null;
    } finally {
      setRedeeming(false);
    }
  }, [token, updateProfile, fetchHistory]);

  const clearError = useCallback(() => setError(null), []);
  const clearResult = useCallback(() => setLastResult(null), []);

  return {
    history,
    loadingHistory,
    redeeming,
    error,
    lastResult,
    redeem,
    fetchHistory,
    clearError,
    clearResult,
  };
}
