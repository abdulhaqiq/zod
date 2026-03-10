// Step 6 — Interests (up to 5)
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';
import { useProfileSave } from '@/hooks/useProfileSave';
import OnboardingShell from './OnboardingShell';

const ALL_INTERESTS: { emoji: string; label: string }[] = [
  { emoji: '🥾', label: 'Hiking' },      { emoji: '✈️', label: 'Travel' },
  { emoji: '🍳', label: 'Cooking' },     { emoji: '💪', label: 'Fitness' },
  { emoji: '🎵', label: 'Music' },       { emoji: '🎨', label: 'Art' },
  { emoji: '🎮', label: 'Gaming' },      { emoji: '📚', label: 'Reading' },
  { emoji: '📸', label: 'Photography' }, { emoji: '💃', label: 'Dancing' },
  { emoji: '🧘', label: 'Yoga' },        { emoji: '🎬', label: 'Movies' },
  { emoji: '☕', label: 'Coffee' },       { emoji: '🍷', label: 'Wine' },
  { emoji: '🏄', label: 'Surfing' },     { emoji: '🚴', label: 'Cycling' },
  { emoji: '🧠', label: 'Meditation' },  { emoji: '🍽️', label: 'Foodie' },
  { emoji: '🐶', label: 'Dogs' },        { emoji: '🐱', label: 'Cats' },
  { emoji: '❤️', label: 'Volunteering' },{ emoji: '👗', label: 'Fashion' },
  { emoji: '🎤', label: 'Concerts' },    { emoji: '⛺', label: 'Camping' },
];

export default function InterestsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { save, saving } = useProfileSave();
  const { profile } = useAuth();
  const [selected, setSelected] = useState<string[]>(profile?.interests ?? []);

  const toggle = (label: string) =>
    setSelected((prev) =>
      prev.includes(label) ? prev.filter((x) => x !== label) : prev.length < 5 ? [...prev, label] : prev,
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
      subtitle={`Pick up to 5 interests. ${selected.length}/5 selected.`}
      onContinue={handleContinue}
      continueDisabled={selected.length === 0}
      loading={saving}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {ALL_INTERESTS.map((item) => {
            const active = selected.includes(item.label);
            return (
              <Pressable
                key={item.label}
                onPress={() => toggle(item.label)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.text : 'transparent',
                    borderColor: active ? colors.text : colors.border,
                  },
                ]}
              >
                <Text style={styles.chipEmoji}>{item.emoji}</Text>
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
