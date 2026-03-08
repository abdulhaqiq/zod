import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import ChipSelectorSheet, { type ChipOption } from '@/components/ui/ChipSelectorSheet';
import WheelPickerSheet from '@/components/ui/WheelPickerSheet';
import Squircle from '@/components/ui/Squircle';
import type { AppColors } from '@/constants/appColors';

const MY_AVATAR = 'https://randomuser.me/api/portraits/men/32.jpg';

// ─── Picker option data ───────────────────────────────────────────────────────

const opts = (arr: string[]): ChipOption[] => arr.map(label => ({ label }));

const HEIGHT_OPTIONS   = opts(["4'10\" (147cm)","4'11\" (150cm)","5'0\" (152cm)","5'1\" (155cm)","5'2\" (157cm)","5'3\" (160cm)","5'4\" (163cm)","5'5\" (165cm)","5'6\" (168cm)","5'7\" (170cm)","5'8\" (173cm)","5'9\" (175cm)","5'10\" (178cm)","5'11\" (180cm)","6'0\" (183cm)","6'1\" (185cm)","6'2\" (188cm)","6'3\" (191cm)","6'4\" (193cm)","6'5\" (196cm)"]);
const EXERCISE_OPTIONS = opts(["Never", "Sometimes", "Often", "Every day"]);
const EDU_LVL_OPTIONS  = opts(["High School", "Some College", "Associate's", "Bachelor's", "Master's", "PhD", "Other"]);
const DRINKING_OPTIONS = opts(["Never", "Socially", "Regularly"]);
const SMOKING_OPTIONS  = opts(["Never", "Socially", "Regularly", "Yes"]);
const LOOKING_OPTIONS  = opts(["Casual dating", "Something serious", "Marriage", "Open to it", "Friends first"]);
const FAMILY_OPTIONS   = opts(["Want kids", "Open to it", "Don't want kids", "Have kids"]);
const KIDS_OPTIONS     = opts(["No", "Yes, live with me", "Yes, elsewhere"]);
const SIGN_OPTIONS     = opts(["♈ Aries","♉ Taurus","♊ Gemini","♋ Cancer","♌ Leo","♍ Virgo","♎ Libra","♏ Scorpio","♐ Sagittarius","♑ Capricorn","♒ Aquarius","♓ Pisces"]);
const RELIGION_OPTIONS = opts(["Agnostic","Atheist","Buddhist","Christian","Hindu","Jewish","Muslim","Spiritual","Other"]);
const LANG_OPTIONS     = opts(["English","Spanish","French","German","Portuguese","Italian","Arabic","Mandarin","Japanese","Korean","Hindi","Russian","Dutch","Swedish","Polish","Turkish"]);

// ─── Profile state ────────────────────────────────────────────────────────────

interface ProfileAbout {
  height:        string;
  exercise:      string;
  educationLevel:string;
  drinking:      string;
  smoking:       string;
  lookingFor:    string;
  familyPlans:   string;
  haveKids:      string;
  starSign:      string;
  religion:      string;
  languages:     string[];
}

// ─── Picker config ────────────────────────────────────────────────────────────

