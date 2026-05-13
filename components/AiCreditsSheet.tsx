/**
 * AiCreditsSheet
 * Bottom sheet showing the user's AI credits balance, what credits do,
 * and purchasable credit packs.
 */

import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  localizedPrice,
}: {
  pack: AiCreditPack;
  onBuy: (p: AiCreditPack) => void;
  purchasing: boolean;
  colors: any;
  localizedPrice?: string | null;
}) {
  // Use localized price from RevenueCat if available, fallback to hardcoded
  const displayPrice = localizedPrice ?? pack.price;
  
  return (
    <Pressable
      onPress={() => !purchasing && onBuy(pack)}
      style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}
    >
      <Squircle
        style={s.packCard}
        cornerRadius={20} cornerSmoothing={1}
        fillColor={colors.surface}
        strokeColor={colors.border}
        strokeWidth={1}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 14 }}>
          {/* Credits icon */}
          <Squircle style={s.packIcon} cornerRadius={16} cornerSmoothing={1} fillColor={colors.surface2}>
            <ExpoImage 
              source={require('@/assets/images/lightning-bolt.png')}
              style={{ width: 26, height: 26 }}
              contentFit="contain"
            />
          </Squircle>

          <View style={{ flex: 1 }}>
            <Text style={[s.packLabel, { color: colors.text }]}>{pack.label}</Text>
            <Text style={[s.packSub, { color: colors.textSecondary }]}>AI Credits</Text>
          </View>
        </View>

        {/* Price + buy CTA */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Text style={[s.packPrice, { color: colors.text }]}>{displayPrice}</Text>
          
          <Squircle
            style={[s.buyBtn, { backgroundColor: colors.text }]}
            cornerRadius={20}
            cornerSmoothing={1}
          >
            {purchasing
              ? <ActivityIndicator size="small" color={colors.bg} />
              : <Text style={[s.buyBtnText, { color: colors.bg }]}>Buy</Text>
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
  const { myFeatures, purchaseAiCredits, purchasingCredits, getAiCreditPrice } = useSubscription();
  const insets = useSafeAreaInsets();

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
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[s.screen, { backgroundColor: colors.bg }]}>

        {/* Top-bar with close button */}
        <View style={[s.topBar, { paddingTop: insets.top + 6, borderBottomColor: colors.border }]}>
          <Pressable onPress={onClose} hitSlop={10} style={s.closeBtn}>
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
          <Text style={[s.topBarTitle, { color: colors.text }]}>AI Credits</Text>
          <View style={s.closeBtn} pointerEvents="none" />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          bounces={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        >

          {/* Balance hero */}
          <View style={s.hero}>
            <Squircle style={s.heroIcon} cornerRadius={32} cornerSmoothing={1} fillColor={colors.surface2}>
              <ExpoImage 
                source={require('@/assets/images/lightning-bolt.png')}
                style={{ width: 52, height: 52 }}
                contentFit="contain"
              />
            </Squircle>
            <Text style={[s.balanceNum, { color: colors.text }]}>{balance}</Text>
            <Text style={[s.balanceLabel, { color: colors.textSecondary }]}>AI Credits in your wallet</Text>
            
            {/* Plan pills */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              {tier !== 'free' && (
                <View style={[s.planPill, { backgroundColor: colors.text }]}>
                  <Ionicons name="star" size={12} color={colors.bg} />
                  <Text style={[s.planPillText, { color: colors.bg }]}>
                    {tier === 'premium_plus' ? 'Premium+' : 'Pro'}
                  </Text>
                </View>
              )}
              {tier === 'free' ? (
                <Pressable
                  onPress={onClose}
                  style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                >
                  <View style={[s.planPill, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
                    <Ionicons name="star-outline" size={12} color={colors.textSecondary} />
                    <Text style={[s.planPillText, { color: colors.textSecondary }]}>Free Plan</Text>
                  </View>
                </Pressable>
              ) : (
                <Pressable
                  onPress={onClose}
                  style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                >
                  <View style={[s.planPill, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
                    <Ionicons name="information-circle-outline" size={12} color={colors.textSecondary} />
                    <Text style={[s.planPillText, { color: colors.textSecondary }]}>Upgrade for monthly credits</Text>
                  </View>
                </Pressable>
              )}
            </View>
          </View>

          {/* What credits do */}
          <View style={s.section}>
            <Text style={[s.sectionTitle, { color: colors.textSecondary }]}>WHAT CREDITS DO</Text>
            <Squircle style={s.useGroup} cornerRadius={20} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              {CREDIT_USES.map((u, i) => (
                <View
                  key={u.label}
                  style={[
                    s.useRow,
                    i < CREDIT_USES.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                  ]}
                >
                  <Squircle style={s.useIcon} cornerRadius={12} cornerSmoothing={1} fillColor={colors.surface2}>
                    <Ionicons name={u.icon as any} size={20} color={colors.text} />
                  </Squircle>
                  <Text style={[s.useLabel, { color: colors.text }]}>{u.label}</Text>
                  <View style={s.costPill}>
                    <ExpoImage 
                      source={require('@/assets/images/lightning-bolt.png')}
                      style={{ width: 14, height: 14 }}
                      contentFit="contain"
                    />
                    <Text style={[s.costText, { color: colors.text }]}>{u.cost}</Text>
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
                  localizedPrice={getAiCreditPrice?.(pack.id)}
                />
              ))}
            </View>
          </View>

          <Text style={[s.footer, { color: colors.textSecondary }]}>
            Credits never expire. Purchases processed by Apple.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen:         { flex: 1 },
  topBar:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  topBarTitle:    { fontSize: 17, fontFamily: 'ProductSans-Bold' },
  closeBtn:       { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  hero:           { alignItems: 'center', paddingTop: 32, paddingBottom: 32, gap: 8, paddingHorizontal: 20 },
  heroIcon:       { width: 100, height: 100, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  balanceNum:     { fontSize: 56, fontFamily: 'ProductSans-Bold', letterSpacing: -1 },
  balanceLabel:   { fontSize: 15, fontFamily: 'ProductSans-Regular', marginTop: 4 },
  planPill:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  planPillText:   { fontSize: 12, fontFamily: 'ProductSans-Bold' },

  section:        { marginBottom: 26, paddingHorizontal: 20 },
  sectionTitle:   { fontSize: 11, fontFamily: 'ProductSans-Bold', letterSpacing: 1.2, marginBottom: 12, marginLeft: 2 },

  useGroup:       { overflow: 'hidden' },
  useRow:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 16, gap: 14 },
  useIcon:        { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  useLabel:       { flex: 1, fontSize: 16, fontFamily: 'ProductSans-Medium' },
  costPill:       { flexDirection: 'row', alignItems: 'center', gap: 5 },
  costText:       { fontSize: 15, fontFamily: 'ProductSans-Bold' },

  packCard:       { flexDirection: 'row', alignItems: 'center', padding: 18 },
  packIcon:       { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  packLabel:      { fontSize: 17, fontFamily: 'ProductSans-Bold' },
  packSub:        { fontSize: 14, fontFamily: 'ProductSans-Regular', marginTop: 2 },
  packPrice:      { fontSize: 20, fontFamily: 'ProductSans-Bold' },
  buyBtn:         { paddingHorizontal: 24, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', minWidth: 80 },
  buyBtnText:     { fontSize: 15, fontFamily: 'ProductSans-Bold' },

  footer:         { fontSize: 11, fontFamily: 'ProductSans-Regular', textAlign: 'center', paddingHorizontal: 20, marginBottom: 8 },
});
