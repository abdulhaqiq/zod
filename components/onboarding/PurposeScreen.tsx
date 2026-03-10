// Step 3 — Relationship intent (multi-select, fetched from backend)
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';
import { API_V1 } from '@/constants/api';
import { useProfileSave } from '@/hooks/useProfileSave';
import OnboardingShell from './OnboardingShell';

interface RelType { value: string; label: string }

export default function PurposeScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { save, saving } = useProfileSave();
  const { profile } = useAuth();

  const [options, setOptions] = useState<RelType[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [selected, setSelected] = useState<string[]>(
    Array.isArray(profile?.purpose) ? profile.purpose : []
  );

  useEffect(() => {
    fetch(`${API_V1}/lookup/relationship-types`)
      .then((r) => r.json())
      .then((data) => setOptions(data))
      .catch(() => {
        // Fallback to hardcoded if network fails
        setOptions([
          { value: 'relationship', label: 'Long-term relationship' },
          { value: 'casual',       label: 'Something casual' },
          { value: 'open',         label: 'Open relationship' },
          { value: 'friends',      label: 'New friends' },
          { value: 'unsure',       label: 'Not sure yet' },
        ]);
      })
      .finally(() => setLoadingOptions(false));
  }, []);

  const toggle = (value: string) => {
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
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
      {loadingOptions ? (
        <ActivityIndicator color={colors.text} style={{ marginTop: 32 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.chips}
          showsVerticalScrollIndicator={false}
        >
          {options.map((opt) => {
            const active = selected.includes(opt.value);
            return (
              <Pressable
                key={opt.value}
                onPress={() => toggle(opt.value)}
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
      )}
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
