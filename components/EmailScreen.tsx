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
import { apiFetch } from '@/constants/api';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EmailScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { token } = useAuth();
  const { next } = useLocalSearchParams<{ next?: string }>();

  const inputRef = useRef<TextInput>(null);
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

  const isValid = EMAIL_REGEX.test(email.trim());
  const error = touched && !isValid ? 'Please enter a valid email address' : null;

  const handleContinue = async () => {
    setTouched(true);
    if (!isValid) return;

    setLoading(true);
    try {
      await apiFetch('/profile/me', {
        method: 'PATCH',
        token: token ?? undefined,
        body: JSON.stringify({ email: email.trim() }),
      });
      router.replace((next ?? '/gender') as any);
    } catch (err: any) {
      Alert.alert('Could not save email', err.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    router.replace((next ?? '/gender') as any);
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
          <Text style={[styles.title, { color: colors.text }]}>What's your{'\n'}email?</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            We'll use this to help you sign in and keep your account secure.
          </Text>

          <Squircle
            style={styles.inputContainer}
            cornerRadius={22}
            cornerSmoothing={1}
            fillColor={error ? colors.errorBg : colors.surface}
            strokeColor={error ? colors.errorBorder : colors.border}
            strokeWidth={1.5}
          >
            <TextInput
              ref={inputRef}
              style={[styles.emailInput, { color: colors.text }]}
              placeholder="yourname@email.com"
              placeholderTextColor={colors.placeholder}
              value={email}
              onChangeText={(t) => { setEmail(t); setTouched(false); }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleContinue}
            />
            {email.length > 0 && (
              <Pressable onPress={() => setEmail('')} hitSlop={8} style={styles.clearBtn}>
                <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
              </Pressable>
            )}
          </Squircle>

          {error && (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle-outline" size={14} color={colors.error} />
              <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <Button
            title={loading ? 'Saving…' : 'Continue'}
            onPress={handleContinue}
            disabled={(touched && !isValid) || loading}
            style={styles.btn}
          />
          <Pressable onPress={handleSkip} style={styles.skipBtn} hitSlop={8}>
            <Text style={[styles.skipText, { color: colors.textSecondary }]}>Skip for now</Text>
          </Pressable>
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
  subtitle: { fontSize: 14, fontFamily: 'ProductSans-Regular', lineHeight: 20, marginBottom: 36 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', height: 64, paddingHorizontal: 20 },
  emailInput: { flex: 1, fontSize: 18, fontFamily: 'ProductSans-Medium', height: '100%', letterSpacing: 0.3 },
  clearBtn: { padding: 4 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  errorText: { fontSize: 13, fontFamily: 'ProductSans-Regular', flex: 1 },
  footer: { paddingHorizontal: 24, paddingBottom: 24, paddingTop: 12, gap: 12 },
  btn: { width: '100%' },
  skipBtn: { alignItems: 'center', paddingVertical: 8 },
  skipText: { fontSize: 14, fontFamily: 'ProductSans-Regular' },
});
