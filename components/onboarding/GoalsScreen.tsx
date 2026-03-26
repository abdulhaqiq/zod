import { navPush, navReplace } from '@/utils/nav';
// Step 4 — Life Goals (multi-select, up to 5)
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';
import { useLookupsCategory } from '@/hooks/useLookups';
import { useProfileSave } from '@/hooks/useProfileSave';
import OnboardingShell from './OnboardingShell';

// Category display order and labels
const CATEGORY_ORDER = [
  'Adventure',
  'Career',
  'Travel',
  'Family',
  'Health',
  'Financial',
  'Creative',
  'Education',
  'Community',
  'Personal',
];

export default function GoalsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { save, saving } = useProfileSave();
  const { profile } = useAuth();
  const allValues = useLookupsCategory('values_list');

  // Life goals are items with an emoji OR a subcategory (new goals have no emoji but have subcategory)
  const goals = allValues.filter(v => !!v.emoji || !!v.subcategory);
  const personalValues = allValues.filter(v => !v.emoji && !v.subcategory);
  const goalIds = goals.map(g => g.id);
  const personalIds = personalValues.map(v => v.id);
  const existingGoals = (profile?.values_list ?? []).filter(id => goalIds.includes(id));
  const [selected, setSelected] = useState<number[]>(existingGoals);

  const MAX = 5;

  const toggle = (id: number) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < MAX ? [...prev, id] : prev,
    );

  const handleContinue = async () => {
    if (selected.length === 0) return;
    const existing = profile?.values_list ?? [];
    const mergedPersonalValues = existing.filter(id => personalIds.includes(id));
    const ok = await save({ values_list: [...mergedPersonalValues, ...selected] });
    if (ok) navPush('/height');
  };

  // Group goals by subcategory, maintaining CATEGORY_ORDER
  const grouped = CATEGORY_ORDER.reduce<Record<string, typeof goals>>((acc, cat) => {
    const items = goals.filter(g => (g.subcategory ?? 'Other') === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});

  // Append any goals with subcategories not in CATEGORY_ORDER
  goals.forEach(g => {
    const cat = g.subcategory ?? 'Other';
    if (!CATEGORY_ORDER.includes(cat)) {
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(g);
    }
  });

  const categoryEntries = Object.entries(grouped);

  return (
    <OnboardingShell
      step={4}
      title="What are your life goals?"
      subtitle={`${selected.length} / ${MAX} selected`}
      onContinue={handleContinue}
      continueDisabled={selected.length === 0}
      loading={saving}
      fallbackHref="/purpose"
    >
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.sections}>
        {categoryEntries.map(([cat, items]) => (
          <View key={cat} style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
              {cat}
            </Text>
            <View style={styles.grid}>
              {items.map((g) => {
                const active = selected.includes(g.id);
                const atMax = selected.length >= MAX && !active;
                return (
                  <Pressable
                    key={g.id}
                    onPress={() => !atMax && toggle(g.id)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? colors.text : 'transparent',
                        borderColor: active ? colors.text : atMax ? colors.borderFaint : colors.border,
                        opacity: atMax ? 0.45 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: active ? colors.bg : colors.text }]}>
                      {g.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </View>
      </ScrollView>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  scroll:        { flex: 1 },
  sections:      { gap: 22, marginTop: 8, paddingBottom: 16 },
  section:       { gap: 10 },
  sectionHeader: { fontSize: 12, fontFamily: 'ProductSans-Bold', letterSpacing: 0.8, textTransform: 'uppercase' },
  grid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip:          { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 100, borderWidth: 1.5 },
  chipText:      { fontSize: 14, fontFamily: 'ProductSans-Medium' },
});
