/**
 * useSubscription — RevenueCat IAP hook.
 *
 * Handles:
 *  - SDK configuration on first call (SDK key fetched from backend)
 *  - Loading available packages from the "default" offering
 *  - Purchase flow (monthly / yearly)
 *  - Restore purchases
 *  - Verifying entitlement with our backend after a successful purchase
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Constants from 'expo-constants';
import Purchases, {
  LOG_LEVEL,
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases';
import { apiFetch } from '@/constants/api';
import { RC_ENTITLEMENT, RC_OFFERING } from '@/constants/iap';
import { useAuth } from '@/context/AuthContext';

/** True when running inside the Expo Go sandbox — native modules unavailable */
const IS_EXPO_GO = Constants.appOwnership === 'expo';

export type SubscriptionStatus = {
  isPro: boolean;
  expiresAt: string | null;
  tier: string;
};

export function useSubscription() {
  const { token, updateProfile } = useAuth();

  const [offering,   setOffering]   = useState<PurchasesOffering | null>(null);
  const [status,     setStatus]     = useState<SubscriptionStatus | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const configuredToken = useRef<string | null>(null);

  // ── Configure RevenueCat SDK — key fetched from backend ──────────────────

  useEffect(() => {
    if (!token || configuredToken.current === token) return;
    configuredToken.current = token;

    const init = async () => {
      // Fetch subscription status from backend first — this works in all
      // environments including Expo Go where the native RC SDK is unavailable.
      fetchStatus();

      // Skip native RC SDK entirely in Expo Go — no native store available
      if (!IS_EXPO_GO) {
        try {
          const { sdk_key } = await apiFetch<{ sdk_key: string }>(
            '/subscription/config',
            { token },
          );
          Purchases.setLogLevel(LOG_LEVEL.WARN);
          Purchases.configure({ apiKey: sdk_key });
          // Load store offerings for purchase UI (only available in native builds)
          loadOffering();
        } catch { /* silent — status is already loaded from backend above */ }
      }
    };

    init();
  }, [token]);

  // ── Load offering ─────────────────────────────────────────────────────────

  const loadOffering = useCallback(async () => {
    try {
      const offerings = await Purchases.getOfferings();
      const off = offerings.all[RC_OFFERING] ?? offerings.current;
      setOffering(off ?? null);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load offerings');
    }
  }, []);

  // ── Fetch subscription status from backend ────────────────────────────────

  const fetchStatus = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch<{ is_pro: boolean; tier: string; expires_at: string | null }>(
        '/subscription/status',
        { token },
      );
      setStatus({ isPro: data.is_pro, tier: data.tier, expiresAt: data.expires_at });
      // Keep the cached profile in sync so isPro checks everywhere are accurate
      updateProfile({ subscription_tier: data.tier });
    } catch { /* ignore */ }
  }, [token, updateProfile]);

  // ── Purchase a package ────────────────────────────────────────────────────

  const purchase = useCallback(async (pkg: PurchasesPackage): Promise<boolean> => {
    setPurchasing(true);
    setError(null);
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      const entitlement = customerInfo.entitlements.active[RC_ENTITLEMENT];

      if (entitlement) {
        const rcCustomerId = customerInfo.originalAppUserId;
        const data = await apiFetch<{ is_pro: boolean; tier: string; expires_at: string | null }>(
          '/subscription/verify',
          {
            method: 'POST',
            token: token ?? undefined,
            body: JSON.stringify({ revenuecat_customer_id: rcCustomerId }),
          },
        );
        setStatus({ isPro: data.is_pro, tier: data.tier, expiresAt: data.expires_at });
        updateProfile({ subscription_tier: data.tier });
        return true;
      }
      return false;
    } catch (e: any) {
      if (e.userCancelled) return false;

      // Map RevenueCat / StoreKit error codes to friendly messages
      const msg: string = e?.message ?? e?.localizedDescription ?? '';
      const code: number = e?.code ?? e?.underlyingErrorCode ?? -1;

      if (
        msg.toLowerCase().includes('invalid offer') ||
        msg.toLowerCase().includes('invalid product') ||
        code === 3 /* PRODUCT_NOT_AVAILABLE */ ||
        code === 6 /* INVALID_APPLE_SUBSCRIPTION_KEY */
      ) {
        setError(
          'This product is not available in the App Store right now. ' +
          'Please check back later or contact support.',
        );
      } else if (msg.toLowerCase().includes('network') || code === 10) {
        setError('No internet connection. Please check your network and try again.');
      } else if (msg.toLowerCase().includes('not allowed') || code === 7) {
        setError('Purchases are not allowed on this device. Check Screen Time or parental controls.');
      } else {
        setError(msg || 'Purchase failed. Please try again.');
      }
      return false;
    } finally {
      setPurchasing(false);
    }
  }, [token, updateProfile]);

  // ── Restore purchases ─────────────────────────────────────────────────────

  const restore = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const customerInfo = await Purchases.restorePurchases();
      const entitlement = customerInfo.entitlements.active[RC_ENTITLEMENT];
      if (entitlement) {
        const rcCustomerId = customerInfo.originalAppUserId;
        const data = await apiFetch<{ is_pro: boolean; tier: string; expires_at: string | null }>(
          '/subscription/verify',
          {
            method: 'POST',
            token: token ?? undefined,
            body: JSON.stringify({ revenuecat_customer_id: rcCustomerId }),
          },
        );
        setStatus({ isPro: data.is_pro, tier: data.tier, expiresAt: data.expires_at });
        updateProfile({ subscription_tier: data.tier });
        return true;
      }
      return false;
    } catch (e: any) {
      setError(e?.message ?? 'Restore failed');
      return false;
    } finally {
      setLoading(false);
    }
  }, [token, updateProfile]);

  // ── Convenience getters ───────────────────────────────────────────────────

  const weeklyPackage: PurchasesPackage | null =
    offering?.availablePackages.find(p => p.identifier === '$rc_weekly') ??
    offering?.weekly ?? null;

  const monthlyPackage: PurchasesPackage | null =
    offering?.availablePackages.find(p => p.identifier === '$rc_monthly') ??
    offering?.monthly ?? null;

  const sixMonthPackage: PurchasesPackage | null =
    offering?.availablePackages.find(p => p.identifier === '$rc_six_month') ??
    offering?.sixMonth ?? null;

  const yearlyPackage: PurchasesPackage | null =
    offering?.availablePackages.find(p => p.identifier === '$rc_annual') ??
    offering?.annual ?? null;

  return {
    offering,
    weeklyPackage,
    monthlyPackage,
    sixMonthPackage,
    yearlyPackage,
    status,
    loading,
    purchasing,
    error,
    purchase,
    restore,
    refetch: fetchStatus,
  };
}
