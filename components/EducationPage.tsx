import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
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

WebBrowser.maybeCompleteAuthSession();

// ─── LinkedIn OAuth config ────────────────────────────────────────────────────

const LINKEDIN_CLIENT_ID  = '86limpriduno69';
const LINKEDIN_REDIRECT_URI = 'https://www.linkedin.com/developers/tools/oauth/redirect';
const LINKEDIN_SCOPE = 'openid profile email r_fullprofile';

function buildLinkedInAuthUrl(): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: LINKEDIN_CLIENT_ID,
    redirect_uri: LINKEDIN_REDIRECT_URI,
    scope: LINKEDIN_SCOPE,
    state: Math.random().toString(36).slice(2),
  });
  return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
}

// ─── Degree options ───────────────────────────────────────────────────────────

const DEGREES = ["High School", "Associate's", "Bachelor's", "Master's", "PhD", "Other"];

// ─── Types ────────────────────────────────────────────────────────────────────

interface EduEntry {
  id: string;
  institution: string;
  course: string;
  degree: string;
  gradYear: string;
}

const MAX_ENTRIES = 3;

// ─── Field input ──────────────────────────────────────────────────────────────

function Field({
  label, value, onChangeText, placeholder, keyboardType = 'default', colors,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder: string; keyboardType?: any; colors: AppColors;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Squircle
        style={styles.inputBox}
        cornerRadius={14}
        cornerSmoothing={1}
        fillColor={colors.surface2}
        strokeColor={colors.border}
        strokeWidth={1}
      >
        <TextInput
          style={[styles.input, { color: colors.text }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          keyboardType={keyboardType}
          selectionColor={colors.text}
          returnKeyType="next"
        />
      </Squircle>
    </View>
  );
}

// ─── Degree Picker ────────────────────────────────────────────────────────────

function DegreePicker({
  value, onChange, colors,
}: { value: string; onChange: (v: string) => void; colors: AppColors }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>DEGREE TYPE</Text>
      <View style={styles.degreeChips}>
        {DEGREES.map(d => {
          const selected = d === value;
          return (
            <Pressable key={d} onPress={() => onChange(d)}>
              <View style={[
                styles.degreeChip,
                {
                  backgroundColor: selected ? colors.text : colors.surface2,
                  borderColor: selected ? colors.text : colors.border,
                },
              ]}>
                <Text style={[styles.degreeChipText, { color: selected ? colors.bg : colors.text }]}>
                  {d}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─── Education Entry Card ─────────────────────────────────────────────────────

function EduCard({
  entry, onChange, onRemove, index, colors,
}: {
  entry: EduEntry; onChange: (u: EduEntry) => void;
  onRemove: () => void; index: number; colors: AppColors;
}) {
  const set = (key: keyof EduEntry) => (val: string) =>
    onChange({ ...entry, [key]: val });

  return (
    <Squircle
      style={styles.card}
      cornerRadius={22}
      cornerSmoothing={1}
      fillColor={colors.surface}
      strokeColor={colors.border}
      strokeWidth={1}
    >
      {/* Card header */}
      <View style={[styles.cardHeader, { borderBottomColor: colors.border }]}>
        <View style={styles.cardHeaderLeft}>
          <Squircle style={styles.cardIcon} cornerRadius={12} cornerSmoothing={1} fillColor={colors.surface2}>
            <Ionicons name="school-outline" size={16} color={colors.text} />
          </Squircle>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            {entry.institution || `Education ${index + 1}`}
          </Text>
        </View>
        <Pressable onPress={onRemove} hitSlop={10}>
          <Squircle style={styles.removeBtn} cornerRadius={10} cornerSmoothing={1} fillColor={colors.surface2}>
            <Ionicons name="trash-outline" size={14} color={colors.error ?? '#FF3B30'} />
          </Squircle>
        </Pressable>
      </View>

      <View style={styles.cardBody}>
        <Field
          label="INSTITUTION"
          value={entry.institution}
          onChangeText={set('institution')}
          placeholder="e.g. UCLA, Harvard, MIT"
          colors={colors}
        />
        <Field
          label="COURSE / FIELD OF STUDY"
          value={entry.course}
          onChangeText={set('course')}
          placeholder="e.g. Computer Science, Design"
          colors={colors}
        />
        <DegreePicker value={entry.degree} onChange={set('degree')} colors={colors} />
        <Field
          label="GRADUATION YEAR"
          value={entry.gradYear}
          onChangeText={set('gradYear')}
          placeholder="e.g. 2022"
          keyboardType="numeric"
          colors={colors}
        />
      </View>
    </Squircle>
  );
}

// ─── Education Page ───────────────────────────────────────────────────────────

export default function EducationPage() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { profile, token, updateProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [linkedInConnected, setLinkedInConnected] = useState(false);
  const [linkedInLoading, setLinkedInLoading]     = useState(false);

  const [entries, setEntries] = useState<EduEntry[]>(() => {
    const ed = profile?.education;
    if (ed?.length) {
      return ed.map((e, i) => ({
        id: String(i + 1),
        institution: e.institution ?? '',
        course: e.course ?? '',
        degree: e.degree ?? '',
        gradYear: e.grad_year ?? '',
      }));
    }
    return [{ id: '1', institution: '', course: '', degree: '', gradYear: '' }];
  });

  const addEntry = () => {
    if (entries.length >= MAX_ENTRIES) return;
    setEntries(prev => [...prev, {
      id: Date.now().toString(),
      institution: '', course: '', degree: '', gradYear: '',
    }]);
  };

  const updateEntry = (id: string, updated: EduEntry) =>
    setEntries(prev => prev.map(e => e.id === id ? updated : e));

  const removeEntry = (id: string) =>
    setEntries(prev => prev.filter(e => e.id !== id));

  const handleLinkedInImport = async (url: string) => {
    if (!url.includes('code=')) return;
    let code: string | undefined;
    try {
      code = new URL(url).searchParams.get('code') ?? undefined;
    } catch {
      code = url.match(/[?&]code=([^&]+)/)?.[1];
    }
    if (!code || !token) return;

    setLinkedInLoading(true);
    try {
      const imported = await apiFetch<{
        institution: string; course: string; degree: string; grad_year: string;
      }[]>('/linkedin/import-education', {
        method: 'POST',
        token,
        body: JSON.stringify({ code, redirect_uri: LINKEDIN_REDIRECT_URI }),
      });

      if (imported.length === 0) {
        Alert.alert('No Education Found', 'LinkedIn returned no education. Make sure your profile is public and has education listed.');
        return;
      }

      setEntries(imported.map((e, i) => ({
        id: Date.now().toString() + i,
        institution: e.institution,
        course: e.course,
        degree: e.degree,
        gradYear: e.grad_year,
      })));
      setLinkedInConnected(true);
      Alert.alert('Imported!', `${imported.length} education entr${imported.length > 1 ? 'ies' : 'y'} imported from LinkedIn.`);
    } catch (e: any) {
      Alert.alert('Import Failed', e.message ?? 'Could not import from LinkedIn.');
    } finally {
      setLinkedInLoading(false);
    }
  };

  const connectLinkedIn = async () => {
    setLinkedInLoading(true);
    try {
      const result = await WebBrowser.openAuthSessionAsync(buildLinkedInAuthUrl(), LINKEDIN_REDIRECT_URI);
      if (result.type === 'success' && result.url) {
        await handleLinkedInImport(result.url);
      }
    } catch {
      Alert.alert('Error', 'Could not open LinkedIn. Please try again.');
    } finally {
      setLinkedInLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = entries.map(e => ({
        institution: e.institution.trim(),
        course: e.course.trim(),
        degree: e.degree.trim(),
        grad_year: e.gradYear.trim(),
      }));
      const updated = await apiFetch<any>('/profile/me', {
        method: 'PATCH',
        token: token ?? undefined,
        body: JSON.stringify({ education: payload }),
      });
      updateProfile(updated);
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.safe, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScreenHeader
          title="Education"
          onClose={() => router.back()}
          rightLabel={saving ? '…' : 'Save'}
          onRightPress={saving ? undefined : handleSave}
          colors={colors}
        />

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* LinkedIn import banner */}
          <Squircle
            style={styles.linkedInBanner}
            cornerRadius={20}
            cornerSmoothing={1}
            fillColor="#0A66C2"
          >
            <View style={styles.linkedInInner}>
              <View style={styles.linkedInLeft}>
                <Squircle style={styles.linkedInIcon} cornerRadius={10} cornerSmoothing={1} fillColor="rgba(255,255,255,0.18)">
                  <Ionicons name="logo-linkedin" size={20} color="#fff" />
                </Squircle>
                <View>
                  <Text style={styles.linkedInTitle}>Import from LinkedIn</Text>
                  <Text style={styles.linkedInSub}>
                    {linkedInConnected ? 'Imported · tap to refresh' : 'Auto-fill your education'}
                  </Text>
                </View>
              </View>
              <Pressable
                style={[styles.linkedInBtn, linkedInConnected && { backgroundColor: 'rgba(255,255,255,0.15)' }]}
                onPress={linkedInLoading ? undefined : connectLinkedIn}
                disabled={linkedInLoading}
              >
                <Text style={[styles.linkedInBtnText, linkedInConnected && { color: '#fff' }]}>
                  {linkedInLoading ? '…' : linkedInConnected ? 'Connected' : 'Connect'}
                </Text>
              </Pressable>
            </View>
          </Squircle>

          {entries.map((entry, i) => (
            <EduCard
              key={entry.id}
              entry={entry}
              index={i}
              onChange={updated => updateEntry(entry.id, updated)}
              onRemove={() => removeEntry(entry.id)}
              colors={colors}
            />
          ))}

          {entries.length < MAX_ENTRIES && (
            <Pressable onPress={addEntry} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
              <Squircle
                style={styles.addBtn}
                cornerRadius={18}
                cornerSmoothing={1}
                fillColor={colors.surface}
                strokeColor={colors.border}
                strokeWidth={1.5}
              >
                <Ionicons name="add-circle-outline" size={20} color={colors.text} />
                <Text style={[styles.addBtnText, { color: colors.text }]}>
                  Add Education
                  <Text style={{ color: colors.textSecondary }}> · {entries.length}/{MAX_ENTRIES}</Text>
                </Text>
              </Squircle>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:           { flex: 1 },
  flex:           { flex: 1 },
  scroll:         { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 48, gap: 14 },

  // Card
  card:           { overflow: 'hidden' },
  cardHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  cardIcon:       { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  cardTitle:      { fontSize: 14, fontFamily: 'ProductSans-Bold', flex: 1 },
  removeBtn:      { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  cardBody:       { padding: 14, gap: 14 },

  // Field
  fieldWrap:      { gap: 6 },
  fieldLabel:     { fontSize: 11, fontFamily: 'ProductSans-Bold', letterSpacing: 0.5 },
  inputBox:       { height: 46, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' },
  input:          { flex: 1, fontSize: 15, fontFamily: 'ProductSans-Regular' },

  // Degree picker
  degreeChips:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  degreeChip:     { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 50, borderWidth: 1.5 },
  degreeChipText: { fontSize: 13, fontFamily: 'ProductSans-Medium' },

  // Add button
  addBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  addBtnText:     { fontSize: 15, fontFamily: 'ProductSans-Bold' },

  // LinkedIn
  linkedInBanner:  { overflow: 'hidden' },
  linkedInInner:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, gap: 10 },
  linkedInLeft:    { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  linkedInIcon:    { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  linkedInTitle:   { fontSize: 14, fontFamily: 'ProductSans-Bold', color: '#fff' },
  linkedInSub:     { fontSize: 11, fontFamily: 'ProductSans-Regular', color: 'rgba(255,255,255,0.7)' },
  linkedInBtn:     { backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  linkedInBtnText: { fontSize: 12, fontFamily: 'ProductSans-Bold', color: '#0A66C2' },
});
