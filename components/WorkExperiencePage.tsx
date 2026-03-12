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
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import ScreenHeader from '@/components/ui/ScreenHeader';
import Squircle from '@/components/ui/Squircle';
import { API_V1, apiFetch } from '@/constants/api';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';
import type { AppColors } from '@/constants/appColors';

WebBrowser.maybeCompleteAuthSession();

// ─── LinkedIn OAuth config ────────────────────────────────────────────────────

const LINKEDIN_CLIENT_ID = '86limpriduno69';
// This URL is pre-registered by LinkedIn in every app — no portal config needed.
// After auth, LinkedIn redirects here; WebBrowser intercepts the page load and
// returns the full URL (including ?code=...) back to the app.
const LINKEDIN_REDIRECT_URI = 'https://www.linkedin.com/developers/tools/oauth/redirect';
const LINKEDIN_SCOPE = 'openid profile email';

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

// ─── Job title suggestions ────────────────────────────────────────────────────

const JOB_TITLES = [
  // Tech
  'Software Engineer', 'Senior Software Engineer', 'Staff Engineer', 'Principal Engineer',
  'Frontend Engineer', 'Backend Engineer', 'Full Stack Engineer', 'Mobile Engineer',
  'iOS Engineer', 'Android Engineer', 'DevOps Engineer', 'Site Reliability Engineer',
  'Data Engineer', 'Data Scientist', 'Machine Learning Engineer', 'AI Engineer',
  'Product Manager', 'Senior Product Manager', 'Director of Product', 'VP of Product',
  'UX Designer', 'Product Designer', 'UI Designer', 'Design Lead', 'Creative Director',
  'Engineering Manager', 'VP of Engineering', 'CTO', 'CEO', 'COO', 'CFO',
  'QA Engineer', 'Solutions Architect', 'Cloud Architect', 'Security Engineer',
  'Cybersecurity Analyst', 'Database Administrator', 'Systems Administrator',
  // Business
  'Business Analyst', 'Management Consultant', 'Strategy Consultant', 'Operations Manager',
  'Project Manager', 'Program Manager', 'Scrum Master', 'Agile Coach',
  'Account Manager', 'Account Executive', 'Sales Manager', 'VP of Sales',
  'Marketing Manager', 'Growth Manager', 'Brand Manager', 'Content Strategist',
  'Digital Marketing Manager', 'SEO Specialist', 'Social Media Manager',
  'Financial Analyst', 'Investment Banker', 'Portfolio Manager', 'Risk Analyst',
  'HR Manager', 'Recruiter', 'Talent Acquisition Specialist', 'People Operations',
  // Healthcare
  'Doctor', 'Physician', 'Surgeon', 'Nurse', 'Registered Nurse', 'Pharmacist',
  'Dentist', 'Physiotherapist', 'Psychologist', 'Psychiatrist', 'Radiologist',
  // Legal
  'Lawyer', 'Attorney', 'Legal Counsel', 'Paralegal', 'Compliance Officer',
  // Education
  'Teacher', 'Professor', 'Lecturer', 'Research Scientist', 'Researcher',
  // Creative
  'Graphic Designer', 'Motion Designer', 'Video Editor', 'Photographer', 'Cinematographer',
  'Copywriter', 'Content Creator', 'Journalist', 'Editor', 'Art Director',
  // Other
  'Entrepreneur', 'Founder', 'Co-Founder', 'Freelancer', 'Consultant',
  'Student', 'Intern', 'Graduate', 'Self-employed',
];

