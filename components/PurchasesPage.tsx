import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenHeader from '@/components/ui/ScreenHeader';
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

function tierColor(tier: string | null | undefined, text: string) {
  return (!tier || tier === 'free') ? text : '#9c27b0';
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

function ActionRow({ icon, label, sub, onPress, colors, last, highlight }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string; sub?: string;
  onPress: () => void; colors: any; last?: boolean; highlight?: boolean;
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
      <View style={[styles.iconWrap, { backgroundColor: colors.bg }]}>
        <Ionicons name={icon} size={18} color={highlight ? '#9c27b0' : colors.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, { color: highlight ? '#9c27b0' : colors.text }]}>{label}</Text>
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
  const insets = useSafeAreaInsets();
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
    <View style={[styles.container, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <ScreenHeader title="Purchases" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Status card ───────────────────────────────────────────────── */}
        <View style={[styles.statusCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.statusIconWrap, { backgroundColor: isPro ? '#9c27b020' : colors.bg }]}>
            <Ionicons name={isPro ? 'star' : 'star-outline'} size={28} color={isPro ? '#9c27b0' : colors.textSecondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>CURRENT PLAN</Text>
            <Text style={[styles.statusTier, { color: tierColor(tier, colors.text) }]}>{tierLabel(tier)}</Text>
            {isPro && (
              <Text style={[styles.statusSub, { color: colors.textSecondary }]}>
                Renews automatically via Apple
              </Text>
            )}
          </View>
          {!isPro && (
            <Pressable
              onPress={() => router.push('/subscription')}
              style={[styles.upgradeBtn, { backgroundColor: colors.text }]}
            >
              <Text style={[styles.upgradeTxt, { color: colors.bg }]}>Upgrade</Text>
            </Pressable>
          )}
        </View>

        {/* ── Subscription details ─────────────────────────────────────── */}
        {isPro && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>SUBSCRIPTION</Text>
            <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <InfoRow label="Plan" value={tierLabel(tier)} colors={colors} />
              <InfoRow label="Billing" value="Via Apple App Store" colors={colors} />
              <InfoRow label="Manage" value="iPhone Settings → Subscriptions" colors={colors} last />
            </View>
          </View>
        )}

        {/* ── Actions ──────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>ACTIONS</Text>
          <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ActionRow
              icon="refresh-outline" label="Restore Purchases"
              sub="Already subscribed on another device?"
              onPress={handleRestore} colors={colors} highlight
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
              sub={isPro ? 'See what\'s included in your plan' : 'Unlock all premium features'}
              onPress={() => router.push('/subscription')}
              colors={colors} last={!isPro} highlight={!isPro}
            />
            {isPro && (
              <ActionRow
                icon="receipt-outline" label="Billing History"
                sub="View in Apple App Store"
                onPress={() => Linking.openURL('https://apps.apple.com/account/subscriptions')}
                colors={colors} last
              />
            )}
          </View>
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
  statusCard:     { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 18, marginTop: 16 },
  statusIconWrap: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  statusLabel:    { fontSize: 10, fontFamily: 'ProductSans-Bold', letterSpacing: 1.2 },
  statusTier:     { fontSize: 18, fontFamily: 'ProductSans-Bold', marginTop: 2 },
  statusSub:      { fontSize: 12, fontFamily: 'ProductSans-Regular', marginTop: 2 },
  upgradeBtn:     { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  upgradeTxt:     { fontSize: 13, fontFamily: 'ProductSans-Bold' },
  section:        { marginTop: 24 },
  sectionTitle:   { fontSize: 11, fontFamily: 'ProductSans-Bold', letterSpacing: 1.4, marginBottom: 8, marginLeft: 2 },
  group:          { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row:            { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14, gap: 12 },
  rowLabel:       { fontSize: 15, fontFamily: 'ProductSans-Medium', flex: 1 },
  rowValue:       { fontSize: 13, fontFamily: 'ProductSans-Regular' },
  rowSub:         { fontSize: 12, fontFamily: 'ProductSans-Regular', marginTop: 2 },
  iconWrap:       { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  footer:         { fontSize: 12, fontFamily: 'ProductSans-Regular', textAlign: 'center', marginTop: 28, lineHeight: 18 },
});
