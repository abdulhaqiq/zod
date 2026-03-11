import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import ChipSelectorSheet, { type ChipOption } from '@/components/ui/ChipSelectorSheet';
import WheelPickerSheet from '@/components/ui/WheelPickerSheet';
import VoiceSection from '@/components/ui/VoiceSection';
import Squircle from '@/components/ui/Squircle';
import { API_BASE, apiFetch } from '@/constants/api';
import { useAuth } from '@/context/AuthContext';
import { useProfileSave } from '@/hooks/useProfileSave';
import type { AppColors } from '@/constants/appColors';

// ─── Height helpers ───────────────────────────────────────────────────────────

const HEIGHT_LABELS: { cm: number; label: string }[] = [
  { cm: 147, label: "4'10\" (147cm)" }, { cm: 150, label: "4'11\" (150cm)" },
  { cm: 152, label: "5'0\" (152cm)" },  { cm: 155, label: "5'1\" (155cm)" },
  { cm: 157, label: "5'2\" (157cm)" },  { cm: 160, label: "5'3\" (160cm)" },
  { cm: 163, label: "5'4\" (163cm)" },  { cm: 165, label: "5'5\" (165cm)" },
  { cm: 168, label: "5'6\" (168cm)" },  { cm: 170, label: "5'7\" (170cm)" },
  { cm: 173, label: "5'8\" (173cm)" },  { cm: 175, label: "5'9\" (175cm)" },
  { cm: 178, label: "5'10\" (178cm)" }, { cm: 180, label: "5'11\" (180cm)" },
  { cm: 183, label: "6'0\" (183cm)" },  { cm: 185, label: "6'1\" (185cm)" },
  { cm: 188, label: "6'2\" (188cm)" },  { cm: 191, label: "6'3\" (191cm)" },
  { cm: 193, label: "6'4\" (193cm)" },  { cm: 196, label: "6'5\" (196cm)" },
];

const cmToLabel = (cm: number | null): string => {
  if (!cm) return '—';
  const match = HEIGHT_LABELS.find(h => h.cm === cm);
  return match?.label ?? `${cm}cm`;
};

const labelToCm = (label: string): number | null => {
  const match = HEIGHT_LABELS.find(h => h.label === label);
  return match?.cm ?? null;
};

// ─── Lookup option cache (module-level so it persists across renders) ─────────

type LookupMap = Record<string, ChipOption[]>;
let _cachedLookups: LookupMap | null = null;

