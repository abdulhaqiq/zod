/**
 * AiCreditsSheet
 * Bottom sheet showing the user's AI credits balance, what credits do,
 * and purchasable credit packs.
 */

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Squircle from '@/components/ui/Squircle';
import { useAppTheme } from '@/context/ThemeContext';
import { AI_CREDIT_PACKS, type AiCreditPack } from '@/constants/iap';
import { useSubscription } from '@/hooks/useSubscription';

// ─── What are AI credits used for ─────────────────────────────────────────────

const CREDIT_USES = [
  { icon: 'sparkles',       label: 'AI Compatibility Score',  cost: 2 },
  { icon: 'create-outline', label: 'AI Bio / Prompt Rewrite', cost: 1 },
  { icon: 'flash',          label: 'AI Smart Match Boost',    cost: 3 },
  { icon: 'chatbubble',     label: 'AI Chat Opener Ideas',    cost: 1 },
] as const;

// ─── Pack card ────────────────────────────────────────────────────────────────

function PackCard({
  pack,
  onBuy,
  purchasing,
  colors,
}: {
  pack: AiCreditPack;
  onBuy: (p: AiCreditPack) => void;
  purchasing: boolean;
  colors: any;
}) {
  const isPopular   = (pack as any).badge === 'Popular';
  const isBestValue = (pack as any).badge === 'Best Value';
  const accent = isPopular ? '#f59e0b' : isBestValue ? '#22c55e' : colors.text;

  return (
    <Pressable
      onPress={() => !purchasing && onBuy(pack)}
      style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}
    >
      <Squircle
        style={[s.packCard, { borderColor: isPopular || isBestValue ? accent + '55' : colors.border }]}
        cornerRadius={18} cornerSmoothing={1}
        fillColor={colors.surface}
        strokeColor={isPopular || isBestValue ? accent + '55' : colors.border}
        strokeWidth={1}
      >
        {/* Badge */}
        {(pack as any).badge && (
          <View style={[s.packBadge, { backgroundColor: accent + '22' }]}>
            <Text style={[s.packBadgeText, { color: accent }]}>{(pack as any).badge}</Text>
          </View>
        )}

        {/* Credits icon + count */}
        <Squircle style={[s.packIconWrap, { backgroundColor: accent + '18' }]} cornerRadius={14} cornerSmoothing={1} fillColor={accent + '18'}>
          <Ionicons name="flash" size={22} color={accent} />
        </Squircle>

        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={[s.packLabel, { color: colors.text }]}>{pack.label}</Text>
          <Text style={[s.packSub, { color: colors.textSecondary }]}>AI Credits</Text>
        </View>

        {/* Price + buy CTA */}
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <Text style={[s.packPrice, { color: colors.text }]}>{pack.price}</Text>
          <Squircle style={[s.buyBtn, { backgroundColor: accent }]} cornerRadius={12} cornerSmoothing={1} fillColor={accent}>
            {purchasing
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={s.buyBtnText}>Buy</Text>
            }
          </Squircle>
        </View>
      </Squircle>
    </Pressable>
  );
}

// ─── Main sheet ───────────────────────────────────────────────────────────────

