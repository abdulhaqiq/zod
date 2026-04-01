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
import Constants, { ExecutionEnvironment } from 'expo-constants';
import Purchases, {
  LOG_LEVEL,
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases';
import { NativeModules } from 'react-native';
import { apiFetch } from '@/constants/api';
import { RC_ENTITLEMENT, RC_OFFERING, RC_PREMIUM_OFFERING, RC_PREMIUM_ENTITLEMENT, type AiCreditPack } from '@/constants/iap';
import { useAuth } from '@/context/AuthContext';

// Structured feature types stored in DB
export type FeatureBool = {
  key: string; label: string; icon: string;
  type: 'bool'; value: boolean;
};
export type FeatureQuantity = {
  key: string; label: string; icon: string;
  type: 'quantity'; limit: number; period: 'weekly' | 'monthly'; display: string;
};
export type FeatureLabel = {
  key: string; label: string; icon: string;
  type: 'label'; display: string;
};
export type PlanFeature = FeatureBool | FeatureQuantity | FeatureLabel;

export type BackendPlan = {
  id: string;
  name: string;
  tier: 'pro' | 'premium_plus';
  apple_product_id: string;
  interval: 'weekly' | 'monthly' | 'threemonth' | 'sixmonth' | 'annual';
  price_display: string;
  price_usd: number;
  badge: string | null;
  description: string | null;
  features: PlanFeature[];
  sort_order: number;
};

export type MyFeatures = {
  tier: string;
  super_likes_limit: number;
  super_likes_remaining: number;
  super_likes_reset_at: string | null;
  super_likes_resets_in_days: number | null;
  profile_boosts_limit: number;
  features: PlanFeature[];
  /** Free-tier daily like quota. -1 = unlimited (paid tiers). */
  daily_likes_limit: number;
  daily_likes_used: number;
  daily_likes_remaining: number;
  /** AI Credits wallet. */
  ai_credits_balance: number;
  /** Monthly grant for this tier (0 for free). */
  ai_credits_monthly: number;
};

/**
 * True when running inside the Expo Go sandbox where native modules are unavailable.
 * Checks both the Expo constants AND whether the RevenueCat native module is present,
 * since Constants.executionEnvironment can be unreliable across SDK versions.
 */
const IS_EXPO_GO =
  !NativeModules.RNPurchases ||
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
  (Constants as any).appOwnership === 'expo';

export type SubscriptionStatus = {
  isPro: boolean;
  expiresAt: string | null;
  tier: string;
};

export function useSubscription() {
  const { token, updateProfile } = useAuth();

  const [offering,         setOffering]         = useState<PurchasesOffering | null>(null);
  const [premiumOffering,  setPremiumOffering]  = useState<PurchasesOffering | null>(null);
  const [plans,            setPlans]            = useState<BackendPlan[]>([]);
  const [myFeatures,       setMyFeatures]       = useState<MyFeatures | null>(null);
  const [status,           setStatus]           = useState<SubscriptionStatus | null>(null);
  const [loading,          setLoading]          = useState(false);
  const [purchasing,       setPurchasing]       = useState(false);
  const [purchasingCredits,setPurchasingCredits]= useState(false);
  const [error,            setError]            = useState<string | null>(null);
  const configuredToken = useRef<string | null>(null);

  // ── Configure RevenueCat SDK — key fetched from backend ──────────────────

  useEffect(() => {
    if (!token || configuredToken.current === token) return;
    configuredToken.current = token;

    const init = async () => {
      // Fetch status, plan catalog, and personal feature limits from backend.
      // All three work in Expo Go (no native RC SDK needed).
      fetchStatus();
      apiFetch<BackendPlan[]>('/subscription/plans', { token })
        .then(data => setPlans(data ?? []))
        .catch(() => {});
      apiFetch<MyFeatures>('/subscription/my-features', { token })
        .then(data => {
          setMyFeatures(data);
          // Sync super_likes_remaining into the cached profile so FeedScreen
          // sees the correct count without needing a separate profile refresh.
          if (data?.super_likes_remaining !== undefined) {
            updateProfile({ super_likes_remaining: data.super_likes_remaining });
          }
        })
        .catch(() => {});

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
      const premOff = offerings.all[RC_PREMIUM_OFFERING] ?? null;
      setPremiumOffering(premOff);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load offerings');
    }
  }, []);

  // ── Fetch subscription status + feature limits from backend ─────────────

  const fetchStatus = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch<{ is_pro: boolean; tier: string; expires_at: string | null }>(
        '/subscription/status',
        { token },
      );
      setStatus({ isPro: data.is_pro, tier: data.tier, expiresAt: data.expires_at });
      updateProfile({ subscription_tier: data.tier });
    } catch { /* ignore */ }
  }, [token, updateProfile]);

  const fetchMyFeatures = useCallback(async () => {
    if (!token) return;
    try {
      const feat = await apiFetch<MyFeatures>('/subscription/my-features', { token });
      if (feat) {
        setMyFeatures(feat);
        if (feat.super_likes_remaining !== undefined) {
          updateProfile({ super_likes_remaining: feat.super_likes_remaining });
        }
      }
    } catch { /* ignore */ }
  }, [token, updateProfile]);

  // ── Purchase a package ────────────────────────────────────────────────────

  const purchase = useCallback(async (pkg: PurchasesPackage): Promise<boolean> => {
    setPurchasing(true);
    setError(null);
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      const entitlement =
        customerInfo.entitlements.active[RC_PREMIUM_ENTITLEMENT] ??
        customerInfo.entitlements.active[RC_ENTITLEMENT];

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
        // Refresh feature limits (super_likes, ai_credits, etc.) for the new tier
        fetchMyFeatures();
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
  }, [token, updateProfile, fetchMyFeatures]);

  // ── Restore purchases ─────────────────────────────────────────────────────

  const restore = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const customerInfo = await Purchases.restorePurchases();
      const entitlement =
        customerInfo.entitlements.active[RC_PREMIUM_ENTITLEMENT] ??
        customerInfo.entitlements.active[RC_ENTITLEMENT];
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
        // Refresh feature limits for the restored tier
        fetchMyFeatures();
        return true;
      }
      return false;
    } catch (e: any) {
      setError(e?.message ?? 'Restore failed');
      return false;
    } finally {
      setLoading(false);
    }
  }, [token, updateProfile, fetchMyFeatures]);

  // ── Purchase AI credit pack (consumable) ─────────────────────────────────

  const purchaseAiCredits = useCallback(async (pack: AiCreditPack): Promise<{ success: boolean; newBalance?: number; error?: string }> => {
    setPurchasingCredits(true);
    setError(null);
    try {
      if (!IS_EXPO_GO) {
        // Fetch the product from RevenueCat by product ID
        const offerings = await Purchases.getOfferings();
        const allPackages = Object.values(offerings.all ?? {}).flatMap(o => o.availablePackages);
        const pkg = allPackages.find(p => p.product?.identifier === pack.id);

        if (pkg) {
          const { customerInfo } = await Purchases.purchasePackage(pkg);
          const rcCustomerId = customerInfo.originalAppUserId;
          const data = await apiFetch<{ credits_added: number; new_balance: number }>(
            '/subscription/ai-credits/topup',
            {
              method: 'POST',
              token: token ?? undefined,
              body: JSON.stringify({ pack_id: pack.id, revenuecat_customer_id: rcCustomerId }),
            },
          );
          // Update local myFeatures balance
          setMyFeatures(prev => prev ? { ...prev, ai_credits_balance: data.new_balance } : prev);
          return { success: true, newBalance: data.new_balance };
        }
      }

      // In Expo Go or if product not found in RC — call backend directly (dev/test only)
      const data = await apiFetch<{ credits_added: number; new_balance: number }>(
        '/subscription/ai-credits/topup',
        {
          method: 'POST',
          token: token ?? undefined,
          body: JSON.stringify({ pack_id: pack.id, revenuecat_customer_id: 'dev_test' }),
        },
      );
      setMyFeatures(prev => prev ? { ...prev, ai_credits_balance: data.new_balance } : prev);
      return { success: true, newBalance: data.new_balance };
    } catch (e: any) {
      if (e?.userCancelled) return { success: false };
      const msg = e?.message ?? 'Purchase failed. Please try again.';
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setPurchasingCredits(false);
    }
  }, [token]);

  // ── Convenience getters — Pro (default offering) ─────────────────────────

  const weeklyPackage: PurchasesPackage | null =
    offering?.availablePackages.find(p => p.identifier === '$rc_weekly') ??
    offering?.weekly ?? null;

  const monthlyPackage: PurchasesPackage | null =
    offering?.availablePackages.find(p => p.identifier === '$rc_monthly') ??
    offering?.monthly ?? null;

  const threeMonthPackage: PurchasesPackage | null =
    offering?.availablePackages.find(p => p.identifier === '$rc_three_month') ??
    offering?.threeMonth ?? null;

  const yearlyPackage: PurchasesPackage | null =
    offering?.availablePackages.find(p => p.identifier === '$rc_annual') ??
    offering?.annual ?? null;

  // ── Convenience getters — Premium+ (premium offering) ────────────────────

  const premiumWeeklyPackage: PurchasesPackage | null =
    premiumOffering?.availablePackages.find(p => p.identifier === '$rc_weekly') ??
    premiumOffering?.weekly ?? null;

  const premiumMonthlyPackage: PurchasesPackage | null =
    premiumOffering?.availablePackages.find(p => p.identifier === '$rc_monthly') ??
    premiumOffering?.monthly ?? null;

  const premiumThreeMonthPackage: PurchasesPackage | null =
    premiumOffering?.availablePackages.find(p => p.identifier === '$rc_three_month') ??
    premiumOffering?.threeMonth ?? null;

  // Derived plan lists from backend catalog
  const proPlans     = plans.filter(p => p.tier === 'pro');
  const premiumPlans = plans.filter(p => p.tier === 'premium_plus');

  const planByInterval = (tier: 'pro' | 'premium_plus', interval: BackendPlan['interval']) =>
    plans.find(p => p.tier === tier && p.interval === interval) ?? null;

  /** Get a structured feature from the user's active plan features (from my-features endpoint) */
  const getMyFeature = (key: string): PlanFeature | null =>
    myFeatures?.features.find(f => f.key === key) ?? null;

  return {
    offering,
    premiumOffering,
    plans,
    proPlans,
    premiumPlans,
    planByInterval,
    myFeatures,
    getMyFeature,
    weeklyPackage,
    monthlyPackage,
    threeMonthPackage,
    yearlyPackage,
    premiumWeeklyPackage,
    premiumMonthlyPackage,
    premiumThreeMonthPackage,
    status,
    loading,
    purchasing,
    purchasingCredits,
    error,
    purchase,
    restore,
    purchaseAiCredits,
    /** Re-fetch subscription status from the backend */
    refetch: fetchStatus,
    /** Re-fetch feature limits (super_likes, ai_credits, etc.) */
    refetchFeatures: fetchMyFeatures,
  };
}
