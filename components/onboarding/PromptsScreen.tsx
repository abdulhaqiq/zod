import { navPush, navReplace } from '@/utils/nav';
// Step 9 — Bio / prompt
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';
import Squircle from '@/components/ui/Squircle';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';
import { useProfileSave } from '@/hooks/useProfileSave';
import OnboardingShell from './OnboardingShell';

const MAX = 300;

export default function PromptsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { profile } = useAuth();
  const { save, saving } = useProfileSave();
  const [bio, setBio] = useState(profile?.bio ?? '');

  const handleContinue = async () => {
    const trimmed = bio.trim();
    if (trimmed.length < 10) return;
    const ok = await save({ bio: trimmed });
    if (ok) navPush('/photos');
  };

  return (
    <OnboardingShell
      step={9}
      title="Tell us about yourself"
      subtitle="Write a short bio. Be yourself — authenticity is attractive."
      onContinue={handleContinue}
      continueDisabled={bio.trim().length < 10}
      loading={saving}
      keyboardAvoiding
    >
      <Squircle
        style={styles.inputBox}
        cornerRadius={18}
        cornerSmoothing={1}
        fillColor={colors.surface}
        strokeColor={bio.length > 0 ? colors.borderActive : colors.border}
        strokeWidth={bio.length > 0 ? 2 : 1.5}
      >
        <TextInput
          style={[styles.input, { color: colors.text }]}
          placeholder="I love hiking on weekends and trying new restaurants…"
          placeholderTextColor={colors.placeholder}
          value={bio}
          onChangeText={(t) => setBio(t.slice(0, MAX))}
          multiline
          maxLength={MAX}
          autoFocus
          textAlignVertical="top"
        />
      </Squircle>
      <Text style={[styles.counter, { color: colors.textTertiary }]}>
        {bio.length}/{MAX}
      </Text>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  inputBox: { minHeight: 160, padding: 16 },
  input: { fontSize: 16, fontFamily: 'ProductSans-Regular', lineHeight: 24 },
  counter: { fontSize: 12, fontFamily: 'ProductSans-Regular', textAlign: 'right', marginTop: 8 },
});