export default function AiCreditsSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { colors } = useAppTheme();
  const { myFeatures, purchaseAiCredits, purchasingCredits } = useSubscription();

  const balance  = myFeatures?.ai_credits_balance  ?? 0;
  const monthly  = myFeatures?.ai_credits_monthly  ?? 0;
  const tier     = myFeatures?.tier ?? 'free';

  const handleBuy = async (pack: AiCreditPack) => {
    const result = await purchaseAiCredits(pack);
    if (result.success) {
      Alert.alert('Credits added!', `+${pack.credits} AI Credits added to your wallet.`);
    } else if (result.error) {
      Alert.alert('Purchase failed', result.error);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={[s.sheet, { backgroundColor: colors.surface }]}>
          {/* Handle */}
          <View style={[s.handle, { backgroundColor: colors.border }]} />

          {/* Header gradient */}
          <LinearGradient
            colors={['rgba(234,179,8,0.15)', 'transparent']}
            style={s.headerGradient}
            pointerEvents="none"
          />

          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>

            {/* Balance hero */}
            <View style={s.hero}>
              <Squircle style={s.heroIcon} cornerRadius={22} cornerSmoothing={1} fillColor="rgba(234,179,8,0.15)">
                <Ionicons name="flash" size={32} color="#f59e0b" />
              </Squircle>
              <Text style={[s.heroTitle, { color: colors.text }]}>AI Credits</Text>
              <View style={s.balanceRow}>
                <Ionicons name="flash" size={18} color="#f59e0b" />
                <Text style={[s.balanceNum, { color: colors.text }]}>{balance}</Text>
                <Text style={[s.balanceLabel, { color: colors.textSecondary }]}>in your wallet</Text>
              </View>
              {monthly > 0 && (
                <View style={[s.monthlyPill, { backgroundColor: colors.bg }]}>
                  <Ionicons name="refresh-circle-outline" size={13} color={colors.textSecondary} />
                  <Text style={[s.monthlyText, { color: colors.textSecondary }]}>
                    {monthly} free credits / month with {tier === 'premium_plus' ? 'Premium+' : 'Pro'}
                  </Text>
                </View>
              )}
            </View>

            {/* What credits do */}
            <View style={s.section}>
              <Text style={[s.sectionTitle, { color: colors.textSecondary }]}>WHAT CREDITS DO</Text>
              <Squircle style={s.useGroup} cornerRadius={18} cornerSmoothing={1} fillColor={colors.bg} strokeColor={colors.border} strokeWidth={1}>
                {CREDIT_USES.map((u, i) => (
                  <View
                    key={u.label}
                    style={[
                      s.useRow,
                      i < CREDIT_USES.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                    ]}
                  >
                    <Squircle style={s.useIcon} cornerRadius={10} cornerSmoothing={1} fillColor={colors.surface}>
                      <Ionicons name={u.icon as any} size={15} color={colors.text} />
                    </Squircle>
                    <Text style={[s.useLabel, { color: colors.text }]}>{u.label}</Text>
                    <View style={[s.costPill, { backgroundColor: 'rgba(234,179,8,0.12)' }]}>
                      <Ionicons name="flash" size={10} color="#f59e0b" />
                      <Text style={s.costText}>{u.cost}</Text>
                    </View>
                  </View>
                ))}
              </Squircle>
            </View>

            {/* Buy packs */}
            <View style={s.section}>
              <Text style={[s.sectionTitle, { color: colors.textSecondary }]}>BUY CREDITS</Text>
              <View style={{ gap: 10 }}>
                {AI_CREDIT_PACKS.map(pack => (
                  <PackCard
                    key={pack.id}
                    pack={pack}
                    onBuy={handleBuy}
                    purchasing={purchasingCredits}
                    colors={colors}
                  />
                ))}
              </View>
            </View>

            <Text style={[s.footer, { color: colors.textSecondary }]}>
              Credits never expire. Purchases processed by Apple.
            </Text>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  backdrop:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:          { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingBottom: 40, maxHeight: '88%', overflow: 'hidden' },
  handle:         { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 6 },
  headerGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 120, borderTopLeftRadius: 28, borderTopRightRadius: 28 },

  hero:           { alignItems: 'center', paddingTop: 16, paddingBottom: 20, gap: 8 },
  heroIcon:       { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  heroTitle:      { fontSize: 22, fontFamily: 'ProductSans-Bold' },
  balanceRow:     { flexDirection: 'row', alignItems: 'center', gap: 5 },
  balanceNum:     { fontSize: 28, fontFamily: 'ProductSans-Bold' },
  balanceLabel:   { fontSize: 14, fontFamily: 'ProductSans-Regular', marginTop: 3 },
  monthlyPill:    { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginTop: 4 },
  monthlyText:    { fontSize: 12, fontFamily: 'ProductSans-Regular' },

  section:        { marginBottom: 20 },
  sectionTitle:   { fontSize: 11, fontFamily: 'ProductSans-Bold', letterSpacing: 1.3, marginBottom: 8, marginLeft: 2 },

  useGroup:       { overflow: 'hidden' },
  useRow:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13, gap: 12 },
  useIcon:        { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  useLabel:       { flex: 1, fontSize: 14, fontFamily: 'ProductSans-Medium' },
  costPill:       { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  costText:       { fontSize: 12, fontFamily: 'ProductSans-Bold', color: '#f59e0b' },

  packCard:       { flexDirection: 'row', alignItems: 'center', padding: 14, overflow: 'visible' },
  packBadge:      { position: 'absolute', top: -8, right: 12, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  packBadgeText:  { fontSize: 10, fontFamily: 'ProductSans-Bold' },
  packIconWrap:   { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  packLabel:      { fontSize: 15, fontFamily: 'ProductSans-Bold' },
  packSub:        { fontSize: 12, fontFamily: 'ProductSans-Regular', marginTop: 2 },
  packPrice:      { fontSize: 16, fontFamily: 'ProductSans-Bold' },
  buyBtn:         { paddingHorizontal: 14, paddingVertical: 7, alignItems: 'center', justifyContent: 'center', minWidth: 56 },
  buyBtnText:     { fontSize: 13, fontFamily: 'ProductSans-Bold', color: '#fff' },

  footer:         { fontSize: 11, fontFamily: 'ProductSans-Regular', textAlign: 'center', marginBottom: 8 },
});
