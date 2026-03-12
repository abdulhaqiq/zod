// Step 3 — Relationship intent (multi-select)
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';
import { RELATIONSHIP_TYPES } from '@/constants/lookupData';
import { useProfileSave } from '@/hooks/useProfileSave';
import OnboardingShell from './OnboardingShell';

export default function PurposeScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { save, saving } = useProfileSave();
  const { profile } = useAuth();

  const [selected, setSelected] = useState<number[]>(
    Array.isArray(profile?.purpose) ? profile.purpose : []
  );

  const toggle = (id: number) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  };

  const handleContinue = async () => {
    if (selected.length === 0) return;
    const ok = await save({ purpose: selected });
    if (ok) router.push('/goals');
  };

  return (
    <OnboardingShell
      step={3}
      title="What are you looking for?"
      subtitle="Be honest — it helps find the right match. Pick all that apply."
      onContinue={handleContinue}
      continueDisabled={selected.length === 0}
      loading={saving}
    >
      <ScrollView
        contentContainerStyle={styles.chips}
        showsVerticalScrollIndicator={false}
      >
        {RELATIONSHIP_TYPES.map((opt) => {
          const active = selected.includes(opt.id);
          return (
            <Pressable
              key={opt.id}
              onPress={() => toggle(opt.id)}
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
      </ScrollView>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingBottom: 16,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 100,
    borderWidth: 1.5,
  },
  chipText: {
    fontSize: 14,
    fontFamily: 'ProductSans-Medium',
  },
});
