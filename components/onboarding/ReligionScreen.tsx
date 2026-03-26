import { navPush } from '@/utils/nav';
// Step 11 — Religion (optional)
// If Muslim selected: shows Halal mode toggle inline.
//   Muslim + Halal ON  → /faith
//   Muslim + Halal OFF → finish onboarding (skip /faith)
// Non-Muslim → finish onboarding
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';
import { useLookupsCategory } from '@/hooks/useLookups';
import { useProfileSave } from '@/hooks/useProfileSave';
import Squircle from '@/components/ui/Squircle';
import OnboardingShell from './OnboardingShell';

const MUSLIM_ID = 49;

export default function ReligionScreen() {
  const { colors } = useAppTheme();
  const { save, saving } = useProfileSave();
  const { profile, setOnboarded } = useAuth();
  const options = useLookupsCategory('religion');

  const [selected, setSelected] = useState<number | null>(profile?.religion_id ?? null);
  const [halalMode, setHalalMode] = useState(profile?.halal_mode_enabled ?? true);

  const isMuslim = selected === MUSLIM_ID;

  const finish = async (religionId: number | null) => {
    const fields: Record<string, unknown> = {};
    if (religionId !== null) fields.religion_id = religionId;

    const muslim = religionId === MUSLIM_ID;

    if (muslim) {
      fields.halal_mode_enabled = halalMode;
    } else {
      fields.is_onboarded = true;
    }

    const ok = await save(fields);
    if (!ok) return;

    if (muslim && halalMode) {
      navPush('/faith');
    } else if (muslim && !halalMode) {
      // Muslim but halal mode off — no need for faith details
      await save({ is_onboarded: true });
      await setOnboarded();
    } else {
      await setOnboarded();
    }
  };

  const handleContinue = () => finish(selected);
  const handleSkip = () => finish(null);

  return (
    <OnboardingShell
      step={11}
      totalSteps={11}
      title="What's your religion?"
      subtitle="This helps us personalise your experience."
      onContinue={handleContinue}
      continueDisabled={selected === null}
      continueLabel="Continue"
      loading={saving}
      onSkip={handleSkip}
      fallbackHref="/photos"
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.chips}>
          {options.map((opt) => {
            const active = selected === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => setSelected(active ? null : opt.id)}
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
        </View>

        {isMuslim && (
          <Squircle
            style={styles.halalRow}
            fillColor={colors.surface}
            strokeColor={colors.border}
            strokeWidth={1.5}
            cornerRadius={20}
          >
            <View style={styles.halalText}>
              <Text style={[styles.halalTitle, { color: colors.text }]}>Enable Halal mode</Text>
              <Text style={[styles.halalDesc, { color: colors.textSecondary }]}>
                Only appear to and see other Halal mode users.
              </Text>
            </View>
            <Switch
              value={halalMode}
              onValueChange={setHalalMode}
              trackColor={{ false: colors.border, true: colors.text }}
              thumbColor={colors.bg}
            />
          </Squircle>
        )}
      </ScrollView>
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
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 100,
    borderWidth: 1.5,
  },
  chipText: {
    fontSize: 15,
    fontFamily: 'ProductSans-Medium',
  },
  halalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    marginTop: 24,
    marginBottom: 8,
  },
  halalText:  { flex: 1, marginRight: 12 },
  halalTitle: { fontSize: 15, fontFamily: 'ProductSans-Bold', marginBottom: 2 },
  halalDesc:  { fontSize: 13, fontFamily: 'ProductSans-Regular', lineHeight: 18 },
});
