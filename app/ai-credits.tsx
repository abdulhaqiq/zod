/**
 * AI Credits — full-screen hub.
 * Uses the same ScreenHeader + layout pattern as SubscriptionPage.
 */

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
      <Squircle style={st.useIcon} cornerRadius={10} cornerSmoothing={1} fillColor={colors.surface2}>
        <Ionicons name={icon as any} size={14} color={colors.text} />
      </Squircle>
      <View style={{ flex: 1 }}>
        <Text style={[st.useLbl, { color: colors.text }]}>{label}</Text>
        <Text style={[st.useDesc, { color: colors.textSecondary }]}>{desc}</Text>
      </View>
      <View style={[st.costBadge, { backgroundColor: colors.surface2 }]}>
        <Ionicons name="flash" size={10} color={colors.text} />
        <Text style={[st.costNum, { color: colors.text }]}>{cost}</Text>
      </View>
    </View>
  );
}

// ─── Pack card ────────────────────────────────────────────────────────────────

function PackCard({ pack, buying, onBuy, colors }: {
  pack: AiCreditPack; buying: boolean; onBuy: (p: AiCreditPack) => void; colors: any;
}) {
  const badge     = (pack as any).badge as string | undefined;
  const isBestVal = badge === 'Best Value';

  return (
    <Pressable onPress={() => !buying && onBuy(pack)} style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}>
      <Squircle
        style={st.packCard} cornerRadius={18} cornerSmoothing={1}
        fillColor={colors.surface} strokeColor={colors.border} strokeWidth={StyleSheet.hairlineWidth}
      >
        {badge && (
          <View style={[st.packRibbon, { backgroundColor: colors.surface2 }]}>
            <Text style={[st.packRibbonTxt, { color: colors.text }]}>{badge}</Text>
          </View>
        )}

        <Squircle style={st.packIcon} cornerRadius={14} cornerSmoothing={1} fillColor={colors.surface2}>
          <Ionicons name="flash" size={20} color={colors.text} />
        </Squircle>

        <View style={{ flex: 1 }}>
          <Text style={[st.packName, { color: colors.text }]}>{pack.label}</Text>
          <View style={st.packSubRow}>
            <Text style={[st.packSub, { color: colors.textSecondary }]}>AI Credits</Text>
            {isBestVal && (
              <View style={[st.savePill, { backgroundColor: colors.surface2 }]}>
                <Text style={[st.saveTxt, { color: colors.textSecondary }]}>Save 33%</Text>
              </View>
            )}
          </View>
        </View>

        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <Text style={[st.packPrice, { color: colors.text }]}>{pack.price}</Text>
          <Squircle style={st.buyBtn} cornerRadius={12} cornerSmoothing={1} fillColor={colors.text}>
            {buying
              ? <ActivityIndicator size="small" color={colors.bg} />
              : <Text style={[st.buyTxt, { color: colors.bg }]}>Buy</Text>
            }
          </Squircle>
        </View>
      </Squircle>
    </Pressable>
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
      isCurrent && { backgroundColor: colors.surface2 },
    ]}>
      <Squircle style={st.planIcon} cornerRadius={9} cornerSmoothing={1}
        fillColor={isCurrent ? colors.border : colors.surface2}>
        <Ionicons name={icon} size={13} color={colors.text} />
      </Squircle>
      <Text style={[st.planName, { color: colors.text, flex: 1 }]}>{label}</Text>
      {isCurrent && (
        <View style={[st.currentPill, { backgroundColor: colors.border }]}>
          <Text style={[st.currentTxt, { color: colors.text }]}>Current</Text>
        </View>
      )}
      <View style={st.planAmt}>
        {credits > 0 ? (
          <>
            <Ionicons name="flash" size={11} color={colors.text} />
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
        Alert.alert('Credits Added', `+${pack.credits} credits added to your wallet.`, [{ text: 'Great!' }]);
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

        {/* ── Hero ── */}
        <View style={st.hero}>
          <Squircle style={st.heroIcon} cornerRadius={24} cornerSmoothing={1} fillColor={colors.surface2}>
            <Ionicons name="flash" size={34} color={colors.text} />
          </Squircle>

          <Text style={[st.heroBalance, { color: colors.text }]}>{balance}</Text>
          <Text style={[st.heroSub, { color: colors.textSecondary }]}>AI Credits in your wallet</Text>

          {/* Tier + reset pills */}
          <View style={st.heroPills}>
            <View style={[st.heroPill, { backgroundColor: colors.surface2 }]}>
              <Ionicons name="star" size={11} color={colors.text} />
              <Text style={[st.heroPillTxt, { color: colors.text }]}>{tierLabel} Plan</Text>
            </View>
            {monthly > 0 ? (
              <View style={[st.heroPill, { backgroundColor: colors.surface2 }]}>
                <Ionicons name="flash" size={11} color={colors.text} />
                <Text style={[st.heroPillTxt, { color: colors.text }]}>+{monthly} on {nextReset}</Text>
              </View>
            ) : (
              <View style={[st.heroPill, { backgroundColor: colors.surface2 }]}>
                <Ionicons name="information-circle-outline" size={11} color={colors.textSecondary} />
                <Text style={[st.heroPillTxt, { color: colors.textSecondary }]}>Upgrade for monthly credits</Text>
              </View>
            )}
          </View>

          {/* Balance bar */}
          <View style={[st.barTrack, { backgroundColor: colors.surface2 }]}>
            <View style={[st.barFill, {
              width: `${Math.min(100, (balance / 50) * 100)}%` as any,
              backgroundColor: colors.text,
            }]} />
          </View>
        </View>

        {/* ── Upgrade nudge (free only) ── */}
        {!isPro && (
          <Pressable onPress={() => router.push('/subscription' as any)}
            style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1, marginBottom: 16 }]}>
            <Squircle style={st.upgradeCard} cornerRadius={18} cornerSmoothing={1}
              fillColor={colors.surface} strokeColor={colors.border} strokeWidth={StyleSheet.hairlineWidth}>
              <Squircle style={st.upgradeIconWrap} cornerRadius={12} cornerSmoothing={1} fillColor={colors.surface2}>
                <Ionicons name="star" size={16} color={colors.text} />
              </Squircle>
              <View style={{ flex: 1 }}>
                <Text style={[st.upgradeTitle, { color: colors.text }]}>Get monthly credits with Pro</Text>
                <Text style={[st.upgradeSub, { color: colors.textSecondary }]}>10 credits/mo included · from $4.99/wk</Text>
              </View>
              <Ionicons name="chevron-forward" size={15} color={colors.textSecondary} />
            </Squircle>
          </Pressable>
        )}

        {/* ── What credits do ── */}
        <Text style={[st.secLabel, { color: colors.textSecondary }]}>WHAT CREDITS DO</Text>
        <Squircle style={st.card} cornerRadius={18} cornerSmoothing={1}
          fillColor={colors.surface} strokeColor={colors.border}
          strokeWidth={StyleSheet.hairlineWidth}>
          {CREDIT_USES.map((cr, i) => (
            <UseRow key={cr.label} icon={cr.icon} label={cr.label} desc={cr.desc}
              cost={cr.cost} colors={colors} last={i === CREDIT_USES.length - 1} />
          ))}
        </Squircle>

        {/* ── Buy credits ── */}
        <Text style={[st.secLabel, { color: colors.textSecondary, marginTop: 22 }]}>BUY CREDITS</Text>
        <View style={{ gap: 10 }}>
          {AI_CREDIT_PACKS.map(pack => (
            <PackCard key={pack.id} pack={pack} buying={buyingPack === pack.id} onBuy={handleBuy} colors={colors} />
          ))}
        </View>

        {/* ── Monthly plan grants ── */}
        <Text style={[st.secLabel, { color: colors.textSecondary, marginTop: 22 }]}>MONTHLY PLAN GRANTS</Text>
        <Squircle style={st.card} cornerRadius={18} cornerSmoothing={1}
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
  scroll: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 60 },

  // Hero
  hero:        { alignItems: 'center', gap: 10, marginBottom: 24 },
  heroIcon:    { width: 72, height: 72, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  heroBalance: { fontSize: 44, fontFamily: 'ProductSans-Bold', lineHeight: 48 },
  heroSub:     { fontSize: 14, fontFamily: 'ProductSans-Regular' },
  heroPills:   { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  heroPill:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  heroPillTxt: { fontSize: 12, fontFamily: 'ProductSans-Medium' },
  barTrack:    { width: '60%', height: 3, borderRadius: 2, overflow: 'hidden', marginTop: 4 },
  barFill:     { height: 3, borderRadius: 2 },

  // Upgrade nudge
  upgradeCard:    { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14, paddingVertical: 13 },
  upgradeIconWrap:{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  upgradeTitle:   { fontSize: 13, fontFamily: 'ProductSans-Bold', marginBottom: 1 },
  upgradeSub:     { fontSize: 11, fontFamily: 'ProductSans-Regular' },

  // Section label
  secLabel: { fontSize: 11, fontFamily: 'ProductSans-Bold', letterSpacing: 1.2, marginBottom: 8, marginLeft: 2 },

  // Card wrapper (shared)
  card: { overflow: 'hidden' },

  // Use rows
  useRow:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 12 },
  useIcon:  { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  useLbl:   { fontSize: 13, fontFamily: 'ProductSans-Bold', marginBottom: 1 },
  useDesc:  { fontSize: 11, fontFamily: 'ProductSans-Regular' },
  costBadge:{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  costNum:  { fontSize: 12, fontFamily: 'ProductSans-Bold' },

  // Pack cards
  packCard:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14, gap: 12 },
  packRibbon:   { position: 'absolute', top: -8, right: 12, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  packRibbonTxt:{ fontSize: 9, fontFamily: 'ProductSans-Bold' },
  packIcon:     { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  packName:     { fontSize: 15, fontFamily: 'ProductSans-Bold' },
  packSubRow:   { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  packSub:      { fontSize: 11, fontFamily: 'ProductSans-Regular' },
  savePill:     { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 5 },
  saveTxt:      { fontSize: 9, fontFamily: 'ProductSans-Bold' },
  packPrice:    { fontSize: 16, fontFamily: 'ProductSans-Bold' },
  buyBtn:       { paddingHorizontal: 16, paddingVertical: 7, alignItems: 'center', justifyContent: 'center', minWidth: 58 },
  buyTxt:       { fontSize: 13, fontFamily: 'ProductSans-Bold' },

  // Plan rows
  planRow:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  planIcon:   { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  planName:   { fontSize: 13, fontFamily: 'ProductSans-Medium' },
  planAmt:    { flexDirection: 'row', alignItems: 'center', gap: 2 },
  planAmtNum: { fontSize: 13, fontFamily: 'ProductSans-Bold' },
  currentPill:{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  currentTxt: { fontSize: 9, fontFamily: 'ProductSans-Bold' },

  footer: { fontSize: 11, fontFamily: 'ProductSans-Regular', textAlign: 'center', marginTop: 24, lineHeight: 16 },
});
