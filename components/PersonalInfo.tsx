import { navPush, navReplace } from '@/utils/nav';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
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
import { useAppTheme } from '@/context/ThemeContext';

const _MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

function formatDate(date: Date): string {
  return `${_MONTH_NAMES[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function getAge(dob: Date): number {
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

const MAX_DATE = new Date(new Date().setFullYear(new Date().getFullYear() - 18));
const MIN_DATE = new Date(new Date().setFullYear(new Date().getFullYear() - 100));

export default function PersonalInfo() {
  const router = useRouter();
  const { colors } = useAppTheme();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [birthday, setBirthday] = useState<Date | null>(null);
  const [tempDate, setTempDate] = useState<Date>(MAX_DATE);
  const [showPicker, setShowPicker] = useState(false);
  const [touched, setTouched] = useState(false);

  const nameError = touched && fullName.trim().length < 2 ? 'Please enter your full name' : null;
  const emailError = touched && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'Please enter a valid email' : null;
  const birthdayError = touched && !birthday ? 'Please select your birthday' : null;

  const isValid = fullName.trim().length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !!birthday;

  const handleContinue = () => {
    setTouched(true);
    if (!isValid) return;

    Alert.alert(
      'Confirm your birthday',
      `You were born on ${formatDate(birthday!)} (age ${getAge(birthday!)}). Your age cannot be changed once set. Are you sure?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, confirm',
          style: 'default',
          onPress: () => navPush('/gender'),
        },
      ]
    );
  };

  const handleDateConfirm = () => {
    setBirthday(tempDate);
    setShowPicker(false);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back */}
          <View style={styles.topBar}>
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <Squircle style={styles.backBtn} cornerRadius={14} cornerSmoothing={1} fillColor={colors.backBtnBg}>
                <Ionicons name="arrow-back" size={20} color={colors.text} />
              </Squircle>
            </Pressable>
          </View>

          <View style={styles.body}>
            {/* Header */}
            <Text style={[styles.title, { color: colors.text }]}>About{'\n'}you</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              This information helps us personalise your experience and keep your account secure.
            </Text>

            {/* Full Name */}
            <View style={styles.fieldWrap}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Full name</Text>
              <Squircle
                style={styles.inputBox}
                cornerRadius={18}
                cornerSmoothing={1}
                fillColor={nameError ? colors.errorBg : colors.surface}
                strokeColor={nameError ? colors.errorBorder : colors.border}
                strokeWidth={1.5}
              >
                <Ionicons name="person-outline" size={18} color={colors.textTertiary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="Jane Doe"
                  placeholderTextColor={colors.placeholder}
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="next"
                  selectionColor={colors.text}
                />
                {fullName.length > 0 && (
                  <Pressable onPress={() => setFullName('')} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                  </Pressable>
                )}
              </Squircle>
              {nameError && (
                <View style={styles.errorRow}>
                  <Ionicons name="warning" size={13} color={colors.error} />
                  <Text style={[styles.errorText, { color: colors.error }]}>{nameError}</Text>
                </View>
              )}
            </View>

            {/* Email */}
            <View style={styles.fieldWrap}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Email</Text>
              <Squircle
                style={styles.inputBox}
                cornerRadius={18}
                cornerSmoothing={1}
                fillColor={emailError ? colors.errorBg : colors.surface}
                strokeColor={emailError ? colors.errorBorder : colors.border}
                strokeWidth={1.5}
              >
                <Ionicons name="mail-outline" size={18} color={colors.textTertiary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.placeholder}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  selectionColor={colors.text}
                />
                {email.length > 0 && (
                  <Pressable onPress={() => setEmail('')} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                  </Pressable>
                )}
              </Squircle>
              {emailError && (
                <View style={styles.errorRow}>
                  <Ionicons name="warning" size={13} color={colors.error} />
                  <Text style={[styles.errorText, { color: colors.error }]}>{emailError}</Text>
                </View>
              )}
            </View>

            {/* Birthday */}
            <View style={styles.fieldWrap}>
              <View style={styles.labelRow}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Birthday</Text>
                <View style={styles.lockBadge}>
                  <Ionicons name="lock-closed" size={10} color={colors.textTertiary} />
                  <Text style={[styles.lockText, { color: colors.textTertiary }]}>Can't be changed later</Text>
                </View>
              </View>

              <Pressable onPress={() => setShowPicker(true)}>
                <Squircle
                  style={styles.inputBox}
                  cornerRadius={18}
                  cornerSmoothing={1}
                  fillColor={birthdayError ? colors.errorBg : colors.surface}
                  strokeColor={birthdayError ? colors.errorBorder : birthday ? colors.borderActive : colors.border}
                  strokeWidth={1.5}
                >
                  <Ionicons name="calendar-outline" size={18} color={colors.textTertiary} style={styles.inputIcon} />
                  <Text style={[styles.dateText, { color: birthday ? colors.text : colors.placeholder }]}>
                    {birthday ? formatDate(birthday) : 'Select your birthday'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={colors.textTertiary} />
                </Squircle>
              </Pressable>

              {birthdayError && (
                <View style={styles.errorRow}>
                  <Ionicons name="warning" size={13} color={colors.error} />
                  <Text style={[styles.errorText, { color: colors.error }]}>{birthdayError}</Text>
                </View>
              )}

              {birthday && (
                <Text style={[styles.ageHint, { color: colors.textTertiary }]}>
                  Age: {getAge(birthday)} years old
                </Text>
              )}
            </View>

            <Text style={[styles.disclaimer, { color: colors.textTertiary }]}>
              Your birthday is used to verify your age. You must be 18+ to use this app.
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button title="Continue" onPress={handleContinue} disabled={touched && !isValid} style={styles.btn} />
        </View>
      </KeyboardAvoidingView>

      {/* Birthday picker modal */}
      <Modal
        visible={showPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPicker(false)}
      >
        <Pressable style={styles.pickerBackdrop} onPress={() => setShowPicker(false)} />
        <View style={[styles.pickerSheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.pickerHeader, { borderBottomColor: colors.border }]}>
            <Pressable onPress={() => setShowPicker(false)} hitSlop={12}>
              <Text style={[styles.pickerAction, { color: colors.textSecondary }]}>Cancel</Text>
            </Pressable>
            <Text style={[styles.pickerTitle, { color: colors.text }]}>Birthday</Text>
            <Pressable onPress={handleDateConfirm} hitSlop={12}>
              <Text style={[styles.pickerAction, styles.pickerDone, { color: colors.text }]}>Done</Text>
            </Pressable>
          </View>

          <DateTimePicker
            value={tempDate}
            mode="date"
            display="spinner"
            maximumDate={MAX_DATE}
            minimumDate={MIN_DATE}
            locale="en-US"
            onChange={(_, date) => { if (date) setTempDate(date); }}
            textColor={colors.text}
            style={styles.datePicker}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  topBar: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32 },
  title: { fontSize: 42, fontFamily: 'ProductSans-Black', lineHeight: 48, marginBottom: 12 },
  subtitle: { fontSize: 14, fontFamily: 'ProductSans-Regular', lineHeight: 21, marginBottom: 36 },
  fieldWrap: { marginBottom: 24 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  label: { fontSize: 13, fontFamily: 'ProductSans-Medium', marginBottom: 8 },
  lockBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  lockText: { fontSize: 11, fontFamily: 'ProductSans-Regular' },
  inputBox: { flexDirection: 'row', alignItems: 'center', height: 58, paddingHorizontal: 16, gap: 10 },
  inputIcon: { flexShrink: 0 },
  input: { flex: 1, fontSize: 16, fontFamily: 'ProductSans-Regular', height: '100%' },
  dateText: { flex: 1, fontSize: 16, fontFamily: 'ProductSans-Regular' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  errorText: { fontSize: 12, fontFamily: 'ProductSans-Regular' },
  ageHint: { fontSize: 12, fontFamily: 'ProductSans-Regular', marginTop: 6 },
  disclaimer: { fontSize: 12, fontFamily: 'ProductSans-Regular', lineHeight: 18, marginTop: 8 },
  footer: { paddingHorizontal: 24, paddingBottom: 24, paddingTop: 12 },
  btn: { width: '100%' },
  // Picker
  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  pickerSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32 },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  pickerTitle: { fontSize: 16, fontFamily: 'ProductSans-Bold' },
  pickerAction: { fontSize: 15, fontFamily: 'ProductSans-Medium' },
  pickerDone: { fontFamily: 'ProductSans-Bold' },
  datePicker: { height: 200 },
});