interface PickerCfg {
  title:        string;
  subtitle?:    string;
  options:      ChipOption[];
  singleSelect: boolean;
  key:          keyof ProfileAbout;
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
  icon, label, value, onPress, colors, danger = false,
  toggle, toggleVal, onToggle, locked = false,
}: {
  icon: any; label: string; value?: string; onPress?: () => void;
  colors: AppColors; danger?: boolean; locked?: boolean;
  toggle?: boolean; toggleVal?: boolean; onToggle?: (v: boolean) => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingRow,
        { borderBottomColor: colors.border },
        locked && { opacity: 0.5 },
        pressed && !toggle && !locked && { opacity: 0.6 },
      ]}
    >
      <Squircle style={styles.settingIconWrap} cornerRadius={10} cornerSmoothing={1} fillColor={colors.surface2}>
        <Ionicons name={icon} size={17} color={danger ? colors.error : colors.text} />
      </Squircle>
      <Text style={[styles.settingLabel, { color: danger ? colors.error : colors.text }]}>{label}</Text>
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

  const [snooze,      setSnooze]    = useState(false);
  const [incognito,   setIncognito] = useState(false);
  const [autoZod,     setAutoZod]   = useState(true);
  const [igConnected, setIgConnected] = useState(false);

  const [about, setAbout] = useState<ProfileAbout>({
    height:         '5\'6" (168cm)',
    exercise:       'Sometimes',
    educationLevel: "Bachelor's",
    drinking:       'Socially',
    smoking:        'Never',
    lookingFor:     'Something serious',
    familyPlans:    'Open to it',
    haveKids:       'No',
    starSign:       '♊ Gemini',
    religion:       'Spiritual',
    languages:      ['English', 'Spanish'],
  });

  const [activePicker,     setActivePicker]     = useState<PickerCfg | null>(null);
  const [showHeightWheel, setShowHeightWheel] = useState(false);

  const openPicker = (cfg: PickerCfg) => setActivePicker(cfg);

  const handlePickerChange = (vals: string[]) => {
    if (!activePicker) return;
    setAbout(s => ({ ...s, [activePicker.key]: activePicker.singleSelect ? vals[0] ?? s[activePicker.key] : vals }));
  };

  const currentSelected = (): string[] => {
    if (!activePicker) return [];
    const v = about[activePicker.key];
    return Array.isArray(v) ? v : v ? [v] : [];
  };

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ────────────────────────────────────────────────────── */}
      <View style={[styles.igHeaderWrap, { borderBottomColor: colors.border }]}>
        <View style={styles.igHeader}>
          <Image source={{ uri: MY_AVATAR }} style={styles.avatarImage} resizeMode="cover" />
          <View style={styles.igRight}>
            <Text style={[styles.igName, { color: colors.text }]}>Alex Johnson</Text>
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
          <StatCol label="Matches" value="143"  colors={colors} />
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <StatCol label="Likes"   value="892"  colors={colors} />
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <StatCol label="Views"   value="2.1k" colors={colors} />
        </View>
      </View>

      {/* ── Subscription banner ───────────────────────────────────────── */}
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

      {/* ── ABOUT YOU ─────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <SectionLabel title="ABOUT YOU" colors={colors} />
        <Group colors={colors}>
          <EditRow icon="resize-outline"  label="Height"          value={about.height}
            onPress={() => setShowHeightWheel(true)}
            colors={colors} />
          <EditRow icon="fitness-outline" label="Exercise"        value={about.exercise}
            onPress={() => openPicker({ title: 'Exercise', options: EXERCISE_OPTIONS, singleSelect: true, key: 'exercise' })}
            colors={colors} />
          <EditRow icon="ribbon-outline"  label="Education Level" value={about.educationLevel}
            onPress={() => openPicker({ title: 'Education Level', options: EDU_LVL_OPTIONS, singleSelect: true, key: 'educationLevel' })}
            colors={colors} />
          <EditRow icon="wine-outline"    label="Drinking"        value={about.drinking}
            onPress={() => openPicker({ title: 'Drinking', options: DRINKING_OPTIONS, singleSelect: true, key: 'drinking' })}
            colors={colors} />
          <EditRow icon="flame-outline"   label="Smoking"         value={about.smoking}
            onPress={() => openPicker({ title: 'Smoking', options: SMOKING_OPTIONS, singleSelect: true, key: 'smoking' })}
            colors={colors} />
          <EditRow icon="heart-outline"   label="Looking For"     value={about.lookingFor}
            onPress={() => openPicker({ title: 'Looking For', options: LOOKING_OPTIONS, singleSelect: true, key: 'lookingFor' })}
            colors={colors} />
          <EditRow icon="people-outline"  label="Family Plans"    value={about.familyPlans}
            onPress={() => openPicker({ title: 'Family Plans', options: FAMILY_OPTIONS, singleSelect: true, key: 'familyPlans' })}
            colors={colors} />
          <EditRow icon="happy-outline"   label="Have Kids"       value={about.haveKids}
            onPress={() => openPicker({ title: 'Have Kids', options: KIDS_OPTIONS, singleSelect: true, key: 'haveKids' })}
            colors={colors} />
          <EditRow icon="star-outline"    label="Star Sign"       value={about.starSign}
            onPress={() => openPicker({ title: 'Star Sign', options: SIGN_OPTIONS, singleSelect: true, key: 'starSign' })}
            colors={colors} />
          <EditRow icon="book-outline"    label="Religion"        value={about.religion}
            onPress={() => openPicker({ title: 'Religion', options: RELIGION_OPTIONS, singleSelect: true, key: 'religion' })}
            colors={colors} />
          <EditRow icon="language-outline" label="Languages"      value={about.languages.join(', ')}
            onPress={() => openPicker({ title: 'Languages', subtitle: 'Pick all that apply', options: LANG_OPTIONS, singleSelect: false, key: 'languages' })}
            colors={colors} last />
        </Group>
      </View>

      {/* ── CONNECTED ACCOUNTS ────────────────────────────────────────── */}
      <View style={styles.section}>
        <SectionLabel title="CONNECTED ACCOUNTS" colors={colors} />
        <Group colors={colors}>
          <Pressable
            style={[styles.editRow, { borderBottomWidth: 0 }]}
            onPress={() => setIgConnected(v => !v)}
          >
            <View style={[styles.editIconWrap, { backgroundColor: '#833ab4', borderRadius: 8 }]}>
              <Ionicons name="logo-instagram" size={16} color="#fff" />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={[styles.editLabel, { color: colors.text }]}>Instagram</Text>
              <Text style={[styles.editPreview, { color: colors.textSecondary }]}>
                {igConnected ? 'Connected · @alexj' : 'Connect to show your photos'}
              </Text>
            </View>
            {igConnected ? (
              <Image source={{ uri: MY_AVATAR }} style={styles.igAvatar} />
            ) : (
              <View style={[styles.connectBtn, { borderColor: colors.border }]}>
                <Text style={[styles.connectBtnText, { color: colors.text }]}>Connect</Text>
              </View>
            )}
          </Pressable>
        </Group>
      </View>

      {/* ── APP SETTINGS ──────────────────────────────────────────────── */}
      <View style={styles.section}>
        <SectionLabel title="APP SETTINGS" colors={colors} />
        <Group colors={colors}>
          <SettingRow icon="moon-outline"     label="Snooze Mode"    colors={colors} toggle toggleVal={snooze}    onToggle={setSnooze} />
          <SettingRow icon="eye-off-outline"  label="Incognito Mode" colors={colors} toggle toggleVal={incognito} onToggle={setIncognito} />
          <SettingRow icon="sparkles-outline" label="Auto Zod (AI)"  colors={colors} toggle toggleVal={autoZod}   onToggle={setAutoZod} />
          <SettingRow icon="airplane-outline" label="Travel Mode"    colors={colors} locked onPress={() => router.push('/subscription')} />
          <SettingRow icon="location-outline" label="Change Location" colors={colors} onPress={() => router.push('/location-search?type=city')} />
        </Group>
      </View>

      {/* ── ACCOUNT ───────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <SectionLabel title="ACCOUNT" colors={colors} />
        <Group colors={colors}>
          <SettingRow icon="notifications-outline" label="Notifications"     colors={colors} />
          <SettingRow icon="shield-outline"         label="Security"          colors={colors} />
          <SettingRow icon="document-text-outline"  label="Legal Information" colors={colors} />
          <SettingRow icon="help-circle-outline"    label="Get Help"          colors={colors} />
          <SettingRow icon="card-outline"           label="Purchases"         colors={colors} />
        </Group>
      </View>

      {/* ── ACCOUNT ACTIONS ───────────────────────────────────────────── */}
      <View style={[styles.section, { marginBottom: 10 }]}>
        <SectionLabel title="ACCOUNT ACTIONS" colors={colors} />
        <Group colors={colors}>
          <SettingRow icon="log-out-outline" label="Log Out" colors={colors} danger
            onPress={() => Alert.alert('Log Out', 'Are you sure you want to log out?',
              [{ text: 'Cancel', style: 'cancel' }, { text: 'Log Out', style: 'destructive' }])} />
          <SettingRow icon="trash-outline" label="Delete Account" colors={colors} danger
            onPress={() => Alert.alert('Delete Account', 'This action is permanent and cannot be undone.',
              [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive' }])} />
        </Group>
      </View>

      {/* ── Height wheel picker ───────────────────────────────────────── */}
      <WheelPickerSheet
        visible={showHeightWheel}
        onClose={() => setShowHeightWheel(false)}
        title="Height"
        options={HEIGHT_OPTIONS.map(o => o.label)}
        selected={about.height}
        onChange={val => setAbout(s => ({ ...s, height: val }))}
        colors={colors}
      />

      {/* ── Chip picker sheet (all other single/multi fields) ─────────── */}
      {activePicker && (
        <ChipSelectorSheet
          visible={!!activePicker}
          onClose={() => setActivePicker(null)}
          title={activePicker.title}
          subtitle={activePicker.subtitle}
          singleSelect={activePicker.singleSelect}
          maxSelect={activePicker.singleSelect ? 1 : 99}
          options={activePicker.options}
          selected={currentSelected()}
          onChange={handlePickerChange}
          colors={colors}
        />
      )}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  igHeaderWrap:   { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 14 },
  igHeader:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, gap: 14 },
  igRight:        { flex: 1, gap: 8 },
  igName:         { fontSize: 18, fontFamily: 'ProductSans-Black' },

  statsRow:       { flexDirection: 'row', alignItems: 'center', marginTop: 14, paddingHorizontal: 16, justifyContent: 'space-around' },
  statVal:        { fontSize: 15, fontFamily: 'ProductSans-Black', textAlign: 'center' },
  statLabel:      { fontSize: 10, fontFamily: 'ProductSans-Regular', textAlign: 'center', marginTop: 1 },
  statDivider:    { width: StyleSheet.hairlineWidth, height: 26, marginHorizontal: 4 },

  actionRow:      { flexDirection: 'row', gap: 8, marginTop: 2 },
  actionBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 22, paddingVertical: 11 },
  actionBtnText:  { fontSize: 12, fontFamily: 'ProductSans-Bold' },

  subBanner:      { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1a0a2e', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13 },
  subBannerPlan:  { fontSize: 13, fontFamily: 'ProductSans-Bold', color: '#fff' },
  subBannerSub:   { fontSize: 12, fontFamily: 'ProductSans-Regular', color: 'rgba(255,255,255,0.45)' },
  subBannerCta:   { fontSize: 12, fontFamily: 'ProductSans-Bold', color: '#c084fc' },

  section:        { paddingHorizontal: 16, marginTop: 22, gap: 6 },
  sectionLabel:   { fontSize: 12, fontFamily: 'ProductSans-Bold', letterSpacing: 1.5, marginLeft: 2, marginBottom: 2 },

  group:          { overflow: 'hidden' },

  editRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13 },
  editIconWrap:   { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  editLabel:      { fontSize: 14, fontFamily: 'ProductSans-Regular' },
  editPreview:    { fontSize: 11, fontFamily: 'ProductSans-Regular' },
  editValue:      { fontSize: 12, fontFamily: 'ProductSans-Regular', maxWidth: 130, textAlign: 'right' },

  settingRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  settingIconWrap:{ width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  settingLabel:   { flex: 1, fontSize: 15, fontFamily: 'ProductSans-Regular' },
  settingValue:   { fontSize: 13, fontFamily: 'ProductSans-Regular', maxWidth: 120, textAlign: 'right' },

  avatarImage:    { width: 64, height: 64, borderRadius: 32 },

  igAvatar:       { width: 32, height: 32, borderRadius: 10 },
  connectBtn:     { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  connectBtnText: { fontSize: 12, fontFamily: 'ProductSans-Medium' },
});
