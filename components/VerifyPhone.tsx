import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Button from '@/components/ui/Button';
import Squircle from '@/components/ui/Squircle';
import { authedFetch, apiFetch } from '@/constants/api';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';
import { getDeviceInfo } from '@/utils/deviceInfo';

const OTP_LENGTH = 5;
const RESEND_COUNTDOWN = 30;

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export default function VerifyPhone() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { signIn } = useAuth();
  const { phone, countryCode } = useLocalSearchParams<{ phone: string; countryCode: string }>();

  const inputRef = useRef<TextInput>(null);
  const [code, setCode] = useState('');
  const [focused, setFocused] = useState(true);
  const [countdown, setCountdown] = useState(RESEND_COUNTDOWN);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, OTP_LENGTH);
    setCode(digits);
    setError(null);
    if (digits.length === OTP_LENGTH) {
      inputRef.current?.blur();
      // Auto-submit as soon as the last digit is typed
      setTimeout(() => handleVerifyWithCode(digits), 100);
    }
  };

  const handleVerifyWithCode = async (digits: string) => {
    if (digits.length < OTP_LENGTH) return;
    inputRef.current?.blur();
    setVerifying(true);
    setError(null);

    try {
      const device = await getDeviceInfo();
      const data = await apiFetch<TokenResponse>('/auth/phone/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ phone, code: digits, device }),
      });

      // Fetch onboarding status before saving to context so the auth guard
      // has the correct value the moment the token state updates
      const me = await authedFetch<{ is_onboarded: boolean }>(
        '/profile/me',
        data.access_token,
      );

      // signIn triggers the auth guard; isOnboarded tells it where to route
      await signIn(data.access_token, data.refresh_token, me.is_onboarded);
    } catch (err: any) {
      setError(err.message ?? 'Invalid code. Please try again.');
      setCode('');
      setTimeout(() => inputRef.current?.focus(), 100);
    } finally {
      setVerifying(false);
    }
  };

  const handleVerify = () => handleVerifyWithCode(code);

  const handleResend = async (channel: 'whatsapp' | 'sms') => {
    if (!phone) return;
    setResending(true);
    setCode('');
    setError(null);

    try {
      const device = await getDeviceInfo();
      await apiFetch('/auth/phone/resend-otp', {
        method: 'POST',
        body: JSON.stringify({ phone, channel, device }),
      });
      setCountdown(RESEND_COUNTDOWN);
      setTimeout(() => inputRef.current?.focus(), 100);
    } catch (err: any) {
      Alert.alert('Could not resend', err.message ?? 'Please try again.');
    } finally {
      setResending(false);
    }
  };

  // The phone number passed from PhoneSignIn is already E.164 (e.g. +966583817592)
  // Show it nicely: countryCode + local part
  const displayPhone = phone ?? 'your number';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Squircle style={styles.backBtn} cornerRadius={14} cornerSmoothing={1} fillColor={colors.backBtnBg}>
              <Ionicons name="arrow-back" size={20} color={colors.text} />
            </Squircle>
          </Pressable>
        </View>

        <View style={styles.body}>
          <Text style={[styles.title, { color: colors.text }]}>Check your{'\n'}phone now</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            We sent a 5-digit code to{'\n'}
            <Text style={[styles.phoneHighlight, { color: colors.text }]}>{displayPhone}</Text>
          </Text>
          <Text style={[styles.subheading, { color: colors.textTertiary }]}>
            Enter the code below to verify your number and continue.
          </Text>

          {/* OTP Boxes */}
          <Pressable style={styles.otpRow} onPress={() => inputRef.current?.focus()}>
            {Array.from({ length: OTP_LENGTH }).map((_, i) => {
              const char = code[i] ?? '';
              const isActive = focused && i === Math.min(code.length, OTP_LENGTH - 1);
              const isFilled = !!char;
              const hasError = !!error;
              return (
                <Squircle
                  key={i}
                  style={styles.otpBox}
                  cornerRadius={16}
                  cornerSmoothing={1}
                  fillColor={hasError ? colors.errorBg : isFilled ? colors.surface2 : colors.surface}
                  strokeColor={
                    hasError
                      ? colors.errorBorder
                      : isActive
                      ? colors.borderActive
                      : isFilled
                      ? colors.border
                      : colors.borderFaint
                  }
                  strokeWidth={isActive ? 2 : 1.5}
                >
                  <Text style={[styles.otpDigit, { color: hasError ? colors.error : colors.text }]}>
                    {char}
                  </Text>
                </Squircle>
              );
            })}
          </Pressable>

          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={handleChange}
            keyboardType="number-pad"
            maxLength={OTP_LENGTH}
            style={styles.hiddenInput}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            autoFocus
            caretHidden
          />

          {error && (
            <View style={styles.errorRow}>
              <Ionicons name="warning" size={14} color={colors.error} />
              <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
            </View>
          )}

          <View style={styles.resendSection}>
            {countdown > 0 ? (
              <Text style={[styles.countdownText, { color: colors.countdownText }]}>
                Resend code in{' '}
                <Text style={[styles.countdownNum, { color: colors.text }]}>
                  0:{countdown.toString().padStart(2, '0')}
                </Text>
              </Text>
            ) : (
              <View>
                <Text style={[styles.resendLabel, { color: colors.textSecondary }]}>Didn't receive it?</Text>

                <Pressable
                  style={({ pressed }) => [styles.resendRow, (pressed || resending) && { opacity: 0.6 }]}
                  onPress={() => handleResend('whatsapp')}
                  disabled={resending}
                >
                  <Squircle style={styles.resendIcon} cornerRadius={10} cornerSmoothing={1} fillColor="#25D366">
                    <Ionicons name="logo-whatsapp" size={16} color="#fff" />
                  </Squircle>
                  <Text style={[styles.resendText, { color: colors.text }]}>Get code on WhatsApp</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                </Pressable>

                <View style={[styles.separator, { backgroundColor: colors.borderFaint }]} />

                <Pressable
                  style={({ pressed }) => [styles.resendRow, (pressed || resending) && { opacity: 0.6 }]}
                  onPress={() => handleResend('sms')}
                  disabled={resending}
                >
                  <Squircle style={styles.resendIcon} cornerRadius={10} cornerSmoothing={1} fillColor={colors.resendIconBg}>
                    <Ionicons name="refresh" size={16} color={colors.text} />
                  </Squircle>
                  <Text style={[styles.resendText, { color: colors.text }]}>Resend OTP via SMS</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                </Pressable>

                <View style={[styles.separator, { backgroundColor: colors.borderFaint }]} />

                <Pressable
                  style={({ pressed }) => [styles.resendRow, (pressed || resending) && { opacity: 0.6 }]}
                  onPress={() => handleResend('sms')}
                  disabled={resending}
                >
                  <Squircle style={styles.resendIcon} cornerRadius={10} cornerSmoothing={1} fillColor={colors.resendIconBg}>
                    <Ionicons name="chatbubble-ellipses" size={16} color={colors.text} />
                  </Squircle>
                  <Text style={[styles.resendText, { color: colors.text }]}>Send new SMS</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                </Pressable>
              </View>
            )}
          </View>
        </View>

        <View style={styles.footer}>
          <Button
            title={verifying ? 'Verifying…' : 'Verify'}
            onPress={handleVerify}
            disabled={code.length < OTP_LENGTH || verifying}
            style={styles.btn}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  topBar: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 32 },
  title: { fontSize: 36, fontFamily: 'ProductSans-Black', lineHeight: 42, marginBottom: 12 },
  subtitle: { fontSize: 14, fontFamily: 'ProductSans-Regular', lineHeight: 22, marginBottom: 10 },
  phoneHighlight: { fontFamily: 'ProductSans-Medium' },
  subheading: { fontSize: 13, fontFamily: 'ProductSans-Regular', lineHeight: 20, marginBottom: 36 },
  otpRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  otpBox: { flex: 1, height: 64, alignItems: 'center', justifyContent: 'center' },
  otpDigit: { fontSize: 24, fontFamily: 'ProductSans-Bold' },
  hiddenInput: { position: 'absolute', opacity: 0, width: 0, height: 0 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, marginBottom: 4 },
  errorText: { fontSize: 13, fontFamily: 'ProductSans-Regular', flex: 1 },
  resendSection: { marginTop: 32 },
  countdownText: { fontSize: 14, fontFamily: 'ProductSans-Regular', textAlign: 'center' },
  countdownNum: { fontFamily: 'ProductSans-Bold' },
  resendLabel: { fontSize: 13, fontFamily: 'ProductSans-Regular', marginBottom: 16 },
  resendRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  resendIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  resendText: { flex: 1, fontSize: 15, fontFamily: 'ProductSans-Medium' },
  separator: { height: 1, marginLeft: 50 },
  footer: { paddingHorizontal: 24, paddingBottom: 24, paddingTop: 12 },
  btn: { width: '100%' },
});
