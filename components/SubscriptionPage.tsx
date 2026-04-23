import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Purchases, { type PurchasesPackage } from 'react-native-purchases';
import ScreenHeader from '@/components/ui/ScreenHeader';
import Squircle from '@/components/ui/Squircle';
import {
  useSubscription,
  type BackendPlan,
  type PlanFeature,
} from '@/hooks/useSubscription';
import { useAppTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type PlanTier      = 'pro' | 'premium_plus';
type BillingPeriod = 'weekly' | 'monthly' | 'threemonths';

// ─── Feature display helpers ──────────────────────────────────────────────────

/**
 * Returns the display value for a feature given a tier's feature list.
 * Returns true (✓), false (–), or a string (quantity/label).
 */
function featureValue(features: PlanFeature[], key: string): boolean | string {
  const f = features.find(x => x.key === key);
  if (!f) return false;
  if (f.type === 'bool')     return f.value;
  if (f.type === 'quantity') return f.display;
  if (f.type === 'label')    return f.display;
  return false;
}

/** Canonical feature order/icons/labels pulled from either plan's feature list. */
function allFeatureKeys(proFeatures: PlanFeature[], ppFeatures: PlanFeature[]): PlanFeature[] {
  const seen = new Set<string>();
  const merged: PlanFeature[] = [];
  for (const f of [...proFeatures, ...ppFeatures]) {
    if (!f.key || !f.label || !f.icon) continue;
    if (!seen.has(f.key)) { seen.add(f.key); merged.push(f); }
  }
  return merged;
}

// ─── Billing option row ───────────────────────────────────────────────────────

function BillingOption({
  label, price, sub, badge, selected, onSelect, colors,
}: {
  label: string; price: string; sub: string; badge?: string | null;
  selected: boolean; onSelect: () => void; colors: any;
}) {
  return (
    <Pressable onPress={onSelect} style={({ pressed }) => [pressed && { opacity: 0.75 }]}>
      <Squircle
        style={styles.billingOption}
        cornerRadius={18} cornerSmoothing={1}
        fillColor={selected ? colors.surface2 : colors.surface}
        strokeColor={selected ? colors.text : colors.border}
        strokeWidth={selected ? 2 : StyleSheet.hairlineWidth}
      >
        <View style={styles.billingInner}>
          <View style={[styles.radio, { borderColor: selected ? colors.text : colors.border }]}>
            {selected && <View style={[styles.radioDot, { backgroundColor: colors.text }]} />}
          </View>
          <View style={styles.billingMeta}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[styles.billingLabel, { color: colors.text }]}>{label}</Text>
              {badge ? (
                <View style={[styles.saveBadge, { backgroundColor: colors.surface2, borderColor: colors.border, borderWidth: 1 }]}>
                  <Text style={[styles.saveBadgeText, { color: colors.text }]}>{badge}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.billingSub, { color: colors.textSecondary }]}>{sub}</Text>
          </View>
          <Text style={[styles.billingPrice, { color: colors.text }]}>{price}</Text>
        </View>
      </Squircle>
    </Pressable>
  );
}

// ─── Feature cell ─────────────────────────────────────────────────────────────

function FeatureCell({ value, colors }: { value: boolean | string; colors: any }) {
  if (value === false) {
    return (
      <Squircle style={styles.cellBadge} cornerRadius={8} cornerSmoothing={1} fillColor={colors.surface2}>
        <Ionicons name="close" size={13} color={colors.textTertiary} />
      </Squircle>
    );
  }
  if (value === true) {
    return (
      <Squircle style={styles.cellBadge} cornerRadius={8} cornerSmoothing={1} fillColor={colors.surface2}>
        <Ionicons name="checkmark" size={13} color={colors.text} />
      </Squircle>
    );
  }
  return (
    <Squircle style={styles.cellBadgeWide} cornerRadius={8} cornerSmoothing={1} fillColor={colors.surface2}>
      <Text style={[styles.cellQty, { color: colors.text }]} numberOfLines={1}>{value}</Text>
    </Squircle>
  );
}

// ─── Fallback plan data (used until backend responds) ─────────────────────────

const FALLBACK_FEATURES_PRO: PlanFeature[] = [
  { key: 'unlimited_likes',    label: 'Unlimited likes',    icon: 'heart',            type: 'bool',     value: true },
  { key: 'see_who_liked_you',  label: 'See who liked you',  icon: 'eye',              type: 'bool',     value: true },
  { key: 'rewind',             label: 'Rewind last swipe',  icon: 'refresh-circle',   type: 'bool',     value: true },
  { key: 'super_likes',        label: 'Super Likes',        icon: 'star',             type: 'quantity', limit: 5,  period: 'weekly',  display: '5/wk' },
  { key: 'profile_boosts',     label: 'Profile Boosts',     icon: 'rocket',           type: 'quantity', limit: 1,  period: 'monthly', display: '1/mo' },
  { key: 'advanced_filters',   label: 'Advanced filters',   icon: 'options',          type: 'bool',     value: true },
  { key: 'ai_smart_matching',  label: 'AI Smart Matching',  icon: 'sparkles',         type: 'bool',     value: true },
  { key: 'ai_credits',         label: 'AI Credits',         icon: 'flash',            type: 'quantity', limit: 10, period: 'monthly', display: '10/mo' },
  { key: 'travel_mode',        label: 'Travel Mode',        icon: 'airplane',         type: 'bool',     value: true },
  { key: 'priority_visibility',label: 'Priority visibility',icon: 'trending-up',      type: 'bool',     value: true },
  { key: 'read_receipts',      label: 'Read receipts',      icon: 'chatbubble',       type: 'bool',     value: false },
  { key: 'no_ads',             label: 'No ads',             icon: 'ban',              type: 'bool',     value: true },
  { key: 'incognito',          label: 'Incognito browsing', icon: 'eye-off',          type: 'bool',     value: false },
  { key: 'vip_support',        label: 'VIP support',        icon: 'shield-checkmark', type: 'bool',     value: false },
];

