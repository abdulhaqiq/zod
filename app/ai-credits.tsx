/**
 * AI Credits — full-screen hub.
 * Uses the same ScreenHeader + layout pattern as SubscriptionPage.
 */

import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
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
import ScreenHeader from '@/components/ui/ScreenHeader';
import Squircle from '@/components/ui/Squircle';
import { useAppTheme } from '@/context/ThemeContext';
import { AI_CREDIT_PACKS } from '@/constants/iap';
import type { AiCreditPack } from '@/constants/iap';
import { useSubscription } from '@/hooks/useSubscription';

// ─── Data ─────────────────────────────────────────────────────────────────────

const CREDIT_USES = [
  { icon: 'sparkles',       label: 'AI Compatibility Score',  desc: 'Deep match analysis',             cost: 2 },
  { icon: 'create-outline', label: 'AI Bio & Prompt Rewrite', desc: 'Polish your profile text',        cost: 1 },
  { icon: 'flash',          label: 'AI Smart Match Boost',    desc: 'Surface to best-fit profiles',    cost: 3 },
  { icon: 'chatbubble',     label: 'AI Chat Opener Ideas',    desc: 'Personalised icebreakers',        cost: 1 },
  { icon: 'heart-circle',   label: 'AI Date Ideas',           desc: 'Ideas based on shared interests', cost: 2 },
] as const;

const TIER_MONTHLY: Record<string, number> = { free: 0, pro: 10, premium_plus: 25 };

// ─── Use row ──────────────────────────────────────────────────────────────────

