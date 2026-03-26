/**
 * Shared shell for all onboarding screens.
 * Provides: back button, step progress bar, title/subtitle, content area, Continue button.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Alert, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import Button from '@/components/ui/Button';
import NoNetworkOverlay from '@/components/ui/NoNetworkOverlay';
import Squircle from '@/components/ui/Squircle';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';

// Muslim religion lookup ID (from lookup_options table, category='religion')
const MUSLIM_RELIGION_ID = 49;

interface Props {
  step: number;           // 1-based
  /** Override total step count shown in the badge. Auto-detected if omitted. */
  totalSteps?: number;
  title: string;
  subtitle?: string;
  onContinue: () => void;
  /** Label for the primary action button. Defaults to "Continue". */
  continueLabel?: string;
  continueDisabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
  hideBack?: boolean;
  /** When true, the footer button rises above the keyboard */
  keyboardAvoiding?: boolean;
  /** When true, renders a full-screen NoNetworkOverlay over all content */
  networkError?: boolean;
  /** Called when the user taps "Try Again" on the NoNetworkOverlay */
  onRetryNetwork?: () => void;
  /** When true, the body content scrolls so the footer button always stays visible */
  scrollable?: boolean;
  /** When provided, renders a "Skip" link above the footer button */
  onSkip?: () => void;
  /** Fallback route to navigate to when there is no previous screen to go back to */
  fallbackHref?: string;
}

export default function OnboardingShell({
  step,
  totalSteps: totalStepsProp,
  title,
  subtitle,
  onContinue,
  continueLabel,
  continueDisabled,
  loading,
  children,
  hideBack,
  keyboardAvoiding,
  networkError,
  onRetryNetwork,
  scrollable,
  onSkip,
  fallbackHref,
}: Props) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { signOut, profile } = useAuth();

  // Auto-detect whether the user is Muslim to show the correct total step count.
  // Muslims have an extra "Your faith" step (12 total vs 11 for everyone else).
  const isMuslim = profile?.religion_id === MUSLIM_RELIGION_ID;
  const TOTAL_STEPS = totalStepsProp ?? (isMuslim ? 12 : 11);

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  const inner = (
    <>
      {/* Top bar */}
      <View style={styles.topBar}>
        {!hideBack && (
          <Pressable
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else if (fallbackHref) {
                router.replace(fallbackHref as any);
              }
            }}
            hitSlop={12}
          >
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
        <View style={[styles.stepBadge, { backgroundColor: colors.surface2 }]}>
          <Text style={[styles.stepText, { color: colors.textSecondary }]}>
            {step} / {TOTAL_STEPS}
          </Text>
        </View>
        <View style={{ flex: 1 }} />
        <Pressable onPress={handleLogout} hitSlop={12}>
          <Text style={[styles.logoutText, { color: colors.textSecondary }]}>Log out</Text>
        </Pressable>
      </View>

      {/* Body */}
      {scrollable ? (
        <ScrollView
          style={styles.bodyScroll}
          contentContainerStyle={styles.bodyScrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
          ) : null}
          {children}
        </ScrollView>
      ) : (
        <View style={styles.body}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
          ) : null}
          {children}
        </View>
      )}

      {/* Footer */}
      <View style={[styles.footer, { backgroundColor: colors.bg }]}>
        <Button
          title={loading ? 'Saving…' : (continueLabel ?? 'Continue')}
          onPress={onContinue}
          disabled={continueDisabled || loading}
          style={styles.btn}
        />
        {onSkip && (
          <Pressable onPress={onSkip} style={styles.skipBtn} hitSlop={12}>
            <Text style={[styles.skipText, { color: colors.textSecondary }]}>Skip for now</Text>
          </Pressable>
        )}
      </View>
    </>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      {keyboardAvoiding ? (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          {inner}
        </KeyboardAvoidingView>
      ) : (
        <View style={{ flex: 1 }}>
          {inner}
        </View>
      )}

      {networkError && onRetryNetwork && (
        <NoNetworkOverlay onRetry={onRetryNetwork} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  stepBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20 },
  stepText: { fontSize: 11, fontFamily: 'ProductSans-Medium', letterSpacing: 0.3 },
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  bodyScroll: { flex: 1 },
  bodyScrollContent: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24 },
  title: { fontSize: 32, fontFamily: 'ProductSans-Black', lineHeight: 38, marginBottom: 10 },
  subtitle: { fontSize: 14, fontFamily: 'ProductSans-Regular', lineHeight: 22, marginBottom: 32 },
  footer: { paddingHorizontal: 24, paddingBottom: 24, paddingTop: 12 },
  skipBtn: { alignItems: 'center', paddingTop: 14 },
  skipText: { fontSize: 14, fontFamily: 'ProductSans-Medium' },
  btn: { width: '100%' },
  logoutText: { fontSize: 13, fontFamily: 'ProductSans-Medium' },
});
