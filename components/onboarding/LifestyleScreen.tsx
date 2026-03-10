// Step 7 — Lifestyle (drinking, smoking, exercise, diet)
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';
import { useProfileSave } from '@/hooks/useProfileSave';
import OnboardingShell from './OnboardingShell';

const QUESTIONS: { key: string; label: string; options: string[] }[] = [
  { key: 'drinking', label: 'Drinking', options: ['Never', 'Rarely', 'Socially', 'Often'] },
  { key: 'smoking', label: 'Smoking', options: ['Never', 'Sometimes', 'Yes'] },
  { key: 'exercise', label: 'Exercise', options: ['Never', 'Sometimes', 'Regularly', 'Daily'] },
  { key: 'diet', label: 'Diet', options: ['Omnivore', 'Vegetarian', 'Vegan', 'Halal', 'Other'] },
];

export default function LifestyleScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { save, saving } = useProfileSave();
  const { profile } = useAuth();
  const [answers, setAnswers] = useState<Record<string, string>>(
    (profile?.lifestyle as Record<string, string>) ?? {}
  );

  const allAnswered = QUESTIONS.every((q) => answers[q.key]);

  const handleContinue = async () => {
    if (!allAnswered) return;
    const ok = await save({ lifestyle: answers });
    if (ok) router.push('/values');
  };

  return (
    <OnboardingShell
      step={7}
      title="Your lifestyle"
      subtitle="Help matches understand how you live."
      onContinue={handleContinue}
      continueDisabled={!allAnswered}
      loading={saving}
    >
      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        {QUESTIONS.map((q) => (
          <View key={q.key} style={styles.section}>
            <Text style={[styles.qLabel, { color: colors.textSecondary }]}>{q.label.toUpperCase()}</Text>
            <View style={styles.row}>
              {q.options.map((opt) => {
                const active = answers[q.key] === opt;
                return (
                  <Pressable
                    key={opt}
                    onPress={() => setAnswers((prev) => ({ ...prev, [q.key]: opt }))}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? colors.text : 'transparent',
                        borderColor: active ? colors.text : colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: active ? colors.bg : colors.text }]}>{opt}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  section: { marginBottom: 28 },
  qLabel: { fontSize: 12, fontFamily: 'ProductSans-Medium', marginBottom: 10, letterSpacing: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 100, borderWidth: 1.5 },
  chipText: { fontSize: 14, fontFamily: 'ProductSans-Medium' },
});
