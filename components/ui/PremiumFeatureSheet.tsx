/**
 * PremiumFeatureSheet — bottom-sheet upsell that appears when a user taps
 * a locked premium feature. Shows the feature description + full plan list
 * and a direct Upgrade CTA without navigating away.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Squircle from '@/components/ui/Squircle';
import type { AppColors } from '@/constants/appColors';

const { height: SCREEN_H } = Dimensions.get('window');

// ─── Feature definitions ──────────────────────────────────────────────────────

export interface PremiumFeature {
  icon: string;          // Ionicons name
  title: string;
  tagline: string;       // one-liner shown in the row
  description: string;  // paragraph shown in the sheet
  accentColor?: string;  // optional tint for the icon badge
}

export const PREMIUM_FEATURES: Record<string, PremiumFeature> = {
  incognito: {
    icon: 'eye-off-outline',
    title: 'Incognito Mode',
    tagline: 'Browse without being seen',
    description:
      'Your profile becomes invisible to people you haven\'t liked. Browse freely without appearing in anyone\'s discovery feed — your moves stay private.',
    accentColor: '#6366f1',
  },
  autoZod: {
    icon: 'sparkles-outline',
    title: 'Auto Zod (AI)',
    tagline: 'AI-powered match suggestions',
    description:
      'Our AI studies your swipe patterns, preferences, and conversation style to surface the most compatible matches first. The more you use it, the smarter it gets.',
    accentColor: '#f59e0b',
  },
  travel: {
    icon: 'airplane-outline',
    title: 'Travel Mode',
    tagline: 'Match anywhere in the world',
    description:
      'Planning a trip? Drop a pin anywhere on the globe and start matching with people at your destination before you even arrive. Perfect for travel, relocation, or long-distance.',
    accentColor: '#10b981',
  },
  changeLocation: {
    icon: 'location-outline',
    title: 'Change Location',
    tagline: 'Discover people in any city',
    description:
      'Freely switch your discovery location to any city — no VPN needed. Explore matches in a new neighbourhood or city without physically being there.',
    accentColor: '#3b82f6',
  },
};

// All features shown in the plan breakdown inside the sheet
const ALL_PLAN_FEATURES = [
  { icon: 'heart',          label: 'Unlimited likes'          },
  { icon: 'eye',            label: 'See who liked you'        },
  { icon: 'refresh-circle', label: 'Rewind last swipe'        },
  { icon: 'star',           label: 'Unlimited Super Likes'    },
  { icon: 'options',        label: 'Advanced filters'         },
  { icon: 'airplane',       label: 'Travel Mode'              },
  { icon: 'location',       label: 'Change location freely'   },
  { icon: 'sparkles',       label: 'AI matchmaking'           },
  { icon: 'eye-off',        label: 'Incognito browsing'       },
  { icon: 'trending-up',    label: 'Priority visibility'      },
  { icon: 'ban',            label: 'No ads'                   },
];

// ─── Billing pill ─────────────────────────────────────────────────────────────

function BillingPill({
  label, price, sub, badge, selected, onSelect, colors,
}: {
  label: string; price: string; sub: string; badge?: string;
  selected: boolean; onSelect: () => void; colors: AppColors;
}) {
  return (
    <Pressable onPress={onSelect} style={({ pressed }) => [pressed && { opacity: 0.8 }, styles.billingPressable]}>
      <Squircle
        cornerRadius={16}
        cornerSmoothing={1}
        fillColor={selected ? colors.surface2 : colors.surface}
        strokeColor={selected ? colors.text : colors.border}
        strokeWidth={selected ? 2 : StyleSheet.hairlineWidth}
        style={styles.billingCard}
      >
        <View style={styles.billingInner}>
          <View style={[styles.radio, { borderColor: selected ? colors.text : colors.border }]}>
            {selected && <View style={[styles.radioDot, { backgroundColor: colors.text }]} />}
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[styles.billingLabel, { color: colors.text }]}>{label}</Text>
              {badge ? (
                <View style={[styles.badge, { backgroundColor: colors.text }]}>
                  <Text style={[styles.badgeText, { color: colors.bg }]}>{badge}</Text>
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

// ─── Sheet ────────────────────────────────────────────────────────────────────

interface Props {
  featureKey: string | null;
  onClose: () => void;
  colors: AppColors;
}

export default function PremiumFeatureSheet({ featureKey, onClose, colors }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const slideY = useRef(new Animated.Value(SCREEN_H)).current;
  const visible = !!featureKey;
  const feature = featureKey ? PREMIUM_FEATURES[featureKey] : null;

  const [billing, setBilling] = useState<'yearly' | 'monthly'>('yearly');

  useEffect(() => {
    Animated.spring(slideY, {
      toValue: visible ? 0 : SCREEN_H,
      useNativeDriver: true,
      tension: 60,
      friction: 12,
    }).start();
  }, [visible]);

  const handleUpgrade = () => {
    onClose();
    router.push('/subscription');
  };

  if (!feature && !visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={onClose} />

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: colors.bg, paddingBottom: insets.bottom + 12 },
          { transform: [{ translateY: slideY }] },
        ]}
      >
        {/* Handle */}
        <View style={[styles.handle, { backgroundColor: colors.border }]} />

        {/* Close */}
        <Pressable onPress={onClose} hitSlop={14} style={styles.closeBtn}>
          <Ionicons name="close-circle" size={28} color={colors.textTertiary} />
        </Pressable>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Feature hero */}
          {feature && (
            <View style={styles.featureHero}>
              <Squircle
                style={[styles.featureIconBg, { backgroundColor: feature.accentColor ?? colors.surface2 }]}
                cornerRadius={22}
                cornerSmoothing={1}
                fillColor={feature.accentColor ?? colors.surface2}
              >
                <Ionicons name={feature.icon as any} size={30} color="#fff" />
              </Squircle>
              <View style={styles.featureHeroText}>
                <View style={[styles.proBadge, { backgroundColor: colors.surface2 }]}>
                  <Ionicons name="star" size={10} color="#FFD60A" />
                  <Text style={[styles.proBadgeText, { color: colors.text }]}>Zod Pro</Text>
                </View>
                <Text style={[styles.featureTitle, { color: colors.text }]}>{feature.title}</Text>
                <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>
                  {feature.description}
                </Text>
              </View>
            </View>
          )}

          {/* Billing options */}
          <View style={styles.billingWrap}>
            <BillingPill
              label="Yearly"
              price="$7.99/mo"
              sub="Billed $95.88/year"
              badge="Save 47%"
              selected={billing === 'yearly'}
              onSelect={() => setBilling('yearly')}
              colors={colors}
            />
            <BillingPill
              label="Monthly"
              price="$14.99/mo"
              sub="Cancel anytime"
              selected={billing === 'monthly'}
              onSelect={() => setBilling('monthly')}
              colors={colors}
            />
          </View>

          {/* What's included */}
          <Squircle
            cornerRadius={20}
            cornerSmoothing={1}
            fillColor={colors.surface}
            strokeColor={colors.border}
            strokeWidth={StyleSheet.hairlineWidth}
            style={styles.featureCard}
          >
            <Text style={[styles.featureCardTitle, { color: colors.text }]}>Everything in Pro</Text>
            {ALL_PLAN_FEATURES.map((f, i) => (
              <View
                key={f.label}
                style={[
                  styles.featureRow,
                  i < ALL_PLAN_FEATURES.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.border,
                  },
                ]}
              >
                <Squircle
                  style={styles.featureDot}
                  cornerRadius={9}
                  cornerSmoothing={1}
                  fillColor={colors.surface2}
                >
                  <Ionicons name={f.icon as any} size={13} color={colors.text} />
                </Squircle>
                <Text style={[styles.featureText, { color: colors.text }]}>{f.label}</Text>
                <Ionicons name="checkmark" size={15} color={colors.text} />
              </View>
            ))}
          </Squircle>
        </ScrollView>

        {/* Sticky CTA */}
        <View style={[styles.ctaWrap, { borderTopColor: colors.border }]}>
          <Pressable onPress={handleUpgrade} style={({ pressed }) => [pressed && { opacity: 0.82 }]}>
            <Squircle
              style={styles.ctaBtn}
              cornerRadius={50}
              cornerSmoothing={1}
              fillColor={colors.text}
            >
              <Ionicons name="star" size={15} color={colors.bg} />
              <Text style={[styles.ctaBtnText, { color: colors.bg }]}>
                Upgrade to Pro · {billing === 'yearly' ? '$7.99' : '$14.99'}/mo
              </Text>
            </Squircle>
          </Pressable>
          <Text style={[styles.ctaLegal, { color: colors.textTertiary }]}>
            Renews automatically. Cancel anytime in App Store settings.
          </Text>
        </View>
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },

  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    maxHeight: SCREEN_H * 0.9,
    borderTopLeftRadius: 30, borderTopRightRadius: 30,
    overflow: 'hidden',
  },
  handle:  { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  closeBtn: { position: 'absolute', top: 14, right: 16, zIndex: 10 },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 24, gap: 18 },

  // Feature hero
  featureHero:     { flexDirection: 'row', gap: 16, alignItems: 'flex-start', marginTop: 8 },
  featureIconBg:   { width: 60, height: 60, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  featureHeroText: { flex: 1, gap: 6 },
  proBadge:        { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  proBadgeText:    { fontSize: 11, fontFamily: 'ProductSans-Bold' },
  featureTitle:    { fontSize: 20, fontFamily: 'ProductSans-Black' },
  featureDesc:     { fontSize: 13, fontFamily: 'ProductSans-Regular', lineHeight: 19 },

  // Billing
  billingWrap:      { gap: 10 },
  billingPressable: {},
  billingCard:      {},
  billingInner:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
  radio:            { width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot:         { width: 9, height: 9, borderRadius: 5 },
  billingLabel:     { fontSize: 14, fontFamily: 'ProductSans-Bold' },
  billingSub:       { fontSize: 11, fontFamily: 'ProductSans-Regular', marginTop: 1 },
  billingPrice:     { fontSize: 14, fontFamily: 'ProductSans-Black' },
  badge:            { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20 },
  badgeText:        { fontSize: 10, fontFamily: 'ProductSans-Bold' },

  // Feature card
  featureCard:      { overflow: 'hidden' },
  featureCardTitle: { fontSize: 13, fontFamily: 'ProductSans-Bold', letterSpacing: 0.5, paddingHorizontal: 14, paddingVertical: 12 },
  featureRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11 },
  featureDot:       { width: 26, height: 26, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  featureText:      { flex: 1, fontSize: 13, fontFamily: 'ProductSans-Regular' },

  // CTA
  ctaWrap:    { paddingHorizontal: 18, paddingTop: 12, gap: 8, borderTopWidth: StyleSheet.hairlineWidth },
  ctaBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 50 },
  ctaBtnText: { fontSize: 15, fontFamily: 'ProductSans-Black' },
  ctaLegal:   { fontSize: 11, fontFamily: 'ProductSans-Regular', textAlign: 'center', lineHeight: 15 },
});
