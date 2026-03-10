// Step 2 — Gender
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';
import { useProfileSave } from '@/hooks/useProfileSave';
import OnboardingShell from './OnboardingShell';

const GENDERS = [
  { label: 'Man',    value: 'man',    icon: '♂' },
  { label: 'Woman',  value: 'woman',  icon: '♀' },
];

export default function GenderScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { save, saving } = useProfileSave();
  const { profile } = useAuth();

  const [selected, setSelected] = useState<string | null>(profile?.gender ?? null);

  const handleContinue = async () => {
    if (!selected) return;
    const ok = await save({ gender: selected });
    if (ok) router.push('/purpose');
  };

  return (
    <OnboardingShell
      step={2}
      title="I identify as"
      subtitle="This helps us personalise your experience."
      onContinue={handleContinue}
      continueDisabled={!selected}
      loading={saving}
    >
      <View style={styles.row}>
        {GENDERS.map(({ label, value, icon }) => {
          const active = selected === value;
          return (
            <Pressable
              key={value}
              onPress={() => setSelected(value)}
              style={[
                styles.pill,
                {
                  backgroundColor: active ? colors.text : colors.surface,
                  borderColor: active ? colors.text : colors.border,
                },
              ]}
            >
              <Text style={[styles.icon, { color: active ? colors.bg : colors.textSecondary }]}>
                {icon}
              </Text>
              <Text style={[styles.label, { color: active ? colors.bg : colors.text }]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  icon: {
    fontSize: 18,
  },
  label: {
    fontSize: 16,
    fontFamily: 'ProductSans-Medium',
  },
});
