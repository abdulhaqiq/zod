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
import Purchases, {
  LOG_LEVEL,
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases';
import { apiFetch } from '@/constants/api';
import { RC_ENTITLEMENT, RC_OFFERING } from '@/constants/iap';
import { useAuth } from '@/context/AuthContext';

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
      try {
        const { sdk_key } = await apiFetch<{ sdk_key: string }>(
          '/subscription/config',
          { token },
        );
        Purchases.setLogLevel(LOG_LEVEL.WARN);
        Purchases.configure({ apiKey: sdk_key });
        loadOffering();
        fetchStatus();
      } catch (e: any) {
        setError(e?.message ?? 'RevenueCat init failed');
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
    } catch { /* ignore */ }
  }, [token]);

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
            token,
            body: JSON.stringify({ revenuecat_customer_id: rcCustomerId }),
          },
        );
        setStatus({ isPro: data.is_pro, tier: data.tier, expiresAt: data.expires_at });
        updateProfile({ subscription_tier: data.tier });
        return true;
      }
      return false;
    } catch (e: any) {
      if (!e.userCancelled) {
        setError(e?.message ?? 'Purchase failed');
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
            token,
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

  const monthlyPackage: PurchasesPackage | null =
    offering?.availablePackages.find(p => p.identifier === '$rc_monthly') ??
    offering?.monthly ?? null;

  const yearlyPackage: PurchasesPackage | null =
    offering?.availablePackages.find(p => p.identifier === '$rc_annual') ??
    offering?.annual ?? null;

  return {
    offering,
    monthlyPackage,
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