function matchTitles(query: string): string[] {
  if (!query.trim()) return [];
  const q = query.trim().toLowerCase();
  return JOB_TITLES.filter(t => t.toLowerCase().includes(q)).slice(0, 6);
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkEntry {
  id: string;
  jobTitle: string;
  company: string;
  startYear: string;
  endYear: string;
  current: boolean;
}

interface EntryErrors {
  jobTitle?: string;
  company?: string;
  startYear?: string;
  endYear?: string;
}

const CURRENT_YEAR = new Date().getFullYear();

function validateEntry(e: WorkEntry): EntryErrors {
  const errors: EntryErrors = {};
  if (!e.jobTitle.trim()) errors.jobTitle = 'Job title is required';
  if (!e.company.trim()) errors.company = 'Company is required';

  const sy = parseInt(e.startYear, 10);
  if (!e.startYear.trim()) {
    errors.startYear = 'Required';
  } else if (isNaN(sy) || sy < 1950 || sy > CURRENT_YEAR) {
    errors.startYear = `Enter a year between 1950–${CURRENT_YEAR}`;
  }

  if (!e.current) {
    const ey = parseInt(e.endYear, 10);
    if (!e.endYear.trim()) {
      errors.endYear = 'Required';
    } else if (isNaN(ey) || ey < 1950 || ey > CURRENT_YEAR + 5) {
      errors.endYear = `Enter a valid year`;
    } else if (!isNaN(sy) && ey < sy) {
      errors.endYear = 'Must be ≥ start year';
    }
  }

  return errors;
}

const MAX_ENTRIES = 3;

// ─── Field input ──────────────────────────────────────────────────────────────

function Field({
  label, value, onChangeText, placeholder, keyboardType = 'default', colors, error, editable = true,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder: string; keyboardType?: any; colors: AppColors; error?: string; editable?: boolean;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: error ? '#FF3B30' : colors.textSecondary }]}>{label}</Text>
      <Squircle
        style={styles.inputBox}
        cornerRadius={14}
        cornerSmoothing={1}
        fillColor={colors.surface2}
        strokeColor={error ? '#FF3B30' : colors.border}
        strokeWidth={error ? 1.5 : 1}
      >
        <TextInput
          style={[styles.input, { color: editable ? colors.text : colors.textSecondary }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          keyboardType={keyboardType}
          selectionColor={colors.text}
          returnKeyType="next"
          editable={editable}
        />
      </Squircle>
      {!!error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

// ─── Job Title Field with autocomplete ────────────────────────────────────────

function JobTitleField({
  value, onChangeText, colors, error,
}: {
  value: string; onChangeText: (v: string) => void; colors: AppColors; error?: string;
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestions = showSuggestions ? matchTitles(value) : [];

  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: error ? '#FF3B30' : colors.textSecondary }]}>JOB TITLE</Text>
      <Squircle
        style={styles.inputBox}
        cornerRadius={14}
        cornerSmoothing={1}
        fillColor={colors.surface2}
        strokeColor={error ? '#FF3B30' : (showSuggestions && suggestions.length > 0 ? colors.text : colors.border)}
        strokeWidth={error || (showSuggestions && suggestions.length > 0) ? 1.5 : 1}
      >
        <TextInput
          style={[styles.input, { color: colors.text }]}
          value={value}
          onChangeText={v => { onChangeText(v); setShowSuggestions(true); }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder="e.g. Software Engineer"
          placeholderTextColor={colors.placeholder}
          selectionColor={colors.text}
          returnKeyType="next"
          autoCorrect={false}
        />
        {value.length > 0 && (
          <Pressable onPress={() => { onChangeText(''); setShowSuggestions(false); }} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
          </Pressable>
        )}
      </Squircle>
      {!!error && <Text style={styles.errorText}>{error}</Text>}
      {suggestions.length > 0 && (
        <Squircle
          style={styles.suggestionBox}
          cornerRadius={14}
          cornerSmoothing={1}
          fillColor={colors.surface}
          strokeColor={colors.border}
          strokeWidth={1}
        >
          {suggestions.map((s, i) => (
            <Pressable
              key={s}
              onPress={() => { onChangeText(s); setShowSuggestions(false); }}
              style={[styles.suggestionRow,
                i < suggestions.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }
              ]}
            >
              <Ionicons name="briefcase-outline" size={13} color={colors.textSecondary} />
              <Text style={[styles.suggestionText, { color: colors.text }]}>{s}</Text>
            </Pressable>
          ))}
        </Squircle>
      )}
    </View>
  );
}

// ─── Work Entry Card ──────────────────────────────────────────────────────────