async function fetchAllLookups(): Promise<LookupMap> {
  if (_cachedLookups) return _cachedLookups;
  try {
    const res = await fetch(`${API_BASE}/api/v1/lookup/options`);
    if (!res.ok) throw new Error('lookup fetch failed');
    const data = await res.json() as Record<string, Array<{ emoji?: string; label: string }>>;
    const map: LookupMap = {};
    for (const [cat, rows] of Object.entries(data)) {
      map[cat] = rows.map(r => ({ emoji: r.emoji ?? undefined, label: r.label }));
    }
    _cachedLookups = map;
    return map;
  } catch {
    return {};
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCol({ label, value, colors }: { label: string; value: string; colors: AppColors }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={[styles.statVal,   { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

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

function EditRow({
  icon, label, value, preview, onPress, colors, accentIcon = false, last = false,
}: {
  icon: any; label: string; value?: string; preview?: string; onPress?: () => void;
  colors: AppColors; accentIcon?: boolean; last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.editRow,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
        pressed && { opacity: 0.65 },
      ]}
    >
      <Squircle style={styles.editIconWrap} cornerRadius={10} cornerSmoothing={1}
        fillColor={accentIcon ? '#833ab4' : colors.surface2}>
        <Ionicons name={icon} size={16} color={accentIcon ? '#fff' : colors.text} />
      </Squircle>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={[styles.editLabel, { color: colors.text }]}>{label}</Text>
        {preview ? (
          <Text style={[styles.editPreview, { color: colors.textSecondary }]} numberOfLines={1}>{preview}</Text>
        ) : null}
      </View>
      {value ? <Text style={[styles.editValue, { color: colors.textSecondary }]}>{value}</Text> : null}
      <Ionicons name="chevron-forward" size={15} color={colors.textSecondary} />
    </Pressable>
  );
}

function SettingRow({
  icon, label, subtitle, value, onPress, colors, danger = false,
  toggle, toggleVal, onToggle, locked = false,
}: {
  icon: any; label: string; subtitle?: string; value?: string; onPress?: () => void;
  colors: AppColors; danger?: boolean; locked?: boolean;
  toggle?: boolean; toggleVal?: boolean; onToggle?: (v: boolean) => void;
}) {
  return (
    <Pressable
      onPress={locked ? () => onPress?.() : onPress}
      style={({ pressed }) => [
        styles.settingRow,
        { borderBottomColor: colors.border },
        locked && { opacity: 0.55 },
        pressed && !toggle && !locked && { opacity: 0.6 },
      ]}
    >
      <Squircle style={styles.settingIconWrap} cornerRadius={10} cornerSmoothing={1} fillColor={colors.surface2}>
        <Ionicons name={icon} size={17} color={danger ? colors.error : colors.text} />
      </Squircle>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.settingLabel, { color: danger ? colors.error : colors.text }]}>{label}</Text>
        {subtitle ? (
          <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? <Text style={[styles.settingValue, { color: colors.textSecondary }]}>{value}</Text> : null}
      {locked ? (
        <Ionicons name="lock-closed" size={15} color={colors.textSecondary} />
      ) : toggle ? (
        <Switch
          value={toggleVal}
          onValueChange={onToggle}
          thumbColor={colors.bg}
          trackColor={{ false: colors.surface2, true: colors.text }}
        />
      ) : (
        !value && <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
      )}
    </Pressable>
  );
}

// ─── My Profile Page ──────────────────────────────────────────────────────────

export default function MyProfilePage({ colors, insets }: { colors: AppColors; insets: any }) {
  const router = useRouter();
  const { token, refreshToken, signOut, profile } = useAuth();
  const { save } = useProfileSave();

  // ── Lookup options from backend ───────────────────────────────────────────
  const [lookups, setLookups] = useState<LookupMap>(_cachedLookups ?? {});
  const lookupsLoaded = useRef(false);

  useEffect(() => {
    if (lookupsLoaded.current) return;
    lookupsLoaded.current = true;
    fetchAllLookups().then(setLookups);
  }, []);

  const opts = (cat: string): ChipOption[] => lookups[cat] ?? [];

  // ── Derive display values from real profile ───────────────────────────────
  const avatarUrl  = profile?.photos?.[0] ?? null;
  const displayName = profile?.full_name ?? '—';
  const heightLabel = cmToLabel(profile?.height_cm ?? null);

  // Lifestyle sub-fields live in the JSONB lifestyle dict
  const lf = (profile?.lifestyle as Record<string, string> | null) ?? {};

  // Local editable state initialised from real profile
  const [height,         setHeight]         = useState(heightLabel);
  const [exercise,       setExercise]       = useState(lf.exercise       ?? '');
  const [educationLevel, setEducationLevel] = useState(profile?.education_level ?? '');
  const [drinking,       setDrinking]       = useState(lf.drinking       ?? '');
  const [smoking,        setSmoking]        = useState(lf.smoking        ?? '');
  const [lookingFor,     setLookingFor]     = useState(profile?.looking_for   ?? '');
  const [familyPlans,    setFamilyPlans]    = useState(profile?.family_plans  ?? '');
  const [haveKids,       setHaveKids]       = useState(profile?.have_kids     ?? '');
  const [starSign,       setStarSign]       = useState(profile?.star_sign     ?? '');
  const [religion,       setReligion]       = useState(profile?.religion      ?? '');
  const [languages,      setLanguages]      = useState<string[]>(profile?.languages ?? []);

  const [snooze, setSnooze] = useState(false);

  // Sync if profile loads after mount
  useEffect(() => {
    if (!profile) return;
    const ls = (profile.lifestyle as Record<string, string> | null) ?? {};
    setHeight(cmToLabel(profile.height_cm));
    setExercise(ls.exercise       ?? '');
    setEducationLevel(profile.education_level ?? '');
    setDrinking(ls.drinking       ?? '');
    setSmoking(ls.smoking         ?? '');
    setLookingFor(profile.looking_for   ?? '');
    setFamilyPlans(profile.family_plans ?? '');
    setHaveKids(profile.have_kids       ?? '');
    setStarSign(profile.star_sign       ?? '');
    setReligion(profile.religion        ?? '');
    setLanguages(profile.languages      ?? []);
  }, [profile?.id]);

  // ── Save helpers ─────────────────────────────────────────────────────────

  const saveField = async (fields: Record<string, unknown>) => {
    await save(fields);
  };

  // ── Pickers ───────────────────────────────────────────────────────────────

  // Native wheel picker (single-select fields)
  interface WheelState { title: string; options: string[]; selected: string; onDone: (v: string) => void; }
  const [wheel, setWheel] = useState<WheelState | null>(null);

  // Chip sheet — single-select (About You fields) or multi-select (Languages)
  interface ChipState { title: string; subtitle?: string; options: ChipOption[]; selected: string[]; single?: boolean; onDone: (vals: string[]) => void; }
  const [chipPicker, setChipPicker] = useState<ChipState | null>(null);

  const openWheel = (cfg: WheelState) => setWheel(cfg);
  const [showHeightWheel] = useState(false); // kept for compat — height now uses wheel too

  // ── Log out ───────────────────────────────────────────────────────────────

  const handleLogOut = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out', style: 'destructive',
        onPress: async () => {
          try {
            if (refreshToken) {
              await apiFetch('/auth/logout', {
                method: 'POST', token: token ?? undefined,
                body: JSON.stringify({ refresh_token: refreshToken }),
              });
            }
          } catch { /* sign out locally regardless */ }
          await signOut();
          router.replace('/welcome');
        },
      },
    ]);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={[styles.igHeaderWrap, { borderBottomColor: colors.border }]}>
        <View style={styles.igHeader}>
          {avatarUrl ? (
            <ExpoImage source={{ uri: avatarUrl }} style={styles.avatarImage} contentFit="cover" cachePolicy="memory-disk" transition={200} />
          ) : (
            <View style={[styles.avatarImage, styles.avatarPlaceholder, { backgroundColor: colors.surface2 }]}>
              <Ionicons name="person" size={28} color={colors.textSecondary} />
            </View>
          )}
          <View style={styles.igRight}>
            <Text style={[styles.igName, { color: colors.text }]}>{displayName}</Text>
            <View style={styles.actionRow}>
              <Pressable
                style={[styles.actionBtn, { borderWidth: 1, borderColor: colors.border }]}
                onPress={() => router.push('/edit-profile')}
              >
                <Ionicons name="create-outline" size={12} color={colors.text} />
                <Text style={[styles.actionBtnText, { color: colors.text }]}>Edit Profile</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.statsRow}>
          <StatCol label="Photos"  value={String(profile?.photos?.length ?? 0)} colors={colors} />
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <StatCol label="Matches" value="—"  colors={colors} />
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <StatCol label="Views"   value="—" colors={colors} />
        </View>
      </View>

      {/* ── Subscription banner ─────────────────────────────────────────── */}
      <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
        <Pressable style={styles.subBanner} onPress={() => router.push('/subscription')}>
          <Ionicons name="star" size={14} color="#FFD60A" />
          <Text style={styles.subBannerPlan}>Zod Free</Text>
          <Text style={styles.subBannerSub}>· Unlock all features</Text>
          <View style={{ flex: 1 }} />
          <Text style={styles.subBannerCta}>Upgrade now</Text>
          <Ionicons name="chevron-forward" size={13} color="#c084fc" />
        </Pressable>
      </View>

      {/* ── ABOUT YOU ───────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <SectionLabel title="ABOUT YOU" colors={colors} />
        <Group colors={colors}>
          <EditRow icon="resize-outline" label="Height" value={height || '—'}
            onPress={() => openWheel({
              title: 'Height', options: HEIGHT_LABELS.map(h => h.label), selected: height,
              onDone: (v) => { setHeight(v); const cm = labelToCm(v); if (cm) saveField({ height_cm: cm }); },
            })} colors={colors} />

          <EditRow icon="fitness-outline" label="Exercise" value={exercise || '—'}
            onPress={() => setChipPicker({
              title: 'Exercise', options: opts('exercise'), single: true,
              selected: exercise ? [exercise] : [],
              onDone: ([v]) => { setExercise(v); saveField({ lifestyle: { ...lf, exercise: v } }); },
            })} colors={colors} />

          <EditRow icon="ribbon-outline" label="Education Level" value={educationLevel || '—'}
            onPress={() => setChipPicker({
              title: 'Education Level', options: opts('education_level'), single: true,
              selected: educationLevel ? [educationLevel] : [],
              onDone: ([v]) => { setEducationLevel(v); saveField({ education_level: v }); },
            })} colors={colors} />

          <EditRow icon="wine-outline" label="Drinking" value={drinking || '—'}
            onPress={() => setChipPicker({
              title: 'Drinking', options: opts('drinking'), single: true,
              selected: drinking ? [drinking] : [],
              onDone: ([v]) => { setDrinking(v); saveField({ lifestyle: { ...lf, drinking: v } }); },
            })} colors={colors} />

          <EditRow icon="flame-outline" label="Smoking" value={smoking || '—'}
            onPress={() => setChipPicker({
              title: 'Smoking', options: opts('smoking'), single: true,
              selected: smoking ? [smoking] : [],
              onDone: ([v]) => { setSmoking(v); saveField({ lifestyle: { ...lf, smoking: v } }); },
            })} colors={colors} />

          <EditRow icon="heart-outline" label="Looking For" value={lookingFor || '—'}
            onPress={() => setChipPicker({
              title: 'Looking For', options: opts('looking_for'), single: true,
              selected: lookingFor ? [lookingFor] : [],
              onDone: ([v]) => { setLookingFor(v); saveField({ looking_for: v }); },
            })} colors={colors} />

          <EditRow icon="people-outline" label="Family Plans" value={familyPlans || '—'}
            onPress={() => setChipPicker({
              title: 'Family Plans', options: opts('family_plans'), single: true,
              selected: familyPlans ? [familyPlans] : [],
              onDone: ([v]) => { setFamilyPlans(v); saveField({ family_plans: v }); },
            })} colors={colors} />

          <EditRow icon="happy-outline" label="Have Kids" value={haveKids || '—'}
            onPress={() => setChipPicker({
              title: 'Have Kids', options: opts('have_kids'), single: true,
              selected: haveKids ? [haveKids] : [],
              onDone: ([v]) => { setHaveKids(v); saveField({ have_kids: v }); },
            })} colors={colors} />

          <EditRow icon="star-outline" label="Star Sign" value={starSign || '—'}
            onPress={() => setChipPicker({
              title: 'Star Sign', options: opts('star_sign'), single: true,
              selected: starSign ? [starSign] : [],
              onDone: ([v]) => { setStarSign(v); saveField({ star_sign: v }); },
            })} colors={colors} />

          <EditRow icon="book-outline" label="Religion" value={religion || '—'}
            onPress={() => setChipPicker({
              title: 'Religion', options: opts('religion'), single: true,
              selected: religion ? [religion] : [],
              onDone: ([v]) => { setReligion(v); saveField({ religion: v }); },
            })} colors={colors} />

          <EditRow icon="language-outline" label="Languages"
            value={languages.length ? languages.join(', ') : '—'}
            onPress={() => setChipPicker({
              title: 'Languages', subtitle: 'Pick all that apply',
              options: opts('language'), single: false, selected: languages,
              onDone: (vals) => { setLanguages(vals); saveField({ languages: vals }); },
            })} colors={colors} last />
        </Group>
      </View>

      {/* ── VOICE PROMPTS ───────────────────────────────────────────────── */}
      <View style={styles.section}>
        <SectionLabel title="VOICE PROMPTS" colors={colors} />
        <Text style={[styles.voiceSubtitle, { color: colors.textSecondary }]}>
          Record up to 2 clips · 30 seconds each
        </Text>
        <VoiceSection colors={colors} />
      </View>

      {/* ── APP SETTINGS ────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <SectionLabel title="APP SETTINGS" colors={colors} />
        <Group colors={colors}>
          <SettingRow
            icon="moon-outline" label="Snooze Mode"
            subtitle="Pause your profile visibility"
            colors={colors} toggle toggleVal={snooze} onToggle={setSnooze}
          />
          <SettingRow
            icon="eye-off-outline" label="Incognito Mode"
            subtitle="Browse profiles without being seen"
            colors={colors} locked onPress={() => router.push('/subscription')}
          />
          <SettingRow
            icon="sparkles-outline" label="Auto Zod (AI)"
            subtitle="Let AI find your best matches daily"
            colors={colors} locked onPress={() => router.push('/subscription')}
          />
          <SettingRow
            icon="airplane-outline" label="Travel Mode"
            subtitle="Match with people in any city worldwide"
            colors={colors} locked onPress={() => router.push('/subscription')}
          />
          <SettingRow
            icon="location-outline" label="Change Location"
            subtitle="Update your current city"
            colors={colors} locked onPress={() => router.push('/subscription')}
          />
        </Group>
      </View>

      {/* ── ACCOUNT ─────────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <SectionLabel title="ACCOUNT" colors={colors} />
        <Group colors={colors}>
          <SettingRow icon="notifications-outline" label="Notifications"     colors={colors} onPress={() => router.push('/notifications')} />
          <SettingRow icon="shield-outline"        label="Security"          colors={colors} onPress={() => router.push('/security')} />
          <SettingRow icon="document-text-outline" label="Legal Information" colors={colors} onPress={() => router.push('/legal')} />
          <SettingRow icon="help-circle-outline"   label="Get Help"          colors={colors} onPress={() => router.push('/get-help')} />
          <SettingRow icon="card-outline"          label="Purchases"         colors={colors} onPress={() => router.push('/purchases')} />
        </Group>
      </View>

      {/* ── ACCOUNT ACTIONS ─────────────────────────────────────────────── */}
      <View style={[styles.section, { marginBottom: 10 }]}>
        <SectionLabel title="ACCOUNT ACTIONS" colors={colors} />
        <Group colors={colors}>
          <SettingRow icon="log-out-outline" label="Log Out" colors={colors} danger onPress={handleLogOut} />
          <SettingRow icon="trash-outline" label="Delete Account" colors={colors} danger
            onPress={() => Alert.alert('Delete Account', 'This action is permanent and cannot be undone.',
              [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive' }])} />
        </Group>
      </View>

      {/* ── Native wheel picker (single-select) ─────────────────────────── */}
      {wheel && (
        <WheelPickerSheet
          visible={!!wheel}
          onClose={() => setWheel(null)}
          title={wheel.title}
          options={wheel.options}
          selected={wheel.selected}
          onChange={val => { wheel.onDone(val); setWheel(null); }}
          colors={colors}
        />
      )}

      {/* ── Chip picker (single-select fields + multi-select Languages) ──── */}
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
          onChange={vals => {
            chipPicker.onDone(vals);
            setChipPicker(null);
          }}
          colors={colors}
        />
      )}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  igHeaderWrap:      { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 14 },
  igHeader:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, gap: 14 },
  igRight:           { flex: 1, gap: 8 },
  igName:            { fontSize: 18, fontFamily: 'ProductSans-Black' },

  statsRow:          { flexDirection: 'row', alignItems: 'center', marginTop: 14, paddingHorizontal: 16, justifyContent: 'space-around' },
  statVal:           { fontSize: 15, fontFamily: 'ProductSans-Black', textAlign: 'center' },
  statLabel:         { fontSize: 10, fontFamily: 'ProductSans-Regular', textAlign: 'center', marginTop: 1 },
  statDivider:       { width: StyleSheet.hairlineWidth, height: 26, marginHorizontal: 4 },

  actionRow:         { flexDirection: 'row', gap: 8, marginTop: 2 },
  actionBtn:         { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 22, paddingVertical: 11 },
  actionBtnText:     { fontSize: 12, fontFamily: 'ProductSans-Bold' },

  subBanner:         { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1a0a2e', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13 },
  subBannerPlan:     { fontSize: 13, fontFamily: 'ProductSans-Bold', color: '#fff' },
  subBannerSub:      { fontSize: 12, fontFamily: 'ProductSans-Regular', color: 'rgba(255,255,255,0.45)' },
  subBannerCta:      { fontSize: 12, fontFamily: 'ProductSans-Bold', color: '#c084fc' },

  section:           { paddingHorizontal: 16, marginTop: 22, gap: 6 },
  sectionLabel:      { fontSize: 12, fontFamily: 'ProductSans-Bold', letterSpacing: 1.5, marginLeft: 2, marginBottom: 2 },
  voiceSubtitle:     { fontSize: 12, fontFamily: 'ProductSans-Regular', marginBottom: 4, marginLeft: 2 },

  group:             { overflow: 'hidden' },

  editRow:           { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13 },
  editIconWrap:      { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  editLabel:         { fontSize: 14, fontFamily: 'ProductSans-Regular' },
  editPreview:       { fontSize: 11, fontFamily: 'ProductSans-Regular' },
  editValue:         { fontSize: 12, fontFamily: 'ProductSans-Regular', maxWidth: 130, textAlign: 'right' },

  settingRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  settingIconWrap:   { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  settingLabel:      { fontSize: 15, fontFamily: 'ProductSans-Regular' },
  settingSubtitle:   { fontSize: 11, fontFamily: 'ProductSans-Regular' },
  settingValue:      { fontSize: 13, fontFamily: 'ProductSans-Regular', maxWidth: 120, textAlign: 'right' },

  avatarImage:       { width: 64, height: 64, borderRadius: 32 },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
});
