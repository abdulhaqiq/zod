import { navPush, navReplace } from '@/utils/nav';
// Step 3 — Looking For (single select)
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';
import { useLookupsCategory } from '@/hooks/useLookups';
import { useProfileSave } from '@/hooks/useProfileSave';
import OnboardingShell from './OnboardingShell';

export default function PurposeScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { save, saving } = useProfileSave();
  const { profile } = useAuth();
  const options = useLookupsCategory('looking_for');

  // Single select for looking_for_id
  const [selected, setSelected] = useState<number | null>(
    profile?.looking_for_id ?? null
  );

  const handleSelect = (id: number) => {
    setSelected(id);
  };

  const handleContinue = async () => {
    if (!selected) return;
    const ok = await save({ looking_for_id: selected });
    if (ok) navPush('/goals');
  };

  return (
    <OnboardingShell
      step={3}
      title="What are you looking for?"
      subtitle={selected ? '1 selected' : 'Select one'}
      onContinue={handleContinue}
      continueDisabled={!selected}
      loading={saving}
      fallbackHref="/gender"
    >
      <ScrollView
        contentContainerStyle={styles.chips}
        showsVerticalScrollIndicator={false}
      >
        {options.map((opt) => {
          const active = selected === opt.id;
          return (
            <Pressable
              key={opt.id}
              onPress={() => handleSelect(opt.id)}
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
