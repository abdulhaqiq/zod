import { navPush, navReplace } from '@/utils/nav';
// Step 5 — Height
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';
import { useProfileSave } from '@/hooks/useProfileSave';
import OnboardingShell from './OnboardingShell';

// Heights from 140cm to 220cm
const CM_VALUES = Array.from({ length: 81 }, (_, i) => 140 + i);

function cmToFtIn(cm: number) {
  const totalIn = cm / 2.54;
  const ft = Math.floor(totalIn / 12);
  const inch = Math.round(totalIn % 12);
  return `${ft}'${inch}"`;
}

export default function HeightScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { save, saving } = useProfileSave();
  const { profile } = useAuth();
  const [heightCm, setHeightCm] = useState(profile?.height_cm ?? 170);
  const [unit, setUnit] = useState<'cm' | 'ft'>('cm');

  const label = unit === 'cm' ? `${heightCm} cm` : cmToFtIn(heightCm);

  const handleContinue = async () => {
    const ok = await save({ height_cm: heightCm });
    if (ok) navPush('/interests');
  };

  return (
    <OnboardingShell
      step={5}
      title="How tall are you?"
      subtitle="Your height is shown on your profile."
      onContinue={handleContinue}
      loading={saving}
    >
      {/* Unit toggle */}
      <View style={[styles.toggle, { backgroundColor: colors.surface }]}>
        {(['cm', 'ft'] as const).map((u) => (
          <Pressable
            key={u}
            style={[styles.toggleBtn, unit === u && { backgroundColor: colors.text }]}
            onPress={() => setUnit(u)}
          >
            <Text style={[styles.toggleText, { color: unit === u ? colors.bg : colors.textSecondary }]}>
              {u}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Big display */}
      <Text style={[styles.display, { color: colors.text }]}>{label}</Text>

      {/* +/- controls */}
      <View style={styles.controls}>
        <Pressable
          style={[styles.controlBtn, { backgroundColor: colors.surface }]}
          onPress={() => setHeightCm((c) => Math.max(140, c - 1))}
        >
          <Text style={[styles.controlIcon, { color: colors.text }]}>−</Text>
        </Pressable>
        <Pressable
          style={[styles.controlBtn, { backgroundColor: colors.surface }]}
          onPress={() => setHeightCm((c) => Math.min(220, c + 1))}
        >
          <Text style={[styles.controlIcon, { color: colors.text }]}>+</Text>
        </Pressable>
      </View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  toggle: { flexDirection: 'row', borderRadius: 12, overflow: 'hidden', alignSelf: 'flex-start', marginBottom: 40 },
  toggleBtn: { paddingHorizontal: 24, paddingVertical: 10 },
  toggleText: { fontSize: 14, fontFamily: 'ProductSans-Medium' },
  display: { fontSize: 72, fontFamily: 'ProductSans-Black', textAlign: 'center', marginBottom: 40 },
  controls: { flexDirection: 'row', justifyContent: 'center', gap: 24 },
  controlBtn: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
  controlIcon: { fontSize: 32, fontFamily: 'ProductSans-Light' },
});
