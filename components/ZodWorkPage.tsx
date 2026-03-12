import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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
import ChipSelectorSheet, { type ChipOption } from '@/components/ui/ChipSelectorSheet';
import ScreenHeader from '@/components/ui/ScreenHeader';
import Squircle from '@/components/ui/Squircle';
import { apiFetch } from '@/constants/api';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';
import type { AppColors } from '@/constants/appColors';
import { fetchWorkLookups, getCachedWorkLookups, resolveLabel, resolveLabels, type WorkLookupMap } from '@/utils/workLookups';

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ title, colors }: { title: string; colors: AppColors }) {
  return <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{title}</Text>;
}

function Group({ children, colors }: { children: React.ReactNode; colors: AppColors }) {
  return (
    <Squircle style={styles.group} cornerRadius={22} cornerSmoothing={1}
      fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
      {children}
    </Squircle>
  );
}

function Row({
  icon, label, value, preview, onPress, colors, last = false,
}: {
  icon: any; label: string; value?: string; preview?: string;
  onPress?: () => void; colors: AppColors; last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
        pressed && { opacity: 0.65 },
      ]}
    >
      <Squircle style={styles.iconWrap} cornerRadius={10} cornerSmoothing={1} fillColor={colors.surface2}>
        <Ionicons name={icon} size={16} color={colors.text} />
      </Squircle>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
        {preview ? (
          <Text style={[styles.rowPreview, { color: colors.textSecondary }]} numberOfLines={2}>{preview}</Text>
        ) : null}
      </View>
      {value ? <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{value}</Text> : null}
      <Ionicons name="chevron-forward" size={15} color={colors.textSecondary} />
    </Pressable>
  );
}

