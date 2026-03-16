import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import ChipSelectorSheet, { type ChipOption } from '@/components/ui/ChipSelectorSheet';
import WheelPickerSheet from '@/components/ui/WheelPickerSheet';
import VoiceSection from '@/components/ui/VoiceSection';
import Squircle from '@/components/ui/Squircle';
import { API_V1, apiFetch } from '@/constants/api';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';
import { getLookupLabel, getLookupLabels } from '@/constants/lookupData';
import { useProfileSave } from '@/hooks/useProfileSave';
import type { AppColors } from '@/constants/appColors';

// ─── Height helpers ───────────────────────────────────────────────────────────

const HEIGHT_LABELS: { cm: number; label: string }[] = [
  { cm: 137, label: "4'6\" (137cm)" },  { cm: 140, label: "4'7\" (140cm)" },
  { cm: 142, label: "4'8\" (142cm)" },  { cm: 145, label: "4'9\" (145cm)" },
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
  { cm: 198, label: "6'6\" (198cm)" },  { cm: 201, label: "6'7\" (201cm)" },
  { cm: 203, label: "6'8\" (203cm)" },  { cm: 206, label: "6'9\" (206cm)" },
  { cm: 208, label: "6'10\" (208cm)" }, { cm: 211, label: "6'11\" (211cm)" },
  { cm: 213, label: "7'0\" (213cm)" },  { cm: 216, label: "7'1\" (216cm)" },
  { cm: 218, label: "7'2\" (218cm)" },  { cm: 221, label: "7'3\" (221cm)" },
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
    const res = await fetch(`${API_V1}/lookup/options`);
    if (!res.ok) throw new Error('lookup fetch failed');
    const data = await res.json() as Record<string, Array<{ id: number; emoji?: string; label: string }>>;
    const map: LookupMap = {};
    for (const [cat, rows] of Object.entries(data)) {
      // Store id as the `value` field so ChipSelectorSheet returns the ID (as string)
      map[cat] = rows.map(r => ({ value: String(r.id), emoji: r.emoji ?? undefined, label: r.label }));
    }
    _cachedLookups = map;
    return map;
  } catch {
    return {};
  }
}

// ─── Mood emoji categories ────────────────────────────────────────────────────

const MOOD_CATEGORIES: { label: string; icon: string; emojis: string[] }[] = [
  {
    label: 'Feelings',
    icon: '😊',
    emojis: ['😀','😄','😁','😆','😅','😂','🤣','😊','😇','🥰','😍','🤩','😘','😗','😎','🤗','🤭','🫣','🤔','😏','😌','😴','🥱','😤','😭','😢','🥹','😳','🫠','🤯','🥳','🤪','😜','😝','🤑','🤠','👻'],
  },
  {
    label: 'Activities',
    icon: '🎯',
    emojis: ['🏃','🧘','🏋️','🚴','🎮','🎧','🎵','🎶','📚','💻','🎨','✍️','📸','🎬','🎤','🎸','🎯','🏆','⚽','🏀','🎾','🏊','🧗','🤿','✈️','🌊','🏕️','🌙','☀️','🔥','⚡','❄️'],
  },
  {
    label: 'Food & Drink',
    icon: '☕',
    emojis: ['☕','🍵','🧃','🍺','🍷','🍸','🥂','🧉','🍕','🍣','🍜','🌮','🍔','🥗','🍩','🍰','🍫','🍓','🍉','🥑','🌶️','🥐','🧇','🍿'],
  },
  {
    label: 'Hearts',
    icon: '❤️',
    emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💕','💞','💖','💘','💝','💗','💓','💟','❣️','💔','🫶','💌','🫀'],
  },
  {
    label: 'Nature',
    icon: '🌸',
    emojis: ['🌸','🌺','🌻','🌹','🌷','🌼','💐','🍀','🌿','🌱','🌴','🌵','🍄','🌈','⛅','🌤️','🌙','⭐','🌟','✨','☃️','🌊','🌋','🏔️','🌅','🌆'],
  },
  {
    label: 'Objects',
    icon: '💡',
    emojis: ['💡','💎','🔑','🎁','🎀','🎊','🎉','🪄','🔮','🧲','⚗️','🧪','📱','💬','📩','🗓️','🚀','🛸','🛺','⛵','🏡','🕍','🗽','🎡'],
  },
];

