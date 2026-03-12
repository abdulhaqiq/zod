import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import ScreenHeader from '@/components/ui/ScreenHeader';
import Squircle from '@/components/ui/Squircle';
import { useAppTheme } from '@/context/ThemeContext';

// ─── FAQ data ─────────────────────────────────────────────────────────────────

const FAQ: { q: string; a: string }[] = [
  {
    q: 'Why am I not getting matches?',
    a: 'Try completing your profile with clear face photos and a bio. Users with complete profiles get up to 3× more matches. You can also expand your preferences in the filter settings.',
  },
  {
    q: 'How does the matching algorithm work?',
    a: 'Zod AI analyses mutual interests, values, relationship goals, and interaction patterns to surface the most compatible people first. Keep swiping — it learns over time.',
  },
  {
    q: 'How do I report someone?',
    a: 'Open their profile or chat → tap the ⋯ menu → Report. Our trust & safety team reviews all reports within 24 hours.',
  },
  {
    q: 'Can I undo a swipe?',
    a: 'Yes! With Zod Pro you can rewind your last swipe. Upgrade in Profile → Zod Pro.',
  },
  {
    q: 'How do I cancel my subscription?',
    a: 'Open iPhone Settings → tap your Apple ID at the top → Subscriptions → Zod → Cancel Subscription. Access continues until the billing period ends.',
  },
  {
    q: "My photos aren't uploading — what should I do?",
    a: "Photos must show a clear face, no watermarks, no explicit content, and be at least 400x400 px. Make sure you have a stable internet connection.",
  },
  {
    q: 'Is my data private?',
    a: 'Yes. Your data is encrypted and never sold to third parties. Read our full Privacy Policy in Legal Information.',
  },
];

// ─── Accordion ────────────────────────────────────────────────────────────────

function AccordionItem({ q, a, colors }: { q: string; a: string; colors: any }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
      <Pressable style={styles.accordionHeader} onPress={() => setOpen(o => !o)}>
        <Text style={[styles.accordionQ, { color: colors.text }]}>{q}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} />
      </Pressable>
      {open && (
        <Text style={[styles.accordionA, { color: colors.textSecondary }]}>{a}</Text>
      )}
    </View>
  );
}

// ─── Contact option ───────────────────────────────────────────────────────────

function ContactRow({ icon, label, sub, onPress, last, colors }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string; sub: string;
  onPress: () => void; last?: boolean; colors: any;
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
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.rowSub, { color: colors.textSecondary }]}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
    </Pressable>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function GetHelpPage() {
  const { colors } = useAppTheme();
  const [search, setSearch] = useState('');

  const filtered = FAQ.filter(f =>
    search.trim() === '' ||
    f.q.toLowerCase().includes(search.toLowerCase()) ||
    f.a.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScreenHeader title="Get Help" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── Search ──────────────────────────────────────────────────────── */}
        <Squircle style={styles.searchBar} cornerRadius={16} cornerSmoothing={1}
          fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
          <Ionicons name="search-outline" size={16} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search help topics…"
            placeholderTextColor={colors.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
            </Pressable>
          )}
        </Squircle>

        {/* ── FAQ ─────────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>FREQUENTLY ASKED</Text>
          <Squircle style={styles.group} cornerRadius={22} cornerSmoothing={1}
            fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
            {filtered.length > 0
              ? filtered.map((item, idx) => (
                  <AccordionItem key={idx} q={item.q} a={item.a} colors={colors} />
                ))
              : <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No results for "{search}"</Text>
            }
          </Squircle>
        </View>

        {/* ── Contact ─────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>CONTACT US</Text>
          <Squircle style={styles.group} cornerRadius={22} cornerSmoothing={1}
            fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
            <ContactRow
              icon="chatbubbles-outline" label="Live Chat"
              sub="Chat with our support team"
              onPress={() => Alert.alert('Coming soon', 'Live chat will be available shortly.')}
              colors={colors}
            />
            <ContactRow
              icon="mail-outline" label="Email Support"
              sub="support@zod.ai"
              onPress={() => Linking.openURL('mailto:support@zod.ai')}
              colors={colors}
            />
            <ContactRow
              icon="bug-outline" label="Report a Bug"
              sub="Help us improve the app"
              onPress={() => Linking.openURL('mailto:bugs@zod.ai?subject=Bug Report')}
              colors={colors} last
            />
          </Squircle>
        </View>

        <Text style={[styles.footer, { color: colors.textSecondary }]}>
          Our support team is available Mon–Fri, 9am–6pm EST.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1 },
  scroll:          { paddingHorizontal: 16, paddingBottom: 40 },
  searchBar:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 8, marginTop: 12 },
  searchInput:     { flex: 1, fontSize: 14, fontFamily: 'ProductSans-Regular' },
  section:         { marginTop: 24 },
  sectionTitle:    { fontSize: 11, fontFamily: 'ProductSans-Bold', letterSpacing: 1.4, marginBottom: 8, marginLeft: 2 },
  group:           { overflow: 'hidden' },
  row:             { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14, gap: 12 },
  iconWrap:        { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  rowText:         { flex: 1 },
  rowLabel:        { fontSize: 15, fontFamily: 'ProductSans-Medium' },
  rowSub:          { fontSize: 12, fontFamily: 'ProductSans-Regular', marginTop: 2 },
  accordionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 14 },
  accordionQ:      { fontSize: 14, fontFamily: 'ProductSans-Medium', flex: 1, marginRight: 8 },
  accordionA:      { fontSize: 13, fontFamily: 'ProductSans-Regular', lineHeight: 20, paddingHorizontal: 14, paddingBottom: 14 },
  emptyText:       { fontSize: 14, fontFamily: 'ProductSans-Regular', padding: 20, textAlign: 'center' },
  footer:          { fontSize: 12, fontFamily: 'ProductSans-Regular', textAlign: 'center', marginTop: 28 },
});
