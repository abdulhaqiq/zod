import { navPush, navReplace } from '@/utils/nav';
// Step 2 — Gender
import { Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Squircle from '@/components/ui/Squircle';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';
import { useLookupsCategory } from '@/hooks/useLookups';
import { useProfileSave } from '@/hooks/useProfileSave';
import OnboardingShell from './OnboardingShell';

const { width: W } = Dimensions.get('window');
const CARD_W = (W - 48 - 14) / 2; // 2 cards with 1 gap of 14px

export default function GenderScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { save, saving } = useProfileSave();
  const { profile } = useAuth();
  // Only Man & Woman — zod is a straight dating app; backend also enforces this
  const genders = useLookupsCategory('gender').filter(g =>
    g.label === 'Man' || g.label === 'Woman'
  );

  const [selectedId, setSelectedId] = useState<number | null>(profile?.gender_id ?? null);

  // Skip this screen if gender was already set before arriving here.
  // Run once on mount only — we don't want to auto-navigate when the user
  // selects a gender on this screen (they should press Continue for that).
  useEffect(() => {
    if (profile?.gender_id) {
      navReplace('/purpose');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save immediately when a card is tapped so the selection persists
  // even if the user logs out before pressing Continue.
  const handleSelect = async (id: number) => {
    setSelectedId(id);
    await save({ gender_id: id });
  };

  const handleContinue = () => {
    if (!selectedId) return;
    navReplace('/purpose');
  };

  const GENDER_ICON: Record<string, React.string> = {
    Man: 'male',
    Woman: 'female',
  };

  return (
    <OnboardingShell
      step={2}
      title="I identify as"
      subtitle="Select one to continue."
      onContinue={handleContinue}
      continueDisabled={!selectedId}
      loading={saving}
      fallbackHref="/profile"
    >
      <View style={styles.row}>
        {genders.map(({ id, label }) => {
          const active = selectedId === id;
          const iconName = GENDER_ICON[label];
          return (
            <Pressable key={id} onPress={() => handleSelect(id)}>
              <Squircle
                style={{ width: CARD_W, height: 130 }}
                cornerRadius={28}
                cornerSmoothing={1}
                fillColor={active ? colors.text : colors.surface}
                strokeColor={colors.border}
                strokeWidth={active ? 0 : 1.5}
              >
                <View style={styles.cardContent}>
                  {iconName && (
                    <Ionicons
                      name={iconName as any}
                      size={32}
                      color={active ? colors.bg : colors.textSecondary}
                    />
                  )}
                  <Text style={[styles.label, { color: active ? colors.bg : colors.text }]}>
                    {label}
                  </Text>
                </View>
              </Squircle>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.note, { color: colors.textTertiary }]}>
        zod is designed for man–woman connections. We respect everyone — this focus helps us create the best experience for our community.
      </Text>
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
  label: {
    fontSize: 17,
    fontFamily: 'ProductSans-Bold',
  },
  note: {
    fontSize: 12,
    fontFamily: 'ProductSans-Regular',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 24,
    paddingHorizontal: 8,
  },
});
