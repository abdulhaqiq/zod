import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import ScreenHeader from '@/components/ui/ScreenHeader';
import Squircle from '@/components/ui/Squircle';
import {
  useSubscription,
  type BackendPlan,
  type PlanFeature,
} from '@/hooks/useSubscription';
import { useGiftCard } from '@/hooks/useGiftCard';
import { useAppTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type PlanTier      = 'pro' | 'premium_plus';
type BillingPeriod = 'weekly' | 'monthly' | 'sixmonths';

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
    <Squircle style={[styles.cellBadge, styles.cellBadgeWide]} cornerRadius={8} cornerSmoothing={1} fillColor={colors.surface2}>
      <Text style={[styles.cellQty, { color: colors.text }]}>{value}</Text>
    </Squircle>
  );
}

// ─── Fallback plan data (used until backend responds) ─────────────────────────

const FALLBACK_FEATURES_PRO: PlanFeature[] = [
  { key: 'unlimited_likes',    label: 'Unlimited likes',    icon: 'heart',            type: 'bool',     value: true },
  { key: 'see_who_liked_you',  label: 'See who liked you',  icon: 'eye',              type: 'bool',     value: true },
  { key: 'rewind',             label: 'Rewind last swipe',  icon: 'refresh-circle',   type: 'bool',     value: true },
  { key: 'super_likes',        label: 'Super Likes',        icon: 'star',             type: 'quantity', limit: 5,  period: 'weekly',  display: '5 / week' },
  { key: 'profile_boosts',     label: 'Profile Boosts',     icon: 'rocket',           type: 'quantity', limit: 1,  period: 'monthly', display: '1 / month' },
  { key: 'advanced_filters',   label: 'Advanced filters',   icon: 'options',          type: 'bool',     value: true },
  { key: 'ai_smart_matching',  label: 'AI Smart Matching',  icon: 'sparkles',         type: 'label',    display: 'Standard' },
  { key: 'travel_mode',        label: 'Travel Mode',        icon: 'airplane',         type: 'bool',     value: true },
  { key: 'priority_visibility',label: 'Priority visibility',icon: 'trending-up',      type: 'label',    display: 'Standard' },
  { key: 'read_receipts',      label: 'Read receipts',      icon: 'chatbubble',       type: 'bool',     value: false },
  { key: 'no_ads',             label: 'No ads',             icon: 'ban',              type: 'bool',     value: true },
  { key: 'incognito',          label: 'Incognito browsing', icon: 'eye-off',          type: 'bool',     value: false },
  { key: 'vip_support',        label: 'VIP support',        icon: 'shield-checkmark', type: 'bool',     value: false },
];