function WorkCard({
  entry, onChange, onRemove, colors, errors,
}: {
  entry: WorkEntry;
  onChange: (updated: WorkEntry) => void;
  onRemove: () => void;
  colors: AppColors;
  errors?: EntryErrors;
}) {
  const set = (key: keyof WorkEntry) => (val: any) =>
    onChange({ ...entry, [key]: val });

  return (
    <Squircle
      style={styles.card}
      cornerRadius={22}
      cornerSmoothing={1}
      fillColor={colors.surface}
      strokeColor={errors && Object.keys(errors).length > 0 ? '#FF3B30' : colors.border}
      strokeWidth={1}
    >
      {/* Card header */}
      <View style={[styles.cardHeader, { borderBottomColor: colors.border }]}>
        <View style={styles.cardHeaderLeft}>
          <Squircle style={styles.cardIcon} cornerRadius={12} cornerSmoothing={1} fillColor={colors.surface2}>
            <Ionicons name="briefcase-outline" size={16} color={colors.text} />
          </Squircle>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            {entry.jobTitle || 'New Experience'}
          </Text>
        </View>
        <Pressable onPress={onRemove} hitSlop={10}>
          <Squircle style={styles.removeBtn} cornerRadius={10} cornerSmoothing={1} fillColor={colors.surface2}>
            <Ionicons name="trash-outline" size={14} color={colors.error ?? '#FF3B30'} />
          </Squircle>
        </Pressable>
      </View>

      <View style={styles.cardBody}>
        <JobTitleField value={entry.jobTitle} onChangeText={set('jobTitle')} colors={colors} error={errors?.jobTitle} />
        <Field label="COMPANY" value={entry.company} onChangeText={set('company')}
          placeholder="e.g. Adobe" colors={colors} error={errors?.company} />

        <View style={styles.yearRow}>
          <View style={{ flex: 1 }}>
            <Field label="START YEAR" value={entry.startYear} onChangeText={set('startYear')}
              placeholder="2020" keyboardType="numeric" colors={colors} error={errors?.startYear} />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="END YEAR"
              value={entry.current ? 'Present' : entry.endYear}
              onChangeText={set('endYear')}
              placeholder="2023"
              keyboardType="numeric"
              colors={colors}
              editable={!entry.current}
              error={entry.current ? undefined : errors?.endYear}
            />
          </View>
        </View>

        {/* Current role toggle */}
        <View style={[styles.toggleRow, { borderTopColor: colors.border }]}>
          <Text style={[styles.toggleLabel, { color: colors.text }]}>Current role</Text>
          <Switch
            value={entry.current}
            onValueChange={v => { set('current')(v); if (v) set('endYear')(''); }}
            thumbColor={colors.bg}
            trackColor={{ false: colors.surface2, true: colors.text }}
          />
        </View>
      </View>
    </Squircle>
  );
}

// ─── Work Experience Page ─────────────────────────────────────────────────────

