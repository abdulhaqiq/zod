// Step 6 — Interests (up to 5)
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';
import { useLookupsCategory } from '@/hooks/useLookups';
import { useProfileSave } from '@/hooks/useProfileSave';
import OnboardingShell from './OnboardingShell';

export default function InterestsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { save, saving } = useProfileSave();
  const { profile } = useAuth();
  const interests = useLookupsCategory('interests');
  const [selected, setSelected] = useState<number[]>(profile?.interests ?? []);

  const MAX = 5;

  const toggle = (id: number) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < MAX ? [...prev, id] : prev,
    );

  const handleContinue = async () => {
    if (selected.length === 0) return;
    const ok = await save({ interests: selected });
    if (ok) router.push('/lifestyle');
  };

  return (
    <OnboardingShell
      step={6}
      title="What are you into?"
      subtitle={`${selected.length} / ${MAX} selected`}
      onContinue={handleContinue}
      continueDisabled={selected.length === 0}
      loading={saving}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {interests.map((item) => {
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
                {item.emoji ? <Text style={styles.chipEmoji}>{item.emoji}</Text> : null}
                <Text style={[styles.chipText, { color: active ? colors.bg : colors.text }]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  grid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8, paddingBottom: 16 },
  chip:      { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 100, borderWidth: 1.5 },
  chipEmoji: { fontSize: 15 },
  chipText:  { fontSize: 14, fontFamily: 'ProductSans-Medium' },
});