const FALLBACK_FEATURES_PP: PlanFeature[] = [
  { key: 'unlimited_likes',    label: 'Unlimited likes',    icon: 'heart',            type: 'bool',     value: true },
  { key: 'see_who_liked_you',  label: 'See who liked you',  icon: 'eye',              type: 'bool',     value: true },
  { key: 'rewind',             label: 'Rewind last swipe',  icon: 'refresh-circle',   type: 'bool',     value: true },
  { key: 'super_likes',        label: 'Super Likes',        icon: 'star',             type: 'quantity', limit: 10, period: 'weekly',  display: '10/wk' },
  { key: 'profile_boosts',     label: 'Profile Boosts',     icon: 'rocket',           type: 'quantity', limit: 2,  period: 'monthly', display: '2/mo' },
  { key: 'advanced_filters',   label: 'Advanced filters',   icon: 'options',          type: 'bool',     value: true },
  { key: 'ai_smart_matching',  label: 'AI Smart Matching',  icon: 'sparkles',         type: 'label',    display: 'Priority' },
  { key: 'ai_credits',         label: 'AI Credits',         icon: 'flash',            type: 'quantity', limit: 25, period: 'monthly', display: '25/mo' },
  { key: 'travel_mode',        label: 'Travel Mode',        icon: 'airplane',         type: 'bool',     value: true },
  { key: 'priority_visibility',label: 'Priority visibility',icon: 'trending-up',      type: 'label',    display: '2×' },
  { key: 'read_receipts',      label: 'Read receipts',      icon: 'chatbubble',       type: 'bool',     value: true },
  { key: 'no_ads',             label: 'No ads',             icon: 'ban',              type: 'bool',     value: true },
  { key: 'incognito',          label: 'Incognito browsing', icon: 'eye-off',          type: 'bool',     value: true },
  { key: 'vip_support',        label: 'VIP support',        icon: 'shield-checkmark', type: 'bool',     value: true },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SubscriptionPage() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { profile } = useAuth();
  const {
    planByInterval,
    proPlans,
    premiumPlans,
    plansLoading,
    myFeatures,
    weeklyPackage,
    monthlyPackage,
    threeMonthPackage,
    premiumWeeklyPackage,
    premiumMonthlyPackage,
    premiumThreeMonthPackage,
    status,
    purchasing,
    error,
    purchase,
    restore,
  } = useSubscription();

  const [tier,    setTier]    = useState<PlanTier>('pro');
  const [billing, setBilling] = useState<BillingPeriod>('monthly');

  // The user's actual subscription tier
  const userTier  = myFeatures?.tier ?? profile?.subscription_tier ?? 'free';
  const isPro     = userTier === 'pro' || userTier === 'premium_plus' || status?.isPro === true;
  // True only when the user already owns the tab they're currently viewing
  const isAlreadyOnSelectedTier =
    tier === 'premium_plus'
      ? userTier === 'premium_plus'
      : (tier === 'pro' && (userTier === 'pro' || userTier === 'premium_plus')); // pro or premium+ both cover the Pro tab
  const expiresAt = status?.expiresAt ?? null;
  
  // Can upgrade to Premium+ if currently on Pro
  const canUpgradeToPremium = userTier === 'pro' && tier === 'premium_plus';

  // ── Feature lists from DB (fallback to hardcoded until DB responds) ──────────

  const proMonthlyPlan = proPlans.find(p => p.interval === 'monthly');
  const ppMonthlyPlan  = premiumPlans.find(p => p.interval === 'monthly');

  // Only use backend features if they are structured objects with a `key` field.
  // Legacy DB entries may be plain strings or dicts without `key`/`icon`, which
  // cause featureValue() to return false for everything and the list to look empty.
  const isStructuredFeature = (f: any): f is PlanFeature =>
    f && typeof f === 'object' && typeof f.key === 'string' && f.key.length > 0;

  const proBackendFeatures = (proMonthlyPlan?.features ?? []).filter(isStructuredFeature) as PlanFeature[];
  const ppBackendFeatures  = (ppMonthlyPlan?.features  ?? []).filter(isStructuredFeature) as PlanFeature[];

  const proFeatures = proBackendFeatures.length ? proBackendFeatures : FALLBACK_FEATURES_PRO;
  const ppFeatures  = ppBackendFeatures.length  ? ppBackendFeatures  : FALLBACK_FEATURES_PP;

  // Merged canonical feature key order (all unique keys from both plans).
  // Always fall back to hardcoded features if the backend data produces an
  // empty list (e.g. features are missing required icon/label fields).
  const _featureKeysRaw = allFeatureKeys(proFeatures, ppFeatures);
  const featureKeys = (
    _featureKeysRaw.length > 0
      ? _featureKeysRaw
      : allFeatureKeys(FALLBACK_FEATURES_PRO, FALLBACK_FEATURES_PP)
  ).filter(f => f.key !== 'gift_card');

  // ── Plan lookup helpers ───────────────────────────────────────────────────────

  const getPlan = (t: PlanTier, b: BillingPeriod): BackendPlan | null =>
    planByInterval(t, b === 'threemonths' ? 'threemonth' : b as any);

  const getPriceDisplay = (t: PlanTier, b: BillingPeriod) =>
    getPlan(t, b)?.price_display ?? null;
  const getDescription  = (t: PlanTier, b: BillingPeriod) =>
    getPlan(t, b)?.description   ?? null;
  const getBadge        = (t: PlanTier, b: BillingPeriod) =>
    getPlan(t, b)?.badge         ?? null;

  // ── RC packages for actual IAP (tier-aware) ──────────────────────────────────

  const proPackageMap: Record<BillingPeriod, PurchasesPackage | null> = {
    weekly:     weeklyPackage,
    monthly:    monthlyPackage,
    threemonths: threeMonthPackage,
  };
  const premiumPackageMap: Record<BillingPeriod, PurchasesPackage | null> = {
    weekly:     premiumWeeklyPackage,
    monthly:    premiumMonthlyPackage,
    threemonths: premiumThreeMonthPackage,
  };
  const rcPackageMap = tier === 'premium_plus' ? premiumPackageMap : proPackageMap;
  const storeAvailable =
    weeklyPackage !== null || monthlyPackage !== null || threeMonthPackage !== null ||
    premiumWeeklyPackage !== null || premiumMonthlyPackage !== null || premiumThreeMonthPackage !== null;

  // ── Price helpers — prefer live App Store prices from RevenueCat ──────────────
  // Falls back to DB values only when RC packages haven't loaded yet.

  const getRcPkg = (t: PlanTier, b: BillingPeriod): PurchasesPackage | null =>
    (t === 'premium_plus' ? premiumPackageMap : proPackageMap)[b];

  const getRcPriceDisplay = (t: PlanTier, b: BillingPeriod): string | null => {
    const pkg = getRcPkg(t, b);
    const priceStr: string = (pkg?.product as any)?.priceString ?? (pkg?.product as any)?.localizedPriceString ?? '';
    if (!priceStr) return null;
    if (b === 'weekly') return `${priceStr}/wk`;
    if (b === 'monthly') return `${priceStr}/mo`;
    // 3-month: derive per-month breakdown from the total price
    const priceNum: number = (pkg?.product as any)?.price ?? 0;
    if (priceNum > 0) {
      const symbol = priceStr.replace(/[\d.,\s]/g, '');
      const perMonth = (priceNum / 3).toFixed(2);
      return `${symbol}${perMonth}/mo`;
    }
    return priceStr;
  };

  const getRcDescription = (t: PlanTier, b: BillingPeriod): string | null => {
    const pkg = getRcPkg(t, b);
    const priceStr: string = (pkg?.product as any)?.priceString ?? (pkg?.product as any)?.localizedPriceString ?? '';
    if (!priceStr) return null;
    if (b === 'weekly') return 'Billed weekly';
    if (b === 'monthly') return 'Billed monthly';
    return `Billed ${priceStr} every 3 months`;
  };

  // ── CTA text ──────────────────────────────────────────────────────────────────

  const tierName = tier === 'pro' ? 'Pro' : 'Premium+';
  const ctaPrice = getRcPriceDisplay(tier, billing) ?? getPlan(tier, billing)?.price_display ?? null;
  const ctaDesc  = getRcDescription(tier, billing)  ?? getPlan(tier, billing)?.description   ?? null;

  // ── Personal quota (from my-features) ────────────────────────────────────────

  // Derive the user's actual subscription tier (not the UI tab selector)
  const activeTier     = myFeatures?.tier ?? profile?.subscription_tier ?? 'free';
  const defaultSlLimit = activeTier === 'premium_plus' ? 10 : activeTier === 'pro' ? 5 : 0;

  // my-features is the authoritative source; profile is a stale cache fallback.
  // For remaining: prefer myFeatures (freshly synced from server).
  // For limit: use myFeatures if it's > 0; otherwise fall back to tier default.
  const slRemaining = myFeatures != null
    ? myFeatures.super_likes_remaining
    : (profile?.super_likes_remaining ?? 0);
  const slLimit = myFeatures != null && myFeatures.super_likes_limit > 0
    ? myFeatures.super_likes_limit
    : defaultSlLimit;
  const slResetsIn  = myFeatures?.super_likes_resets_in_days;

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleSubscribe = async () => {
    const pkg = rcPackageMap[billing];
    if (!pkg) {
      Alert.alert('Not available right now', 'In-app purchases are not yet configured. Check back soon.');
      return;
    }
    const success = await purchase(pkg);
    if (success) {
      Alert.alert(`Welcome to ${tierName}!`, 'All features are now unlocked.', [
        { text: "Let's go!", onPress: () => { if (router.canGoBack()) router.back(); } },
      ]);
    } else if (error) {
      Alert.alert('Purchase failed', error);
    }
  };

  const handleRestore = async () => {
    if (!storeAvailable) {
      Alert.alert('Store not available', 'Restore purchases requires a development or production build.');
      return;
    }
    const success = await restore();
    if (success) {
      Alert.alert('Restored!', 'Your subscription has been restored.', [
        { text: 'OK', onPress: () => { if (router.canGoBack()) router.back(); } },
      ]);
    } else {
      Alert.alert('No subscription found', "We couldn't find an active subscription for your account.");
    }
  };

  const handleManageSubscription = () => {
    Linking.openURL('https://apps.apple.com/account/subscriptions');
  };

  const billingPeriods: BillingPeriod[] = ['threemonths', 'monthly', 'weekly'];
  const billingLabel: Record<BillingPeriod, string> = { threemonths: '3 Months', monthly: 'Monthly', weekly: 'Weekly' };

  // Features for the currently selected tier
  const activePlanFeatures = tier === 'pro' ? proFeatures : ppFeatures;

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScreenHeader
        title="Upgrade"
        onClose={() => { if (router.canGoBack()) router.back(); }}
        colors={colors}
      />

      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Current Subscription Status ────────────────────────────────── */}
        {isPro && (
          <View style={[styles.currentPlanCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.currentPlanHeader}>
              <Squircle style={[styles.currentPlanIcon, { backgroundColor: colors.surface2 }]} cornerRadius={12} cornerSmoothing={1}>
                <Ionicons name={userTier === 'premium_plus' ? 'diamond' : 'star'} size={20} color={colors.text} />
              </Squircle>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={[styles.currentPlanTitle, { color: colors.text }]}>
                    {userTier === 'premium_plus' ? 'Premium+' : 'Zod Pro'}
                  </Text>
                  {canUpgradeToPremium && (
                    <View style={{ backgroundColor: colors.text, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Text style={{ fontSize: 10, fontFamily: 'ProductSans-Bold', color: colors.bg }}>Viewing Premium+</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.currentPlanSub, { color: colors.textSecondary }]}>
                  {canUpgradeToPremium 
                    ? 'Upgrade for more features'
                    : expiresAt
                      ? `Renews ${new Date(expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                      : 'Active'}
                </Text>
              </View>
              <Pressable
                onPress={handleManageSubscription}
                style={({ pressed }) => [pressed && { opacity: 0.7 }]}
              >
                <Squircle style={[styles.manageBtn, { backgroundColor: colors.surface2 }]} cornerRadius={10} cornerSmoothing={1}>
                  <Text style={[styles.manageBtnText, { color: colors.text }]}>Manage</Text>
                </Squircle>
              </Pressable>
            </View>

            {/* Quick Stats */}
            {!canUpgradeToPremium && (
              <View style={styles.quickStats}>
                <View style={styles.statItem}>
                  <Ionicons name="star" size={14} color={colors.textSecondary} />
                  <Text style={[styles.statText, { color: colors.textSecondary }]}>
                    {slRemaining}/{slLimit} Super Likes
                  </Text>
                </View>
                <View style={styles.statDivider}>
                  <View style={[styles.statDot, { backgroundColor: colors.border }]} />
                </View>
                <View style={styles.statItem}>
                  <Ionicons name="flash" size={14} color={colors.textSecondary} />
                  <Text style={[styles.statText, { color: colors.textSecondary }]}>
                    {myFeatures?.ai_credits_balance ?? 0} AI Credits
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <View style={styles.hero}>
          {canUpgradeToPremium ? (
            <Text style={[styles.heroTitle, { color: colors.text }]}>
              Upgrade to Premium+
            </Text>
          ) : isPro ? (
            <Text style={[styles.heroTitle, { color: colors.text }]}>
              Your Subscription
            </Text>
          ) : (
            <Text style={[styles.heroTitle, { color: colors.text, textAlign: 'center' }]}>
              Choose the plan{'\n'}that <Text style={{ color: colors.textSecondary }}>fits</Text> you
            </Text>
          )}
          <Text style={[styles.heroSub, { color: colors.textSecondary }]}>
            {canUpgradeToPremium 
              ? 'Get priority matching, more Super Likes, AI Credits, and exclusive features.'
              : isPro 
                ? 'Manage your subscription or explore Premium+'
                : 'Unlock unlimited likes, see who likes you, and more.'}
          </Text>

          {/* Tier switcher pill */}
          <View style={[styles.tierPill, { backgroundColor: colors.surface2 }]}>
            {(['pro', 'premium_plus'] as PlanTier[]).map(t => (
              <Pressable
                key={t}
                onPress={() => setTier(t)}
                style={({ pressed }) => [pressed && { opacity: 0.7 }]}
              >
                <View style={[
                  styles.tierTab,
                  tier === t && [styles.tierTabActive, { backgroundColor: colors.bg }],
                ]}>
                  <Text style={[
                    styles.tierTabText,
                    { color: tier === t ? colors.text : colors.textSecondary },
                  ]}>
                    {t === 'pro' ? 'Pro' : 'Premium+'}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ── Billing options ───────────────────────────────────────────── */}
        <View style={styles.pricingSection}>
          <View style={styles.pricingSectionHeader}>
            <Text style={[styles.pricingSectionTitle, { color: colors.text }]}>
              Select your plan
            </Text>
          </View>

          <View style={styles.billingWrap}>
            {plansLoading ? (
              // Skeleton rows while backend prices load
              ['threemonths', 'monthly', 'weekly'].map(b => (
                <View key={b} style={[styles.billingOptionSkeleton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <ActivityIndicator size="small" color={colors.textTertiary} />
                </View>
              ))
            ) : (
              billingPeriods.map(b => {
                const rcPrice = getRcPriceDisplay(tier, b);
                const dbPrice = getPriceDisplay(tier, b);
                const rcDesc  = getRcDescription(tier, b);
                const dbDesc  = getDescription(tier, b);
                const dbBadge = getBadge(tier, b);
                // Fallback stand-in badge when DB hasn't returned a badge yet
                const standInBadge = dbBadge ?? (b === 'threemonths' ? 'Best Value' : null);
                return (
                  <BillingOption
                    key={b}
                    label={billingLabel[b]}
                    price={rcPrice ?? dbPrice ?? '—'}
                    sub={rcDesc ?? dbDesc ?? (b === 'weekly' ? 'Billed weekly' : b === 'monthly' ? 'Billed monthly' : 'Billed every 3 months')}
                    badge={standInBadge}
                    selected={billing === b}
                    onSelect={() => setBilling(b)}
                    colors={colors}
                  />
                );
              })
            )}
          </View>
        </View>

        {/* ── Feature comparison (all features, ✓ or ✗ for active tier) ── */}
        <Text style={[styles.featuresHeader, { color: colors.text }]}>
          What's included
        </Text>
        <Squircle style={styles.tableCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={StyleSheet.hairlineWidth}>
          {featureKeys.map((feat, i) => {
            const val       = featureValue(activePlanFeatures, feat.key);
            const included  = val !== false;
            const iconColor = included ? colors.text : colors.textTertiary;
            const textColor = included ? colors.text : colors.textTertiary;

            return (
              <View
                key={feat.key ?? String(i)}
                style={[
                  styles.featureRow,
                  i < featureKeys.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                ]}
              >
                <View style={styles.featureLabelWrap}>
                  <Ionicons name={included ? 'checkmark-circle' : 'close-circle'} size={20} color={included ? colors.text : colors.textTertiary} />
                  <Text style={[styles.featureText, { color: textColor }]}>{feat.label}</Text>
                </View>
                {typeof val === 'string' && val !== 'true' && (
                  <Text style={[styles.featureValue, { color: colors.textSecondary }]}>{val}</Text>
                )}
              </View>
            );
          })}
        </Squircle>

        {/* ── Promo Code + Restore ──────────────────────────────────────── */}
        <View style={styles.footerLinks}>
          <Pressable
            onPress={() => Purchases.presentCodeRedemptionSheet()}
            style={({ pressed }) => [styles.giftCardBtn, pressed && { opacity: 0.6 }]}
          >
            <Squircle
              style={styles.giftCardPill}
              cornerRadius={14} cornerSmoothing={1}
              fillColor={colors.surface2}
              strokeColor={colors.border}
              strokeWidth={StyleSheet.hairlineWidth}
            >
              <Ionicons name="pricetag-outline" size={14} color={colors.text} />
              <Text style={[styles.giftCardText, { color: colors.text }]}>Redeem Promo Code</Text>
            </Squircle>
          </Pressable>
          <Pressable onPress={handleRestore} style={({ pressed }) => [styles.restoreBtn, pressed && { opacity: 0.6 }]}>
            <Text style={[styles.restoreText, { color: colors.textSecondary }]}>Restore purchases</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* ── Full-width bottom CTA ─────────────────────────────────────── */}
      <View style={styles.ctaWrap} pointerEvents="box-none">
        {!isAlreadyOnSelectedTier && error ? (
          <View style={styles.errorRow}>
            <Squircle style={styles.errorPill} cornerRadius={14} cornerSmoothing={1} fillColor="rgba(239,68,68,0.1)" strokeColor="rgba(239,68,68,0.25)" strokeWidth={1}>
              <Ionicons name="alert-circle-outline" size={14} color="#ef4444" />
              <Text style={styles.errorText}>{error}</Text>
            </Squircle>
          </View>
        ) : null}

        <View style={[styles.bottomSheet, {
          backgroundColor: colors.surface,
          borderTopColor:  colors.border,
          ...Platform.select({
            ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.08, shadowRadius: 16 },
            android: { elevation: 12 },
          }),
        }]}>
          {isAlreadyOnSelectedTier ? (
            <>
              <Pressable
                onPress={handleManageSubscription}
                style={({ pressed }) => [pressed && { opacity: 0.8 }]}
              >
                <View style={[styles.alreadyBtn, { backgroundColor: colors.surface2, borderRadius: 50 }]}>
                  <View style={styles.alreadyInner}>
                    <Ionicons name="checkmark-circle" size={20} color={colors.text} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.alreadyLabel, { color: colors.text }]}>Already Subscribed</Text>
                      <Text style={[styles.alreadySub, { color: colors.textSecondary }]}>
                        {expiresAt
                          ? `Renews ${new Date(expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                          : `You're on ${tier === 'premium_plus' ? 'Premium+' : 'Pro'} · Active`}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                  </View>
                </View>
              </Pressable>
              {userTier === 'pro' && tier === 'pro' && (
                <Pressable
                  onPress={() => setTier('premium_plus')}
                  style={({ pressed }) => [{ marginTop: 8 }, pressed && { opacity: 0.7 }]}
                >
                  <Text style={[styles.upgradeHint, { color: colors.text }]}>
                    Want more? Tap Premium+ above to see upgrade options →
                  </Text>
                </Pressable>
              )}
              <Text style={[styles.ctaLegal, { color: colors.textTertiary }]}>
                Tap to manage or cancel in App Store settings.
              </Text>
            </>
          ) : (
            <>
              <Pressable
                onPress={purchasing ? undefined : handleSubscribe}
                style={({ pressed }) => [pressed && !purchasing && { opacity: 0.82 }]}
              >
                <View style={[styles.ctaBtn, { backgroundColor: storeAvailable ? colors.text : colors.surface2, borderRadius: 50 }]}>
                  {purchasing ? (
                    <ActivityIndicator color={colors.bg} />
                  ) : storeAvailable ? (
                    <View style={styles.ctaBtnInner}>
                      <Text style={[styles.ctaBtnLabel, { color: colors.bg }]}>
                        {canUpgradeToPremium ? `Upgrade to ${tierName}` : `Get ${tierName}`}
                      </Text>
                      {ctaPrice && ctaDesc ? (
                        <Text style={[styles.ctaBtnSub, { color: colors.bg, opacity: 0.7 }]}>
                          {ctaPrice} · {ctaDesc}
                        </Text>
                      ) : ctaPrice ? (
                        <Text style={[styles.ctaBtnSub, { color: colors.bg, opacity: 0.7 }]}>{ctaPrice}</Text>
                      ) : null}
                    </View>
                  ) : (
                    <Text style={[styles.ctaBtnLabel, { color: colors.textSecondary }]}>Not available right now</Text>
                  )}
                </View>
              </Pressable>
              <Text style={[styles.ctaLegal, { color: colors.textTertiary }]}>
                {storeAvailable
                  ? 'Renews automatically. Cancel anytime in App Store settings.'
                  : 'In-app purchases are being configured. Check back soon.'}
              </Text>
              <View style={styles.ctaLegalLinks}>
                <Pressable onPress={() => WebBrowser.openBrowserAsync('https://zod.dhabli.com/terms')} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
                  <Text style={[styles.ctaLegalLink, { color: colors.textSecondary }]}>Terms of Use</Text>
                </Pressable>
                <Text style={[styles.ctaLegalSep, { color: colors.textTertiary }]}>·</Text>
                <Pressable onPress={() => WebBrowser.openBrowserAsync('https://zod.dhabli.com/privacy')} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
                  <Text style={[styles.ctaLegalLink, { color: colors.textSecondary }]}>Privacy Policy</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </View>

      {/* Gift card redemption has been fully removed per Apple guideline 3.1.1.
          Redemption is available exclusively at https://zod.dhabli.com/redeem */}
      {false && (
        <View>
          <Pressable style={styles.gcBackdrop} onPress={() => {}} />

          <View style={[styles.gcSheet, { backgroundColor: colors.bg, borderTopColor: colors.border }]}>
            <View style={[styles.gcHandle, { backgroundColor: colors.border }]} />

            {gcResult ? (
              /* ── Success state ── */
              <View style={styles.gcSuccess}>
                {/* Success card visual */}
                <View style={styles.gcSuccessCard}>
                  <View style={styles.gcCardTopRow}>
                    <Ionicons name="star" size={18} color="#f59e0b" />
                    <Text style={styles.gcCardTierText}>
                      {gcResult.tier === 'premium_plus' ? 'PREMIUM+' : 'ZOD PRO'}
                    </Text>
                  </View>
                  <View style={styles.gcCardCheckRow}>
                    <View style={styles.gcCardCheckCircle}>
                      <Ionicons name="checkmark" size={28} color="#f59e0b" />
                    </View>
                  </View>
                  <Text style={styles.gcCardActivatedText}>ACTIVATED</Text>
                </View>

                <View style={styles.gcSuccessTextWrap}>
                  <Text style={[styles.gcSuccessTitle, { color: colors.text }]}>You're all set!</Text>
                  <Text style={[styles.gcSuccessSub, { color: colors.textSecondary }]}>
                    {gcResult.plan_name} · {gcResult.duration_days} days
                  </Text>
                </View>

                <Squircle
                  style={styles.gcInfoBox}
                  cornerRadius={18} cornerSmoothing={1}
                  fillColor={colors.surface}
                  strokeColor={colors.border}
                  strokeWidth={StyleSheet.hairlineWidth}
                >
                  <View style={styles.gcInfoRow}>
                    <Squircle style={styles.gcInfoIcon} cornerRadius={8} cornerSmoothing={1} fillColor={colors.surface2}>
                      <Ionicons name="time-outline" size={13} color={colors.text} />
                    </Squircle>
                    <Text style={[styles.gcInfoText, { color: colors.text }]}>
                      Active for {gcResult.duration_days} days
                    </Text>
                  </View>
                  {gcResult.expires_at ? (
                    <View style={[styles.gcInfoRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 12 }]}>
                      <Squircle style={styles.gcInfoIcon} cornerRadius={8} cornerSmoothing={1} fillColor={colors.surface2}>
                        <Ionicons name="calendar-outline" size={13} color={colors.text} />
                      </Squircle>
                      <Text style={[styles.gcInfoText, { color: colors.text }]}>
                        Expires {new Date(gcResult.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </Text>
                    </View>
                  ) : null}
                  {gcResult.redemptions_remaining > 0 ? (
                    <View style={[styles.gcInfoRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 12 }]}>
                      <Squircle style={styles.gcInfoIcon} cornerRadius={8} cornerSmoothing={1} fillColor={colors.surface2}>
                        <Ionicons name="gift-outline" size={13} color={colors.text} />
                      </Squircle>
                      <Text style={[styles.gcInfoText, { color: colors.textSecondary }]}>
                        {gcResult.redemptions_remaining} use{gcResult.redemptions_remaining !== 1 ? 's' : ''} left on this card
                      </Text>
                    </View>
                  ) : null}
                </Squircle>

                <Pressable onPress={handleGcDone} style={({ pressed }) => [{ width: '100%' }, pressed && { opacity: 0.82 }]}>
                  <Squircle style={styles.gcPrimaryBtn} cornerRadius={50} cornerSmoothing={1} fillColor={colors.text}>
                    <Text style={[styles.gcPrimaryBtnText, { color: colors.bg }]}>Start Using Pro</Text>
                  </Squircle>
                </Pressable>
              </View>
            ) : (
              /* ── Input state ── */
              <View style={styles.gcBody}>

                {/* Visual gift card */}
                <View style={styles.gcCardVisual}>
                  <View style={styles.gcCardTopRow}>
                    <Ionicons name="gift-outline" size={16} color="#f59e0b" />
                    <Text style={styles.gcCardTierText}>ZOD PRO</Text>
                  </View>
                  <View style={styles.gcCardDots}>
                    <Text style={styles.gcCardDotsText}>• • • •{'   '}• • • •{'   '}• • • •</Text>
                  </View>
                  <View style={[styles.gcCardCircle, styles.gcCardCircleLeft]} />
                  <View style={[styles.gcCardCircle, styles.gcCardCircleRight]} />
                </View>

                <View style={styles.gcTitleWrap}>
                  <Text style={[styles.gcTitle, { color: colors.text }]}>Redeem Gift Card</Text>
                  <Text style={[styles.gcSub, { color: colors.textSecondary }]}>
                    Enter your 12-character code to unlock Pro instantly.
                  </Text>
                </View>

                {/* Segmented code input */}
                <Squircle
                  style={styles.gcInputWrap}
                  cornerRadius={18} cornerSmoothing={1}
                  fillColor={colors.surface}
                  strokeColor={gcError ? '#ef4444' : gcCode.length > 0 ? colors.text : colors.border}
                  strokeWidth={gcError ? 1.5 : gcCode.length > 0 ? 1.5 : StyleSheet.hairlineWidth}
                >
                  <TextInput
                    ref={gcInputRef}
                    value={gcCode}
                    onChangeText={handleGcChange}
                    placeholder="XXXX – XXXX – XXXX"
                    placeholderTextColor={colors.textTertiary}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={handleGcSubmit}
                    style={[styles.gcInput, { color: colors.text }]}
                    editable={!redeemingGiftCard}
                  />
                  {gcCode.length > 0 && !redeemingGiftCard ? (
                    <Pressable onPress={() => setGcCode('')} hitSlop={12}>
                      <Squircle style={styles.gcClearBtn} cornerRadius={10} cornerSmoothing={1} fillColor={colors.surface2}>
                        <Ionicons name="close" size={12} color={colors.textSecondary} />
                      </Squircle>
                    </Pressable>
                  ) : null}
                </Squircle>

                {gcError ? (
                  <Squircle
                    style={styles.gcErrorPill}
                    cornerRadius={10} cornerSmoothing={1}
                    fillColor="rgba(239,68,68,0.08)"
                    strokeColor="rgba(239,68,68,0.2)"
                    strokeWidth={1}
                  >
                    <Ionicons name="alert-circle-outline" size={14} color="#ef4444" />
                    <Text style={styles.gcErrorText}>{gcError}</Text>
                  </Squircle>
                ) : null}

                <View style={styles.gcBtnStack}>
                  <Pressable
                    onPress={redeemingGiftCard ? undefined : handleGcSubmit}
                    style={({ pressed }) => [{ width: '100%' }, pressed && !redeemingGiftCard && { opacity: 0.82 }]}
                  >
                    <Squircle
                      style={styles.gcPrimaryBtn}
                      cornerRadius={50} cornerSmoothing={1}
                      fillColor={gcCode.replace(/-/g, '').length >= 12 ? colors.text : colors.surface2}
                    >
                      {redeemingGiftCard ? (
                        <ActivityIndicator color={colors.bg} />
                      ) : (
                        <Text style={[styles.gcPrimaryBtnText, {
                          color: gcCode.replace(/-/g, '').length >= 12 ? colors.bg : colors.textSecondary,
                        }]}>Redeem</Text>
                      )}
                    </Squircle>
                  </Pressable>

                  <Pressable
                    onPress={handleGcDone}
                    style={({ pressed }) => [styles.gcCancelBtn, pressed && { opacity: 0.5 }]}
                  >
                    <Text style={[styles.gcCancelText, { color: colors.textSecondary }]}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        </View>
      )}

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:   { flex: 1 },
  flex:   { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 200 },

  // Current plan card
  currentPlanCard: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 24,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  currentPlanHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  currentPlanIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  currentPlanTitle: { fontSize: 17, fontFamily: 'ProductSans-Bold' },
  currentPlanSub: { fontSize: 13, fontFamily: 'ProductSans-Regular', marginTop: 2 },
  manageBtn: { paddingHorizontal: 14, paddingVertical: 7 },
  manageBtnText: { fontSize: 13, fontFamily: 'ProductSans-Bold' },
  quickStats: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statText: { fontSize: 12, fontFamily: 'ProductSans-Regular' },
  statDivider: { paddingHorizontal: 8 },
  statDot: { width: 3, height: 3, borderRadius: 1.5 },

  hero:     { alignItems: 'center', gap: 8, marginBottom: 24 },
  heroSub:  { fontSize: 15, fontFamily: 'ProductSans-Regular', textAlign: 'center', lineHeight: 22, paddingHorizontal: 24, marginBottom: 8 },

  heroTitle:     { fontSize: 32, fontFamily: 'ProductSans-Black', textAlign: 'center', lineHeight: 38 },

  pricingSection: { marginBottom: 20 },
  pricingSectionHeader: { marginBottom: 16 },
  pricingSectionTitle: { fontSize: 20, fontFamily: 'ProductSans-Bold' },
  
  billingWrap:   { gap: 10, marginBottom: 20 },
  
  featuresHeader: { fontSize: 20, fontFamily: 'ProductSans-Bold', marginBottom: 16 },
  billingOption: {},
  billingOptionSkeleton: { height: 72, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  billingInner:  { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 16 },
  radio:         { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot:      { width: 10, height: 10, borderRadius: 5 },
  billingMeta:   { flex: 1, gap: 3 },
  billingLabel:  { fontSize: 15, fontFamily: 'ProductSans-Bold' },
  billingSub:    { fontSize: 11, fontFamily: 'ProductSans-Regular' },
  billingPrice:  { fontSize: 15, fontFamily: 'ProductSans-Black' },
  saveBadge:     { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  saveBadgeText: { fontSize: 10, fontFamily: 'ProductSans-Bold' },

  // Tier switcher pill
  tierPill:           { flexDirection: 'row', borderRadius: 50, padding: 4, gap: 2, marginTop: 4 },
  tierTab:            { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 50 },
  tierTabActive:      { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  tierTabText:        { fontSize: 14, fontFamily: 'ProductSans-Bold' },

  tableCard:          { marginBottom: 16, overflow: 'hidden', padding: 4 },

  featureRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  featureLabelWrap:   { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureText:        { fontSize: 15, fontFamily: 'ProductSans-Regular', flex: 1 },
  featureValue:       { fontSize: 13, fontFamily: 'ProductSans-Medium' },
  cellBadge:     { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  cellBadgeWide: { minWidth: 54, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', justifyContent: 'center' },
  cellQty:       { fontSize: 10, fontFamily: 'ProductSans-Bold', textAlign: 'center' },

  footerLinks:   { alignItems: 'center', justifyContent: 'center', paddingVertical: 4, gap: 4 },
  giftCardBtn:   { alignItems: 'center' },
  giftCardPill:  { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 18, paddingVertical: 10 },
  giftCardText:  { fontSize: 13, fontFamily: 'ProductSans-Bold' },
  restoreBtn:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12 },
  restoreText:   { fontSize: 13, fontFamily: 'ProductSans-Regular' },

  ctaWrap:  { position: 'absolute', bottom: 0, left: 0, right: 0 },
  errorRow: { paddingHorizontal: 14, marginBottom: 8 },
  errorPill:{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  errorText:{ flex: 1, color: '#ef4444', fontSize: 12, fontFamily: 'ProductSans-Regular', lineHeight: 17 },

  bottomSheet: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },

  alreadyBtn:   { paddingVertical: 16, paddingHorizontal: 20, marginBottom: 10 },
  alreadyInner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  alreadyLabel: { fontSize: 15, fontFamily: 'ProductSans-Black' },
  alreadySub:   { fontSize: 12, fontFamily: 'ProductSans-Regular', marginTop: 2 },
  upgradeHint:  { fontSize: 13, fontFamily: 'ProductSans-Medium', textAlign: 'center', textDecorationLine: 'underline' },

  ctaBtn:      { paddingVertical: 16, paddingHorizontal: 20, alignItems: 'center', marginBottom: 10 },
  ctaBtnInner: { alignItems: 'center', gap: 2 },
  ctaBtnLabel: { fontSize: 16, fontFamily: 'ProductSans-Black' },
  ctaBtnSub:   { fontSize: 11, fontFamily: 'ProductSans-Regular' },
  ctaLegal:    { fontSize: 10, fontFamily: 'ProductSans-Regular', textAlign: 'center', lineHeight: 14 },
  ctaLegalLinks: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 },
  ctaLegalLink:  { fontSize: 10, fontFamily: 'ProductSans-Medium', textDecorationLine: 'underline' },
  ctaLegalSep:   { fontSize: 10, fontFamily: 'ProductSans-Regular' },

  // Gift card modal
  gcOverlay:  { flex: 1, justifyContent: 'flex-end' },
  gcBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  gcSheet: {
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 44 : 24,
    paddingTop: 14,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.15, shadowRadius: 28 },
      android: { elevation: 24 },
    }),
  },
  gcHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },

  // Visual gift card
  gcCardVisual: {
    width: '100%',
    height: 130,
    backgroundColor: '#0f0f1a',
    borderRadius: 20,
    padding: 18,
    justifyContent: 'space-between',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
  },
  gcCardTopRow:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  gcCardTierText:  { color: '#f59e0b', fontFamily: 'ProductSans-Bold', fontSize: 11, letterSpacing: 1.8 },
  gcCardDots:      { alignItems: 'flex-start' },
  gcCardDotsText:  { color: 'rgba(255,255,255,0.25)', fontFamily: 'ProductSans-Bold', fontSize: 14, letterSpacing: 2 },
  gcCardCircle:    {
    position: 'absolute', width: 90, height: 90, borderRadius: 45,
    backgroundColor: 'rgba(245,158,11,0.07)',
  },
  gcCardCircleLeft:  { bottom: -30, left: -20 },
  gcCardCircleRight: { top: -30, right: -20, backgroundColor: 'rgba(99,102,241,0.08)' },

  // Input state
  gcBody:      { alignItems: 'center', gap: 16 },
  gcTitleWrap: { alignItems: 'center', gap: 4 },
  gcTitle:     { fontSize: 22, fontFamily: 'ProductSans-Black', textAlign: 'center' },
  gcSub:       { fontSize: 13, fontFamily: 'ProductSans-Regular', textAlign: 'center', lineHeight: 20, paddingHorizontal: 8 },
  gcInputWrap: { flexDirection: 'row', alignItems: 'center', width: '100%', paddingHorizontal: 18, paddingVertical: 18, gap: 10 },
  gcInput:     { flex: 1, fontSize: 20, fontFamily: 'ProductSans-Bold', letterSpacing: 4, textAlign: 'center' },
  gcClearBtn:  { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  gcErrorPill: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%', paddingHorizontal: 14, paddingVertical: 10 },
  gcErrorText: { flex: 1, color: '#ef4444', fontSize: 12, fontFamily: 'ProductSans-Regular', lineHeight: 17 },
  gcBtnStack:       { width: '100%', gap: 4, alignItems: 'center' },
  gcPrimaryBtn:     { width: '100%', paddingVertical: 17, alignItems: 'center', justifyContent: 'center' },
  gcPrimaryBtnText: { fontSize: 16, fontFamily: 'ProductSans-Black' },
  gcCancelBtn:      { paddingVertical: 12, paddingHorizontal: 32 },
  gcCancelText:     { fontSize: 14, fontFamily: 'ProductSans-Medium', textAlign: 'center' },

  // Success state
  gcSuccess:        { alignItems: 'center', gap: 16, paddingTop: 4 },
  gcSuccessCard:    {
    width: '100%', height: 130, backgroundColor: '#0f0f1a',
    borderRadius: 20, padding: 18, justifyContent: 'space-between',
    overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(245,158,11,0.35)',
  },
  gcCardCheckRow:   { alignItems: 'center' },
  gcCardCheckCircle:{ width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(245,158,11,0.15)', alignItems: 'center', justifyContent: 'center' },
  gcCardActivatedText: { color: '#f59e0b', fontFamily: 'ProductSans-Bold', fontSize: 11, letterSpacing: 2 },
  gcSuccessTextWrap:{ alignItems: 'center', gap: 4 },
  gcSuccessTitle:   { fontSize: 24, fontFamily: 'ProductSans-Black', textAlign: 'center' },
  gcSuccessSub:     { fontSize: 14, fontFamily: 'ProductSans-Regular', textAlign: 'center', color: 'rgba(0,0,0,0.5)' },
  gcInfoBox:        { width: '100%', padding: 16, gap: 0 },
  gcInfoRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  gcInfoIcon:       { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  gcInfoText:       { fontSize: 13, fontFamily: 'ProductSans-Regular', flex: 1 },
});