export default function WorkExperiencePage() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { profile, token, updateProfile } = useAuth();
  const [linkedInLoading, setLinkedInLoading] = useState(false);
  const [linkedInConnected, setLinkedInConnected] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, EntryErrors>>({});

  const [entries, setEntries] = useState<WorkEntry[]>(() => {
    const we = profile?.work_experience;
    if (we?.length) {
      return we.map((w, i) => ({
        id: String(i + 1),
        jobTitle: w.job_title ?? '',
        company: w.company ?? '',
        startYear: w.start_year ?? '',
        endYear: w.end_year ?? '',
        current: w.current ?? false,
      }));
    }
    return [{ id: '1', jobTitle: '', company: '', startYear: '', endYear: '', current: false }];
  });

  // ── LinkedIn OAuth result handler ─────────────────────────────────────────
  // No deep-link listener needed — WebBrowser.openAuthSessionAsync intercepts
  // the redirect directly and returns result.url with the code.

  const handleLinkedInRedirect = async (url: string) => {
    if (!url.includes('code=')) return;

    // Extract code from URL query params (works for both https:// and deep links)
    let code: string | undefined;
    try {
      const urlObj = new URL(url);
      code = urlObj.searchParams.get('code') ?? undefined;
    } catch {
      // Fallback for non-standard URLs
      const match = url.match(/[?&]code=([^&]+)/);
      code = match?.[1];
    }

    if (!code || !token) return;

    setLinkedInLoading(true);
    try {
      const imported = await apiFetch<{
        job_title: string; company: string; start_year: string;
        end_year: string; current: boolean;
      }[]>('/linkedin/import-work', {
        method: 'POST',
        token,
        body: JSON.stringify({ code, redirect_uri: LINKEDIN_REDIRECT_URI }),
      });

      if (imported.length === 0) {
        Alert.alert('No Experience Found', 'LinkedIn returned no work experience. Make sure your profile is public and has positions listed.');
        return;
      }

      const mapped: WorkEntry[] = imported.map((e, i) => ({
        id: Date.now().toString() + i,
        jobTitle: e.job_title,
        company: e.company,
        startYear: e.start_year,
        endYear: e.end_year,
        current: e.current,
      }));
      setEntries(mapped);
      setLinkedInConnected(true);
      Alert.alert('Imported!', `${mapped.length} experience${mapped.length > 1 ? 's' : ''} imported from LinkedIn.`);
    } catch (e: any) {
      Alert.alert('Import Failed', e.message ?? 'Could not import from LinkedIn.');
    } finally {
      setLinkedInLoading(false);
    }
  };

  const connectLinkedIn = async () => {
    setLinkedInLoading(true);
    try {
      const url = buildLinkedInAuthUrl();
      const result = await WebBrowser.openAuthSessionAsync(url, LINKEDIN_REDIRECT_URI);
      if (result.type === 'success' && result.url) {
        await handleLinkedInRedirect(result.url);
      }
    } catch {
      Alert.alert('Error', 'Could not open LinkedIn. Please try again.');
    } finally {
      setLinkedInLoading(false);
    }
  };

  // ── Entry management ───────────────────────────────────────────────────────
  const addEntry = () => {
    if (entries.length >= MAX_ENTRIES) return;
    setEntries(prev => [...prev, {
      id: Date.now().toString(),
      jobTitle: '', company: '', startYear: '', endYear: '', current: false,
    }]);
  };

  const updateEntry = (id: string, updated: WorkEntry) =>
    setEntries(prev => prev.map(e => e.id === id ? updated : e));

  const removeEntry = (id: string) =>
    setEntries(prev => prev.filter(e => e.id !== id));

  const handleSave = async () => {
    // Validate all entries first
    const allErrors: Record<string, EntryErrors> = {};
    entries.forEach(e => {
      const errs = validateEntry(e);
      if (Object.keys(errs).length > 0) allErrors[e.id] = errs;
    });
    if (Object.keys(allErrors).length > 0) {
      setFieldErrors(allErrors);
      return;
    }
    setFieldErrors({});
    setSaving(true);
    try {
      const payload = entries.map(e => ({
        job_title: e.jobTitle.trim(),
        company: e.company.trim(),
        start_year: e.startYear.trim(),
        end_year: e.current ? '' : e.endYear.trim(),
        current: e.current,
      }));
      const updated = await apiFetch<any>('/profile/me', {
        method: 'PATCH',
        token: token ?? undefined,
        body: JSON.stringify({ work_experience: payload }),
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
          title="Work Experience"
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
                    {linkedInConnected ? 'Imported · tap to refresh' : 'Auto-fill your experience'}
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

          {/* Entry cards */}
          {entries.map(entry => (
            <WorkCard
              key={entry.id}
              entry={entry}
              onChange={updated => {
                updateEntry(entry.id, updated);
                // Clear errors for this entry as user edits
                if (fieldErrors[entry.id]) {
                  setFieldErrors(prev => {
                    const next = { ...prev };
                    delete next[entry.id];
                    return next;
                  });
                }
              }}
              onRemove={() => {
                removeEntry(entry.id);
                setFieldErrors(prev => { const n = { ...prev }; delete n[entry.id]; return n; });
              }}
              colors={colors}
              errors={fieldErrors[entry.id]}
            />
          ))}

          {/* Add button */}
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
                  Add Experience
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
  safe:             { flex: 1 },
  flex:             { flex: 1 },
  scroll:           { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 48, gap: 14 },

  // LinkedIn
  linkedInBanner:   { overflow: 'hidden' },
  linkedInInner:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, gap: 10 },
  linkedInLeft:     { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  linkedInIcon:     { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  linkedInTitle:    { fontSize: 14, fontFamily: 'ProductSans-Bold', color: '#fff' },
  linkedInSub:      { fontSize: 11, fontFamily: 'ProductSans-Regular', color: 'rgba(255,255,255,0.7)' },
  linkedInBtn:      { backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  linkedInBtnText:  { fontSize: 12, fontFamily: 'ProductSans-Bold', color: '#0A66C2' },

  // Card
  card:             { overflow: 'hidden' },
  cardHeader:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  cardHeaderLeft:   { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  cardIcon:         { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  cardTitle:        { fontSize: 14, fontFamily: 'ProductSans-Bold', flex: 1 },
  removeBtn:        { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  cardBody:         { padding: 14, gap: 12 },

  // Field
  fieldWrap:        { gap: 5 },
  fieldLabel:       { fontSize: 11, fontFamily: 'ProductSans-Bold', letterSpacing: 0.5 },
  inputBox:         { height: 46, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' },
  input:            { flex: 1, fontSize: 15, fontFamily: 'ProductSans-Regular' },
  errorText:        { fontSize: 11, fontFamily: 'ProductSans-Regular', color: '#FF3B30', marginTop: 2 },

  // Autocomplete suggestions
  suggestionBox:    { overflow: 'hidden', marginTop: 4 },
  suggestionRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  suggestionText:   { fontSize: 14, fontFamily: 'ProductSans-Regular', flex: 1 },

  yearRow:          { flexDirection: 'row', gap: 10 },

  // Toggle
  toggleRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
  toggleLabel:      { fontSize: 14, fontFamily: 'ProductSans-Regular' },

  // Add button
  addBtn:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  addBtnText:       { fontSize: 15, fontFamily: 'ProductSans-Bold' },
});