function UseRow({ icon, label, desc, cost, colors, last }: {
  icon: string; label: string; desc: string; cost: number; colors: any; last?: boolean;
}) {
  return (
    <View style={[st.useRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
      <Squircle style={st.useIcon} cornerRadius={12} cornerSmoothing={1} fillColor={colors.surface2}>
        <Ionicons name={icon as any} size={16} color={colors.text} />
      </Squircle>
      <View style={{ flex: 1 }}>
        <Text style={[st.useLbl, { color: colors.text }]}>{label}</Text>
        <Text style={[st.useDesc, { color: colors.textSecondary }]}>{desc}</Text>
      </View>
      <Squircle style={st.costBadge} cornerRadius={10} cornerSmoothing={1} fillColor={colors.surface2}>
        <ExpoImage 
          source={require('@/assets/images/lightning-bolt.png')}
          style={{ width: 12, height: 12 }}
          contentFit="contain"
        />
        <Text style={[st.costNum, { color: colors.text }]}>{cost}</Text>
      </Squircle>
    </View>
  );
}

// ─── Pack row ─────────────────────────────────────────────────────────────────

function PackRow({ pack, buying, onBuy, colors, isLast }: {
  pack: AiCreditPack; buying: boolean; onBuy: (p: AiCreditPack) => void; colors: any; isLast: boolean;
}) {
  const badge = (pack as any).badge as string | undefined;

  return (
    <View style={[st.packRow, !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
      <Squircle style={st.packRowIcon} cornerRadius={14} cornerSmoothing={1} fillColor={colors.surface2}>
        <ExpoImage 
          source={require('@/assets/images/lightning-bolt.png')}
          style={{ width: 20, height: 20 }}
          contentFit="contain"
        />
      </Squircle>

      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[st.packRowName, { color: colors.text }]}>{pack.label}</Text>
          {badge && (
            <Squircle cornerRadius={6} cornerSmoothing={1} fillColor={colors.surface2} style={{ paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ fontSize: 9, fontFamily: 'ProductSans-Bold', color: colors.text }}>{badge}</Text>
            </Squircle>
          )}
        </View>
        <Text style={[st.packRowSub, { color: colors.textSecondary }]}>{pack.price}</Text>
      </View>

      <Pressable 
        onPress={() => !buying && onBuy(pack)} 
        style={({ pressed }) => [{ opacity: pressed || buying ? 0.7 : 1 }]}
        disabled={buying}
      >
        <Squircle style={st.packRowBtn} cornerRadius={14} cornerSmoothing={1} fillColor={colors.text}>
          {buying ? (
            <ActivityIndicator size="small" color={colors.bg} />
          ) : (
            <Text style={[st.packRowBtnTxt, { color: colors.bg }]}>Buy</Text>
          )}
        </Squircle>
      </Pressable>
    </View>
  );
}

// ─── Plan grant row ───────────────────────────────────────────────────────────

function PlanRow({ label, icon, credits, isCurrent, isLast, colors }: {
  label: string; icon: any; credits: number; isCurrent: boolean; isLast: boolean; colors: any;
}) {
  return (
    <View style={[
      st.planRow,
      !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    ]}>
      <Squircle style={st.planIcon} cornerRadius={11} cornerSmoothing={1}
        fillColor={colors.surface2}>
        <Ionicons name={icon} size={15} color={colors.text} />
      </Squircle>
      <Text style={[st.planName, { color: colors.text, flex: 1 }]}>{label}</Text>
      {isCurrent && (
        <Squircle style={st.currentPill} cornerRadius={8} cornerSmoothing={1} fillColor={colors.surface2}>
          <Text style={[st.currentTxt, { color: colors.text }]}>Current</Text>
        </Squircle>
      )}
      <View style={st.planAmt}>
        {credits > 0 ? (
          <>
            <ExpoImage 
              source={require('@/assets/images/lightning-bolt.png')}
              style={{ width: 12, height: 12 }}
              contentFit="contain"
            />
            <Text style={[st.planAmtNum, { color: colors.text }]}>{credits}/mo</Text>
          </>
        ) : (
          <Text style={[st.planAmtNum, { color: colors.textSecondary }]}>—</Text>
        )}
      </View>
    </View>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AiCreditsScreen() {
  const router     = useRouter();
  const { colors } = useAppTheme();
  const { myFeatures, purchaseAiCredits } = useSubscription();

  const balance = myFeatures?.ai_credits_balance ?? 0;
  const monthly = myFeatures?.ai_credits_monthly ?? TIER_MONTHLY[myFeatures?.tier ?? 'free'] ?? 0;
  const tier    = myFeatures?.tier ?? 'free';
  const isPro   = tier !== 'free';

  const tierLabel = tier === 'premium_plus' ? 'Premium+' : tier === 'pro' ? 'Pro' : 'Free';
  const nextReset = (() => {
    const d = new Date();
    d.setUTCMonth(d.getUTCMonth() + 1, 1);
    d.setUTCHours(0, 0, 0, 0);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  })();

  const [buyingPack, setBuyingPack] = useState<string | null>(null);

  const handleBuy = async (pack: AiCreditPack) => {
    setBuyingPack(pack.id);
    try {
      const res = await purchaseAiCredits(pack);
      if (res.success) {
        Alert.alert('Credits Added!', `+${pack.credits} AI Credits added to your wallet.`, [{ text: 'Great!' }]);
      } else if (res.error) {
        Alert.alert('Purchase Failed', res.error);
      }
    } finally {
      setBuyingPack(null);
    }
  };

  const PLAN_ROWS = [
    { label: 'Free',     icon: 'person-outline', credits: 0,  isCurrent: tier === 'free' },
    { label: 'Pro',      icon: 'star',           credits: 10, isCurrent: tier === 'pro' },
    { label: 'Premium+', icon: 'star',           credits: 25, isCurrent: tier === 'premium_plus' },
  ];

  return (
    <View style={[st.root, { backgroundColor: colors.bg }]}>

      {/* Same global header as SubscriptionPage */}
      <ScreenHeader title="AI Credits" onClose={() => router.back()} colors={colors} />

      <ScrollView style={st.flex} contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Hero (Glowing Balance Card) ── */}
        <View style={{ alignItems: 'center', marginBottom: 32, marginTop: 24 }}>
          <Text style={{ fontSize: 15, fontFamily: 'ProductSans-Regular', color: colors.textSecondary, marginBottom: 8 }}>
            Total Balance
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <ExpoImage
              source={require('@/assets/images/lightning-bolt.png')}
              style={{ width: 32, height: 32 }}
              contentFit="contain"
            />
            <Text style={{ fontSize: 48, fontFamily: 'ProductSans-Bold', color: colors.text }}>
              {balance}
            </Text>
          </View>
        </View>

        {/* ── Upgrade nudge (free only) ── */}
        {!isPro && (
          <Pressable onPress={() => router.push('/subscription' as any)}
            style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1, marginBottom: 20 }]}>
            <Squircle style={st.upgradeCard} cornerRadius={24} cornerSmoothing={1}
              fillColor={colors.surface} strokeColor={colors.border} strokeWidth={StyleSheet.hairlineWidth}>
              <Squircle style={st.upgradeIconWrap} cornerRadius={14} cornerSmoothing={1} fillColor={colors.surface2}>
                <Ionicons name="star" size={18} color={colors.text} />
              </Squircle>
              <View style={{ flex: 1 }}>
                <Text style={[st.upgradeTitle, { color: colors.text }]}>Get monthly credits with Pro</Text>
                <Text style={[st.upgradeSub, { color: colors.textSecondary }]}>10 credits/mo included · from $4.99/wk</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Squircle>
          </Pressable>
        )}

        {/* ── Buy credits ── */}
        <Text style={[st.secLabel, { color: colors.textSecondary }]}>BUY CREDITS</Text>
        <Squircle style={st.card} cornerRadius={24} cornerSmoothing={1}
          fillColor={colors.surface} strokeColor={colors.border}
          strokeWidth={StyleSheet.hairlineWidth}>
          {AI_CREDIT_PACKS.map((pack, i) => (
            <PackRow key={pack.id} pack={pack} buying={buyingPack === pack.id} onBuy={handleBuy} colors={colors} isLast={i === AI_CREDIT_PACKS.length - 1} />
          ))}
        </Squircle>

        {/* ── What credits do ── */}
        <Text style={[st.secLabel, { color: colors.textSecondary, marginTop: 28 }]}>WHAT CREDITS DO</Text>
        <Squircle style={st.card} cornerRadius={24} cornerSmoothing={1}
          fillColor={colors.surface} strokeColor={colors.border}
          strokeWidth={StyleSheet.hairlineWidth}>
          {CREDIT_USES.map((cr, i) => (
            <UseRow key={cr.label} icon={cr.icon} label={cr.label} desc={cr.desc}
              cost={cr.cost} colors={colors} last={i === CREDIT_USES.length - 1} />
          ))}
        </Squircle>

        {/* ── Monthly plan grants ── */}
        <Text style={[st.secLabel, { color: colors.textSecondary, marginTop: 28 }]}>MONTHLY PLAN GRANTS</Text>
        <Squircle style={st.card} cornerRadius={24} cornerSmoothing={1}
          fillColor={colors.surface} strokeColor={colors.border}
          strokeWidth={StyleSheet.hairlineWidth}>
          {PLAN_ROWS.map((row, i) => (
            <PlanRow
              key={row.label}
              label={row.label}
              icon={row.icon}
              credits={row.credits}
              isCurrent={row.isCurrent}
              isLast={i === PLAN_ROWS.length - 1}
              colors={colors}
            />
          ))}
        </Squircle>

        <Text style={[st.footer, { color: colors.textSecondary }]}>
          Credits never expire · Purchases processed securely by Apple
        </Text>

      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  root:   { flex: 1 },
  flex:   { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 60 },

  // Hero
  heroPills:   { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  heroPill:    { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6 },
  heroPillTxt: { fontSize: 13, fontFamily: 'ProductSans-Medium' },

  // Upgrade nudge
  upgradeCard:    { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 16 },
  upgradeIconWrap:{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  upgradeTitle:   { fontSize: 15, fontFamily: 'ProductSans-Bold', marginBottom: 2 },
  upgradeSub:     { fontSize: 12, fontFamily: 'ProductSans-Regular' },

  // Section label
  secLabel: { fontSize: 12, fontFamily: 'ProductSans-Bold', letterSpacing: 1.2, marginBottom: 10, marginLeft: 2 },

  // Card wrapper (shared)
  card: { overflow: 'hidden' },

  // Use rows
  useRow:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 14 },
  useIcon:  { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  useLbl:   { fontSize: 14, fontFamily: 'ProductSans-Bold', marginBottom: 2 },
  useDesc:  { fontSize: 12, fontFamily: 'ProductSans-Regular' },
  costBadge:{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5 },
  costNum:  { fontSize: 13, fontFamily: 'ProductSans-Bold' },

  // Pack rows
  packRow:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 14 },
  packRowIcon:  { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  packRowName:  { fontSize: 15, fontFamily: 'ProductSans-Bold' },
  packRowSub:   { fontSize: 13, fontFamily: 'ProductSans-Regular', marginTop: 2 },
  packRowBtn:   { paddingHorizontal: 16, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', minWidth: 60 },
  packRowBtnTxt:{ fontSize: 13, fontFamily: 'ProductSans-Bold' },

  // Plan rows
  planRow:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  planIcon:   { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  planName:   { fontSize: 14, fontFamily: 'ProductSans-Medium' },
  planAmt:    { flexDirection: 'row', alignItems: 'center', gap: 3 },
  planAmtNum: { fontSize: 14, fontFamily: 'ProductSans-Bold' },
  currentPill:{ paddingHorizontal: 8, paddingVertical: 3 },
  currentTxt: { fontSize: 10, fontFamily: 'ProductSans-Bold' },

  footer: { fontSize: 12, fontFamily: 'ProductSans-Regular', textAlign: 'center', marginTop: 28, lineHeight: 18 },
});
