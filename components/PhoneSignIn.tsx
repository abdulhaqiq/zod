import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Button from '@/components/ui/Button';
import Squircle from '@/components/ui/Squircle';
import CountryPicker from '@/components/CountryPicker';
import { COUNTRIES, type Country } from '@/constants/countries';
import { apiFetch, authedFetch } from '@/constants/api';
import { useAuth, loadRecentAccount, saveRecentAccount } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';
import { getDeviceInfo } from '@/utils/deviceInfo';

const US = COUNTRIES[0];
const OTP_LENGTH = 5;
const RESEND_COUNTDOWN = 30;

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  is_new_user?: boolean;
}

async function detectCountryByIP(): Promise<Country> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch('https://api.country.is/', { signal: controller.signal });
    if (!res.ok) throw new Error('non-200');
    const data: { country: string } = await res.json();
    const iso = data.country?.toUpperCase();
    const match = COUNTRIES.find((c) => c.iso === iso);
    return match ?? US;
  } catch {
    return US;
  } finally {
    clearTimeout(timer);
  }
}

function formatPhone(raw: string, country: Country): string {
  const digits = raw.replace(/\D/g, '');
  if (country.code === '+1') {
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  }
  return digits;
}

function getDigits(raw: string): string {
  return raw.replace(/\D/g, '');
}

function validatePhone(digits: string, country: Country): string | null {
  if (digits.length === 0) return 'Please enter your phone number';
  if (digits.length < country.minLen)
    return `Phone number must be at least ${country.minLen} digits for ${country.name}`;
  return null;
}

