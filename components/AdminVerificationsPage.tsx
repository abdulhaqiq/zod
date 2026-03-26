import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import ScreenHeader from '@/components/ui/ScreenHeader';
import Squircle from '@/components/ui/Squircle';
import { API_V1 } from '@/constants/api';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type VerifUser = {
  id: string | null;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  verification_status: string | null;
  is_verified: boolean | null;
};

type Attempt = {
  id: string;
  status: 'pending' | 'verified' | 'rejected';
  submitted_at: string;
  processed_at: string | null;
  ip_address: string | null;
  device_model: string | null;
  platform: string | null;
  selfie_url: string | null;
  is_live: boolean | null;
  face_match_score: number | null;
  age_estimate: number | null;
  rejection_reason: string | null;
  user: VerifUser | null;
};

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const color =
    status === 'verified' ? '#22c55e' :
    status === 'rejected' ? '#ef4444' : '#f59e0b';
  const icon =
    status === 'verified' ? 'checkmark-circle' :
    status === 'rejected' ? 'close-circle' : 'time-outline';
  const label =
    status === 'verified' ? 'Verified' :
    status === 'rejected' ? 'Rejected' : 'Pending';

  return (
    <View style={[styles.badge, { backgroundColor: `${color}18` }]}>
      <Ionicons name={icon as any} size={12} color={color} />
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

// ─── Attempt card ─────────────────────────────────────────────────────────────

function AttemptCard({ a }: { a: Attempt }) {
  const { colors } = useAppTheme();
  const [expanded, setExpanded] = useState(false);

  const submitted = new Date(a.submitted_at).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  const processed = a.processed_at
    ? new Date(a.processed_at).toLocaleString(undefined, {
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : null;

  const processingMs = a.processed_at
    ? new Date(a.processed_at).getTime() - new Date(a.submitted_at).getTime()
    : null;
  const processingLabel = processingMs != null
    ? processingMs < 1000
      ? `${processingMs}ms`
      : `${(processingMs / 1000).toFixed(1)}s`
    : null;

  return (
    <Squircle
      style={styles.card}
      cornerRadius={18}
      cornerSmoothing={1}
      fillColor={colors.surface}
      strokeColor={colors.border}
      strokeWidth={StyleSheet.hairlineWidth}
    >
      {/* Header row */}
      <Pressable
        style={styles.cardHeader}
        onPress={() => setExpanded(e => !e)}
      >
        <View style={styles.cardHeaderLeft}>
          <Text style={[styles.userName, { color: colors.text }]}>
            {a.user?.full_name ?? 'Unknown User'}
          </Text>
          <Text style={[styles.userContact, { color: colors.textSecondary }]}>
            {a.user?.phone ?? a.user?.email ?? a.user?.id ?? '—'}
          </Text>
        </View>
        <View style={styles.cardHeaderRight}>
          <StatusBadge status={a.status} />
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down' as any}
            size={14}
            color={colors.textTertiary}
          />
        </View>
      </Pressable>

      {/* Always-visible summary */}
      <View style={[styles.cardSummary, { borderTopColor: colors.border }]}>
        <View style={styles.metaRow}>
          <Ionicons name="calendar-outline" size={12} color={colors.textTertiary} />
          <Text style={[styles.metaText, { color: colors.textSecondary }]}>{submitted}</Text>
        </View>
        {a.face_match_score != null && (
          <View style={styles.metaRow}>
            <Ionicons name="person-outline" size={12} color={colors.textTertiary} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>
              {a.face_match_score.toFixed(0)}% match
            </Text>
          </View>
        )}
        {a.is_live === false && (
          <View style={styles.metaRow}>
            <Ionicons name="alert-circle-outline" size={12} color="#ef4444" />
            <Text style={[styles.metaText, { color: '#ef4444' }]}>Liveness failed</Text>
          </View>
        )}
      </View>

      {/* Expanded detail */}
      {expanded && (
        <View style={[styles.cardDetail, { borderTopColor: colors.border }]}>
          <DetailRow label="Attempt ID"    value={a.id}                         colors={colors} mono />
          <DetailRow label="Submitted"     value={submitted}                     colors={colors} />
          <DetailRow label="Processed"     value={processed ?? '—'}              colors={colors} />
          {processingLabel && (
            <DetailRow label="Processing time" value={processingLabel}           colors={colors} />
          )}
          <DetailRow label="IP Address"   value={a.ip_address ?? '—'}            colors={colors} mono />
          <DetailRow label="Platform"     value={a.platform ?? '—'}              colors={colors} />
          <DetailRow label="Device"       value={a.device_model ?? '—'}          colors={colors} />
          <DetailRow label="Live face"    value={a.is_live === true ? 'Yes' : a.is_live === false ? 'No' : '—'} colors={colors} />
          <DetailRow label="Match score"  value={a.face_match_score != null ? `${a.face_match_score.toFixed(1)}%` : '—'} colors={colors} />
          <DetailRow label="Age estimate" value={a.age_estimate != null ? `${a.age_estimate} yrs` : '—'} colors={colors} />
          {a.rejection_reason && (
            <DetailRow label="Rejection reason" value={a.rejection_reason}       colors={colors} />
          )}
          {/* User info */}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <DetailRow label="User ID"      value={a.user?.id ?? '—'}              colors={colors} mono />
          <DetailRow label="User status"  value={a.user?.verification_status ?? '—'} colors={colors} />
        </View>
      )}
    </Squircle>
  );
}

function DetailRow({
  label, value, colors, mono = false,
}: {
  label: string; value: string; colors: any; mono?: boolean;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>{label}</Text>
      <Text
        style={[styles.detailValue, { color: colors.text }, mono && styles.mono]}
        numberOfLines={3}
        selectable
      >
        {value}
      </Text>
    </View>
  );
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatsBar({ attempts, colors }: { attempts: Attempt[]; colors: any }) {
  const verified = attempts.filter(a => a.status === 'verified').length;
  const rejected = attempts.filter(a => a.status === 'rejected').length;
  const pending  = attempts.filter(a => a.status === 'pending').length;

  return (
    <View style={styles.statsBar}>
      <StatPill label="Total"    value={attempts.length} color={colors.text}   colors={colors} />
      <StatPill label="Verified" value={verified}         color="#22c55e"       colors={colors} />
      <StatPill label="Rejected" value={rejected}         color="#ef4444"       colors={colors} />
      {pending > 0 && (
        <StatPill label="Pending" value={pending}         color="#f59e0b"       colors={colors} />
      )}
    </View>
  );
}

function StatPill({ label, value, color, colors }: { label: string; value: number; color: string; colors: any }) {
  return (
    <Squircle
      style={styles.statPill}
      cornerRadius={14}
      cornerSmoothing={1}
      fillColor={colors.surface}
      strokeColor={colors.border}
      strokeWidth={StyleSheet.hairlineWidth}
    >
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
    </Squircle>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminVerificationsPage() {
  const router   = useRouter();
  const { colors } = useAppTheme();
  const { token }  = useAuth();

  const [attempts,  setAttempts]  = useState<Attempt[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!token) return;
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_V1}/admin/verifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? 'Failed to load');
      setAttempts(data.attempts ?? []);
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScreenHeader
        title="Verifications"
        onClose={() => router.back()}
        colors={colors}
      />

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={colors.textSecondary}
          />
        }
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.text} />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Ionicons name="alert-circle-outline" size={36} color={colors.error} />
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
            <Pressable onPress={() => load()} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
              <Text style={[styles.retryText, { color: colors.text }]}>Retry</Text>
            </Pressable>
          </View>
        ) : attempts.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="scan-outline" size={44} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No verification attempts yet</Text>
          </View>
        ) : (
          <>
            <StatsBar attempts={attempts} colors={colors} />
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
              ALL ATTEMPTS · NEWEST FIRST
            </Text>
            {attempts.map(a => (
              <AttemptCard key={a.id} a={a} />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:           { flex: 1 },
  flex:           { flex: 1 },
  scroll:         { paddingHorizontal: 16, paddingBottom: 48, paddingTop: 8, gap: 12 },
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },

  // Stats
  statsBar:       { flexDirection: 'row', gap: 8, marginBottom: 4 },
  statPill:       { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 2 },
  statValue:      { fontSize: 20, fontFamily: 'ProductSans-Black' },
  statLabel:      { fontSize: 10, fontFamily: 'ProductSans-Regular', letterSpacing: 0.5 },

  sectionLabel:   { fontSize: 10, fontFamily: 'ProductSans-Bold', letterSpacing: 0.8, paddingLeft: 2 },

  // Card
  card:           { overflow: 'hidden' },
  cardHeader:     { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  cardHeaderLeft: { flex: 1 },
  cardHeaderRight:{ flexDirection: 'row', alignItems: 'center', gap: 8 },
  userName:       { fontSize: 14, fontFamily: 'ProductSans-Bold' },
  userContact:    { fontSize: 12, fontFamily: 'ProductSans-Regular', marginTop: 1 },

  cardSummary:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 14, paddingBottom: 12, borderTopWidth: StyleSheet.hairlineWidth },
  metaRow:        { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText:       { fontSize: 11, fontFamily: 'ProductSans-Regular' },

  // Expanded detail
  cardDetail:     { borderTopWidth: StyleSheet.hairlineWidth, padding: 14, gap: 8 },
  detailRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  detailLabel:    { fontSize: 11, fontFamily: 'ProductSans-Regular', flex: 0.45 },
  detailValue:    { fontSize: 11, fontFamily: 'ProductSans-Bold', flex: 0.55, textAlign: 'right' },
  mono:           { fontFamily: 'ProductSans-Regular', fontSize: 10 },
  divider:        { height: StyleSheet.hairlineWidth, marginVertical: 4 },

  // Badge
  badge:          { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 50, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText:      { fontSize: 11, fontFamily: 'ProductSans-Bold' },

  // Error / empty
  errorText:      { fontSize: 13, fontFamily: 'ProductSans-Regular', textAlign: 'center' },
  retryText:      { fontSize: 14, fontFamily: 'ProductSans-Bold', marginTop: 4 },
  emptyText:      { fontSize: 14, fontFamily: 'ProductSans-Regular' },
});
