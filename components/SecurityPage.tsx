import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import ScreenHeader from '@/components/ui/ScreenHeader';
import Squircle from '@/components/ui/Squircle';
import { API_V1 } from '@/constants/api';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type Session = {
  id: string;
  device_name: string;
  device_os: string;
  ip_address: string;
  created_at: string;
  last_used_at: string;
  expires_at: string;
};

const MAX_SESSIONS = 2;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  return new Date(iso).toLocaleDateString();
}

function deviceIcon(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('iphone') || n.includes('android') || n.includes('pixel')) return 'phone-portrait-outline';
  if (n.includes('ipad') || n.includes('tablet')) return 'tablet-portrait-outline';
  if (n.includes('mac') || n.includes('windows') || n.includes('linux')) return 'laptop-outline';
  return 'hardware-chip-outline';
}

// ─── Row components ───────────────────────────────────────────────────────────

function ActionRow({
  icon, label, sub, value, onPress, last, colors, danger,
}: {
  icon: string;
  label: string; sub?: string; value?: string;
  onPress?: () => void; last?: boolean; colors: any; danger?: boolean;
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
      <Squircle style={styles.iconWrap} cornerRadius={10} cornerSmoothing={1} fillColor={colors.bg}>
        <Ionicons name={icon as any} size={18} color={danger ? '#e53935' : colors.text} />
      </Squircle>
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
  icon: string;
  label: string; sub?: string;
  value: boolean; onChange: (v: boolean) => void;
  last?: boolean; colors: any;
}) {
  const handleChange = (v: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(v);
  };
  return (
    <View style={[styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
      <Squircle style={styles.iconWrap} cornerRadius={10} cornerSmoothing={1} fillColor={colors.bg}>
        <Ionicons name={icon as any} size={18} color={colors.text} />
      </Squircle>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
        {sub ? <Text style={[styles.rowSub, { color: colors.textSecondary }]}>{sub}</Text> : null}
      </View>
      <Switch value={value} onValueChange={handleChange} trackColor={{ false: colors.border, true: colors.text }} thumbColor="#fff" />
    </View>
  );
}

// ─── Session card ─────────────────────────────────────────────────────────────

function SessionCard({ session, isCurrent, onRevoke, colors }: {
  session: Session; isCurrent: boolean; onRevoke: () => void; colors: any;
}) {
  return (
    <Squircle style={styles.sessionCard} cornerRadius={18} cornerSmoothing={1}
      fillColor={colors.surface} strokeColor={isCurrent ? colors.text : colors.border} strokeWidth={isCurrent ? 1.5 : 1}>
      <View style={styles.sessionLeft}>
        <Ionicons name={deviceIcon(session.device_name) as any} size={20} color={colors.text} />
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text style={[styles.sessionDevice, { color: colors.text }]} numberOfLines={1}>
            {session.device_name}
          </Text>
          <Text style={[styles.sessionMeta, { color: colors.textSecondary }]}>
            {session.ip_address ? `${session.ip_address} · ` : ''}{timeAgo(session.last_used_at)}
          </Text>
        </View>
      </View>
      {isCurrent
        ? <View style={[styles.currentBadge, { backgroundColor: colors.text }]}>
            <Text style={[styles.currentText, { color: colors.bg }]}>This device</Text>
          </View>
        : <Pressable onPress={onRevoke} hitSlop={8}>
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
      }
    </Squircle>
  );
}

// ─── Max-sessions modal ───────────────────────────────────────────────────────

function MaxSessionsModal({ visible, sessions, onRevoke, onClose, colors }: {
  visible: boolean;
  sessions: Session[];
  onRevoke: (id: string) => void;
  onClose: () => void;
  colors: any;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
          <View style={styles.modalHandle} />
          <Text style={[styles.modalTitle, { color: colors.text }]}>Too many active sessions</Text>
          <Text style={[styles.modalSub, { color: colors.textSecondary }]}>
            You've reached the maximum of {MAX_SESSIONS} active sessions. Sign out of an existing session to continue.
          </Text>

          <View style={{ gap: 10, marginTop: 16 }}>
            {sessions.map(s => (
              <Squircle key={s.id} cornerRadius={16} cornerSmoothing={1}
                fillColor={colors.bg} strokeColor={colors.border} strokeWidth={1}
                style={styles.modalSessionCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                  <Ionicons name={deviceIcon(s.device_name) as any} size={18} color={colors.text} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sessionDevice, { color: colors.text }]} numberOfLines={1}>{s.device_name}</Text>
                    <Text style={[styles.sessionMeta, { color: colors.textSecondary }]}>{timeAgo(s.last_used_at)}</Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => onRevoke(s.id)}
                  style={[styles.modalRevokeBtn, { borderColor: '#e53935' }]}
                >
                  <Text style={styles.modalRevokeTxt}>Remove</Text>
                </Pressable>
              </Squircle>
            ))}
          </View>

          <Pressable onPress={onClose} style={[styles.modalCancelBtn, { borderColor: colors.border }]}>
            <Text style={[styles.modalCancelTxt, { color: colors.textSecondary }]}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SecurityPage() {
  const { colors } = useAppTheme();
  const { profile, token } = useAuth();
  const [faceId, setFaceId] = useState(true);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [showMaxModal, setShowMaxModal] = useState(false);

  const phone = profile?.phone ?? '—';
  const maskedPhone = phone.length > 4 ? `+•••• ••• ${phone.slice(-4)}` : phone;

  const fetchSessions = useCallback(async () => {
    if (!token) return;
    setLoadingSessions(true);
    try {
      const res = await fetch(`${API_V1}/auth/sessions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions ?? []);
        // If over limit, show modal immediately
        if ((data.sessions ?? []).length > MAX_SESSIONS) {
          setShowMaxModal(true);
        }
      }
    } catch {}
    finally { setLoadingSessions(false); }
  }, [token]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const revokeSession = async (sessionId: string) => {
    if (!token) return;
    setRevokingId(sessionId);
    try {
      await fetch(`${API_V1}/auth/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      setShowMaxModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Error', 'Could not sign out that session. Please try again.');
    } finally {
      setRevokingId(null);
    }
  };

  const revokeAll = async () => {
    if (!token) return;
    Alert.alert('Sign out everywhere?', 'You will need to log back in on all devices.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out all', style: 'destructive', onPress: async () => {
          try {
            await fetch(`${API_V1}/auth/sessions`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` },
            });
            setSessions([]);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch {
            Alert.alert('Error', 'Could not sign out all sessions.');
          }
        },
      },
    ]);
  };

  // The newest session is assumed to be the current device
  const currentSessionId = sessions[0]?.id ?? null;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScreenHeader title="Security" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Login ─────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>LOGIN</Text>
          <Squircle style={styles.group} cornerRadius={22} cornerSmoothing={1}
            fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
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
          </Squircle>
        </View>

        {/* ── Active sessions ───────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              ACTIVE SESSIONS {!loadingSessions && `(${sessions.length}/${MAX_SESSIONS})`}
            </Text>
            {sessions.length > MAX_SESSIONS && (
              <Pressable onPress={() => setShowMaxModal(true)}>
                <Text style={styles.warningText}>Over limit</Text>
              </Pressable>
            )}
          </View>

          {loadingSessions
            ? <ActivityIndicator color={colors.text} style={{ marginTop: 12 }} />
            : sessions.length === 0
              ? <Squircle style={styles.emptyCard} cornerRadius={18} cornerSmoothing={1}
                  fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No active sessions found.</Text>
                </Squircle>
              : <View style={{ gap: 8 }}>
                  {sessions.map(s => (
                    <SessionCard
                      key={s.id}
                      session={s}
                      isCurrent={s.id === currentSessionId}
                      onRevoke={() => revokeSession(s.id)}
                      colors={colors}
                    />
                  ))}
                </View>
          }
        </View>

        {/* ── Danger zone ───────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>DANGER ZONE</Text>
          <Squircle style={styles.group} cornerRadius={22} cornerSmoothing={1}
            fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
            <ActionRow
              icon="log-out-outline" label="Sign out all devices"
              sub="Revoke access on all other devices"
              onPress={revokeAll}
              colors={colors} last
            />
          </Squircle>
        </View>
      </ScrollView>

      {/* ── Max sessions modal ────────────────────────────────────────── */}
      <MaxSessionsModal
        visible={showMaxModal}
        sessions={sessions.filter(s => s.id !== currentSessionId)}
        onRevoke={revokeSession}
        onClose={() => setShowMaxModal(false)}
        colors={colors}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1 },
  scroll:          { paddingHorizontal: 16, paddingBottom: 40 },
  section:         { marginTop: 24, gap: 8 },
  sectionRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginLeft: 2 },
  sectionTitle:    { fontSize: 11, fontFamily: 'ProductSans-Bold', letterSpacing: 1.4 },
  warningText:     { fontSize: 11, fontFamily: 'ProductSans-Bold', color: '#e53935' },
  group:           { overflow: 'hidden' },
  row:             { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14, gap: 12 },
  iconWrap:        { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  rowText:         { flex: 1 },
  rowLabel:        { fontSize: 15, fontFamily: 'ProductSans-Medium' },
  rowSub:          { fontSize: 12, fontFamily: 'ProductSans-Regular', marginTop: 2 },
  rowValue:        { fontSize: 13, fontFamily: 'ProductSans-Regular', marginRight: 6 },
  sessionCard:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  sessionLeft:     { flexDirection: 'row', alignItems: 'center', flex: 1 },
  sessionDevice:   { fontSize: 14, fontFamily: 'ProductSans-Medium' },
  sessionMeta:     { fontSize: 12, fontFamily: 'ProductSans-Regular', marginTop: 2 },
  currentBadge:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  currentText:     { fontSize: 11, fontFamily: 'ProductSans-Bold' },
  signOutText:     { color: '#e53935', fontFamily: 'ProductSans-Medium', fontSize: 13 },
  emptyCard:       { padding: 18, alignItems: 'center' },
  emptyText:       { fontSize: 13, fontFamily: 'ProductSans-Regular' },

  // Modal
  modalBackdrop:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet:      { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  modalHandle:     { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(128,128,128,0.4)', alignSelf: 'center', marginBottom: 20 },
  modalTitle:      { fontSize: 18, fontFamily: 'ProductSans-Bold', textAlign: 'center' },
  modalSub:        { fontSize: 13, fontFamily: 'ProductSans-Regular', textAlign: 'center', marginTop: 8, lineHeight: 20 },
  modalSessionCard:{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  modalRevokeBtn:  { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  modalRevokeTxt:  { fontSize: 12, fontFamily: 'ProductSans-Bold', color: '#e53935' },
  modalCancelBtn:  { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  modalCancelTxt:  { fontSize: 15, fontFamily: 'ProductSans-Medium' },
});