function ToggleRow({
  icon, label, subtitle, value, onChange, colors, last = false,
}: {
  icon: any; label: string; subtitle?: string;
  value: boolean; onChange: (v: boolean) => void;
  colors: AppColors; last?: boolean;
}) {
  return (
    <View style={[
      styles.row,
      !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    ]}>
      <Squircle style={styles.iconWrap} cornerRadius={10} cornerSmoothing={1} fillColor={colors.surface2}>
        <Ionicons name={icon} size={16} color={colors.text} />
      </Squircle>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
        {subtitle ? (
          <Text style={[styles.rowPreview, { color: colors.textSecondary }]}>{subtitle}</Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={(v) => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onChange(v);
        }}
        thumbColor={colors.bg}
        trackColor={{ false: colors.surface2, true: colors.text }}
      />
    </View>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ZodWorkPage() {
  const router = useRouter();
  const { token, profile, updateProfile } = useAuth();
  const { colors } = useAppTheme();

  // ── Lookup options from DB ────────────────────────────────────────────────
  const [lookups, setLookups] = useState<WorkLookupMap>(getCachedWorkLookups() ?? {});
  const lookupsLoaded = useRef(false);

  useEffect(() => {
    if (lookupsLoaded.current) return;
    lookupsLoaded.current = true;
    fetchWorkLookups().then(setLookups);
  }, []);

  const opts = (cat: string): ChipOption[] => lookups[cat] ?? [];

  // ── Local state from profile — stored as string IDs for ChipSelectorSheet ──
  const [matchingGoals,   setMatchingGoals]   = useState<string[]>((profile?.work_matching_goals ?? []).map(String));
  const [hiring,          setHiring]          = useState<boolean>(profile?.work_are_you_hiring ?? false);
  const [commitmentLevel, setCommitmentLevel] = useState(profile?.work_commitment_level_id ? String(profile.work_commitment_level_id) : '');
  const [skills,          setSkills]          = useState<string[]>((profile?.work_skills ?? []).map(String));
  const [equitySplit,     setEquitySplit]      = useState(profile?.work_equity_split_id ? String(profile.work_equity_split_id) : '');
  const [industries,      setIndustries]      = useState<string[]>((profile?.work_industries ?? []).map(String));
  const [schedulingUrl,   setSchedulingUrl]   = useState(profile?.work_scheduling_url ?? '');
  const [whoToShow,       setWhoToShow]       = useState(profile?.work_who_to_show_id ? String(profile.work_who_to_show_id) : '');
  const [priorityStartup, setPriorityStartup] = useState<boolean>(profile?.work_priority_startup ?? false);
  const [urlFocused,      setUrlFocused]      = useState(false);

  // Sync when profile loads after mount
  useEffect(() => {
    if (!profile) return;
    setMatchingGoals((profile.work_matching_goals ?? []).map(String));
    setHiring(profile.work_are_you_hiring ?? false);
    setCommitmentLevel(profile.work_commitment_level_id ? String(profile.work_commitment_level_id) : '');
    setSkills((profile.work_skills ?? []).map(String));
    setEquitySplit(profile.work_equity_split_id ? String(profile.work_equity_split_id) : '');
    setIndustries((profile.work_industries ?? []).map(String));
    setSchedulingUrl(profile.work_scheduling_url ?? '');
    setWhoToShow(profile.work_who_to_show_id ? String(profile.work_who_to_show_id) : '');
    setPriorityStartup(profile.work_priority_startup ?? false);
  }, [profile?.id]);

  // ── Save helper ───────────────────────────────────────────────────────────
  const save = async (fields: Record<string, unknown>) => {
    try {
      await apiFetch('/profile/me', {
        method: 'PATCH', token: token ?? undefined,
        body: JSON.stringify(fields),
      });
      updateProfile(fields as any);
    } catch {
      Alert.alert('Error', 'Failed to save. Please try again.');
    }
  };

  // ── Chip picker ───────────────────────────────────────────────────────────
  interface ChipState {
    title: string; subtitle?: string; options: ChipOption[];
    selected: string[]; single?: boolean; onDone: (vals: string[]) => void;
  }
  const [chipPicker, setChipPicker] = useState<ChipState | null>(null);

  // ── Preview helpers: resolve DB IDs → human-readable labels ──────────────
  const previewOne  = (cat: string, id: string) =>
    id ? resolveLabel(lookups, cat, id) : '—';
  const previewList = (cat: string, ids: string[]) =>
    ids.length ? resolveLabels(lookups, cat, ids).join(', ') : 'Not set';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title="Zod Work" />
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── WORK PROFILE ─────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionLabel title="WORK PROFILE" colors={colors} />
          <Group colors={colors}>
            <Row
              icon="create-outline"
              label="Edit Work Profile"
              preview="Work photos & prompts"
              colors={colors}
              last
              onPress={() => router.push('/work-edit-profile')}
            />
          </Group>
        </View>

        {/* ── ABOUT MY WORK ────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionLabel title="ABOUT MY WORK" colors={colors} />
          <Group colors={colors}>

            <Row
              icon="people-outline"
              label="Matching Goals"
              preview={previewList('work_matching_goals', matchingGoals)}
              colors={colors}
              onPress={() => setChipPicker({
                title: 'Matching Goals', subtitle: 'Select all that apply',
                options: opts('work_matching_goals'), selected: matchingGoals, single: false,
                onDone: (vals) => { setMatchingGoals(vals); save({ work_matching_goals: vals.map(Number) }); },
              })}
            />

            <ToggleRow
              icon="megaphone-outline"
              label="Are You Hiring?"
              subtitle={hiring ? 'Yes, actively hiring' : 'Not currently hiring'}
              value={hiring}
              onChange={(v) => { setHiring(v); save({ work_are_you_hiring: v }); }}
              colors={colors}
            />

            <Row
              icon="time-outline"
              label="Commitment Level"
              value={previewOne('work_commitment_level', commitmentLevel)}
              colors={colors}
              onPress={() => setChipPicker({
                title: 'Commitment Level',
                options: opts('work_commitment_level'),
                selected: commitmentLevel ? [commitmentLevel] : [], single: true,
                onDone: ([v]) => { setCommitmentLevel(v); save({ work_commitment_level_id: Number(v) }); },
              })}
            />

            <Row
              icon="construct-outline"
              label="Skills & Experience"
              preview={previewList('work_skills', skills)}
              colors={colors}
              onPress={() => setChipPicker({
                title: 'Skills & Experience', subtitle: 'Select all that apply',
                options: opts('work_skills'), selected: skills, single: false,
                onDone: (vals) => { setSkills(vals); save({ work_skills: vals.map(Number) }); },
              })}
            />

            <Row
              icon="pie-chart-outline"
              label="Equity Split"
              value={previewOne('work_equity_split', equitySplit)}
              colors={colors}
              onPress={() => setChipPicker({
                title: 'Equity Split Preference',
                options: opts('work_equity_split'),
                selected: equitySplit ? [equitySplit] : [], single: true,
                onDone: ([v]) => { setEquitySplit(v); save({ work_equity_split_id: Number(v) }); },
              })}
            />

            <Row
              icon="grid-outline"
              label="Industries & Interests"
              preview={previewList('work_industries', industries)}
              colors={colors}
              onPress={() => setChipPicker({
                title: 'Industries & Interests', subtitle: 'Select all that apply',
                options: opts('work_industries'), selected: industries, single: false,
                onDone: (vals) => { setIndustries(vals); save({ work_industries: vals.map(Number) }); },
              })}
            />

            {/* Scheduling URL */}
            <View style={[styles.row, { borderBottomWidth: 0 }]}>
              <Squircle style={styles.iconWrap} cornerRadius={10} cornerSmoothing={1} fillColor={colors.surface2}>
                <Ionicons name="calendar-outline" size={16} color={colors.text} />
              </Squircle>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.rowLabel, { color: colors.text }]}>Scheduling Link</Text>
                <TextInput
                  value={schedulingUrl}
                  onChangeText={setSchedulingUrl}
                  onFocus={() => setUrlFocused(true)}
                  onBlur={() => {
                    setUrlFocused(false);
                    save({ work_scheduling_url: schedulingUrl });
                  }}
                  placeholder="e.g. calendly.com/yourname"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                  keyboardType="url"
                  style={[
                    styles.urlInput,
                    { color: colors.text, borderColor: urlFocused ? colors.text : 'transparent' },
                  ]}
                />
              </View>
            </View>
          </Group>
        </View>

        {/* ── EXPERIENCE & EDUCATION ───────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionLabel title="EXPERIENCE & EDUCATION" colors={colors} />
          <Group colors={colors}>
            <Row
              icon="briefcase-outline"
              label="My Experience"
              preview={
                profile?.work_experience?.length
                  ? `${profile.work_experience.length} entr${profile.work_experience.length === 1 ? 'y' : 'ies'} · import from LinkedIn`
                  : 'Import from LinkedIn · up to 10 entries'
              }
              colors={colors}
              onPress={() => router.push('/work-experience')}
            />
            <Row
              icon="school-outline"
              label="My Education"
              preview={
                profile?.education?.length
                  ? `${profile.education.length} entr${profile.education.length === 1 ? 'y' : 'ies'}`
                  : 'Add schools & degrees'
              }
              colors={colors}
              last
              onPress={() => router.push('/education')}
            />
          </Group>
        </View>

        {/* ── PREFERENCES ──────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionLabel title="PREFERENCES" colors={colors} />
          <Group colors={colors}>
            <Row
              icon="eye-outline"
              label="Who I Want to See"
              value={previewOne('work_who_to_show', whoToShow)}
              colors={colors}
              onPress={() => setChipPicker({
                title: 'Who I Want to See',
                options: opts('work_who_to_show'),
                selected: whoToShow ? [whoToShow] : [], single: true,
                onDone: ([v]) => { setWhoToShow(v); save({ work_who_to_show_id: Number(v) }); },
              })}
            />
            <ToggleRow
              icon="rocket-outline"
              label="Prioritise Startup Experience"
              subtitle="Show people with startup background first"
              value={priorityStartup}
              onChange={(v) => { setPriorityStartup(v); save({ work_priority_startup: v }); }}
              colors={colors}
              last
            />
          </Group>
        </View>

      </ScrollView>

      {/* ── Chip picker sheet ─────────────────────────────────────────────── */}
      {chipPicker && (
        <ChipSelectorSheet
          visible={!!chipPicker}
          onClose={() => setChipPicker(null)}
          title={chipPicker.title}
          subtitle={chipPicker.subtitle}
          singleSelect={chipPicker.single ?? false}
          maxSelect={chipPicker.single ? 1 : 99}
          options={chipPicker.options}
          selected={chipPicker.selected}
          onChange={(vals) => { chipPicker.onDone(vals); setChipPicker(null); }}
          colors={colors}
        />
      )}
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  section:      { paddingHorizontal: 16, marginTop: 22, gap: 6 },
  sectionLabel: { fontSize: 12, fontFamily: 'ProductSans-Bold', letterSpacing: 1.5, marginLeft: 2, marginBottom: 2 },
  group:        { overflow: 'hidden' },
  row:          { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13 },
  iconWrap:     { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rowLabel:     { fontSize: 14, fontFamily: 'ProductSans-Regular' },
  rowPreview:   { fontSize: 11, fontFamily: 'ProductSans-Regular' },
  rowValue:     { fontSize: 12, fontFamily: 'ProductSans-Regular', maxWidth: 140, textAlign: 'right' },
  urlInput:     { fontSize: 12, fontFamily: 'ProductSans-Regular', paddingVertical: 4, paddingHorizontal: 8, borderWidth: 1, borderRadius: 8 },
});
