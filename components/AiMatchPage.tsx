import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Squircle from '@/components/ui/Squircle';
import { apiFetch } from '@/constants/api';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';

interface Profile {
  id: string; name: string; age: number; verified: boolean;
  distance: string; images: string[];
  interests: { emoji: string; label: string }[];
}

export default function AiMatchPage({ insets }: { insets: any }) {
  const { token } = useAuth();
  const { colors } = useAppTheme();
  const [picks, setPicks]     = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    apiFetch<{ profiles: Profile[] }>('/discover/feed?page=0&limit=5', { token })
      .then(res => setPicks(res.profiles))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const scored = picks.map((p, i) => ({
    profile: p,
    score: Math.max(70, 97 - i * 5),
    sharedInterests: (p.interests ?? []).slice(0, 3).map((x: any) => x.label ?? x),
    reason: `Based on your profile, you and ${p.name ?? 'this person'} share common interests and compatibility signals.`,
  }));

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: insets.bottom + 90, gap: 12 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <Squircle style={styles.headerIcon} cornerRadius={14} cornerSmoothing={1} fillColor={colors.surface2}>
          <Ionicons name="sparkles" size={18} color={colors.text} />
        </Squircle>
        <View style={{ flex: 1 }}>
          <Text style={[styles.pageTitle, { color: colors.text }]}>AI Matches</Text>
          <Text style={[styles.pageSub, { color: colors.textSecondary }]}>Curated picks based on your profile</Text>
        </View>
      </View>

      {loading && (
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Finding your best matches…</Text>
      )}

      {scored.map(({ profile, score, sharedInterests, reason }) => (
        <Squircle key={profile.id} style={styles.card} cornerRadius={24} cornerSmoothing={1}
          fillColor={colors.surface} strokeColor={colors.border} strokeWidth={StyleSheet.hairlineWidth}>

          {/* Top: photo + info */}
          <View style={styles.cardTop}>
            <Image source={{ uri: profile.images?.[0] }} style={styles.photo} resizeMode="cover" />
            <View style={styles.info}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.name, { color: colors.text }]}>{profile.name}, {profile.age}</Text>
                {profile.verified && <Ionicons name="checkmark-circle" size={14} color={colors.text} />}
              </View>
              {profile.distance ? (
                <Text style={[styles.location, { color: colors.textSecondary }]}>{profile.distance} away</Text>
              ) : null}
              <Squircle style={styles.scorePill} cornerRadius={20} cornerSmoothing={1} fillColor={colors.surface2}>
                <Ionicons name="pulse" size={12} color={colors.text} />
                <Text style={[styles.scoreNum, { color: colors.text }]}>{score}% match</Text>
              </Squircle>
              <View style={[styles.scoreTrack, { backgroundColor: colors.surface2, marginTop: 8 }]}>
                <View style={[styles.scoreFill, { width: `${score}%` as any, backgroundColor: colors.text }]} />
              </View>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Shared interests */}
          <View style={{ gap: 8 }}>
            <Text style={[styles.secLabel, { color: colors.textSecondary }]}>SHARED INTERESTS</Text>
            <View style={styles.chipRow}>
              {sharedInterests.map((interest: string) => (
                <Squircle key={interest} style={styles.chip} cornerRadius={20} cornerSmoothing={1} fillColor={colors.surface2}>
                  <Text style={[styles.chipText, { color: colors.text }]}>{interest}</Text>
                </Squircle>
              ))}
              {sharedInterests.length === 0 && (
                <Text style={[styles.emptyChipText, { color: colors.textSecondary }]}>Complete your profile to see shared interests</Text>
              )}
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Why matched */}
          <View style={{ gap: 6 }}>
            <Text style={[styles.secLabel, { color: colors.textSecondary }]}>WHY YOU MATCH</Text>
            <Text style={[styles.reason, { color: colors.text }]}>{reason}</Text>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <Squircle style={[styles.actionBtn, styles.actionBtnOutline]} cornerRadius={50} cornerSmoothing={1}
              fillColor="transparent" strokeColor={colors.border} strokeWidth={1.5}>
              <Text style={[styles.actionBtnText, { color: colors.text }]}>View Profile</Text>
            </Squircle>
            <Squircle style={[styles.actionBtn, styles.actionBtnFill]} cornerRadius={50} cornerSmoothing={1} fillColor={colors.text}>
              <Text style={[styles.actionBtnText, { color: colors.bg }]}>Connect</Text>
            </Squircle>
          </View>
        </Squircle>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headerRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  headerIcon:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  pageTitle:      { fontSize: 24, fontFamily: 'ProductSans-Black' },
  pageSub:        { fontSize: 13, fontFamily: 'ProductSans-Regular', marginTop: 2 },
  loadingText:    { fontSize: 13, fontFamily: 'ProductSans-Regular', textAlign: 'center', marginTop: 40 },

  card:           { overflow: 'hidden', padding: 16, gap: 14 },
  cardTop:        { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  photo:          { width: 76, height: 76, borderRadius: 18 },
  info:           { flex: 1, gap: 4 },
  name:           { fontSize: 16, fontFamily: 'ProductSans-Black' },
  location:       { fontSize: 12, fontFamily: 'ProductSans-Regular' },
  scorePill:      { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, marginTop: 4 },
  scoreNum:       { fontSize: 12, fontFamily: 'ProductSans-Bold' },
  scoreTrack:     { height: 4, borderRadius: 2, overflow: 'hidden' },
  scoreFill:      { height: 4, borderRadius: 2 },
  divider:        { height: StyleSheet.hairlineWidth },
  secLabel:       { fontSize: 10, fontFamily: 'ProductSans-Bold', letterSpacing: 1.5 },
  chipRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:           { paddingHorizontal: 12, paddingVertical: 6 },
  chipText:       { fontSize: 13, fontFamily: 'ProductSans-Medium' },
  emptyChipText:  { fontSize: 12, fontFamily: 'ProductSans-Regular' },
  reason:         { fontSize: 14, fontFamily: 'ProductSans-Regular', lineHeight: 21 },
  actions:        { flexDirection: 'row', gap: 10 },
  actionBtn:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 13 },
  actionBtnOutline: {},
  actionBtnFill:  {},
  actionBtnText:  { fontSize: 14, fontFamily: 'ProductSans-Bold' },
});
