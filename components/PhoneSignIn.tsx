import { navPush, navReplace } from '@/utils/nav';
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
import CountryPicker from '@/components/CountryPicker';
import { COUNTRIES, type Country } from '@/constants/countries';
import { apiFetch } from '@/constants/api';
import { useAppTheme } from '@/context/ThemeContext';
import { getDeviceInfo } from '@/utils/deviceInfo';

const US = COUNTRIES[0];

/**
 * Detect the user's country via IP geolocation — the same approach used by
 * WhatsApp, Telegram and every major app. Returns the matching Country or US.
 */
async function detectCountryByIP(): Promise<Country> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000); // 4 s timeout
  try {
    // api.country.is is purpose-built, tiny, and returns only { ip, country }
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

function validate(digits: string, country: Country): string | null {
  if (digits.length === 0) return 'Please enter your phone number';
  if (digits.length < country.minLen)
    return `Phone number must be ${country.minLen} digits for ${country.name}`;
  return null;
}

export default function PhoneSignIn() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const inputRef = useRef<TextInput>(null);
  const params = useLocalSearchParams<{ phone?: string }>();

  const [country, setCountry] = useState<Country>(US);

  // Detect country from IP in the background — fast (< 1 s on good network),
  // accurate, and requires no permissions. Falls back to US on timeout/error.
  // Skip IP detection if the user came from the recent-account quick sign-in
  // (we already know their country code from the stored phone number).
  useEffect(() => {
    if (params.phone) {
      // Try to extract the country code from the E.164 number and match it
      const match = params.phone.match(/^(\+\d{1,4})/);
      if (match) {
        const code = match[1];
        const found = COUNTRIES.find(c => c.code === code);
        if (found) { setCountry(found); return; }
      }
    }
    let cancelled = false;
    detectCountryByIP().then((c) => {
      if (!cancelled) setCountry(c);
    });
    return () => { cancelled = true; };
  }, []);

  // Pre-fill phone number if navigated from the recent-account quick sign-in
  const [phone, setPhone] = useState(() => {
    if (!params.phone) return '';
    // Strip the country code prefix if present (e.g. "+44 7700..." → "7700...")
    const raw = params.phone.replace(/^\+\d{1,3}\s?/, '');
    return raw;
  });
  const [touched, setTouched] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const digits = getDigits(phone);
  const error = touched ? validate(digits, country) : null;
  const isValid = validate(digits, country) === null;

  const handleChange = (text: string) => {
    const raw = getDigits(text);
    const capped = raw.slice(0, country.minLen + 2);
    setPhone(formatPhone(capped, country));
  };

  const handleCountrySelect = (c: Country) => {
    setCountry(c);
    setPhone('');
    setTouched(false);
    setTimeout(() => inputRef.current?.focus(), 300);
  };

  const handleContinue = async () => {
    setTouched(true);
    if (!isValid) return;

    // Build E.164 phone number: country code + digits only
    const e164 = `${country.code}${digits}`;

    setLoading(true);
    try {
      const device = await getDeviceInfo();
      await apiFetch('/auth/phone/send-otp', {
        method: 'POST',
        body: JSON.stringify({ phone: e164, channel: 'sms', device }),
      });
      navPush({ pathname: '/otp', params: { phone: e164, countryCode: country.code } });
    } catch (err: any) {
      Alert.alert('Could not send OTP', err.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.topBar}>
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
        </View>

        <View style={styles.body}>
          <Text style={[styles.title, { color: colors.text }]}>What's your{'\n'}number?</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            We'll send a verification code. Standard SMS rates may apply.
          </Text>

          <Squircle
            style={styles.inputContainer}
            cornerRadius={22}
            cornerSmoothing={1}
            fillColor={error ? colors.errorBg : colors.surface}
            strokeColor={error ? colors.errorBorder : colors.border}
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
              ref={inputRef}
              style={[styles.phoneInput, { color: colors.text }]}
              placeholder={country.code === '+1' ? '(000) 000-0000' : '000 000 0000'}
              placeholderTextColor={colors.placeholder}
              value={phone}
              onChangeText={handleChange}
              keyboardType="phone-pad"
              onBlur={() => setTouched(true)}
              selectionColor={colors.text}
              autoFocus
            />

            {phone.length > 0 && (
              <Pressable
                onPress={() => { setPhone(''); setTouched(false); inputRef.current?.focus(); }}
                style={styles.clearBtn}
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
              </Pressable>
            )}
          </Squircle>

          {error ? (
            <View style={styles.errorRow}>
              <Ionicons name="warning" size={14} color={colors.error} />
              <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
            </View>
          ) : (
            <Text style={[styles.hint, { color: colors.textTertiary }]}>
              We only use this to verify your identity. Your number is never shown to others.
            </Text>
          )}
        </View>

        <View style={styles.footer}>
          <Button
            title={loading ? 'Sending code…' : 'Continue'}
            onPress={handleContinue}
            disabled={(touched && !isValid) || loading}
            style={styles.btn}
          />
        </View>

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
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 32 },
  title: { fontSize: 36, fontFamily: 'ProductSans-Black', lineHeight: 42, marginBottom: 12 },
  subtitle: { fontSize: 14, fontFamily: 'ProductSans-Regular', lineHeight: 20, marginBottom: 36 },
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
  footer: { paddingHorizontal: 24, paddingBottom: 24, paddingTop: 12 },
  btn: { width: '100%' },
});
