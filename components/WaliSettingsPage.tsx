/**
 * Wali Settings — Guardian information for female users in Halal mode.
 *
 * Accessible only when both face AND ID verification are complete
 * (verification_status === 'verified').
 *
 * Mirrors the ZodWorkPage structure (ScreenHeader + Group/Row pattern).
 */
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import ScreenHeader from '@/components/ui/ScreenHeader';
import Squircle from '@/components/ui/Squircle';
import { apiFetch } from '@/constants/api';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';
import type { AppColors } from '@/constants/appColors';

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ title, colors }: { title: string; colors: AppColors }) {
  return <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{title}</Text>;
}

function Group({ children, colors }: { children: React.ReactNode; colors: AppColors }) {
  return (
    <Squircle
      style={styles.group}
      cornerRadius={22}
      cornerSmoothing={1}
      fillColor={colors.surface}
      strokeColor={colors.border}
      strokeWidth={1}
    >
      {children}
    </Squircle>
  );
}

function FieldRow({
  icon, label, value, placeholder, onChangeText, onBlur,
  keyboardType, last, colors, saving,
}: {
  icon: any;
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (v: string) => void;
  onBlur: () => void;
  keyboardType?: any;
  last?: boolean;
  colors: AppColors;
  saving?: boolean;
}) {
  return (
    <View
      style={[
        styles.row,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
      ]}
    >
      <Squircle style={styles.iconWrap} cornerRadius={10} cornerSmoothing={1} fillColor={colors.surface2 ?? colors.bg}>
        <Ionicons name={icon} size={16} color={colors.text} />
      </Squircle>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
        <TextInput
          style={[styles.fieldInput, { color: colors.text }]}
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlur}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          keyboardType={keyboardType ?? 'default'}
          returnKeyType="done"
          autoCapitalize={keyboardType === 'email-address' ? 'none' : 'words'}
        />
      </View>
      {saving && <ActivityIndicator size="small" color={colors.textSecondary} />}
    </View>
  );
}

