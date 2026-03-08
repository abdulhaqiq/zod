import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import ScreenHeader from '@/components/ui/ScreenHeader';
import Squircle from '@/components/ui/Squircle';
import { useAppTheme } from '@/context/ThemeContext';

// ─── Feature list ────────────────────────────────────────────────────────────

const FEATURES = [
  { icon: 'heart',               label: 'Unlimited likes'           },
  { icon: 'eye',                 label: 'See who liked you'         },
  { icon: 'refresh-circle',      label: 'Rewind last swipe'         },
  { icon: 'star',                label: 'Unlimited Super Likes'     },
  { icon: 'options',             label: 'Advanced filters'          },
  { icon: 'airplane',            label: 'Travel Mode'               },
  { icon: 'location',            label: 'Change location freely'    },
  { icon: 'sparkles',            label: 'AI matchmaking'            },
  { icon: 'trending-up',         label: 'Priority visibility'       },
  { icon: 'chatbubble',          label: 'Read receipts'             },
  { icon: 'ban',                 label: 'No ads'                    },
];

// ─── Billing option ──────────────────────────────────────────────────────────

function BillingOption({
  label, price, sub, selected, onSelect, colors,
}: {
  label: string; price: string; sub: string;
  selected: boolean; onSelect: () => void; colors: any;
}) {
  return (
    <Pressable onPress={onSelect} style={({ pressed }) => [pressed && { opacity: 0.75 }]}>
      <Squircle
        style={[styles.billingOption, selected && { borderWidth: 2 }]}
        cornerRadius={18}
        cornerSmoothing={1}
        fillColor={selected ? colors.surface2 : colors.surface}
        strokeColor={selected ? colors.text : colors.border}
        strokeWidth={selected ? 2 : StyleSheet.hairlineWidth}
      >
        <View style={styles.billingInner}>
          <View style={[styles.radio, { borderColor: selected ? colors.text : colors.border }]}>
            {selected && <View style={[styles.radioDot, { backgroundColor: colors.text }]} />}
          </View>
          <View style={styles.billingMeta}>
            <Text style={[styles.billingLabel, { color: colors.text }]}>{label}</Text>
            <Text style={[styles.billingSub, { color: colors.textSecondary }]}>{sub}</Text>
          </View>
          <Text style={[styles.billingPrice, { color: colors.text }]}>{price}</Text>
        </View>
      </Squircle>
    </Pressable>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SubscriptionPage() {
  const router  = useRouter();
  const { colors } = useAppTheme();

  const [billing, setBilling] = useState<'yearly' | 'monthly'>('yearly');

  const priceMonthly = '$14.99';
  const priceYearly  = '$7.99';

  const handleSubscribe = () => {
    router.back();
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScreenHeader
        title="Upgrade to Pro"
        onClose={() => router.back()}
        colors={colors}
      />

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <Squircle style={styles.heroIcon} cornerRadius={24} cornerSmoothing={1} fillColor={colors.surface2}>
            <Ionicons name="star" size={36} color={colors.text} />
          </Squircle>
          <Text style={[styles.heroTitle, { color: colors.text }]}>Zod Pro</Text>
          <Text style={[styles.heroSub, { color: colors.textSecondary }]}>
            Everything you need to find{'\n'}the right person, faster.
          </Text>
        </View>

        {/* Billing options */}
        <View style={styles.billingWrap}>
          <BillingOption
            label="Yearly"
            price={`${priceYearly}/mo`}
            sub={`Billed $95.88/year · Save 47%`}
            selected={billing === 'yearly'}
            onSelect={() => setBilling('yearly')}
            colors={colors}
          />
          <BillingOption
            label="Monthly"
            price={`${priceMonthly}/mo`}
            sub="Billed monthly, cancel anytime"
            selected={billing === 'monthly'}
            onSelect={() => setBilling('monthly')}
            colors={colors}
          />
        </View>

        {/* Feature list */}
        <Squircle
          style={styles.featureCard}
          cornerRadius={22}
          cornerSmoothing={1}
          fillColor={colors.surface}
          strokeColor={colors.border}
          strokeWidth={StyleSheet.hairlineWidth}
        >
          <Text style={[styles.featureCardTitle, { color: colors.text }]}>What's included</Text>
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

        {/* Free note */}
        <Text style={[styles.freeNote, { color: colors.textTertiary }]}>
          Currently on Zod Free · Cancel anytime
        </Text>
      </ScrollView>

      {/* Sticky CTA */}
      <View style={[styles.ctaWrap, { borderTopColor: colors.border, backgroundColor: colors.bg }]}>
        <Pressable onPress={handleSubscribe} style={({ pressed }) => [pressed && { opacity: 0.8 }]}>
          <Squircle
            style={styles.ctaBtn}
            cornerRadius={50}
            cornerSmoothing={1}
            fillColor={colors.text}
          >
            <Text style={[styles.ctaBtnText, { color: colors.bg }]}>
              Continue · {billing === 'yearly' ? priceYearly : priceMonthly}/mo
            </Text>
          </Squircle>
        </Pressable>
        <Text style={[styles.ctaLegal, { color: colors.textTertiary }]}>
          Subscription renews automatically. Cancel anytime in App Store settings.
        </Text>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:             { flex: 1 },
  flex:             { flex: 1 },
  scroll:           { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 140 },

  // Hero
  hero:             { alignItems: 'center', gap: 10, marginBottom: 28 },
  heroIcon:         { width: 76, height: 76, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  heroTitle:        { fontSize: 30, fontFamily: 'ProductSans-Black' },
  heroSub:          { fontSize: 15, fontFamily: 'ProductSans-Regular', textAlign: 'center', lineHeight: 22 },

  // Billing
  billingWrap:      { gap: 10, marginBottom: 20 },
  billingOption:    { },
  billingInner:     { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 16 },
  radio:            { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot:         { width: 10, height: 10, borderRadius: 5 },
  billingMeta:      { flex: 1, gap: 2 },
  billingLabel:     { fontSize: 15, fontFamily: 'ProductSans-Bold' },
  billingSub:       { fontSize: 11, fontFamily: 'ProductSans-Regular' },
  billingPrice:     { fontSize: 15, fontFamily: 'ProductSans-Black' },

  // Features
  featureCard:      { marginBottom: 16, overflow: 'hidden' },
  featureCardTitle: { fontSize: 12, fontFamily: 'ProductSans-Bold', letterSpacing: 0.8, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10, opacity: 0.45 },
  featureRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
  featureDot:       { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  featureText:      { flex: 1, fontSize: 14, fontFamily: 'ProductSans-Regular' },

  // Note
  freeNote:         { fontSize: 12, fontFamily: 'ProductSans-Regular', textAlign: 'center', marginBottom: 8 },

  // CTA
  ctaWrap:          { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 36, borderTopWidth: StyleSheet.hairlineWidth },
  ctaBtn:           { paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
  ctaBtnText:       { fontSize: 16, fontFamily: 'ProductSans-Black' },
  ctaLegal:         { fontSize: 10, fontFamily: 'ProductSans-Regular', textAlign: 'center', marginTop: 10 },
});
