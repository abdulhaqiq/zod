// Step 4 — Life Goals (multi-select, up to 5)
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';
import { LOOKUP } from '@/constants/lookupData';
import { useProfileSave } from '@/hooks/useProfileSave';
import OnboardingShell from './OnboardingShell';

// Life goals are items 16-24 in values_list (indices 16+)
const GOALS = LOOKUP.values_list.slice(16);

export default function GoalsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { save, saving } = useProfileSave();
  const { profile } = useAuth();
  const goalIds = GOALS.map(g => g.id);
  const existingGoals = (profile?.values_list ?? []).filter(id => goalIds.includes(id));
  const [selected, setSelected] = useState<number[]>(existingGoals);

  const toggle = (id: number) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 5 ? [...prev, id] : prev,
    );

  const handleContinue = async () => {
    if (selected.length === 0) return;
    const ok = await save({ values_list: selected });
    if (ok) router.push('/height');
  };

  return (
    <OnboardingShell
      step={4}
      title="What are your life goals?"
      subtitle="Pick up to 5 that matter most to you."
      onContinue={handleContinue}
      continueDisabled={selected.length === 0}
      loading={saving}
    >
      <View style={styles.grid}>
        {GOALS.map((g) => {
          const active = selected.includes(g.id);
          return (
            <Pressable
              key={g.id}
              onPress={() => toggle(g.id)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? colors.text : 'transparent',
                  borderColor: active ? colors.text : colors.border,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: active ? colors.bg : colors.text }]}>
                {g.emoji ? `${g.emoji} ` : ''}{g.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 100, borderWidth: 1.5 },
  chipText: { fontSize: 14, fontFamily: 'ProductSans-Medium' },
});
