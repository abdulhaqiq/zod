import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenHeader from '@/components/ui/ScreenHeader';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';

// ─── Row components ───────────────────────────────────────────────────────────

function ActionRow({
  icon, label, sub, value, onPress, last, colors, danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub?: string;
  value?: string;
  onPress?: () => void;
  last?: boolean;
  colors: any;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
        pressed && { opacity: 0.6 },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.bg }]}>
        <Ionicons name={icon} size={18} color={danger ? '#e53935' : colors.text} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: danger ? '#e53935' : colors.text }]}>{label}</Text>
        {sub ? <Text style={[styles.rowSub, { color: colors.textSecondary }]}>{sub}</Text> : null}
      </View>
      {value ? <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{value}</Text> : null}
      {onPress && !danger && <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />}
    </Pressable>
  );
}

function ToggleRow({
  icon, label, sub, value, onChange, last, colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  last?: boolean;
  colors: any;
}) {
  return (
    <View style={[styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
      <View style={[styles.iconWrap, { backgroundColor: colors.bg }]}>
        <Ionicons name={icon} size={18} color={colors.text} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
        {sub ? <Text style={[styles.rowSub, { color: colors.textSecondary }]}>{sub}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ false: colors.border, true: colors.text }} thumbColor="#fff" />
    </View>
  );
}

// ─── Session card ─────────────────────────────────────────────────────────────

function SessionCard({ device, location, time, current, colors }: {
  device: string; location: string; time: string; current?: boolean; colors: any;
}) {
  return (
    <View style={[styles.sessionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.sessionLeft}>
        <Ionicons name={device.includes('iPhone') ? 'phone-portrait-outline' : 'laptop-outline'} size={20} color={colors.text} />
        <View style={{ marginLeft: 12 }}>
          <Text style={[styles.sessionDevice, { color: colors.text }]}>{device}</Text>
          <Text style={[styles.sessionMeta, { color: colors.textSecondary }]}>{location} · {time}</Text>
        </View>
      </View>
      {current
        ? <View style={[styles.currentBadge, { backgroundColor: colors.text }]}>
            <Text style={[styles.currentText, { color: colors.bg }]}>This device</Text>
          </View>
        : <Pressable onPress={() => Alert.alert('Sign out session', 'Sign out from this device?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign out', style: 'destructive' },
          ])}>
            <Text style={{ color: '#e53935', fontFamily: 'ProductSans-Medium', fontSize: 13 }}>Sign out</Text>
          </Pressable>
      }
    </View>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SecurityPage() {
  const { colors } = useAppTheme();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [faceId, setFaceId] = useState(true);

  const phone = profile?.phone ?? '—';
  const maskedPhone = phone.length > 4 ? `+•••• ••• ${phone.slice(-4)}` : phone;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <ScreenHeader title="Security" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Login ─────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>LOGIN</Text>
          <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ActionRow
              icon="call-outline" label="Phone Number"
              sub="Change your login phone number"
              value={maskedPhone}
              onPress={() => Alert.alert('Coming soon', 'Phone number change will be available in a future update.')}
              colors={colors}
            />
            <ToggleRow
              icon="finger-print-outline" label="Face ID / Biometrics"
              sub="Use Face ID to unlock the app"
              value={faceId} onChange={setFaceId}
              last colors={colors}
            />
          </View>
        </View>

        {/* ── Active sessions ───────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>ACTIVE SESSIONS</Text>
          <SessionCard device="iPhone 16 Pro" location="New York, US" time="Now" current colors={colors} />
          <SessionCard device="MacBook Air" location="New York, US" time="2 days ago" colors={colors} />
        </View>

        {/* ── Danger zone ───────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>DANGER ZONE</Text>
          <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ActionRow
              icon="log-out-outline" label="Sign out all devices"
              sub="Revoke access on all other devices"
              onPress={() => Alert.alert('Sign out everywhere?', 'You will need to log back in on all devices.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign out all', style: 'destructive' },
              ])}
              colors={colors} last
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1 },
  scroll:        { paddingHorizontal: 16, paddingBottom: 40 },
  section:       { marginTop: 24, gap: 8 },
  sectionTitle:  { fontSize: 11, fontFamily: 'ProductSans-Bold', letterSpacing: 1.4, marginLeft: 2 },
  group:         { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14, gap: 12 },
  iconWrap:      { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowText:       { flex: 1 },
  rowLabel:      { fontSize: 15, fontFamily: 'ProductSans-Medium' },
  rowSub:        { fontSize: 12, fontFamily: 'ProductSans-Regular', marginTop: 2 },
  rowValue:      { fontSize: 13, fontFamily: 'ProductSans-Regular', marginRight: 6 },
  sessionCard:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  sessionLeft:   { flexDirection: 'row', alignItems: 'center', flex: 1 },
  sessionDevice: { fontSize: 14, fontFamily: 'ProductSans-Medium' },
  sessionMeta:   { fontSize: 12, fontFamily: 'ProductSans-Regular', marginTop: 2 },
  currentBadge:  { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  currentText:   { fontSize: 11, fontFamily: 'ProductSans-Bold' },
});
