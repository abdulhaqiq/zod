// Step 1 — Full name + date of birth
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
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

function parseDob(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const { save, saving } = useProfileSave();
  const { profile } = useAuth();

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const existingDob = parseDob(profile?.date_of_birth);
  const [dob, setDob] = useState<Date | null>(existingDob);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerTemp, setPickerTemp] = useState<Date>(existingDob ?? DEFAULT_PICKER_DATE);

  const isValid = fullName.trim().length >= 2 && dob !== null;

  const handleContinue = async () => {
    if (!isValid) return;
    const ok = await save({
      full_name: fullName.trim(),
      date_of_birth: dob!.toISOString().split('T')[0],
    });
    if (ok) router.push('/gender');
  };

  const dobLabel = dob
    ? dob.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
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
          returnKeyType="done"
        />
      </Squircle>

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
                setDob(pickerTemp);
                setShowPicker(false);
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
            onChange={(_, selected) => {
              if (selected) setPickerTemp(selected);
            }}
            style={styles.picker}
            textColor={isDark ? '#ffffff' : '#000000'}
          />

          <SafeAreaView />
        </View>
      </Modal>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  inputBox: { height: 60, paddingHorizontal: 18, justifyContent: 'center', marginBottom: 28 },
  input: { fontSize: 17, fontFamily: 'ProductSans-Medium' },
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
});
