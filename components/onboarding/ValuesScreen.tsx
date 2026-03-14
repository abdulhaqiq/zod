// Step 8 — Values (multi-select, up to 5)
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';
import { useLookupsCategory } from '@/hooks/useLookups';
import { useProfileSave } from '@/hooks/useProfileSave';
import OnboardingShell from './OnboardingShell';

export default function ValuesScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { save, saving } = useProfileSave();
  const { profile } = useAuth();
  const allValues = useLookupsCategory('values_list');
  // Personal values only (items without a life-goal emoji prefix; the first 16 by convention)
  const personalValues = allValues.filter(v => !v.emoji);
  const goalValues = allValues.filter(v => !!v.emoji);
  const personalIds = personalValues.map(v => v.id);
  const goalIds = goalValues.map(v => v.id);
  const existingValues = (profile?.values_list ?? []).filter(id => personalIds.includes(id));
  const [selected, setSelected] = useState<number[]>(existingValues);

  const toggle = (id: number) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 5 ? [...prev, id] : prev,
    );

  const handleContinue = async () => {
    if (selected.length === 0) return;
    const existing = profile?.values_list ?? [];
    const mergedGoals = existing.filter(id => goalIds.includes(id));
    const ok = await save({ values_list: [...selected, ...mergedGoals] });
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
        {personalValues.map((item) => {
          const active = selected.includes(item.id);
          return (
            <Pressable
              key={item.id}
              onPress={() => toggle(item.id)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? colors.text : 'transparent',
                  borderColor: active ? colors.text : colors.border,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: active ? colors.bg : colors.text }]}>{item.label}</Text>
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
