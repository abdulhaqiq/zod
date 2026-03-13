// Step 2 — Gender
import { Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Squircle from '@/components/ui/Squircle';
import { LOOKUP } from '@/constants/lookupData';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';
import { useProfileSave } from '@/hooks/useProfileSave';
import OnboardingShell from './OnboardingShell';

const { width: W } = Dimensions.get('window');
const CARD_W = (W - 48 - 14) / 2; // 48 = horizontal padding, 14 = gap

// Only Male / Female
const GENDERS = LOOKUP.gender;

export default function GenderScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { save, saving } = useProfileSave();
  const { profile } = useAuth();

  const [selectedId, setSelectedId] = useState<number | null>(profile?.gender_id ?? null);

  const handleContinue = async () => {
    if (!selectedId) return;
    const ok = await save({ gender_id: selectedId });
    if (ok) router.push('/purpose');
  };

  return (
    <OnboardingShell
      step={2}
      title="I identify as"
      subtitle="This helps us personalise your experience."
      onContinue={handleContinue}
      continueDisabled={!selectedId}
      loading={saving}
    >
      <View style={styles.row}>
        {GENDERS.map(({ id, emoji, label }) => {
          const active = selectedId === id;
          return (
            <Pressable key={id} onPress={() => setSelectedId(id)}>
              <Squircle
                style={{ width: CARD_W, height: 130 }}
                cornerRadius={28}
                cornerSmoothing={1}
                fillColor={active ? colors.text : colors.surface}
                strokeColor={colors.border}
                strokeWidth={active ? 0 : 1.5}
              >
                {/* Content wrapper — needed because SVG is absolutely positioned */}
                <View style={styles.cardContent}>
                  <Text style={[styles.emoji, { color: active ? '#ffffff' : colors.text }]}>{emoji}</Text>
                  <Text style={[styles.label, { color: active ? '#ffffff' : colors.text }]}>
                    {label}
                  </Text>
                </View>
              </Squircle>
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
    gap: 14,
    marginTop: 8,
  },
  cardContent: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emoji: {
    fontSize: 34,
  },
  label: {
    fontSize: 17,
    fontFamily: 'ProductSans-Bold',
  },
});
