import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import ScreenHeader from '@/components/ui/ScreenHeader';
import Squircle from '@/components/ui/Squircle';
import { useSubscription } from '@/hooks/useSubscription';
import { useAppTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';

// ─── Feature list (from Apple requirements, shown as "What's included") ───────

const FEATURES = [
  { icon: 'heart',         label: 'Unlimited likes'        },
  { icon: 'eye',           label: 'See who liked you'      },
  { icon: 'refresh-circle',label: 'Rewind last swipe'      },
  { icon: 'star',          label: 'Unlimited Super Likes'  },
  { icon: 'options',       label: 'Advanced filters'       },
  { icon: 'airplane',      label: 'Travel Mode'            },
  { icon: 'location',      label: 'Change location freely' },
  { icon: 'sparkles',      label: 'AI matchmaking'         },
  { icon: 'trending-up',   label: 'Priority visibility'    },
  { icon: 'chatbubble',    label: 'Read receipts'          },
  { icon: 'ban',           label: 'No ads'                 },
  { icon: 'eye-off',       label: 'Incognito browsing'     },
];

// ─── Billing option ──────────────────────────────────────────────────────────

const BADGE_COLORS: Record<string, string> = {
  'Best Value': '#7c3aed',
  'Popular':    '#0891b2',
};

function BillingOption({
  label, price, sub, badge, selected, onSelect, colors,
}: {
  label: string; price: string; sub: string; badge?: string;
  selected: boolean; onSelect: () => void; colors: any;
}) {
  const badgeBg = badge ? (BADGE_COLORS[badge] ?? '#7c3aed') : undefined;
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
                <View style={[styles.saveBadge, { backgroundColor: badgeBg }]}>
                  <Text style={styles.saveBadgeText}>{badge}</Text>
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

type BillingPeriod = 'weekly' | 'monthly' | 'sixmonths' | 'yearly';

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SubscriptionPage() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { profile } = useAuth();
  const {
    weeklyPackage,
    monthlyPackage,
    sixMonthPackage,
    yearlyPackage,
    status,
    purchasing,
    error,
    purchase,
    restore,
  } = useSubscription();

  const [billing, setBilling] = useState<BillingPeriod>('yearly');

  // Backend profile is the primary source of truth — always available,
  // even in Expo Go where RevenueCat SDK can't load.
  const isPro = profile?.subscription_tier === 'pro' || status?.isPro === true;
  const expiresAt = status?.expiresAt ?? null;

  // Prices — use real RevenueCat prices when available, else fallback display strings
  const weeklyPrice    = weeklyPackage?.product.priceString ?? '$4.99';
  const monthlyPrice   = monthlyPackage?.product.priceString ?? '$14.99';
  const sixMonthTotal  = sixMonthPackage?.product.priceString ?? '$59.99';
  const sixMonthPerMo  = sixMonthPackage
    ? `$${((sixMonthPackage.product.price) / 6).toFixed(2)}`
    : '$10.00';
  const yearlyMonthlyPrice = yearlyPackage
    ? `$${((yearlyPackage.product.price) / 12).toFixed(2)}`
    : '$7.99';
  const yearlyTotalPrice = yearlyPackage?.product.priceString ?? '$95.88';

  const packageMap: Record<BillingPeriod, PurchasesPackage | null> = {
    weekly:    weeklyPackage,
    monthly:   monthlyPackage,
    sixmonths: sixMonthPackage,
    yearly:    yearlyPackage,
  };

  const selectedPackage: PurchasesPackage | null = packageMap[billing];

  // Native store is only available in development/production builds, not Expo Go
  const storeAvailable =
    weeklyPackage !== null || monthlyPackage !== null ||
    sixMonthPackage !== null || yearlyPackage !== null;

  const handleSubscribe = async () => {
    if (!selectedPackage) {
      Alert.alert(
        'Not available right now',
        'In-app purchases are not yet configured for this app. Please check back soon.',
      );
      return;
    }
    const success = await purchase(selectedPackage);
    if (success) {
      Alert.alert('Welcome to Pro!', 'All premium features are now unlocked.', [
        { text: "Let's go!", onPress: () => router.back() },
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
      Alert.alert('Restored!', 'Your Pro subscription has been restored.');
      router.back();
    } else {
      Alert.alert('No subscription found', "We couldn't find an active Pro subscription for your account.");
    }
  };

  const ctaPriceMap: Record<BillingPeriod, string> = {
    weekly:    `${weeklyPrice}/wk`,
    monthly:   `${monthlyPrice}/mo`,
    sixmonths: `${sixMonthPerMo}/mo`,
    yearly:    `${yearlyMonthlyPrice}/mo`,
  };
  const ctaPrice = ctaPriceMap[billing];

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScreenHeader title="Upgrade to Pro" onClose={() => router.back()} colors={colors} />

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <View style={styles.hero}>
          <Squircle style={styles.heroIcon} cornerRadius={24} cornerSmoothing={1} fillColor={colors.surface2}>
            <Ionicons name="star" size={36} color={colors.text} />
          </Squircle>
          <Text style={[styles.heroTitle, { color: colors.text }]}>Zod Pro</Text>
          <Text style={[styles.heroSub, { color: colors.textSecondary }]}>
            Everything you need to find{'\n'}the right person, faster.
          </Text>
        </View>

        {/* ── Billing options ────────────────────────────────────────────── */}
        <View style={styles.billingWrap}>
          <BillingOption
            label="Yearly"
            price={`${yearlyMonthlyPrice}/mo`}
            sub={`Billed ${yearlyTotalPrice}/yr · Save 47%`}
            badge="Best Value"
            selected={billing === 'yearly'}
            onSelect={() => setBilling('yearly')}
            colors={colors}
          />
          <BillingOption
            label="6 Months"
            price={`${sixMonthPerMo}/mo`}
            sub={`Billed ${sixMonthTotal} every 6 months · Save 33%`}
            badge="Popular"
            selected={billing === 'sixmonths'}
            onSelect={() => setBilling('sixmonths')}
            colors={colors}
          />
          <BillingOption
            label="Monthly"
            price={`${monthlyPrice}/mo`}
            sub="Billed monthly, cancel anytime"
            selected={billing === 'monthly'}
            onSelect={() => setBilling('monthly')}
            colors={colors}
          />
          <BillingOption
            label="Weekly"
            price={`${weeklyPrice}/wk`}
            sub="Billed weekly, cancel anytime"
            selected={billing === 'weekly'}
            onSelect={() => setBilling('weekly')}
            colors={colors}
          />
        </View>

        {/* ── Feature list ──────────────────────────────────────────────── */}
        <Squircle
          style={styles.featureCard}
          cornerRadius={22} cornerSmoothing={1}
          fillColor={colors.surface} strokeColor={colors.border}
          strokeWidth={StyleSheet.hairlineWidth}
        >
          <Text style={[styles.featureCardTitle, { color: colors.textSecondary }]}>
            What's included
          </Text>
          {FEATURES.map((f, i) => (
            <View
              key={f.label}
              style={[
                styles.featureRow,
                i < FEATURES.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
              ]}
            >
              <Squircle style={styles.featureDot} cornerRadius={10} cornerSmoothing={1} fillColor={colors.surface2}>
                <Ionicons name={f.icon as any} size={15} color={colors.text} />
              </Squircle>
              <Text style={[styles.featureText, { color: colors.text }]}>{f.label}</Text>
              <Ionicons name="checkmark" size={16} color={colors.text} />
            </View>
          ))}
        </Squircle>

        {/* ── Status / already pro ──────────────────────────────────────── */}
        {isPro ? (
          <View style={[styles.proNotice, { backgroundColor: colors.surface }]}>
            <Ionicons name="checkmark-circle" size={18} color={colors.text} />
            <Text style={[styles.proNoticeText, { color: colors.text }]}>
              You're on Zod Pro{expiresAt ? ` · renews ${new Date(expiresAt).toLocaleDateString()}` : ''}
            </Text>
          </View>
        ) : (
          <Text style={[styles.freeNote, { color: colors.textTertiary }]}>
            Currently on Zod Free · Cancel anytime in App Store settings
          </Text>
        )}

        {/* ── Restore ───────────────────────────────────────────────────── */}
        <Pressable onPress={handleRestore} style={({ pressed }) => [styles.restoreBtn, pressed && { opacity: 0.6 }]}>
          <Text style={[styles.restoreText, { color: colors.textSecondary }]}>Restore purchases</Text>
        </Pressable>
      </ScrollView>

      {/* ── Sticky CTA ────────────────────────────────────────────────────── */}
      {!isPro && (
        <View style={[styles.ctaWrap, { borderTopColor: colors.border, backgroundColor: colors.bg }]}>
          {/* Inline error message */}
          {error ? (
            <Squircle
              style={{ marginBottom: 12, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}
              cornerRadius={14} cornerSmoothing={1}
              fillColor="rgba(239,68,68,0.12)"
              strokeColor="rgba(239,68,68,0.25)"
              strokeWidth={1}
            >
              <Ionicons name="alert-circle-outline" size={16} color="#ef4444" style={{ marginTop: 1 }} />
              <Text style={{ flex: 1, color: '#ef4444', fontSize: 13, fontFamily: 'ProductSans-Regular', lineHeight: 18 }}>
                {error}
              </Text>
            </Squircle>
          ) : null}

          <Pressable
            onPress={purchasing ? undefined : handleSubscribe}
            style={({ pressed }) => [pressed && !purchasing && { opacity: 0.8 }]}
          >
            <Squircle
              style={styles.ctaBtn} cornerRadius={50} cornerSmoothing={1}
              fillColor={storeAvailable ? colors.text : colors.surface2}
            >
              {purchasing ? (
                <ActivityIndicator color={colors.bg} />
              ) : storeAvailable ? (
                <Text style={[styles.ctaBtnText, { color: colors.bg }]}>
                  Continue · {ctaPrice}
                </Text>
              ) : (
                <Text style={[styles.ctaBtnText, { color: colors.textSecondary }]}>
                  Not available right now
                </Text>
              )}
            </Squircle>
          </Pressable>
          <Text style={[styles.ctaLegal, { color: colors.textTertiary }]}>
            {storeAvailable
              ? 'Subscription renews automatically. Cancel anytime in App Store settings.'
              : 'In-app purchases are being configured. Check back soon.'}
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:             { flex: 1 },
  flex:             { flex: 1 },
  scroll:           { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 160 },

  hero:             { alignItems: 'center', gap: 10, marginBottom: 28 },
  heroIcon:         { width: 76, height: 76, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  heroTitle:        { fontSize: 30, fontFamily: 'ProductSans-Black' },
  heroSub:          { fontSize: 15, fontFamily: 'ProductSans-Regular', textAlign: 'center', lineHeight: 22 },

  billingWrap:      { gap: 10, marginBottom: 20 },
  billingOption:    {},
  billingInner:     { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 16 },
  radio:            { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot:         { width: 10, height: 10, borderRadius: 5 },
  billingMeta:      { flex: 1, gap: 3 },
  billingLabel:     { fontSize: 15, fontFamily: 'ProductSans-Bold' },
  billingSub:       { fontSize: 11, fontFamily: 'ProductSans-Regular' },
  billingPrice:     { fontSize: 15, fontFamily: 'ProductSans-Black' },

  saveBadge:        { backgroundColor: '#7c3aed', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  saveBadgeText:    { fontSize: 10, fontFamily: 'ProductSans-Bold', color: '#fff' },

  featureCard:      { marginBottom: 16, overflow: 'hidden' },
  featureCardTitle: { fontSize: 12, fontFamily: 'ProductSans-Bold', letterSpacing: 0.8, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10 },
  featureRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
  featureDot:       { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  featureText:      { flex: 1, fontSize: 14, fontFamily: 'ProductSans-Regular' },

  proNotice:        { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, padding: 14, marginBottom: 10 },
  proNoticeText:    { fontSize: 13, fontFamily: 'ProductSans-Bold' },

  freeNote:         { fontSize: 12, fontFamily: 'ProductSans-Regular', textAlign: 'center', marginBottom: 6 },

  restoreBtn:       { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 20 },
  restoreText:      { fontSize: 13, fontFamily: 'ProductSans-Regular' },

  ctaWrap:          { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 36, borderTopWidth: StyleSheet.hairlineWidth },
  ctaBtn:           { paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
  ctaBtnText:       { fontSize: 16, fontFamily: 'ProductSans-Black' },
  ctaLegal:         { fontSize: 10, fontFamily: 'ProductSans-Regular', textAlign: 'center', marginTop: 10 },
});
