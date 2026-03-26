import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import ScreenHeader from '@/components/ui/ScreenHeader';
import Squircle from '@/components/ui/Squircle';
import { useAppTheme } from '@/context/ThemeContext';

// ─── Data ─────────────────────────────────────────────────────────────────────

const LINKS = [
  { id: 'privacy',  icon: 'shield-checkmark-outline' as const, label: 'Privacy Policy',       url: 'https://zod.dhabli.com/privacy'  },
  { id: 'terms',    icon: 'document-text-outline'    as const, label: 'Terms of Service',      url: 'https://zod.dhabli.com/terms'    },
  { id: 'cookies',  icon: 'nutrition-outline'        as const, label: 'Cookie Policy',         url: 'https://zod.dhabli.com/cookies'  },
  { id: 'licenses', icon: 'code-slash-outline'       as const, label: 'Open Source Licenses',  url: 'https://zod.dhabli.com/licenses' },
  { id: 'gdpr',     icon: 'finger-print-outline'     as const, label: 'Data & GDPR Rights',    url: 'https://zod.dhabli.com/gdpr'     },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: 'What data do we collect?',
    a: 'We collect your phone number or email, profile information (name, age, photos, preferences), and usage data to personalise your experience. We never sell your personal data.',
  },
  {
    q: 'How do we use your data?',
    a: 'Your data is used to show you relevant matches, improve our AI recommendations, and provide customer support. We use industry-standard encryption at rest and in transit.',
  },
  {
    q: 'How do you delete your account?',
    a: 'Go to Profile → Account Actions → Delete Account. Your data is permanently erased within 30 days as required by GDPR and CCPA.',
  },
  {
    q: 'Who can see my profile?',
    a: "Only users within your match criteria can see your profile. Enabling Incognito Mode (Pro) lets you browse without appearing in others' stacks.",
  },
  {
    q: 'How do subscriptions work?',
    a: 'Subscriptions are billed through Apple and renew automatically. You can cancel anytime from your iPhone Settings → Subscriptions.',
  },
];

// ─── Accordion item ───────────────────────────────────────────────────────────

function AccordionItem({ q, a, colors }: { q: string; a: string; colors: any }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
      <Pressable
        style={styles.accordionHeader}
        onPress={() => setOpen(o => !o)}
      >
        <Text style={[styles.accordionQ, { color: colors.text }]}>{q}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down' as any} size={16} color={colors.textSecondary} />
      </Pressable>
      {open && (
        <Text style={[styles.accordionA, { color: colors.textSecondary }]}>{a}</Text>
      )}
    </View>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function LegalPage() {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScreenHeader title="Legal Information" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Documents ─────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>DOCUMENTS</Text>
          <Squircle style={styles.group} cornerRadius={22} cornerSmoothing={1}
            fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
            {LINKS.map((item, idx) => (
              <Pressable
                key={item.id}
                style={({ pressed }) => [
                  styles.row,
                  idx < LINKS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                  pressed && { opacity: 0.6 },
                ]}
                onPress={() => WebBrowser.openBrowserAsync(item.url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET })}
              >
                <Squircle style={styles.iconWrap} cornerRadius={10} cornerSmoothing={1} fillColor={colors.bg}>
                  <Ionicons name={item.icon as any} size={18} color={colors.text} />
                </Squircle>
                <Text style={[styles.rowLabel, { color: colors.text }]}>{item.label}</Text>
                <Ionicons name="open-outline" size={15} color={colors.textSecondary} />
              </Pressable>
            ))}
          </Squircle>
        </View>

        {/* ── FAQ ───────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>PRIVACY FAQ</Text>
          <Squircle style={styles.group} cornerRadius={22} cornerSmoothing={1}
            fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
            {FAQS.map((item, idx) => (
              <AccordionItem key={idx} q={item.q} a={item.a} colors={colors} />
            ))}
          </Squircle>
        </View>

        <Text style={[styles.footer, { color: colors.textSecondary }]}>
          © 2026 Zevello, Inc. All rights reserved.{'\n'}Version 1.0.0
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1 },
  scroll:          { paddingHorizontal: 16, paddingBottom: 40 },
  section:         { marginTop: 24 },
  sectionTitle:    { fontSize: 11, fontFamily: 'ProductSans-Bold', letterSpacing: 1.4, marginBottom: 8, marginLeft: 2 },
  group:           { overflow: 'hidden' },
  row:             { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14, gap: 12 },
  iconWrap:        { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  rowLabel:        { fontSize: 15, fontFamily: 'ProductSans-Medium', flex: 1 },
  accordionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 14 },
  accordionQ:      { fontSize: 14, fontFamily: 'ProductSans-Medium', flex: 1, marginRight: 8 },
  accordionA:      { fontSize: 13, fontFamily: 'ProductSans-Regular', lineHeight: 20, paddingHorizontal: 14, paddingBottom: 14 },
  footer:          { fontSize: 12, fontFamily: 'ProductSans-Regular', textAlign: 'center', marginTop: 28, lineHeight: 20 },
});
