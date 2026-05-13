import { navPush, navReplace } from '@/utils/nav';
// Step 1 — Full name + email + date of birth
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Squircle from '@/components/ui/Squircle';
import { API_V1 } from '@/constants/api';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';
import { useProfileSave } from '@/hooks/useProfileSave';
import OnboardingShell from './OnboardingShell';

// Maximum selectable DOB = 18 years ago from today
const MAX_DOB = (() => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d;
})();

const DEFAULT_PICKER_DATE = MAX_DOB;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseDob(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const { save, saving, networkError, clearNetworkError } = useProfileSave();
  const [emailNetworkError, setEmailNetworkError] = useState(false);

  const anyNetworkError = networkError || emailNetworkError;
  const clearAllNetworkErrors = () => {
    clearNetworkError();
    setEmailNetworkError(false);
  };
  const { profile } = useAuth();

  // Email is locked when it came from a social sign-in (Google or Apple)
  const emailFromSocial = !!(profile?.email && (profile?.apple_id || profile?.google_id));
  const socialProvider = profile?.google_id ? 'Google' : 'Apple';

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [email, setEmail] = useState(profile?.email ?? '');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);

  const existingDob = parseDob(profile?.date_of_birth);
  const [dob, setDob] = useState<Date | null>(existingDob);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerTemp, setPickerTemp] = useState<Date>(existingDob ?? DEFAULT_PICKER_DATE);
  const [showAgeConfirm, setShowAgeConfirm] = useState(false);
  const [pendingDob, setPendingDob] = useState<Date | null>(null);
  const [hasConfirmedAge, setHasConfirmedAge] = useState(false);

  // Debounce ref — avoid firing on every keystroke
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Calculate age in years from a date
  const calculateAge = (birthDate: Date): number => {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const emailFormatValid = EMAIL_REGEX.test(email.trim());
  const isValid = fullName.trim().length >= 2 && emailFormatValid && emailError === null && !checkingEmail && dob !== null;

  const handleEmailChange = (text: string) => {
    setEmail(text);
    setEmailError(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!EMAIL_REGEX.test(text.trim())) return;

    // Skip check if it's the same as what's already saved
    if (text.trim().toLowerCase() === (profile?.email ?? '').toLowerCase()) return;

    setCheckingEmail(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_V1}/profile/check-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: text.trim() }),
        });
        const data = await res.json();
        if (!data.available) {
          setEmailError('This email is already in use.');
        }
      } catch (err: unknown) {
        if (err instanceof TypeError || (err instanceof Error && err.message === 'Network request failed')) {
          setEmailNetworkError(true);
        }
        // Non-network errors: silently allow continue; backend catches duplicates
      } finally {
        setCheckingEmail(false);
      }
    }, 600);
  };

  const handleContinue = async () => {
    if (!isValid) return;
    const fields: Record<string, unknown> = {
      full_name: fullName.trim(),
      date_of_birth: dob!.toISOString().split('T')[0],
    };
    // Only send email if it's user-entered — social-provider email is already on the account
    if (!emailFromSocial) {
      fields.email = email.trim().toLowerCase();
    }
    const ok = await save(fields);
    if (ok) navPush('/gender');
  };

  // Build the label manually to guarantee Gregorian English — avoids device Hijri calendar
  const MONTH_NAMES = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
  ];
  const dobLabel = dob
    ? `${MONTH_NAMES[dob.getMonth()]} ${dob.getDate()}, ${dob.getFullYear()}`
    : null;

  return (
    <OnboardingShell
      step={1}
      title="What's your name?"
      subtitle="This is how you'll appear on your profile."
      onContinue={handleContinue}
      continueDisabled={!isValid}
      loading={saving}
      hideBack
      keyboardAvoiding
      scrollable
      networkError={anyNetworkError}
      onRetryNetwork={clearAllNetworkErrors}
    >
      {/* Full name input */}
      <Squircle
        style={styles.inputBox}
        cornerRadius={18}
        cornerSmoothing={1}
        fillColor={colors.surface}
        strokeColor={fullName.length > 0 ? colors.borderActive : colors.border}
        strokeWidth={fullName.length > 0 ? 2 : 1.5}
      >
        <TextInput
          style={[styles.input, { color: colors.text }]}
          placeholder="Full name"
          placeholderTextColor={colors.placeholder}
          value={fullName}
          onChangeText={setFullName}
          autoFocus
          autoCapitalize="words"
          returnKeyType="next"
        />
      </Squircle>

      {/* Email input — locked when it came from Google or Apple Sign In */}
      <Squircle
        style={[styles.inputBox, { marginBottom: emailError ? 6 : 28, opacity: emailFromSocial ? 0.6 : 1 }]}
        cornerRadius={18}
        cornerSmoothing={1}
        fillColor={colors.surface}
        strokeColor={emailError ? '#ef4444' : email.length > 0 ? colors.borderActive : colors.border}
        strokeWidth={email.length > 0 || emailError ? 2 : 1.5}
      >
        <TextInput
          style={[styles.input, { color: colors.text, flex: 1 }]}
          placeholder="Email address"
          placeholderTextColor={colors.placeholder}
          value={email}
          onChangeText={emailFromSocial ? undefined : handleEmailChange}
          editable={!emailFromSocial}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
        />
        {emailFromSocial ? (
          <Ionicons name="lock-closed" size={14} color={colors.textSecondary} style={{ marginRight: 2 }} />
        ) : checkingEmail ? (
          <ActivityIndicator size="small" color={colors.textSecondary} style={{ marginRight: 4 }} />
        ) : null}
      </Squircle>
      {emailError ? (
        <Text style={[styles.errorText, { color: '#ef4444' }]}>{emailError}</Text>
      ) : emailFromSocial ? (
        <Text style={[styles.errorText, { color: colors.textSecondary, marginBottom: 14 }]}>
          Email set by {socialProvider} Sign In · cannot be changed
        </Text>
      ) : null}

      {/* Date of birth trigger */}
      <Text style={[styles.label, { color: colors.textSecondary }]}>Date of birth</Text>

      <Pressable
        onPress={() => {
          setPickerTemp(dob ?? DEFAULT_PICKER_DATE);
          setShowPicker(true);
        }}
      >
        <Squircle
          style={styles.dobBox}
          cornerRadius={18}
          cornerSmoothing={1}
          fillColor={colors.surface}
          strokeColor={dob ? colors.borderActive : colors.border}
          strokeWidth={dob ? 2 : 1.5}
        >
          {dobLabel ? (
            <Text style={[styles.dobValue, { color: colors.text }]}>{dobLabel}</Text>
          ) : (
            <Text style={[styles.dobPlaceholder, { color: colors.placeholder }]}>
              Select date of birth
            </Text>
          )}
        </Squircle>
      </Pressable>

      <Text style={[styles.hint, { color: colors.textTertiary }]}>
        You must be at least 18 years old.
      </Text>

      {/* Native iOS date picker in a bottom modal */}
      <Modal
        visible={showPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPicker(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setShowPicker(false)} />

        <View style={[styles.sheet, { backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7' }]}>
          {/* Toolbar */}
          <View style={[styles.toolbar, { borderBottomColor: isDark ? '#3a3a3c' : '#d1d1d6' }]}>
            <TouchableOpacity onPress={() => setShowPicker(false)}>
              <Text style={[styles.toolbarBtn, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                const age = calculateAge(pickerTemp);
                // Show confirmation for any age - ask "Are you sure you're X years old?"
                // Only ask once per session - skip if already confirmed
                if (!hasConfirmedAge) {
                  setPendingDob(pickerTemp);
                  setShowPicker(false);
                  setShowAgeConfirm(true);
                } else {
                  setDob(pickerTemp);
                  setShowPicker(false);
                }
              }}
            >
              <Text style={[styles.toolbarBtn, styles.doneBtn, { color: colors.text }]}>Done</Text>
            </TouchableOpacity>
          </View>

          <DateTimePicker
            value={pickerTemp}
            mode="date"
            display="spinner"
            maximumDate={MAX_DOB}
            locale="en-US"
            onChange={(_, selected) => {
              if (selected) setPickerTemp(selected);
            }}
            style={styles.picker}
            textColor={isDark ? '#ffffff' : '#000000'}
          />

          <SafeAreaView />
        </View>
      </Modal>

      {/* Age confirmation modal */}
      <Modal
        visible={showAgeConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAgeConfirm(false)}
      >
        <View style={styles.confirmBackdrop}>
          <Squircle
            style={styles.confirmBox}
            cornerRadius={28}
            cornerSmoothing={1}
            fillColor={colors.surface}
          >
            <View style={styles.confirmContent}>
              <Squircle
                style={styles.confirmIconSquircle}
                cornerRadius={20}
                cornerSmoothing={1}
                fillColor={colors.bg}
              >
                <Ionicons name="calendar-outline" size={28} color={colors.text} />
              </Squircle>
              
              <Text style={[styles.confirmTitle, { color: colors.text }]}>
                Confirm Your Age
              </Text>
              
              <Text style={[styles.confirmMessage, { color: colors.textSecondary }]}>
                You selected birth year {pendingDob?.getFullYear()}. Are you sure you are {pendingDob ? calculateAge(pendingDob) : ''} years old?
              </Text>

              <View style={styles.confirmButtons}>
                <Squircle
                  style={styles.confirmBtnSquircle}
                  cornerRadius={16}
                  cornerSmoothing={1}
                  fillColor={colors.bg}
                >
                  <TouchableOpacity
                    style={styles.confirmBtnTouchable}
                    onPress={() => {
                      setShowAgeConfirm(false);
                      setPendingDob(null);
                    }}
                  >
                    <Text style={[styles.confirmBtnText, { color: colors.textSecondary }]}>
                      Change Date
                    </Text>
                  </TouchableOpacity>
                </Squircle>

                <Squircle
                  style={styles.confirmBtnSquircle}
                  cornerRadius={16}
                  cornerSmoothing={1}
                  fillColor={colors.text}
                >
                  <TouchableOpacity
                    style={styles.confirmBtnTouchable}
                    onPress={() => {
                      if (pendingDob) {
                        setDob(pendingDob);
                      }
                      setHasConfirmedAge(true);
                      setShowAgeConfirm(false);
                      setPendingDob(null);
                    }}
                  >
                    <Text style={[styles.confirmBtnText, { color: colors.bg }]}>
                      Yes, Confirm
                    </Text>
                  </TouchableOpacity>
                </Squircle>
              </View>
            </View>
          </Squircle>
        </View>
      </Modal>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  inputBox: { height: 60, paddingHorizontal: 18, justifyContent: 'center', flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  input: { fontSize: 17, fontFamily: 'ProductSans-Medium', flex: 1 },
  errorText: { fontSize: 12, fontFamily: 'ProductSans-Regular', marginBottom: 14, marginLeft: 4 },
  label: { fontSize: 13, fontFamily: 'ProductSans-Regular', marginBottom: 8 },
  dobBox: {
    height: 60,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dobValue: { fontSize: 16, fontFamily: 'ProductSans-Medium' },
  dobPlaceholder: { fontSize: 16, fontFamily: 'ProductSans-Regular' },
  hint: { fontSize: 12, fontFamily: 'ProductSans-Regular', marginTop: 10 },

  // Modal sheet
  backdrop: { flex: 1 },
  sheet: {
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    overflow: 'hidden',
    paddingBottom: 8,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  toolbarBtn: { fontSize: 16, fontFamily: 'ProductSans-Regular' },
  doneBtn: { fontFamily: 'ProductSans-Bold' },
  picker: { width: '100%' },

  // Age confirmation modal
  confirmBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  confirmBox: {
    width: '90%',
    maxWidth: 340,
  },
  confirmContent: {
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  confirmIconSquircle: {
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmTitle: {
    fontSize: 20,
    fontFamily: 'ProductSans-Bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  confirmMessage: {
    fontSize: 15,
    fontFamily: 'ProductSans-Regular',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  confirmBtnSquircle: {
    flex: 1,
    height: 50,
  },
  confirmBtnTouchable: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: 16,
    fontFamily: 'ProductSans-Bold',
  },
});