function ToggleRow({
  icon, label, subtitle, value, onChange, last, colors,
}: {
  icon: any;
  label: string;
  subtitle?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  last?: boolean;
  colors: AppColors;
}) {
  return (
    <View
      style={[
        styles.row,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
      ]}
    >
      <Squircle style={styles.iconWrap} cornerRadius={10} cornerSmoothing={1} fillColor={colors.surface2 ?? colors.bg}>
        <Ionicons name={icon} size={16} color={colors.text} />
      </Squircle>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
        {subtitle ? (
          <Text style={[styles.rowSub, { color: colors.textSecondary }]}>{subtitle}</Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={(v) => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onChange(v);
        }}
        trackColor={{ false: colors.border, true: colors.text }}
        thumbColor="#fff"
      />
    </View>
  );
}

// Relation chips
const RELATION_OPTIONS = [
  'Father', 'Brother', 'Uncle', 'Grandfather', 'Son', 'Guardian', 'Other',
];

function RelationPicker({
  value, onChange, colors,
}: {
  value: string;
  onChange: (v: string) => void;
  colors: AppColors;
}) {
  return (
    <View style={styles.chipRow}>
      {RELATION_OPTIONS.map(opt => {
        const selected = value === opt;
        return (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            style={[
              styles.chip,
              {
                backgroundColor: selected ? colors.text : colors.surface,
                borderColor: selected ? colors.text : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.chipLabel,
                { color: selected ? colors.bg : colors.text },
              ]}
            >
              {opt}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function WaliSettingsPage() {
  const { colors } = useAppTheme();
  const { profile, token, updateProfile } = useAuth();

  const isVerified = profile?.verification_status === 'verified';

  const [name,      setName]      = useState(profile?.wali_name     ?? '');
  const [age,       setAge]       = useState(profile?.wali_age ? String(profile.wali_age) : '');
  const [email,     setEmail]     = useState(profile?.wali_email    ?? '');
  const [relation,  setRelation]  = useState(profile?.wali_relation ?? '');
  const [verified,  setVerified]  = useState(profile?.wali_verified ?? false);
  const [saving,    setSaving]    = useState<string | null>(null);

  useEffect(() => {
    setName(profile?.wali_name     ?? '');
    setAge(profile?.wali_age       ? String(profile.wali_age) : '');
    setEmail(profile?.wali_email   ?? '');
    setRelation(profile?.wali_relation ?? '');
    setVerified(profile?.wali_verified  ?? false);
  }, [profile?.wali_name, profile?.wali_age, profile?.wali_email, profile?.wali_relation, profile?.wali_verified]);

  const save = async (patch: Record<string, any>, field: string) => {
    if (!token) return;
    setSaving(field);
    try {
      await apiFetch('/profile/me', {
        method: 'PATCH',
        token,
        body: JSON.stringify(patch),
      });
      updateProfile(patch as any);
    } catch {
      Alert.alert('Error', 'Could not save. Please try again.');
    } finally {
      setSaving(null);
    }
  };

  // ── Locked state when not fully verified ────────────────────────────────────
  if (!isVerified) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <ScreenHeader title="Wali Information" />
        <View style={styles.lockedWrap}>
          <Squircle
            style={styles.lockedCard}
            cornerRadius={26}
            cornerSmoothing={1}
            fillColor={colors.surface}
            strokeColor={colors.border}
            strokeWidth={1}
          >
            <View style={styles.lockedIcon}>
              <Ionicons name="shield-checkmark-outline" size={36} color={colors.textSecondary} />
            </View>
            <Text style={[styles.lockedTitle, { color: colors.text }]}>
              Verification Required
            </Text>
            <Text style={[styles.lockedSub, { color: colors.textSecondary }]}>
              To add your Wali's details, you must complete both{' '}
              <Text style={{ fontFamily: 'ProductSans-Bold', color: colors.text }}>face verification</Text>
              {' '}and{' '}
              <Text style={{ fontFamily: 'ProductSans-Bold', color: colors.text }}>ID verification</Text>.
              {'\n\n'}This protects your guardian's information and ensures authenticity.
            </Text>
            <Pressable
              style={[styles.verifyBtn, { backgroundColor: colors.text }]}
              onPress={() => {
                // Navigate to verification page
                const { navPush } = require('@/utils/nav');
                navPush('/verification');
              }}
            >
              <Text style={[styles.verifyBtnLabel, { color: colors.bg }]}>Verify My Identity</Text>
            </Pressable>
          </Squircle>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenHeader title="Wali Information" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── About your Wali ─────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionLabel title="ABOUT YOUR WALI" colors={colors} />
          <Group colors={colors}>
            <FieldRow
              icon="person-outline"
              label="Full Name"
              value={name}
              placeholder="e.g. Mohammad Ahmed"
              onChangeText={setName}
              onBlur={() => name.trim() !== (profile?.wali_name ?? '') && save({ wali_name: name.trim() || null }, 'name')}
              colors={colors}
              saving={saving === 'name'}
            />
            <FieldRow
              icon="calendar-number-outline"
              label="Age"
              value={age}
              placeholder="e.g. 45"
              onChangeText={setAge}
              onBlur={() => {
                const n = parseInt(age, 10);
                const prev = profile?.wali_age ?? null;
                if (!isNaN(n) && n !== prev) save({ wali_age: n }, 'age');
                else if (age === '' && prev !== null) save({ wali_age: null }, 'age');
              }}
              keyboardType="number-pad"
              colors={colors}
              saving={saving === 'age'}
            />
            <FieldRow
              icon="mail-outline"
              label="Email Address"
              value={email}
              placeholder="e.g. wali@email.com"
              onChangeText={setEmail}
              onBlur={() => email.trim() !== (profile?.wali_email ?? '') && save({ wali_email: email.trim() || null }, 'email')}
              keyboardType="email-address"
              colors={colors}
              saving={saving === 'email'}
              last
            />
          </Group>
        </View>

        {/* ── Relation ─────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionLabel title="RELATION TO YOU" colors={colors} />
          <Group colors={colors}>
            <View style={styles.relationWrap}>
              <RelationPicker
                value={relation}
                onChange={(v) => {
                  setRelation(v);
                  save({ wali_relation: v }, 'relation');
                }}
                colors={colors}
              />
            </View>
          </Group>
        </View>

        {/* ── Status ───────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionLabel title="STATUS" colors={colors} />
          <Group colors={colors}>
            <ToggleRow
              icon="shield-checkmark-outline"
              label="Wali Confirmed"
              subtitle={
                verified
                  ? 'Your Wali has been notified and is aware of your profile'
                  : 'Confirm your Wali is aware and involved in your matching'
              }
              value={verified}
              onChange={(v) => {
                setVerified(v);
                save({ wali_verified: v }, 'verified');
              }}
              last
              colors={colors}
            />
          </Group>
        </View>

        {/* ── Info note ────────────────────────────────────────────────────── */}
        <View style={[styles.noteCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} style={{ marginTop: 1 }} />
          <Text style={[styles.noteText, { color: colors.textSecondary }]}>
            Your Wali's information is private and never shown to other users. It is used
            only for trust and safety verification purposes.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:    { flex: 1 },
  scroll:       { paddingHorizontal: 16, paddingBottom: 48 },
  section:      { marginTop: 24, gap: 8 },
  sectionLabel: { fontSize: 11, fontFamily: 'ProductSans-Bold', letterSpacing: 1.4, marginLeft: 2 },
  group:        { overflow: 'hidden' },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 13, gap: 12,
  },
  iconWrap:    { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  rowLabel:    { fontSize: 13, fontFamily: 'ProductSans-Bold' },
  rowSub:      { fontSize: 12, fontFamily: 'ProductSans-Regular', marginTop: 1 },
  fieldInput:  { fontSize: 15, fontFamily: 'ProductSans-Regular', paddingVertical: 2 },

  // Relation chips
  relationWrap: { padding: 14, paddingTop: 12 },
  chipRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, borderWidth: StyleSheet.hairlineWidth,
  },
  chipLabel: { fontSize: 13, fontFamily: 'ProductSans-Medium' },

  // Locked state
  lockedWrap: { flex: 1, padding: 20, justifyContent: 'center' },
  lockedCard: { padding: 28, alignItems: 'center', gap: 0 },
  lockedIcon: { marginBottom: 16 },
  lockedTitle: {
    fontSize: 20, fontFamily: 'ProductSans-Bold',
    textAlign: 'center', marginBottom: 12,
  },
  lockedSub: {
    fontSize: 14, fontFamily: 'ProductSans-Regular',
    textAlign: 'center', lineHeight: 22, marginBottom: 24,
  },
  verifyBtn: {
    paddingHorizontal: 28, paddingVertical: 14,
    borderRadius: 14, alignSelf: 'stretch', alignItems: 'center',
  },
  verifyBtnLabel: { fontSize: 15, fontFamily: 'ProductSans-Bold' },

  // Info note
  noteCard: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    marginTop: 20, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  noteText: { flex: 1, fontSize: 12, fontFamily: 'ProductSans-Regular', lineHeight: 18 },
});
