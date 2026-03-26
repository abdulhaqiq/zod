// Step 12 — Your faith (Muslims with Halal mode ON only)
// Covers sect, prayer frequency, and marriage timeline.
// Halal mode is set on the Religion screen — not here.
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';
import { useLookupsCategory } from '@/hooks/useLookups';
import { useProfileSave } from '@/hooks/useProfileSave';
import OnboardingShell from './OnboardingShell';

interface Section {
  key: 'sect_id' | 'prayer_frequency_id' | 'marriage_timeline_id';
  category: string;
  title: string;
}

const SECTIONS: Section[] = [
  { key: 'sect_id',              category: 'sect',             title: 'Sect' },
  { key: 'prayer_frequency_id',  category: 'prayer_frequency', title: 'Prayer frequency' },
  { key: 'marriage_timeline_id', category: 'marriage_timeline', title: 'Marriage timeline' },
];

export default function FaithScreen() {
  const { colors } = useAppTheme();
  const { save, saving } = useProfileSave();
  const { profile, setOnboarded } = useAuth();

  const sectOpts            = useLookupsCategory('sect');
  const prayerOpts          = useLookupsCategory('prayer_frequency');
  const marriageOpts        = useLookupsCategory('marriage_timeline');

  const optsByCategory: Record<string, ReturnType<typeof useLookupsCategory>> = {
    sect:             sectOpts,
    prayer_frequency: prayerOpts,
    marriage_timeline: marriageOpts,
  };

  const [answers, setAnswers] = useState<Record<string, number | null>>({
    sect_id:              profile?.sect_id              ?? null,
    prayer_frequency_id:  profile?.prayer_frequency_id  ?? null,
    marriage_timeline_id: profile?.marriage_timeline_id ?? null,
  });

  // Save immediately when a chip is tapped so selections persist if user goes back
  const handleSelect = async (key: string, id: number, isActive: boolean) => {
    const newValue = isActive ? null : id;
    const updated  = { ...answers, [key]: newValue };
    setAnswers(updated);
    const fields: Record<string, unknown> = {};
    if (newValue !== null) fields[key] = newValue;
    else fields[key] = null;
    await save(fields);
  };

  const finish = async () => {
    const fields: Record<string, unknown> = { is_onboarded: true };
    for (const s of SECTIONS) {
      if (answers[s.key] !== null) fields[s.key] = answers[s.key];
    }
    const ok = await save(fields);
    if (!ok) return;
    await setOnboarded();
  };

  const handleSkip = async () => {
    const ok = await save({ is_onboarded: true });
    if (!ok) return;
    await setOnboarded();
  };

  return (
    <OnboardingShell
      step={12}
      totalSteps={12}
      title="Your faith"
      subtitle="Help us connect you with like-minded Muslims. All fields are optional."
      onContinue={finish}
      continueLabel="Finish"
      loading={saving}
      onSkip={handleSkip}
      scrollable
      fallbackHref="/religion"
    >
      {SECTIONS.map((section) => {
        const opts = optsByCategory[section.category];
        const selected = answers[section.key];
        return (
          <View key={section.key} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              {section.title.toUpperCase()}
            </Text>
            <View style={styles.chips}>
              {opts.map((opt) => {
                const active = selected === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => handleSelect(section.key, opt.id, active)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? colors.text : 'transparent',
                        borderColor: active ? colors.text : colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: active ? colors.bg : colors.text }]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}

    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  section:      { marginBottom: 28 },
  sectionTitle: { fontSize: 11, fontFamily: 'ProductSans-Medium', letterSpacing: 1, marginBottom: 10 },
  chips:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:         { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 100, borderWidth: 1.5 },
  chipText:     { fontSize: 14, fontFamily: 'ProductSans-Medium' },
});
