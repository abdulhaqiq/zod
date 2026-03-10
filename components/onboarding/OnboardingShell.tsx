/**
 * Shared shell for all onboarding screens.
 * Provides: back button, step progress bar, title/subtitle, content area, Continue button.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import Button from '@/components/ui/Button';
import Squircle from '@/components/ui/Squircle';
import { useAppTheme } from '@/context/ThemeContext';

interface Props {
  step: number;           // 1-based
  title: string;
  subtitle?: string;
  onContinue: () => void;
  continueDisabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
  hideBack?: boolean;
}

export default function OnboardingShell({
  step,
  title,
  subtitle,
  onContinue,
  continueDisabled,
  loading,
  children,
  hideBack,
}: Props) {
  const router = useRouter();
  const { colors } = useAppTheme();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        {!hideBack && (
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Squircle
              style={styles.backBtn}
              cornerRadius={14}
              cornerSmoothing={1}
              fillColor={colors.backBtnBg}
            >
              <Ionicons name="arrow-back" size={20} color={colors.text} />
            </Squircle>
          </Pressable>
        )}
      </View>

      {/* Body */}
      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
        ) : null}
        {children}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Button
          title={loading ? 'Saving…' : 'Continue'}
          onPress={onContinue}
          disabled={continueDisabled || loading}
          style={styles.btn}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  title: { fontSize: 32, fontFamily: 'ProductSans-Black', lineHeight: 38, marginBottom: 10 },
  subtitle: { fontSize: 14, fontFamily: 'ProductSans-Regular', lineHeight: 22, marginBottom: 32 },
  footer: { paddingHorizontal: 24, paddingBottom: 24, paddingTop: 12 },
  btn: { width: '100%' },
});
