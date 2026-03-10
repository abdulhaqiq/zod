// Step 4 — Goals (multi-select, up to 5)
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';
import { useProfileSave } from '@/hooks/useProfileSave';
import OnboardingShell from './OnboardingShell';

const GOALS = [
  'Travel the world', 'Build a family', 'Grow my career',
  'Personal growth', 'Creative pursuits', 'Financial stability',
  'Community & giving', 'Adventure & thrills', 'Mindfulness & health',
];

export default function GoalsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { save, saving } = useProfileSave();
  const { profile } = useAuth();
  const existingGoals = (profile?.values_list ?? []).filter((v) => GOALS.includes(v));
  const [selected, setSelected] = useState<string[]>(existingGoals);

  const toggle = (g: string) =>
    setSelected((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : prev.length < 5 ? [...prev, g] : prev,
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
          const active = selected.includes(g);
          return (
            <Pressable
              key={g}
              onPress={() => toggle(g)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? colors.text : 'transparent',
                  borderColor: active ? colors.text : colors.border,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: active ? colors.bg : colors.text }]}>{g}</Text>
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