export default function PhoneSignIn() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { signIn, token: authToken } = useAuth();
  const params = useLocalSearchParams<{ phone?: string; mode?: string; next?: string }>();

  // ── Phase state ───────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<'phone' | 'otp'>('phone');

  // ── Phone phase ───────────────────────────────────────────────────────────
  const phoneInputRef = useRef<TextInput>(null);
  const [country, setCountry] = useState<Country>(US);
  const [phone, setPhone] = useState(() => {
    if (!params.phone) return '';
    return params.phone.replace(/^\+\d{1,3}\s?/, '');
  });
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [e164, setE164] = useState('');

  // ── OTP phase ─────────────────────────────────────────────────────────────
  const otpInputRef = useRef<TextInput>(null);
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_COUNTDOWN);

  // ── Country detection ─────────────────────────────────────────────────────
  useEffect(() => {
    if (params.phone) {
      const match = params.phone.match(/^(\+\d{1,4})/);
      if (match) {
        const code = match[1];
        const found = COUNTRIES.find(c => c.code === code);
        if (found) { setCountry(found); return; }
      }
    }
    let cancelled = false;
    detectCountryByIP().then((c) => { if (!cancelled) setCountry(c); });
    return () => { cancelled = true; };
  }, []);

  // ── Countdown timer for resend ────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'otp' || countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  // ── Phone validation ──────────────────────────────────────────────────────
  const digits = getDigits(phone);
  const phoneError = phoneTouched ? validatePhone(digits, country) : null;
  const isPhoneValid = validatePhone(digits, country) === null;

  const handlePhoneChange = (text: string) => {
    const raw = getDigits(text);
    const capped = raw.slice(0, country.minLen + 2);
    setPhone(formatPhone(capped, country));
  };

  const handleCountrySelect = (c: Country) => {
    setCountry(c);
    setPhone('');
    setPhoneTouched(false);
    setTimeout(() => phoneInputRef.current?.focus(), 300);
  };

  // ── Send OTP ──────────────────────────────────────────────────────────────
  const sendOtp = async (phoneE164: string, channel: 'sms' | 'whatsapp' = 'sms') => {
    const device = await getDeviceInfo();
    await apiFetch('/auth/phone/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phone: phoneE164, channel, device }),
    });
  };

  const handleSendCode = async () => {
    setPhoneTouched(true);
    if (!isPhoneValid) return;

    const fullE164 = `${country.code}${digits}`;
    setSendLoading(true);
    try {
      await sendOtp(fullE164);
      setE164(fullE164);
      setOtp('');
      setOtpError(null);
      setCountdown(RESEND_COUNTDOWN);
      setPhase('otp');
      setTimeout(() => otpInputRef.current?.focus(), 300);
    } catch (err: any) {
      Alert.alert('Could not send OTP', err.message ?? 'Please try again.');
    } finally {
      setSendLoading(false);
    }
  };

  // ── OTP change / auto-submit ──────────────────────────────────────────────
  const handleOtpChange = (text: string) => {
    const d = text.replace(/\D/g, '').slice(0, OTP_LENGTH);
    setOtp(d);
    setOtpError(null);
    if (d.length === OTP_LENGTH) {
      otpInputRef.current?.blur();
      setTimeout(() => handleVerify(d), 100);
    }
  };

  // ── Verify OTP ────────────────────────────────────────────────────────────
  const handleVerify = async (code: string) => {
    if (code.length < OTP_LENGTH) return;
    setVerifying(true);
    setOtpError(null);

    // Link mode: attaching phone to an existing social account
    if (params.mode === 'link') {
      try {
        await apiFetch('/auth/phone/link', {
          method: 'POST',
          token: authToken ?? undefined,
          body: JSON.stringify({ phone: e164, code }),
        });
        router.replace((params.next ?? '/gender') as any);
      } catch (err: any) {
        setOtpError(err.message ?? 'Verification failed. Please try again.');
        setOtp('');
        setTimeout(() => otpInputRef.current?.focus(), 100);
      } finally {
        setVerifying(false);
      }
      return;
    }

    // Normal sign-in / sign-up
    try {
      const device = await getDeviceInfo();
      const data = await apiFetch<TokenResponse>('/auth/phone/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ phone: e164, code, device }),
      });

      const me = await authedFetch<{
        is_onboarded: boolean;
        full_name?: string | null;
        phone?: string | null;
        email?: string | null;
        photos?: string[] | null;
      }>('/profile/me', data.access_token);

      // signIn updates context → _layout.tsx routing guard handles navigation.
      // Do NOT also call router.replace here — that causes a double-mount of the feed.
      await signIn(data.access_token, data.refresh_token, me.is_onboarded, 'phone');

      const dest = me.is_onboarded ? '/(tabs)' : '/gender';
      const isNew = data.is_new_user && !me.email;

      if (isNew) {
        // Guard won't know to go to /email — navigate explicitly
        router.replace({ pathname: '/email' as any, params: { next: dest } });
        return;
      }

      const existing = await loadRecentAccount();
      const isSameUser = existing?.phone != null && existing.phone === (me.phone ?? null);

      if (existing && isSameUser) {
        // Guard handles routing
        return;
      } else if (existing && !isSameUser) {
        await saveRecentAccount({
          name:   me.full_name   ?? null,
          phone:  me.phone       ?? null,
          photo:  me.photos?.[0] ?? null,
          method: 'phone',
        });
        // Guard handles routing
        return;
      } else {
        // First time on this device — show passkey prompt
        router.push({
          pathname: '/passkey' as any,
          params: {
            name:   me.full_name   ?? '',
            phone:  me.phone       ?? '',
            photo:  me.photos?.[0] ?? '',
            method: 'phone',
            next:   dest,
          },
        });
      }
    } catch (err: any) {
      setOtpError(err.message ?? 'Invalid code. Please try again.');
      setOtp('');
      setTimeout(() => otpInputRef.current?.focus(), 100);
    } finally {
      setVerifying(false);
    }
  };

  // ── Resend ────────────────────────────────────────────────────────────────
  const handleResend = async (channel: 'sms' | 'whatsapp') => {
    if (!e164) return;
    setResending(true);
    setOtp('');
    setOtpError(null);
    try {
      await sendOtp(e164, channel);
      setCountdown(RESEND_COUNTDOWN);
      setTimeout(() => otpInputRef.current?.focus(), 100);
    } catch (err: any) {
      Alert.alert('Could not resend', err.message ?? 'Please try again.');
    } finally {
      setResending(false);
    }
  };

  // ── OTP box rendering ─────────────────────────────────────────────────────
  const renderOtpBoxes = () =>
    Array.from({ length: OTP_LENGTH }).map((_, i) => {
      const char = otp[i] ?? '';
      const isActive = otp.length === i;
      return (
        <Squircle
          key={i}
          style={styles.otpBox}
          cornerRadius={16}
          cornerSmoothing={1}
          fillColor={colors.surface}
          strokeColor={otpError ? colors.errorBorder : isActive ? colors.text : colors.border}
          strokeWidth={isActive ? 2 : 1.5}
        >
          <Text style={[styles.otpChar, { color: colors.text }]}>{char}</Text>
        </Squircle>
      );
    });

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.topBar}>
          <Pressable
            onPress={() => {
              if (phase === 'otp') { setPhase('phone'); setOtp(''); setOtpError(null); }
              else router.back();
            }}
            hitSlop={12}
          >
            <Squircle style={styles.backBtn} cornerRadius={14} cornerSmoothing={1} fillColor={colors.backBtnBg}>
              <Ionicons name="arrow-back" size={20} color={colors.text} />
            </Squircle>
          </Pressable>
        </View>

        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {phase === 'phone' ? (
            <>
              <Text style={[styles.title, { color: colors.text }]}>What's your{'\n'}number?</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                We'll send a verification code. Standard SMS rates may apply.
              </Text>

              <Squircle
                style={styles.inputContainer}
                cornerRadius={22}
                cornerSmoothing={1}
                fillColor={phoneError ? colors.errorBg : colors.surface}
                strokeColor={phoneError ? colors.errorBorder : colors.border}
                strokeWidth={1.5}
              >
                <Pressable
                  onPress={() => setModalVisible(true)}
                  style={({ pressed }) => [styles.countryPicker, pressed && { opacity: 0.6 }]}
                >
                  <Text style={styles.flag}>{country.flag}</Text>
                  <Text style={[styles.countryCode, { color: colors.text }]}>{country.code}</Text>
                  <Ionicons name="chevron-down" size={14} color={colors.textTertiary} />
                </Pressable>

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                <TextInput
                  ref={phoneInputRef}
                  style={[styles.phoneInput, { color: colors.text }]}
                  placeholder={country.code === '+1' ? '(000) 000-0000' : '000 000 0000'}
                  placeholderTextColor={colors.placeholder}
                  value={phone}
                  onChangeText={handlePhoneChange}
                  keyboardType="phone-pad"
                  onBlur={() => setPhoneTouched(true)}
                  selectionColor={colors.text}
                  autoFocus
                />

                {phone.length > 0 && (
                  <Pressable
                    onPress={() => { setPhone(''); setPhoneTouched(false); phoneInputRef.current?.focus(); }}
                    style={styles.clearBtn}
                    hitSlop={8}
                  >
                    <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                  </Pressable>
                )}
              </Squircle>

              {phoneError ? (
                <View style={styles.errorRow}>
                  <Ionicons name="warning" size={14} color={colors.error} />
                  <Text style={[styles.errorText, { color: colors.error }]}>{phoneError}</Text>
                </View>
              ) : (
                <Text style={[styles.hint, { color: colors.textTertiary }]}>
                  We only use this to verify your identity. Your number is never shown to others.
                </Text>
              )}
            </>
          ) : (
            <>
              <Text style={[styles.title, { color: colors.text }]}>Enter the{'\n'}code</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Sent to {e164}
                {'  '}
                <Text
                  style={{ color: colors.primary, fontFamily: 'ProductSans-Medium' }}
                  onPress={() => { setPhase('phone'); setOtp(''); setOtpError(null); }}
                >
                  Edit
                </Text>
              </Text>

              {/* Hidden text input captures keyboard */}
              <TextInput
                ref={otpInputRef}
                value={otp}
                onChangeText={handleOtpChange}
                keyboardType="number-pad"
                maxLength={OTP_LENGTH}
                style={styles.hiddenInput}
                autoFocus
                caretHidden
              />

              {/* Visual OTP boxes */}
              <Pressable onPress={() => otpInputRef.current?.focus()}>
                <View style={styles.otpRow}>{renderOtpBoxes()}</View>
              </Pressable>

              {otpError && (
                <View style={[styles.errorRow, { marginTop: 16 }]}>
                  <Ionicons name="alert-circle-outline" size={14} color={colors.error} />
                  <Text style={[styles.errorText, { color: colors.error }]}>{otpError}</Text>
                </View>
              )}

              {verifying && (
                <View style={styles.verifyingRow}>
                  <ActivityIndicator size="small" color={colors.textSecondary} />
                  <Text style={[styles.verifyingText, { color: colors.textSecondary }]}>Verifying…</Text>
                </View>
              )}

              <View style={styles.resendRow}>
                {countdown > 0 ? (
                  <Text style={[styles.resendCountdown, { color: colors.textTertiary }]}>
                    Resend in {countdown}s
                  </Text>
                ) : resending ? (
                  <ActivityIndicator size="small" color={colors.textSecondary} />
                ) : (
                  <>
                    <Pressable onPress={() => handleResend('sms')} hitSlop={8}>
                      <Text style={[styles.resendLink, { color: colors.primary }]}>Resend SMS</Text>
                    </Pressable>
                    <Text style={[styles.resendDot, { color: colors.textTertiary }]}> · </Text>
                    <Pressable onPress={() => handleResend('whatsapp')} hitSlop={8}>
                      <Text style={[styles.resendLink, { color: colors.primary }]}>WhatsApp</Text>
                    </Pressable>
                  </>
                )}
              </View>
            </>
          )}
        </ScrollView>

        {phase === 'phone' && (
          <View style={styles.footer}>
            <Button
              title={sendLoading ? 'Sending code…' : 'Get verification code'}
              onPress={handleSendCode}
              disabled={(phoneTouched && !isPhoneValid) || sendLoading}
              style={styles.btn}
            />
          </View>
        )}

        <CountryPicker
          visible={modalVisible}
          selected={country}
          onSelect={handleCountrySelect}
          onClose={() => setModalVisible(false)}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  topBar: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 24 },
  title: { fontSize: 36, fontFamily: 'ProductSans-Black', lineHeight: 42, marginBottom: 12 },
  subtitle: { fontSize: 14, fontFamily: 'ProductSans-Regular', lineHeight: 20, marginBottom: 36 },
  // phone phase
  inputContainer: { flexDirection: 'row', alignItems: 'center', height: 64, paddingHorizontal: 16 },
  countryPicker: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 4 },
  flag: { fontSize: 22 },
  countryCode: { fontSize: 15, fontFamily: 'ProductSans-Medium' },
  divider: { width: 1, height: 28, marginHorizontal: 14 },
  phoneInput: { flex: 1, fontSize: 18, fontFamily: 'ProductSans-Medium', height: '100%', letterSpacing: 0.5 },
  clearBtn: { padding: 4 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  errorText: { fontSize: 13, fontFamily: 'ProductSans-Regular', flex: 1 },
  hint: { fontSize: 12, fontFamily: 'ProductSans-Regular', marginTop: 12, lineHeight: 18 },
  // otp phase
  hiddenInput: { position: 'absolute', opacity: 0, height: 0, width: 0 },
  otpRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  otpBox: { flex: 1, height: 64, alignItems: 'center', justifyContent: 'center' },
  otpChar: { fontSize: 26, fontFamily: 'ProductSans-Black' },
  verifyingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20 },
  verifyingText: { fontSize: 14, fontFamily: 'ProductSans-Regular' },
  resendRow: { flexDirection: 'row', alignItems: 'center', marginTop: 24 },
  resendCountdown: { fontSize: 14, fontFamily: 'ProductSans-Regular' },
  resendLink: { fontSize: 14, fontFamily: 'ProductSans-Medium' },
  resendDot: { fontSize: 14 },
  // footer
  footer: { paddingHorizontal: 24, paddingBottom: 24, paddingTop: 12 },
  btn: { width: '100%' },
});