// ─── MoodPickerModal ──────────────────────────────────────────────────────────

function MoodPickerModal({
  visible,
  initialEmoji,
  initialText,
  colors,
  onSave,
  onClose,
}: {
  visible: boolean;
  initialEmoji: string;
  initialText: string;
  colors: AppColors;
  onSave: (emoji: string, text: string) => void;
  onClose: () => void;
}) {
  const [emoji, setEmoji]           = useState(initialEmoji);
  const [text,  setText]            = useState(initialText);
  const [catIdx, setCatIdx]         = useState(0);

  useEffect(() => {
    if (visible) { setEmoji(initialEmoji); setText(initialText); setCatIdx(0); }
  }, [visible]);

  const cat = MOOD_CATEGORIES[catIdx];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={moodStyles.backdrop} onPress={onClose} />
      <View style={[moodStyles.sheet, { backgroundColor: colors.surface }]}>

        {/* Handle */}
        <View style={[moodStyles.handle, { backgroundColor: colors.border }]} />

        {/* Header */}
        <View style={moodStyles.header}>
          <Text style={[moodStyles.title, { color: colors.text }]}>Mood Status</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* Preview + text input */}
        <View style={[moodStyles.inputRow, { backgroundColor: colors.bg, borderColor: colors.border }]}>
          <Text style={moodStyles.previewEmoji}>{emoji || '😊'}</Text>
          <TextInput
            style={[moodStyles.textInput, { color: colors.text }]}
            value={text}
            onChangeText={t => setText(t.slice(0, 60))}
            placeholder="What's your vibe today?"
            placeholderTextColor={colors.textTertiary}
            maxLength={60}
            returnKeyType="done"
          />
          {(emoji || text) ? (
            <Pressable hitSlop={10} onPress={() => { setEmoji(''); setText(''); }}>
              <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
            </Pressable>
          ) : null}
        </View>

        {/* Category tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={moodStyles.catScroll} contentContainerStyle={moodStyles.catContent}>
          {MOOD_CATEGORIES.map((c, i) => (
            <Pressable
              key={c.label}
              onPress={() => setCatIdx(i)}
              style={[
                moodStyles.catTab,
                i === catIdx && { backgroundColor: colors.accent ?? '#6C47FF' },
                { borderColor: colors.border },
              ]}
            >
              <Text style={moodStyles.catIcon}>{c.icon}</Text>
              <Text style={[moodStyles.catLabel, { color: i === catIdx ? '#fff' : colors.textSecondary }]}>{c.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Emoji grid */}
        <ScrollView style={moodStyles.gridScroll} showsVerticalScrollIndicator={false}>
          <View style={moodStyles.grid}>
            {cat.emojis.map(e => (
              <Pressable
                key={e}
                onPress={() => setEmoji(e)}
                style={[
                  moodStyles.emojiCell,
                  e === emoji && { backgroundColor: (colors.accent ?? '#6C47FF') + '33' },
                ]}
              >
                <Text style={moodStyles.emojiGlyph}>{e}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {/* Save */}
        <Pressable
          style={[moodStyles.saveBtn, { backgroundColor: colors.accent ?? '#6C47FF' }]}
          onPress={() => onSave(emoji, text)}
        >
          <Text style={moodStyles.saveTxt}>Save</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const moodStyles = StyleSheet.create({
  backdrop:     { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:        { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 36 },
  handle:       { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  title:        { fontSize: 17, fontFamily: 'ProductSans-Bold' },
  inputRow:     { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, gap: 10, marginBottom: 14 },
  previewEmoji: { fontSize: 26 },
  textInput:    { flex: 1, fontSize: 15, fontFamily: 'ProductSans-Regular' },
  catScroll:    { flexGrow: 0, marginBottom: 12 },
  catContent:   { paddingHorizontal: 16, gap: 8 },
  catTab:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  catIcon:      { fontSize: 15 },
  catLabel:     { fontSize: 12, fontFamily: 'ProductSans-Medium' },
  gridScroll:   { maxHeight: 220, marginHorizontal: 16 },
  grid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  emojiCell:    { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  emojiGlyph:   { fontSize: 26 },
  saveBtn:      { marginHorizontal: 16, marginTop: 16, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  saveTxt:      { fontSize: 16, fontFamily: 'ProductSans-Bold', color: '#fff' },
});

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
  toggle, toggleVal, onToggle, locked = false, loading = false,
}: {
  icon: any; label: string; subtitle?: string; value?: string; onPress?: () => void;
  colors: AppColors; danger?: boolean; locked?: boolean; loading?: boolean;
  toggle?: boolean; toggleVal?: boolean; onToggle?: (v: boolean) => void;
}) {
  const disabled = locked || loading;
  return (
    <Pressable
      onPress={locked ? () => onPress?.() : onPress}
      style={({ pressed }) => [
        styles.settingRow,
        { borderBottomColor: colors.border },
        locked && { opacity: 0.55 },
        pressed && !toggle && !disabled && { opacity: 0.6 },
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
      {loading ? (
        <ActivityIndicator size="small" color={colors.textSecondary} />
      ) : locked ? (
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
  const { token, refreshToken, signOut, profile, updateProfile } = useAuth();
  const { isDark, toggle } = useAppTheme();
  const { save } = useProfileSave();

  // ── Live profile stats ────────────────────────────────────────────────────
  const [statsMatches, setStatsMatches] = useState<number | null>(null);
  const [statsViews,   setStatsViews]   = useState<number | null>(null);

  useEffect(() => {
    if (!token) return;
    apiFetch<{ liked_you: number; matches: number; views: number; unread_chats: number }>(
      '/discover/counts', { token }
    ).then(res => {
      setStatsMatches(res.matches);
      setStatsViews(res.views);
    }).catch(() => {});
  }, [token]);

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

  // Lifestyle sub-fields live in the JSONB lifestyle dict (values are now IDs)
  const lf = (profile?.lifestyle as Record<string, number> | null) ?? {};

  // Local editable state — stored as string IDs for ChipSelectorSheet compatibility
  // (ChipSelectorSheet.selected is string[], so we store id.toString())
  const [height,           setHeight]           = useState(heightLabel);
  const [exerciseId,       setExerciseId]       = useState(lf.exercise       ? String(lf.exercise)       : '');
  const [drinkingId,       setDrinkingId]       = useState(lf.drinking       ? String(lf.drinking)       : '');
  const [smokingId,        setSmokingId]        = useState(lf.smoking        ? String(lf.smoking)        : '');
  const [educationLevelId, setEducationLevelId] = useState(profile?.education_level_id ? String(profile.education_level_id) : '');
  const [lookingForId,     setLookingForId]     = useState(profile?.looking_for_id     ? String(profile.looking_for_id)     : '');
  const [familyPlansId,    setFamilyPlansId]    = useState(profile?.family_plans_id    ? String(profile.family_plans_id)    : '');
  const [haveKidsId,       setHaveKidsId]       = useState(profile?.have_kids_id       ? String(profile.have_kids_id)       : '');
  const [starSignId,       setStarSignId]       = useState(profile?.star_sign_id       ? String(profile.star_sign_id)       : '');
  const [religionId,       setReligionId]       = useState(profile?.religion_id        ? String(profile.religion_id)        : '');
  const [ethnicityId,      setEthnicityId]      = useState(profile?.ethnicity_id       ? String(profile.ethnicity_id)       : '');
  const [languageIds,      setLanguageIds]      = useState<string[]>((profile?.languages ?? []).map(String));
  const [moodEmoji,        setMoodEmoji]        = useState(profile?.mood_emoji ?? '');
  const [moodText,         setMoodText]         = useState(profile?.mood_text ?? '');
  const [moodModalOpen,    setMoodModalOpen]    = useState(false);

  // ── Snooze Mode — backed by is_active on the server ─────────────────────
  // is_active=true  → profile visible   → snooze=false
  // is_active=false → profile hidden    → snooze=true
  const [snooze,        setSnoozeLocal]  = useState(profile?.is_active === false);
  const [snoozeLoading, setSnoozeLoading] = useState(false);

  // Keep in sync if profile reloads
  useEffect(() => {
    setSnoozeLocal(profile?.is_active === false);
  }, [profile?.is_active]);

  const handleSnoozeToggle = async (val: boolean) => {
    if (snoozeLoading || !token) return;
    setSnoozeLocal(val);        // optimistic
    setSnoozeLoading(true);
    try {
      const res = await apiFetch<{ snoozed: boolean; is_active: boolean }>(
        '/profile/me/snooze', { method: 'PATCH', token }
      );
      setSnoozeLocal(res.snoozed);
      updateProfile({ is_active: res.is_active });
    } catch {
      setSnoozeLocal(!val);     // revert on error
    } finally {
      setSnoozeLoading(false);
    }
  };

  // ── Profile completeness score ────────────────────────────────────────────
  const profileFields: { label: string; filled: boolean; tip: string }[] = [
    { label: 'Photos',        filled: (profile?.photos?.length ?? 0) >= 3,  tip: 'Add at least 3 photos' },
    { label: 'Bio',           filled: !!(profile?.about_me),                 tip: 'Write a bio about yourself' },
    { label: 'Height',        filled: !!(profile?.height_cm),                tip: 'Add your height' },
    { label: 'Exercise',      filled: !!exerciseId,                          tip: 'Set your exercise habits' },
    { label: 'Drinking',      filled: !!drinkingId,                          tip: 'Set your drinking habits' },
    { label: 'Smoking',       filled: !!smokingId,                           tip: 'Set your smoking habits' },
    { label: 'Looking For',   filled: !!lookingForId,                        tip: 'Set what you\'re looking for' },
    { label: 'Family Plans',  filled: !!familyPlansId,                       tip: 'Set your family plans' },
    { label: 'Star Sign',     filled: !!starSignId,                          tip: 'Add your star sign' },
    { label: 'Religion',      filled: !!religionId,                          tip: 'Add your religion' },
    { label: 'Ethnicity',     filled: !!ethnicityId,                         tip: 'Add your ethnicity' },
    { label: 'Languages',     filled: languageIds.length > 0,                tip: 'Add languages you speak' },
    { label: 'Interests',     filled: (profile?.interests?.length ?? 0) >= 3, tip: 'Pick at least 3 interests' },
    { label: 'Work/Education', filled: !!(profile?.company || profile?.school), tip: 'Add your work or education' },
  ];
  const filledCount  = profileFields.filter(f => f.filled).length;
  const scorePercent = Math.round((filledCount / profileFields.length) * 100);
  const missing      = profileFields.filter(f => !f.filled).slice(0, 3);

  // Sync if profile loads after mount
  useEffect(() => {
    if (!profile) return;
    const ls = (profile.lifestyle as Record<string, number> | null) ?? {};
    setHeight(cmToLabel(profile.height_cm));
    setExerciseId(ls.exercise  ? String(ls.exercise)  : '');
    setDrinkingId(ls.drinking  ? String(ls.drinking)  : '');
    setSmokingId(ls.smoking    ? String(ls.smoking)   : '');
    setEducationLevelId(profile.education_level_id ? String(profile.education_level_id) : '');
    setLookingForId(profile.looking_for_id         ? String(profile.looking_for_id)     : '');
    setFamilyPlansId(profile.family_plans_id       ? String(profile.family_plans_id)    : '');
    setHaveKidsId(profile.have_kids_id             ? String(profile.have_kids_id)       : '');
    setStarSignId(profile.star_sign_id             ? String(profile.star_sign_id)       : '');
    setReligionId(profile.religion_id              ? String(profile.religion_id)        : '');
    setEthnicityId(profile.ethnicity_id            ? String(profile.ethnicity_id)       : '');
    setLanguageIds((profile.languages ?? []).map(String));
    setMoodEmoji(profile.mood_emoji ?? '');
    setMoodText(profile.mood_text ?? '');
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
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push('/edit-profile');
                }}
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
          <StatCol label="Matches" value={statsMatches !== null ? String(statsMatches) : '—'} colors={colors} />
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <StatCol label="Views"   value={statsViews !== null ? String(statsViews) : '—'} colors={colors} />
        </View>
      </View>

      {/* ── Subscription banner ─────────────────────────────────────────── */}
      <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
        <Pressable style={[styles.subBanner, { backgroundColor: colors.surface }]} onPress={() => router.push('/subscription')}>
          <Ionicons name="star" size={14} color="#FFD60A" />
          <Text style={[styles.subBannerPlan, { color: colors.text }]}>Zod Free</Text>
          <Text style={[styles.subBannerSub, { color: colors.textSecondary }]}>· Unlock all features</Text>
          <View style={{ flex: 1 }} />
          <Text style={[styles.subBannerCta, { color: colors.text }]}>Upgrade now</Text>
          <Ionicons name="chevron-forward" size={13} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* ── AI Profile Score ────────────────────────────────────────────── */}
      <View style={{ paddingHorizontal: 16, marginTop: 14 }}>
        <Squircle
          style={styles.scoreCard}
          cornerRadius={22}
          cornerSmoothing={1}
          fillColor={colors.surface}
          strokeColor={colors.border}
          strokeWidth={1}
        >
          {/* Header */}
          <View style={styles.scoreHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <View style={[styles.scoreIconWrap, { backgroundColor: colors.surface2 }]}>
                <Ionicons name="sparkles" size={14} color={colors.text} />
              </View>
              <View>
                <Text style={[styles.scoreTitle, { color: colors.text }]}>AI Profile Score</Text>
                <Text style={[styles.scoreSubtitle, { color: colors.textSecondary }]}>
                  {scorePercent >= 90 ? 'Looking great!' : scorePercent >= 60 ? 'Good — a few tweaks left' : 'Complete your profile to get more matches'}
                </Text>
              </View>
            </View>
            <Text style={[styles.scorePercent, { color: colors.text }]}>
              {scorePercent}%
            </Text>
          </View>

          {/* Progress bar */}
          <View style={[styles.scoreBarBg, { backgroundColor: colors.surface2 }]}>
            <View
              style={[
                styles.scoreBarFill,
                {
                  width: `${scorePercent}%`,
                  backgroundColor: colors.text,
                },
              ]}
            />
          </View>

          {/* Tips */}
          {missing.length > 0 && (
            <View style={styles.scoreTips}>
              <Text style={[styles.scoreTipsTitle, { color: colors.textSecondary }]}>IMPROVE YOUR SCORE</Text>
              {missing.map((f) => (
                <View key={f.label} style={styles.scoreTipRow}>
                  <Ionicons name="add-circle-outline" size={15} color={colors.textSecondary} />
                  <Text style={[styles.scoreTipText, { color: colors.text }]}>{f.tip}</Text>
                </View>
              ))}
            </View>
          )}
        </Squircle>
      </View>

      {/* ZOD WORK — temporarily disabled
      <View style={styles.section}>
        <SectionLabel title="ZOD WORK" colors={colors} />
        <Group colors={colors}>
          <SettingRow
            icon="briefcase-outline"
            label="Manage Zod Work"
            subtitle="Work profile, experience & preferences"
            colors={colors}
            onPress={() => router.push('/zod-work')}
          />
        </Group>
      </View>
      */}

      {/* ── ABOUT YOU ───────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <SectionLabel title="ABOUT YOU" colors={colors} />
        <Group colors={colors}>
          <EditRow icon="resize-outline" label="Height" value={height || '—'}
            onPress={() => openWheel({
              title: 'Height', options: HEIGHT_LABELS.map(h => h.label), selected: height,
              onDone: (v) => { setHeight(v); const cm = labelToCm(v); if (cm) saveField({ height_cm: cm }); },
            })} colors={colors} />

          <EditRow icon="fitness-outline" label="Exercise" value={getLookupLabel('exercise', exerciseId ? Number(exerciseId) : null) || '—'}
            onPress={() => setChipPicker({
              title: 'Exercise', options: opts('exercise'), single: true,
              selected: exerciseId ? [exerciseId] : [],
              onDone: ([v]) => { setExerciseId(v); saveField({ lifestyle: { ...lf, exercise: Number(v) } }); },
            })} colors={colors} />

          <EditRow icon="ribbon-outline" label="Education Level" value={getLookupLabel('education_level', educationLevelId ? Number(educationLevelId) : null) || '—'}
            onPress={() => setChipPicker({
              title: 'Education Level', options: opts('education_level'), single: true,
              selected: educationLevelId ? [educationLevelId] : [],
              onDone: ([v]) => { setEducationLevelId(v); saveField({ education_level_id: Number(v) }); },
            })} colors={colors} />

          <EditRow icon="wine-outline" label="Drinking" value={getLookupLabel('drinking', drinkingId ? Number(drinkingId) : null) || '—'}
            onPress={() => setChipPicker({
              title: 'Drinking', options: opts('drinking'), single: true,
              selected: drinkingId ? [drinkingId] : [],
              onDone: ([v]) => { setDrinkingId(v); saveField({ lifestyle: { ...lf, drinking: Number(v) } }); },
            })} colors={colors} />

          <EditRow icon="flame-outline" label="Smoking" value={getLookupLabel('smoking', smokingId ? Number(smokingId) : null) || '—'}
            onPress={() => setChipPicker({
              title: 'Smoking', options: opts('smoking'), single: true,
              selected: smokingId ? [smokingId] : [],
              onDone: ([v]) => { setSmokingId(v); saveField({ lifestyle: { ...lf, smoking: Number(v) } }); },
            })} colors={colors} />

          <EditRow icon="heart-outline" label="Looking For" value={getLookupLabel('looking_for', lookingForId ? Number(lookingForId) : null) || '—'}
            onPress={() => setChipPicker({
              title: 'Looking For', options: opts('looking_for'), single: true,
              selected: lookingForId ? [lookingForId] : [],
              onDone: ([v]) => { setLookingForId(v); saveField({ looking_for_id: Number(v) }); },
            })} colors={colors} />

          <EditRow icon="people-outline" label="Family Plans" value={getLookupLabel('family_plans', familyPlansId ? Number(familyPlansId) : null) || '—'}
            onPress={() => setChipPicker({
              title: 'Family Plans', options: opts('family_plans'), single: true,
              selected: familyPlansId ? [familyPlansId] : [],
              onDone: ([v]) => { setFamilyPlansId(v); saveField({ family_plans_id: Number(v) }); },
            })} colors={colors} />

          <EditRow icon="happy-outline" label="Have Kids" value={getLookupLabel('have_kids', haveKidsId ? Number(haveKidsId) : null) || '—'}
            onPress={() => setChipPicker({
              title: 'Have Kids', options: opts('have_kids'), single: true,
              selected: haveKidsId ? [haveKidsId] : [],
              onDone: ([v]) => { setHaveKidsId(v); saveField({ have_kids_id: Number(v) }); },
            })} colors={colors} />

          <EditRow icon="star-outline" label="Star Sign" value={getLookupLabel('star_sign', starSignId ? Number(starSignId) : null) || '—'}
            onPress={() => setChipPicker({
              title: 'Star Sign', options: opts('star_sign'), single: true,
              selected: starSignId ? [starSignId] : [],
              onDone: ([v]) => { setStarSignId(v); saveField({ star_sign_id: Number(v) }); },
            })} colors={colors} />

          <EditRow icon="book-outline" label="Religion" value={getLookupLabel('religion', religionId ? Number(religionId) : null) || '—'}
            onPress={() => setChipPicker({
              title: 'Religion', options: opts('religion'), single: true,
              selected: religionId ? [religionId] : [],
              onDone: ([v]) => { setReligionId(v); saveField({ religion_id: Number(v) }); },
            })} colors={colors} />

          <EditRow icon="people-outline" label="Ethnicity" value={getLookupLabel('ethnicity', ethnicityId ? Number(ethnicityId) : null) || '—'}
            onPress={() => setChipPicker({
              title: 'Ethnicity', options: opts('ethnicity'), single: true,
              selected: ethnicityId ? [ethnicityId] : [],
              onDone: ([v]) => { setEthnicityId(v); saveField({ ethnicity_id: Number(v) }); },
            })} colors={colors} />

          {/* ── Mood Status ── */}
          <Pressable
            onPress={() => setMoodModalOpen(true)}
            style={[styles.moodRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 12 }]}
          >
            <Ionicons name="happy-outline" size={18} color={colors.textSecondary} style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.moodLabel, { color: colors.textSecondary }]}>Mood Status</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {moodEmoji ? <Text style={{ fontSize: 18 }}>{moodEmoji}</Text> : null}
                <Text style={[{ fontSize: 14, fontFamily: 'ProductSans-Regular' }, { color: moodText ? colors.text : colors.textTertiary }]}>
                  {moodText || 'What\'s your vibe today?'}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
          </Pressable>

          <MoodPickerModal
            visible={moodModalOpen}
            initialEmoji={moodEmoji}
            initialText={moodText}
            colors={colors}
            onSave={(e, t) => {
              setMoodEmoji(e);
              setMoodText(t);
              setMoodModalOpen(false);
              saveField({ mood_emoji: e || null, mood_text: t || null });
            }}
            onClose={() => setMoodModalOpen(false)}
          />

          <EditRow icon="language-outline" label="Languages"
            value={getLookupLabels('language', languageIds.map(Number)).join(', ') || '—'}
            onPress={() => setChipPicker({
              title: 'Languages', subtitle: 'Pick all that apply',
              options: opts('language'), single: false, selected: languageIds,
              onDone: (vals) => { setLanguageIds(vals); saveField({ languages: vals.map(Number) }); },
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
            icon={isDark ? 'sunny-outline' : 'moon-outline'}
            label="Appearance"
            subtitle={isDark ? 'Dark mode' : 'Light mode'}
            colors={colors}
            toggle
            toggleVal={isDark}
            onToggle={toggle}
          />
          <SettingRow
            icon="moon-outline" label="Snooze Mode"
            subtitle={snooze ? 'Your profile is hidden from others' : 'Pause your profile visibility'}
            colors={colors} toggle toggleVal={snooze}
            onToggle={handleSnoozeToggle}
            loading={snoozeLoading}
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

  subBanner:         { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13 },
  subBannerPlan:     { fontSize: 13, fontFamily: 'ProductSans-Bold' },
  subBannerSub:      { fontSize: 12, fontFamily: 'ProductSans-Regular' },
  subBannerCta:      { fontSize: 12, fontFamily: 'ProductSans-Bold' },

  section:           { paddingHorizontal: 16, marginTop: 22, gap: 6 },
  sectionLabel:      { fontSize: 12, fontFamily: 'ProductSans-Bold', letterSpacing: 1.5, marginLeft: 2, marginBottom: 2 },
  voiceSubtitle:     { fontSize: 12, fontFamily: 'ProductSans-Regular', marginBottom: 4, marginLeft: 2 },

  moodRow:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  moodLabel:     { fontSize: 11, fontFamily: 'ProductSans-Bold', letterSpacing: 0.8, marginBottom: 4 },

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

  scoreCard:         { padding: 16, gap: 12 },
  scoreHeader:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scoreIconWrap:     { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  scoreTitle:        { fontSize: 14, fontFamily: 'ProductSans-Bold' },
  scoreSubtitle:     { fontSize: 11, fontFamily: 'ProductSans-Regular', marginTop: 1 },
  scorePercent:      { fontSize: 22, fontFamily: 'ProductSans-Black' },
  scoreBarBg:        { height: 6, borderRadius: 99, overflow: 'hidden' },
  scoreBarFill:      { height: 6, borderRadius: 99 },
  scoreTips:         { gap: 8, marginTop: 2 },
  scoreTipsTitle:    { fontSize: 10, fontFamily: 'ProductSans-Bold', letterSpacing: 1.2 },
  scoreTipRow:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scoreTipText:      { fontSize: 13, fontFamily: 'ProductSans-Regular' },
});
