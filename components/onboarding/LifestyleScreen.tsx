// Step 7 — Lifestyle (drinking, smoking, exercise, diet)
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';
import { useLookups, type LookupOption } from '@/hooks/useLookups';
import { useProfileSave } from '@/hooks/useProfileSave';
import OnboardingShell from './OnboardingShell';

const KEYS = ['drinking', 'smoking', 'exercise', 'diet'] as const;
const LABELS: Record<string, string> = { drinking: 'Drinking', smoking: 'Smoking', exercise: 'Exercise', diet: 'Diet' };

export default function LifestyleScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { save, saving } = useProfileSave();
  const { profile } = useAuth();
  const { lookups } = useLookups();
  const [answers, setAnswers] = useState<Record<string, number>>(
    (profile?.lifestyle as Record<string, number>) ?? {}
  );

  const questions: { key: string; label: string; options: LookupOption[] }[] = KEYS.map(k => ({
    key: k, label: LABELS[k], options: lookups[k] ?? [],
  }));

  const allAnswered = questions.every((q) => q.options.length === 0 || answers[q.key] != null);

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
        {questions.map((q) => (
          <View key={q.key} style={styles.section}>
            <Text style={[styles.qLabel, { color: colors.textSecondary }]}>{q.label.toUpperCase()}</Text>
            <View style={styles.row}>
              {q.options.map((opt) => {
                const active = answers[q.key] === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => setAnswers((prev) => ({ ...prev, [q.key]: opt.id }))}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? colors.text : 'transparent',
                        borderColor: active ? colors.text : colors.border,
                      },
                    ]}
                  >
                    {opt.emoji ? <Text style={styles.chipEmoji}>{opt.emoji}</Text> : null}
                    <Text style={[styles.chipText, { color: active ? colors.bg : colors.text }]}>{opt.label}</Text>
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
  scroll:    { flex: 1 },
  section:   { marginBottom: 28 },
  qLabel:    { fontSize: 12, fontFamily: 'ProductSans-Medium', marginBottom: 10, letterSpacing: 1 },
  row:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:      { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 100, borderWidth: 1.5 },
  chipEmoji: { fontSize: 14 },
  chipText:  { fontSize: 14, fontFamily: 'ProductSans-Medium' },
});
