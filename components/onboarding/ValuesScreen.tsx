// Step 8 — Values (multi-select, up to 5)
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';
import { useProfileSave } from '@/hooks/useProfileSave';
import OnboardingShell from './OnboardingShell';

const ALL_VALUES = [
  'Loyalty', 'Ambition', 'Kindness', 'Honesty', 'Humor',
  'Family', 'Independence', 'Creativity', 'Spirituality', 'Compassion',
  'Curiosity', 'Stability', 'Adventure', 'Integrity', 'Respect',
];

export default function ValuesScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { save, saving } = useProfileSave();
  const { profile } = useAuth();
  const existingValues = (profile?.values_list ?? []).filter((v) => ALL_VALUES.includes(v));
  const [selected, setSelected] = useState<string[]>(existingValues);

  const toggle = (v: string) =>
    setSelected((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : prev.length < 5 ? [...prev, v] : prev,
    );

  const handleContinue = async () => {
    if (selected.length === 0) return;
    const ok = await save({ values_list: selected });
    if (ok) router.push('/prompts');
  };

  return (
    <OnboardingShell
      step={8}
      title="What do you value most?"
      subtitle={`Pick up to 5. ${selected.length}/5 selected.`}
      onContinue={handleContinue}
      continueDisabled={selected.length === 0}
      loading={saving}
    >
      <View style={styles.grid}>
        {ALL_VALUES.map((v) => {
          const active = selected.includes(v);
          return (
            <Pressable
              key={v}
              onPress={() => toggle(v)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? colors.text : 'transparent',
                  borderColor: active ? colors.text : colors.border,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: active ? colors.bg : colors.text }]}>{v}</Text>
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