const FALLBACK_FEATURES_PP: PlanFeature[] = [
  { key: 'unlimited_likes',    label: 'Unlimited likes',    icon: 'heart',            type: 'bool',     value: true },
  { key: 'see_who_liked_you',  label: 'See who liked you',  icon: 'eye',              type: 'bool',     value: true },
  { key: 'rewind',             label: 'Rewind last swipe',  icon: 'refresh-circle',   type: 'bool',     value: true },
  { key: 'super_likes',        label: 'Super Likes',        icon: 'star',             type: 'quantity', limit: 10, period: 'weekly',  display: '10 / week' },
  { key: 'profile_boosts',     label: 'Profile Boosts',     icon: 'rocket',           type: 'quantity', limit: 2,  period: 'monthly', display: '2 / month' },
  { key: 'advanced_filters',   label: 'Advanced filters',   icon: 'options',          type: 'bool',     value: true },
  { key: 'ai_smart_matching',  label: 'AI Smart Matching',  icon: 'sparkles',         type: 'label',    display: 'Priority' },
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
    myFeatures,
    weeklyPackage,
    monthlyPackage,
    sixMonthPackage,
    status,
    purchasing,
    error,
    purchase,
    restore,
  } = useSubscription();

  const {
    redeem: redeemGiftCard,
    redeeming: redeemingGiftCard,
    error: gcError,
    clearError: clearGcError,
  } = useGiftCard();

  const [tier,    setTier]    = useState<PlanTier>('pro');
  const [billing, setBilling] = useState<BillingPeriod>('monthly');

  // Gift card modal state
  const [gcModalVisible, setGcModalVisible] = useState(false);
  const [gcCode, setGcCode]                 = useState('');
  const [gcResult, setGcResult]             = useState<import('@/hooks/useGiftCard').RedeemResult | null>(null);
  const gcInputRef = useRef<TextInput>(null);

  const isPro     = profile?.subscription_tier === 'pro' || profile?.subscription_tier === 'premium_plus' || status?.isPro === true;
  const expiresAt = status?.expiresAt ?? null;

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

  const intervalKey: BackendPlan['interval'] = billing === 'sixmonths' ? 'sixmonth' : billing as any;

  const getPlan = (t: PlanTier, b: BillingPeriod): BackendPlan | null =>
    planByInterval(t, b === 'sixmonths' ? 'sixmonth' : b as any);

  // Fallback display values if DB not yet loaded
  const fallbackPrice: Record<PlanTier, Record<BillingPeriod, string>> = {
    pro:          { weekly: '$4.99/wk',  monthly: '$14.99/mo', sixmonths: '$10.00/mo' },
    premium_plus: { weekly: '$6.99/wk',  monthly: '$19.99/mo', sixmonths: '$15.00/mo' },
  };
  const fallbackDesc: Record<PlanTier, Record<BillingPeriod, string>> = {
    pro:          { weekly: 'Billed weekly, cancel anytime', monthly: 'Billed monthly, cancel anytime', sixmonths: 'Billed $59.99 every 6 months · Save 33%' },
    premium_plus: { weekly: 'Billed weekly, cancel anytime', monthly: 'Billed monthly, cancel anytime', sixmonths: 'Billed $89.99 every 6 months · Save 25%' },
  };

  const getPriceDisplay = (t: PlanTier, b: BillingPeriod) =>
    getPlan(t, b)?.price_display ?? fallbackPrice[t][b];
  const getDescription  = (t: PlanTier, b: BillingPeriod) =>
    getPlan(t, b)?.description   ?? fallbackDesc[t][b];
  const getBadge        = (t: PlanTier, b: BillingPeriod) =>
    getPlan(t, b)?.badge         ?? null;

  // ── RC packages for actual IAP ────────────────────────────────────────────────

  const rcPackageMap: Record<BillingPeriod, PurchasesPackage | null> = {
    weekly:    weeklyPackage,
    monthly:   monthlyPackage,
    sixmonths: sixMonthPackage,
  };
  const storeAvailable = weeklyPackage !== null || monthlyPackage !== null || sixMonthPackage !== null;

  // ── CTA text ──────────────────────────────────────────────────────────────────

  const tierName = tier === 'pro' ? 'Zod Pro' : 'Premium+';
  const ctaPrice = getPlan(tier, billing)?.price_display ?? fallbackPrice[tier][billing];
  const ctaDesc  = getPlan(tier, billing)?.description   ?? fallbackDesc[tier][billing];

  // ── Personal quota (from my-features) ────────────────────────────────────────

  const slRemaining = myFeatures?.super_likes_remaining ?? profile?.super_likes_remaining ?? 0;
  const slLimit     = myFeatures?.super_likes_limit ?? (tier === 'premium_plus' ? 10 : 5);
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
        { text: "Let's go!", onPress: () => router.back() },
      ]);
    } else if (error) {
      Alert.alert('Purchase failed', error);
    }
  };

  const handleGiftCard = () => {
    clearGcError();
    setGcCode('');
    setGcResult(null);
    setGcModalVisible(true);
    setTimeout(() => gcInputRef.current?.focus(), 300);
  };

  const handleGcSubmit = async () => {
    const trimmed = gcCode.trim().toUpperCase();
    if (!trimmed) return;
    const result = await redeemGiftCard(trimmed);
    if (result) {
      setGcResult(result);
    }
  };

  const handleGcDone = () => {
    setGcModalVisible(false);
    setGcCode('');
    setGcResult(null);
    if (gcResult) router.back();
  };

  const handleRestore = async () => {
    if (!storeAvailable) {
      Alert.alert('Store not available', 'Restore purchases requires a development or production build.');
      return;
    }
    const success = await restore();
    if (success) {
      Alert.alert('Restored!', 'Your subscription has been restored.');
      router.back();
    } else {
      Alert.alert('No subscription found', "We couldn't find an active subscription for your account.");
    }
  };

  const billingPeriods: BillingPeriod[] = ['sixmonths', 'monthly', 'weekly'];
  const billingLabel: Record<BillingPeriod, string> = { sixmonths: '6 Months', monthly: 'Monthly', weekly: 'Weekly' };

  // Features for the currently selected tier
  const activePlanFeatures = tier === 'pro' ? proFeatures : ppFeatures;

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScreenHeader
        title="Upgrade"
        onClose={() => router.back()}
        colors={colors}
      />

      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <View style={styles.hero}>
          <Squircle style={styles.heroIcon} cornerRadius={24} cornerSmoothing={1} fillColor={colors.surface2}>
            <Ionicons name={tier === 'premium_plus' ? 'diamond' : 'star'} size={34} color={colors.text} />
          </Squircle>
          <Text style={[styles.heroTitle, { color: colors.text }]}>
            {tier === 'pro' ? 'Zod Pro' : 'Premium+'}
          </Text>
          <Text style={[styles.heroSub, { color: colors.textSecondary }]}>
            {tier === 'pro'
              ? 'Everything you need to find the right person, faster.'
              : 'The full Zod experience. Priority matching, no limits.'}
          </Text>

          {/* Tier switcher pill — below the hero text */}
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

          {/* Super likes quota badge for current user */}
          {isPro && (
            <View style={[styles.quotaBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="star" size={13} color={colors.text} />
              <Text style={[styles.quotaText, { color: colors.text }]}>
                {slRemaining} / {slLimit} super likes this week
                {slResetsIn !== null ? `  ·  resets in ${slResetsIn}d` : ''}
              </Text>
            </View>
          )}
        </View>

        {/* ── Billing options ───────────────────────────────────────────── */}
        <View style={styles.billingWrap}>
          {billingPeriods.map(b => (
            <BillingOption
              key={b}
              label={billingLabel[b]}
              price={getPriceDisplay(tier, b)}
              sub={getDescription(tier, b)}
              badge={getBadge(tier, b)}
              selected={billing === b}
              onSelect={() => setBilling(b)}
              colors={colors}
            />
          ))}
        </View>

        {/* ── Feature comparison (all features, ✓ or ✗ for active tier) ── */}
        <Squircle style={styles.tableCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={StyleSheet.hairlineWidth}>

          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderLeft, { color: colors.textSecondary }]}>What you get</Text>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

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
                  <Squircle
                    style={styles.featureDot}
                    cornerRadius={10} cornerSmoothing={1}
                    fillColor={included ? colors.surface2 : colors.surface}
                  >
                    <Ionicons name={feat.icon as any} size={13} color={iconColor} />
                  </Squircle>
                  <Text style={[styles.featureText, { color: textColor }]}>{feat.label}</Text>
                </View>
                <FeatureCell value={val} colors={colors} />
              </View>
            );
          })}
        </Squircle>

        {/* ── Gift Card + Restore ───────────────────────────────────────── */}
        <View style={styles.footerLinks}>
          <Pressable
            onPress={redeemingGiftCard ? undefined : handleGiftCard}
            style={({ pressed }) => [styles.giftCardBtn, pressed && { opacity: 0.6 }]}
          >
            <Squircle
              style={styles.giftCardPill}
              cornerRadius={14} cornerSmoothing={1}
              fillColor={colors.surface2}
              strokeColor={colors.border}
              strokeWidth={StyleSheet.hairlineWidth}
            >
              <Ionicons name="gift-outline" size={14} color={colors.text} />
              <Text style={[styles.giftCardText, { color: colors.text }]}>
                {redeemingGiftCard ? 'Redeeming…' : 'Redeem Gift Card'}
              </Text>
            </Squircle>
          </Pressable>
          <Pressable onPress={handleRestore} style={({ pressed }) => [styles.restoreBtn, pressed && { opacity: 0.6 }]}>
            <Text style={[styles.restoreText, { color: colors.textSecondary }]}>Restore purchases</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* ── Full-width bottom CTA ─────────────────────────────────────── */}
      <View style={styles.ctaWrap} pointerEvents="box-none">
        {!isPro && error ? (
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
          {isPro ? (
            <>
              <View style={[styles.alreadyBtn, { backgroundColor: colors.surface2, borderRadius: 50 }]}>
                <View style={styles.alreadyInner}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.text} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.alreadyLabel, { color: colors.text }]}>Already Subscribed</Text>
                    <Text style={[styles.alreadySub, { color: colors.textSecondary }]}>
                      {expiresAt
                        ? `Renews ${new Date(expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                        : "You're on Zod Pro · Active"}
                    </Text>
                  </View>
                </View>
              </View>
              <Text style={[styles.ctaLegal, { color: colors.textTertiary }]}>
                Manage subscription in App Store settings.
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
                      <Text style={[styles.ctaBtnLabel, { color: colors.bg }]}>Get {tierName}</Text>
                      <Text style={[styles.ctaBtnSub, { color: colors.bg, opacity: 0.7 }]}>
                        {ctaPrice} · {ctaDesc}
                      </Text>
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
            </>
          )}
        </View>
      </View>

      {/* ── Gift Card Modal ──────────────────────────────────────────── */}
      <Modal
        visible={gcModalVisible}
        transparent
        animationType="slide"
        onRequestClose={handleGcDone}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.gcOverlay}
        >
          <Pressable style={styles.gcBackdrop} onPress={handleGcDone} />

          <View style={[styles.gcSheet, { backgroundColor: colors.bg, borderTopColor: colors.border }]}>
            <View style={[styles.gcHandle, { backgroundColor: colors.border }]} />

            {gcResult ? (
              /* ── Success state ── */
              <View style={styles.gcSuccess}>
                <Squircle style={styles.gcSuccessIcon} cornerRadius={26} cornerSmoothing={1} fillColor={colors.surface2}>
                  <Ionicons name="checkmark" size={36} color={colors.text} />
                </Squircle>

                <Text style={[styles.gcSuccessTitle, { color: colors.text }]}>Redeemed!</Text>
                <Text style={[styles.gcSuccessSub, { color: colors.textSecondary }]}>{gcResult.plan_name}</Text>

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

                <Pressable onPress={handleGcDone} style={({ pressed }) => [pressed && { opacity: 0.8 }]}>
                  <Squircle style={styles.gcPrimaryBtn} cornerRadius={50} cornerSmoothing={1} fillColor={colors.text}>
                    <Text style={[styles.gcPrimaryBtnText, { color: colors.bg }]}>Continue</Text>
                  </Squircle>
                </Pressable>
              </View>
            ) : (
              /* ── Input state ── */
              <View style={styles.gcBody}>
                <Squircle style={styles.gcIconWrap} cornerRadius={20} cornerSmoothing={1} fillColor={colors.surface2}>
                  <Ionicons name="gift-outline" size={28} color={colors.text} />
                </Squircle>

                <Text style={[styles.gcTitle, { color: colors.text }]}>Redeem Gift Card</Text>
                <Text style={[styles.gcSub, { color: colors.textSecondary }]}>
                  Enter your code to unlock a Pro subscription instantly.
                </Text>

                {/* Code input inside a Squircle */}
                <Squircle
                  style={styles.gcInputWrap}
                  cornerRadius={16} cornerSmoothing={1}
                  fillColor={colors.surface}
                  strokeColor={gcError ? '#ef4444' : colors.border}
                  strokeWidth={gcError ? 1.5 : StyleSheet.hairlineWidth}
                >
                  <TextInput
                    ref={gcInputRef}
                    value={gcCode}
                    onChangeText={t => setGcCode(t.toUpperCase())}
                    placeholder="XXXX-XXXX-XXXX"
                    placeholderTextColor={colors.textTertiary}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={handleGcSubmit}
                    style={[styles.gcInput, { color: colors.text }]}
                    editable={!redeemingGiftCard}
                  />
                  {gcCode.length > 0 && !redeemingGiftCard ? (
                    <Pressable onPress={() => setGcCode('')} hitSlop={10}>
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

                <Pressable
                  onPress={redeemingGiftCard ? undefined : handleGcSubmit}
                  style={({ pressed }) => [pressed && !redeemingGiftCard && { opacity: 0.8 }]}
                >
                  <Squircle
                    style={styles.gcPrimaryBtn}
                    cornerRadius={50} cornerSmoothing={1}
                    fillColor={gcCode.trim().length > 0 ? colors.text : colors.surface2}
                  >
                    {redeemingGiftCard ? (
                      <ActivityIndicator color={colors.bg} />
                    ) : (
                      <Text style={[styles.gcPrimaryBtnText, {
                        color: gcCode.trim().length > 0 ? colors.bg : colors.textSecondary,
                      }]}>Redeem</Text>
                    )}
                  </Squircle>
                </Pressable>

                <Pressable onPress={handleGcDone} style={styles.gcCancelBtn}>
                  <Text style={[styles.gcCancelText, { color: colors.textSecondary }]}>Cancel</Text>
                </Pressable>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:   { flex: 1 },
  flex:   { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 200 },

  hero:     { alignItems: 'center', gap: 12, marginBottom: 24 },
  heroIcon: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  heroSub:  { fontSize: 14, fontFamily: 'ProductSans-Regular', textAlign: 'center', lineHeight: 21, paddingHorizontal: 16 },

  quotaBadge:  { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 7 },
  quotaText:   { fontSize: 12, fontFamily: 'ProductSans-Medium' },

  heroTitle:     { fontSize: 28, fontFamily: 'ProductSans-Bold', marginBottom: 6 },

  billingWrap:   { gap: 10, marginBottom: 20 },
  billingOption: {},
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

  tableCard:          { marginBottom: 16, overflow: 'hidden' },
  tableHeader:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10 },
  tableHeaderLeft:    { flex: 1, fontSize: 11, fontFamily: 'ProductSans-Bold', letterSpacing: 0.7, textTransform: 'uppercase' },
  divider:            { height: StyleSheet.hairlineWidth, marginHorizontal: 16, marginBottom: 2 },

  featureRow:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 11 },
  featureLabelWrap:   { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureDot:         { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  featureText:        { fontSize: 13, fontFamily: 'ProductSans-Regular', flex: 1 },
  cellBadge:          { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  cellBadgeWide:      { width: 52, paddingHorizontal: 6 },
  cellQty:            { fontSize: 10, fontFamily: 'ProductSans-Bold', textAlign: 'center' },

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

  ctaBtn:      { paddingVertical: 16, paddingHorizontal: 20, alignItems: 'center', marginBottom: 10 },
  ctaBtnInner: { alignItems: 'center', gap: 2 },
  ctaBtnLabel: { fontSize: 16, fontFamily: 'ProductSans-Black' },
  ctaBtnSub:   { fontSize: 11, fontFamily: 'ProductSans-Regular' },
  ctaLegal:    { fontSize: 10, fontFamily: 'ProductSans-Regular', textAlign: 'center', lineHeight: 14 },

  // Gift card modal
  gcOverlay:  { flex: 1, justifyContent: 'flex-end' },
  gcBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  gcSheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 44 : 24,
    paddingTop: 14,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.12, shadowRadius: 24 },
      android: { elevation: 24 },
    }),
  },
  gcHandle:   { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 24 },

  // Input state
  gcBody:     { alignItems: 'center', gap: 14 },
  gcIconWrap: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  gcTitle:    { fontSize: 22, fontFamily: 'ProductSans-Black', textAlign: 'center' },
  gcSub:      { fontSize: 13, fontFamily: 'ProductSans-Regular', textAlign: 'center', lineHeight: 20, paddingHorizontal: 12 },
  gcInputWrap:{ flexDirection: 'row', alignItems: 'center', width: '100%', paddingHorizontal: 16, paddingVertical: 16, gap: 10 },
  gcInput:    { flex: 1, fontSize: 18, fontFamily: 'ProductSans-Bold', letterSpacing: 3, textAlign: 'center' },
  gcClearBtn: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  gcErrorPill:{ flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%', paddingHorizontal: 14, paddingVertical: 10 },
  gcErrorText:{ flex: 1, color: '#ef4444', fontSize: 12, fontFamily: 'ProductSans-Regular', lineHeight: 17 },
  gcPrimaryBtn:     { width: '100%', paddingVertical: 17, alignItems: 'center' },
  gcPrimaryBtnText: { fontSize: 16, fontFamily: 'ProductSans-Black' },
  gcCancelBtn: { paddingVertical: 10 },
  gcCancelText:{ fontSize: 14, fontFamily: 'ProductSans-Regular' },

  // Success state
  gcSuccess:      { alignItems: 'center', gap: 14, paddingTop: 4 },
  gcSuccessIcon:  { width: 80, height: 80, alignItems: 'center', justifyContent: 'center' },
  gcSuccessTitle: { fontSize: 24, fontFamily: 'ProductSans-Black', textAlign: 'center' },
  gcSuccessSub:   { fontSize: 14, fontFamily: 'ProductSans-Regular', textAlign: 'center' },
  gcInfoBox:      { width: '100%', padding: 16, gap: 0 },
  gcInfoRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 2 },
  gcInfoIcon:     { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  gcInfoText:     { fontSize: 13, fontFamily: 'ProductSans-Regular', flex: 1 },
});
