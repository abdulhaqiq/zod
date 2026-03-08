import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
import type { AppColors } from '@/constants/appColors';
import Squircle from '@/components/ui/Squircle';

const MY_AVATAR = 'https://randomuser.me/api/portraits/men/32.jpg';


// ─── Stat column ──────────────────────────────────────────────────────────────

function StatCol({ label, value, colors }: { label: string; value: string; colors: AppColors }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={[styles.statVal, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

// ─── Edit row ─────────────────────────────────────────────────────────────────

function EditRow({
  icon, label, value, preview, colors, accentIcon = false,
}: {
  icon: any; label: string; value?: string; preview?: string;
  colors: AppColors; accentIcon?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.editRow,
        { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
        pressed && { opacity: 0.65 },
      ]}
    >
      <Squircle style={styles.editIconWrap} cornerRadius={10} cornerSmoothing={1} fillColor={accentIcon ? '#833ab4' : colors.surface2}>
        <Ionicons name={icon} size={16} color={accentIcon ? '#fff' : colors.text} />
      </Squircle>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={[styles.editLabel, { color: colors.text }]}>{label}</Text>
        {preview ? (
          <Text style={[styles.editPreview, { color: colors.textSecondary }]} numberOfLines={1}>
            {preview}
          </Text>
        ) : null}
      </View>
      {value ? <Text style={[styles.editValue, { color: colors.textSecondary }]}>{value}</Text> : null}
      <Ionicons name="chevron-forward" size={15} color={colors.textSecondary} />
    </Pressable>
  );
}

// ─── Setting row ──────────────────────────────────────────────────────────────

function SettingRow({
  icon, label, value, onPress, colors, danger = false,
  toggle, toggleVal, onToggle,
}: {
  icon: any; label: string; value?: string; onPress?: () => void;
  colors: AppColors; danger?: boolean;
  toggle?: boolean; toggleVal?: boolean; onToggle?: (v: boolean) => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingRow,
        { borderBottomColor: colors.border },
        pressed && !toggle && { opacity: 0.6 },
      ]}
    >
      <Squircle style={styles.settingIconWrap} cornerRadius={10} cornerSmoothing={1} fillColor={colors.surface2}>
        <Ionicons name={icon} size={17} color={danger ? colors.error : colors.text} />
      </Squircle>
      <Text style={[styles.settingLabel, { color: danger ? colors.error : colors.text }]}>{label}</Text>
      {value ? <Text style={[styles.settingValue, { color: colors.textSecondary }]}>{value}</Text> : null}
      {toggle ? (
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

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ title, colors }: { title: string; colors: AppColors }) {
  return (
    <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{title}</Text>
  );
}

// ─── Group container ──────────────────────────────────────────────────────────

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

// ─── My Profile Page ──────────────────────────────────────────────────────────

export default function MyProfilePage({ colors, insets }: { colors: AppColors; insets: any }) {
  const [snooze,      setSnooze]      = useState(false);
  const [incognito,   setIncognito]   = useState(false);
  const [autoZod,     setAutoZod]     = useState(true);
  const [travel,      setTravel]      = useState(false);
  const [igConnected, setIgConnected] = useState(false);

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Instagram-style header ────────────────────────────────────── */}
      <View style={[styles.igHeaderWrap, { borderBottomColor: colors.border }]}>
        <View style={styles.igHeader}>

          {/* Avatar — circle */}
          <Image
            source={{ uri: MY_AVATAR }}
            style={styles.avatarImage}
            resizeMode="cover"
          />

          {/* Right column: name / buttons */}
          <View style={styles.igRight}>
            <Text style={[styles.igName, { color: colors.text }]}>Alex Johnson</Text>

            {/* Action buttons */}
            <View style={styles.actionRow}>
              <Pressable
                style={[styles.actionBtn, { backgroundColor: colors.surface2 }]}
                onPress={() => Alert.alert('Subscription', 'Manage your plan here.')}
              >
                <Ionicons name="star-outline" size={12} color={colors.text} />
                <Text style={[styles.actionBtnText, { color: colors.text }]}>Subscription</Text>
              </Pressable>
              <Pressable
                style={[styles.actionBtn, { borderWidth: 1, borderColor: colors.border }]}
                onPress={() => {/* scroll to edit section */}}
              >
                <Ionicons name="create-outline" size={12} color={colors.text} />
                <Text style={[styles.actionBtnText, { color: colors.text }]}>Edit Profile</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Stats row — full width below header */}
        <View style={styles.statsRow}>
          <StatCol label="Matches" value="143"  colors={colors} />
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <StatCol label="Likes"   value="892"  colors={colors} />
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <StatCol label="Views"   value="2.1k" colors={colors} />
        </View>
      </View>

      {/* ── Compact subscription banner ───────────────────────────────── */}
      <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
        <Pressable
          style={styles.subBanner}
          onPress={() => Alert.alert('Subscription', 'Manage your Zod plan.')}
        >
          <Ionicons name="star" size={14} color="#FFD60A" />
          <Text style={styles.subBannerPlan}>Zod Free</Text>
          <Text style={styles.subBannerSub}>· Unlock all features</Text>
          <View style={{ flex: 1 }} />
          <Text style={styles.subBannerCta}>Upgrade now</Text>
          <Ionicons name="chevron-forward" size={13} color="#c084fc" />
        </Pressable>
      </View>

      {/* ── EDIT PROFILE ─────────────────────────────────────────────── */}
      <View style={styles.section}>
        <SectionLabel title="EDIT PROFILE" colors={colors} />

        {/* Profile completeness bar */}
        <View style={[styles.completeRow, { backgroundColor: colors.surface }]}>
          <View style={{ flex: 1, gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[styles.completeTitle, { color: colors.text }]}>Profile Complete</Text>
              <Text style={[styles.completePct, { color: colors.text }]}>67%</Text>
            </View>
            <View style={[styles.completeTrack, { backgroundColor: colors.surface2 }]}>
              <LinearGradient
                colors={['#7c3aed', '#c084fc']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.completeFill, { width: '67%' }]}
              />
            </View>
            <Text style={[styles.completeSub, { color: colors.textSecondary }]}>
              Add prompts and a bio to complete your profile
            </Text>
          </View>
        </View>

        {/* MEDIA */}
        <SectionLabel title="MEDIA" colors={colors} />
        <Group colors={colors}>
          <EditRow
            icon="images-outline"
            label="Photos & Videos"
            preview="6 photos · add more to stand out"
            colors={colors}
          />
          <EditRow
            icon="star-outline"
            label="Best Photo"
            preview="Highlight your favourite shot"
            colors={colors}
          />
          <EditRow
            icon="checkmark-circle-outline"
            label="Verification"
            value="Get Verified"
            colors={colors}
          />
        </Group>

        {/* PERSONALITY */}
        <SectionLabel title="PERSONALITY" colors={colors} />
        <Group colors={colors}>
          <EditRow
            icon="heart-outline"
            label="Interests"
            preview="Coffee · Travel · Books + 2 more"
            colors={colors}
          />
          <EditRow
            icon="globe-outline"
            label="Causes & Communities"
            colors={colors}
          />
          <EditRow
            icon="diamond-outline"
            label="Qualities I Value"
            colors={colors}
          />
          <EditRow
            icon="chatbubble-outline"
            label="Prompts"
            preview="Don't be mad if I…"
            colors={colors}
          />
          <EditRow
            icon="flash-outline"
            label="Opening Moves"
            colors={colors}
          />
          <EditRow
            icon="person-outline"
            label="Bio"
            preview="Hey! I'm Alex 👋 I love long drives, spontaneous…"
            colors={colors}
          />
        </Group>
      </View>

      {/* ── ABOUT YOU ────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <SectionLabel title="ABOUT YOU" colors={colors} />

        <SectionLabel title="IDENTITY" colors={colors} />
        <Group colors={colors}>
          <EditRow icon="briefcase-outline" label="Work"        value="UX Designer · Adobe" colors={colors} />
          <EditRow icon="school-outline"    label="Education"   value="UCLA – Design"        colors={colors} />
          <EditRow icon="person-outline"    label="Gender"      value="Man"                  colors={colors} />
          <EditRow icon="location-outline"  label="Living Now"  value="Los Angeles, CA"      colors={colors} />
          <EditRow icon="home-outline"      label="Hometown"    value="Chicago, IL"          colors={colors} />
        </Group>

        <SectionLabel title="MORE ABOUT YOU" colors={colors} />
        <Group colors={colors}>
          <EditRow icon="resize-outline"    label="Height"          value={'5\'6" (168 cm)'}   colors={colors} />
          <EditRow icon="fitness-outline"   label="Exercise"        value="Sometimes"          colors={colors} />
          <EditRow icon="ribbon-outline"    label="Education Level" value="Bachelor's"         colors={colors} />
          <EditRow icon="wine-outline"      label="Drinking"        value="Socially"           colors={colors} />
          <EditRow icon="flame-outline"     label="Smoking"         value="Never"              colors={colors} />
          <EditRow icon="heart-outline"     label="Looking For"     value="Something serious"  colors={colors} />
          <EditRow icon="people-outline"    label="Family Plans"    value="Open to it"         colors={colors} />
          <EditRow icon="happy-outline"     label="Have Kids"       value="No"                 colors={colors} />
          <EditRow icon="star-outline"      label="Star Sign"       value="♊ Gemini"           colors={colors} />
          <EditRow icon="book-outline"      label="Religion"        value="Spiritual"          colors={colors} />
          <EditRow icon="language-outline"  label="Language"        value="English, Spanish"   colors={colors} />
        </Group>

        {/* CONNECTED ACCOUNTS */}
        <SectionLabel title="CONNECTED ACCOUNTS" colors={colors} />
        <Group colors={colors}>
          <Pressable
            style={[
              styles.editRow,
              { borderBottomWidth: 0 },
              ]}
            onPress={() => setIgConnected(v => !v)}
          >
            <View style={[styles.editIconWrap, { backgroundColor: '#833ab4' }]}>
              <Ionicons name="logo-instagram" size={16} color="#fff" />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={[styles.editLabel, { color: colors.text }]}>Instagram</Text>
              <Text style={[styles.editPreview, { color: colors.textSecondary }]}>
                {igConnected ? 'Connected · @alexj' : 'Connect to show your photos'}
              </Text>
            </View>
            {igConnected ? (
              <Image
                source={{ uri: MY_AVATAR }}
                style={styles.igAvatar}
              />
            ) : (
              <View style={[styles.connectBtn, { borderColor: colors.border }]}>
                <Text style={[styles.connectBtnText, { color: colors.text }]}>Connect</Text>
              </View>
            )}
          </Pressable>
        </Group>
      </View>

      {/* ── APP SETTINGS ─────────────────────────────────────────────── */}
      <View style={styles.section}>
        <SectionLabel title="APP SETTINGS" colors={colors} />
        <Group colors={colors}>
          <SettingRow icon="moon-outline"     label="Snooze Mode"    colors={colors} toggle toggleVal={snooze}    onToggle={setSnooze} />
          <SettingRow icon="eye-off-outline"  label="Incognito Mode" colors={colors} toggle toggleVal={incognito} onToggle={setIncognito} />
          <SettingRow icon="sparkles-outline" label="Auto Zod (AI)"  colors={colors} toggle toggleVal={autoZod}   onToggle={setAutoZod} />
          <SettingRow icon="airplane-outline" label="Travel Mode"    colors={colors} toggle toggleVal={travel}    onToggle={setTravel} />
          <SettingRow icon="location-outline" label="Change Location" colors={colors} />
        </Group>
      </View>

      {/* ── ACCOUNT ──────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <SectionLabel title="ACCOUNT" colors={colors} />
        <Group colors={colors}>
          <SettingRow icon="notifications-outline"  label="Notifications"      colors={colors} />
          <SettingRow icon="shield-outline"          label="Security"           colors={colors} />
          <SettingRow icon="document-text-outline"   label="Legal Information"  colors={colors} />
          <SettingRow icon="help-circle-outline"     label="Get Help"           colors={colors} />
          <SettingRow icon="card-outline"            label="Purchases"          colors={colors} />
        </Group>
      </View>

      {/* ── ACCOUNT ACTIONS ──────────────────────────────────────────── */}
      <View style={[styles.section, { marginBottom: 10 }]}>
        <SectionLabel title="ACCOUNT ACTIONS" colors={colors} />
        <Group colors={colors}>
          <SettingRow
            icon="log-out-outline"
            label="Log Out"
            colors={colors}
            danger
            onPress={() =>
              Alert.alert(
                'Log Out',
                'Are you sure you want to log out?',
                [{ text: 'Cancel', style: 'cancel' }, { text: 'Log Out', style: 'destructive' }],
              )
            }
          />
          <SettingRow
            icon="trash-outline"
            label="Delete Account"
            colors={colors}
            danger
            onPress={() =>
              Alert.alert(
                'Delete Account',
                'This action is permanent and cannot be undone.',
                [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive' }],
              )
            }
          />
        </Group>
      </View>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // IG header
  igHeaderWrap:   { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 14 },
  igHeader:       { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingTop: 16, gap: 14 },
  igRight:        { flex: 1, gap: 8 },
  igName:         { fontSize: 18, fontFamily: 'ProductSans-Black' },
  igDob:          { fontSize: 12, fontFamily: 'ProductSans-Regular', marginTop: -2 },

  // Stats
  statsRow:       { flexDirection: 'row', alignItems: 'center', marginTop: 14, paddingHorizontal: 16, justifyContent: 'space-around' },
  statVal:        { fontSize: 15, fontFamily: 'ProductSans-Black', textAlign: 'center' },
  statLabel:      { fontSize: 10, fontFamily: 'ProductSans-Regular', textAlign: 'center', marginTop: 1 },
  statDivider:    { width: StyleSheet.hairlineWidth, height: 26, marginHorizontal: 4 },

  // Action buttons
  actionRow:      { flexDirection: 'row', gap: 8, marginTop: 2 },
  actionBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 22, paddingVertical: 11 },
  actionBtnText:  { fontSize: 12, fontFamily: 'ProductSans-Bold' },

  // Subscription banner
  subBanner:      { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1a0a2e', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13 },
  subBannerPlan:  { fontSize: 13, fontFamily: 'ProductSans-Bold', color: '#fff' },
  subBannerSub:   { fontSize: 12, fontFamily: 'ProductSans-Regular', color: 'rgba(255,255,255,0.45)' },
  subBannerCta:   { fontSize: 12, fontFamily: 'ProductSans-Bold', color: '#c084fc' },

  // Section
  section:        { paddingHorizontal: 16, marginTop: 22, gap: 6 },
  sectionLabel:   { fontSize: 10, fontFamily: 'ProductSans-Bold', letterSpacing: 1.5, marginLeft: 2, marginBottom: 2 },

  // Completeness
  completeRow:    { borderRadius: 14, padding: 14 },
  completeTitle:  { fontSize: 13, fontFamily: 'ProductSans-Bold' },
  completePct:    { fontSize: 13, fontFamily: 'ProductSans-Bold' },
  completeTrack:  { height: 5, borderRadius: 3, overflow: 'hidden' },
  completeFill:   { height: 5, borderRadius: 3 },
  completeSub:    { fontSize: 11, fontFamily: 'ProductSans-Regular' },

  // Group
  group:          { overflow: 'hidden' },

  // Edit row
  editRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13 },
  editIconWrap:   { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  editLabel:      { fontSize: 14, fontFamily: 'ProductSans-Regular' },
  editPreview:    { fontSize: 11, fontFamily: 'ProductSans-Regular' },
  editValue:      { fontSize: 12, fontFamily: 'ProductSans-Regular', maxWidth: 130, textAlign: 'right' },

  // Setting row
  settingRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  settingIconWrap:{ width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  settingLabel:   { flex: 1, fontSize: 15, fontFamily: 'ProductSans-Regular' },
  settingValue:   { fontSize: 13, fontFamily: 'ProductSans-Regular', maxWidth: 120, textAlign: 'right' },

  // Profile avatar circle
  avatarImage:    { width: 82, height: 82, borderRadius: 41 },

  // Instagram connected
  igAvatar:       { width: 32, height: 32, borderRadius: 10 },
  connectBtn:     { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  connectBtnText: { fontSize: 12, fontFamily: 'ProductSans-Medium' },
});
