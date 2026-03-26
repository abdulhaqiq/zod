import { navPush, navReplace } from '@/utils/nav';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import Button from '@/components/ui/Button';
import Squircle from '@/components/ui/Squircle';
import { useAppTheme } from '@/context/ThemeContext';

type Gender = 'male' | 'female' | null;

export default function AboutYou() {
  const router = useRouter();
  const { colors } = useAppTheme();

  const [gender, setGender] = useState<Gender>(null);
  const [touched, setTouched] = useState(false);

  const error = touched && !gender ? 'Please select your gender' : null;

  const handleContinue = () => {
    setTouched(true);
    if (!gender) return;
    navPush('/purpose');
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      {/* Back */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Squircle style={styles.backBtn} cornerRadius={14} cornerSmoothing={1} fillColor={colors.backBtnBg}>
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </Squircle>
        </Pressable>
      </View>

      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.text }]}>I am a…</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          This helps us personalise your experience.
        </Text>

        <View style={styles.genderRow}>
          {(['male', 'female'] as Gender[]).map((g) => {
            const selected = gender === g;
            return (
              <Pressable key={g} style={styles.card} onPress={() => setGender(g)}>
                <Squircle
                  style={styles.cardInner}
                  cornerRadius={22}
                  cornerSmoothing={1}
                  fillColor={selected ? colors.btnPrimaryBg : colors.surface}
                  strokeColor={selected ? colors.btnPrimaryBg : error ? colors.errorBorder : colors.border}
                  strokeWidth={selected ? 0 : 1.5}
                >
                  <Squircle
                    style={styles.iconCircle}
                    cornerRadius={16}
                    cornerSmoothing={1}
                    fillColor={selected ? `${colors.btnPrimaryText}18` : colors.surface2}
                  >
                    <Ionicons
                      name={g === 'male' ? 'male' : 'female' as any}
                      size={32}
                      color={selected ? colors.btnPrimaryText : colors.textSecondary}
                    />
                  </Squircle>
                  <Text style={[styles.cardLabel, { color: selected ? colors.btnPrimaryText : colors.text }, selected && styles.cardLabelSelected]}>
                    {g === 'male' ? 'Male' : 'Female'}
                  </Text>
                </Squircle>
              </Pressable>
            );
          })}
        </View>

        {error && (
          <View style={styles.errorRow}>
            <Ionicons name="warning" size={13} color={colors.error} />
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <Button title="Continue" onPress={handleContinue} disabled={touched && !gender} style={styles.btn} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 32 },
  title: { fontSize: 42, fontFamily: 'ProductSans-Black', lineHeight: 48, marginBottom: 10 },
  subtitle: { fontSize: 14, fontFamily: 'ProductSans-Regular', lineHeight: 21, marginBottom: 40 },
  genderRow: { flexDirection: 'row', gap: 14 },
  card: { flex: 1 },
  cardInner: { height: 140, alignItems: 'center', justifyContent: 'center', gap: 12 },
  iconCircle: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center' },
  cardLabel: { fontSize: 16, fontFamily: 'ProductSans-Medium' },
  cardLabelSelected: { fontFamily: 'ProductSans-Bold' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 16 },
  errorText: { fontSize: 12, fontFamily: 'ProductSans-Regular' },
  footer: { paddingHorizontal: 24, paddingBottom: 24, paddingTop: 12 },
  btn: { width: '100%' },
});
