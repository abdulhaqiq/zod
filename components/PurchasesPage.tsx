import { navPush, navReplace } from '@/utils/nav';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import ScreenHeader from '@/components/ui/ScreenHeader';
import Squircle from '@/components/ui/Squircle';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';
import { useSubscription } from '@/hooks/useSubscription';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tierLabel(tier: string | null | undefined) {
  if (!tier || tier === 'free') return 'Free';
  if (tier === 'pro_monthly') return 'Pro · Monthly';
  if (tier === 'pro_yearly') return 'Pro · Yearly';
  return tier;
}

// ─── Info row ─────────────────────────────────────────────────────────────────

function InfoRow({ label, value, colors, last }: { label: string; value: string; colors: any; last?: boolean }) {
  return (
    <View style={[styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
      <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{value}</Text>
    </View>
  );
}

// ─── Action row ───────────────────────────────────────────────────────────────

function ActionRow({ icon, label, sub, onPress, colors, last }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string; sub?: string;
  onPress: () => void; colors: any; last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
        pressed && { opacity: 0.6 },
      ]}
    >
      <Squircle style={styles.iconWrap} cornerRadius={10} cornerSmoothing={1} fillColor={colors.bg}>
        <Ionicons name={icon} size={18} color={colors.text} />
      </Squircle>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
        {sub ? <Text style={[styles.rowSub, { color: colors.textSecondary }]}>{sub}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
    </Pressable>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function PurchasesPage() {
  const { colors } = useAppTheme();
  const { profile } = useAuth();
  const router = useRouter();
  const { restore: restorePurchases, loading } = useSubscription();

  const tier = profile?.subscription_tier;
  const isPro = tier && tier !== 'free';

  const handleRestore = async () => {
    try {
      await restorePurchases();
      Alert.alert('Restored', 'Your purchases have been restored.');
    } catch {
      Alert.alert('Error', 'Could not restore purchases. Please try again.');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScreenHeader title="Purchases" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Status card ───────────────────────────────────────────────── */}
        <Squircle style={styles.statusCard} cornerRadius={22} cornerSmoothing={1}
          fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
          <Squircle style={styles.statusIconWrap} cornerRadius={14} cornerSmoothing={1} fillColor={colors.bg}>
            <Ionicons name={isPro ? 'star' : 'star-outline'} size={28} color={colors.text} />
          </Squircle>
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>CURRENT PLAN</Text>
            <Text style={[styles.statusTier, { color: colors.text }]}>{tierLabel(tier)}</Text>
            {isPro && (
              <Text style={[styles.statusSub, { color: colors.textSecondary }]}>
                Renews automatically via Apple
              </Text>
            )}
          </View>
          {!isPro && (
            <Pressable
              onPress={() => navPush('/subscription')}
              style={[styles.upgradeBtn, { backgroundColor: colors.text }]}
            >
              <Text style={[styles.upgradeTxt, { color: colors.bg }]}>Upgrade</Text>
            </Pressable>
          )}
        </Squircle>

        {/* ── Subscription details ─────────────────────────────────────── */}
        {isPro && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>SUBSCRIPTION</Text>
            <Squircle style={styles.group} cornerRadius={22} cornerSmoothing={1}
              fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <InfoRow label="Plan" value={tierLabel(tier)} colors={colors} />
              <InfoRow label="Billing" value="Via Apple App Store" colors={colors} />
              <InfoRow label="Manage" value="iPhone Settings → Subscriptions" colors={colors} last />
            </Squircle>
          </View>
        )}

        {/* ── Actions ──────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>ACTIONS</Text>
          <Squircle style={styles.group} cornerRadius={22} cornerSmoothing={1}
            fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
            <ActionRow
              icon="refresh-outline" label="Restore Purchases"
              sub="Already subscribed on another device?"
              onPress={handleRestore} colors={colors}
            />
            {isPro && (
              <ActionRow
                icon="settings-outline" label="Manage Subscription"
                sub="Cancel or change your plan on Apple"
                onPress={() => Linking.openURL('https://apps.apple.com/account/subscriptions')}
                colors={colors}
              />
            )}
            <ActionRow
              icon="star-outline" label={isPro ? 'View Zod Pro Benefits' : 'Explore Zod Pro'}
              sub={isPro ? "See what's included in your plan" : 'Unlock all premium features'}
              onPress={() => navPush('/subscription')}
              colors={colors} last={!isPro}
            />
            {isPro && (
              <ActionRow
                icon="receipt-outline" label="Billing History"
                sub="View in Apple App Store"
                onPress={() => Linking.openURL('https://apps.apple.com/account/subscriptions')}
                colors={colors} last
              />
            )}
          </Squircle>
        </View>

        {loading && (
          <ActivityIndicator style={{ marginTop: 20 }} color={colors.text} />
        )}

        <Text style={[styles.footer, { color: colors.textSecondary }]}>
          All purchases are processed securely by Apple.{'\n'}
          Apple takes a 15–30% commission on in-app purchases.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1 },
  scroll:         { paddingHorizontal: 16, paddingBottom: 40 },
  statusCard:     { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, marginTop: 16 },
  statusIconWrap: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  statusLabel:    { fontSize: 10, fontFamily: 'ProductSans-Bold', letterSpacing: 1.2 },
  statusTier:     { fontSize: 18, fontFamily: 'ProductSans-Bold', marginTop: 2 },
  statusSub:      { fontSize: 12, fontFamily: 'ProductSans-Regular', marginTop: 2 },
  upgradeBtn:     { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  upgradeTxt:     { fontSize: 13, fontFamily: 'ProductSans-Bold' },
  section:        { marginTop: 24 },
  sectionTitle:   { fontSize: 11, fontFamily: 'ProductSans-Bold', letterSpacing: 1.4, marginBottom: 8, marginLeft: 2 },
  group:          { overflow: 'hidden' },
  row:            { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14, gap: 12 },
  rowLabel:       { fontSize: 15, fontFamily: 'ProductSans-Medium', flex: 1 },
  rowValue:       { fontSize: 13, fontFamily: 'ProductSans-Regular' },
  rowSub:         { fontSize: 12, fontFamily: 'ProductSans-Regular', marginTop: 2 },
  iconWrap:       { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  footer:         { fontSize: 12, fontFamily: 'ProductSans-Regular', textAlign: 'center', marginTop: 28, lineHeight: 18 },
});
