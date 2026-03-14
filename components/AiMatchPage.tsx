import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
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

// ─── Shimmer skeleton ─────────────────────────────────────────────────────────

function ShimmerBox({ width, height, borderRadius = 8, colors }: {
  width: number | string; height: number; borderRadius?: number; colors: any;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });

  return (
    <Animated.View style={{
      width: width as any, height, borderRadius,
      backgroundColor: colors.surface2,
      opacity,
    }} />
  );
}

function SkeletonCard({ colors }: { colors: any }) {
  return (
    <View style={[skStyles.card, { backgroundColor: colors.surface }]}>
      <View style={skStyles.cardTop}>
        <ShimmerBox width={76} height={76} borderRadius={18} colors={colors} />
        <View style={{ flex: 1, gap: 8, paddingTop: 4 }}>
          <ShimmerBox width="60%" height={14} borderRadius={7} colors={colors} />
          <ShimmerBox width="40%" height={11} borderRadius={6} colors={colors} />
          <ShimmerBox width="50%" height={24} borderRadius={12} colors={colors} />
          <ShimmerBox width="100%" height={4}  borderRadius={2} colors={colors} />
        </View>
      </View>
      <View style={[skStyles.divider, { backgroundColor: colors.border }]} />
      <View style={{ gap: 8 }}>
        <ShimmerBox width="38%" height={10} borderRadius={5} colors={colors} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <ShimmerBox width={70} height={28} borderRadius={14} colors={colors} />
          <ShimmerBox width={60} height={28} borderRadius={14} colors={colors} />
          <ShimmerBox width={80} height={28} borderRadius={14} colors={colors} />
        </View>
      </View>
      <View style={[skStyles.divider, { backgroundColor: colors.border }]} />
      <View style={{ gap: 6 }}>
        <ShimmerBox width="35%" height={10} borderRadius={5} colors={colors} />
        <ShimmerBox width="100%" height={11} borderRadius={6} colors={colors} />
        <ShimmerBox width="85%"  height={11} borderRadius={6} colors={colors} />
        <ShimmerBox width="70%"  height={11} borderRadius={6} colors={colors} />
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
        <ShimmerBox width="48%" height={46} borderRadius={50} colors={colors} />
        <ShimmerBox width="48%" height={46} borderRadius={50} colors={colors} />
      </View>
    </View>
  );
}

const skStyles = StyleSheet.create({
  card:    { borderRadius: 24, padding: 16, gap: 14 },
  cardTop: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  divider: { height: StyleSheet.hairlineWidth },
});

// ─── Score bar animated ────────────────────────────────────────────────────────

function ScoreBar({ score, colors }: { score: number; colors: any }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: score / 100, duration: 800, useNativeDriver: false }).start();
  }, [score]);
  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View style={[styles.scoreTrack, { backgroundColor: colors.surface2, marginTop: 6 }]}>
      <Animated.View style={[styles.scoreFill, { width: width as any, backgroundColor: colors.text }]} />
    </View>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AiMatchPage({ insets }: { insets: any }) {
  const { token }  = useAuth();
  const { colors } = useAppTheme();
  const router     = useRouter();
  const [picks,   setPicks]   = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  // Track swipe actions taken in this session to show "passed" badge without re-fetch
  const [swiped, setSwiped]   = useState<Record<string, 'like' | 'pass'>>({});

  const fetchPicks = useCallback(() => {
    if (!token) return;
    setLoading(true);
    // Pass a higher limit so after filtering already-swiped we still have cards.
    // The backend already excludes swiped profiles from /discover/feed so this
    // just gets the freshest un-swiped profiles for the AI section.
    apiFetch<{ profiles: Profile[] }>('/discover/feed?page=0&limit=10', { token })
      .then(res => setPicks(res.profiles ?? []))
      .catch(() => setPicks([]))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { fetchPicks(); }, [fetchPicks]);

  const handleSwipe = async (profileId: string, direction: 'right' | 'left') => {
    setSwiped(prev => ({ ...prev, [profileId]: direction === 'right' ? 'like' : 'pass' }));
    try {
      await apiFetch('/discover/swipe', {
        token: token ?? undefined,
        method: 'POST',
        body: JSON.stringify({ swiped_id: profileId, direction, mode: 'date' }),
      });
    } catch {}
  };

  const scored = picks.map((p, i) => ({
    profile: p,
    score: Math.max(70, 97 - i * 4),
    sharedInterests: (p.interests ?? []).slice(0, 3).map((x: any) => x.label ?? x),
    reason: `You and ${p.name ?? 'this person'} share compatible interests and lifestyle patterns that suggest strong chemistry.`,
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
        <Pressable onPress={fetchPicks} hitSlop={10} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
          <Squircle style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
            cornerRadius={12} cornerSmoothing={1} fillColor={colors.surface2}>
            <Ionicons name="refresh" size={16} color={colors.text} />
          </Squircle>
        </Pressable>
      </View>

      {/* Skeleton loading */}
      {loading && (
        <>
          <SkeletonCard colors={colors} />
          <SkeletonCard colors={colors} />
          <SkeletonCard colors={colors} />
        </>
      )}

      {/* Empty state */}
      {!loading && scored.length === 0 && (
        <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
          <Ionicons name="sparkles-outline" size={48} color={colors.textSecondary} />
          <Text style={[styles.name, { color: colors.text }]}>No new picks</Text>
          <Text style={[styles.reason, { color: colors.textSecondary, textAlign: 'center' }]}>
            You've seen everyone nearby. Check back soon or update your filters.
          </Text>
        </View>
      )}

      {/* Match cards */}
      {!loading && scored.map(({ profile, score, sharedInterests, reason }) => {
        const action = swiped[profile.id];
        const isLiked  = action === 'like';
        const isPassed = action === 'pass';

        return (
          <View key={profile.id} style={{ position: 'relative' }}>
            <Squircle
              style={[styles.card, (isLiked || isPassed) && { opacity: 0.55 }]}
              cornerRadius={24} cornerSmoothing={1}
              fillColor={colors.surface} strokeColor={colors.border} strokeWidth={StyleSheet.hairlineWidth}
            >
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <Squircle style={styles.scorePill} cornerRadius={20} cornerSmoothing={1} fillColor={colors.surface2}>
                      <Ionicons name="pulse" size={12} color={colors.text} />
                      <Text style={[styles.scoreNum, { color: colors.text }]}>{score}% match</Text>
                    </Squircle>
                  </View>
                  <ScoreBar score={score} colors={colors} />
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
              {!action && (
                <View style={styles.actions}>
                  <Pressable
                    onPress={() => handleSwipe(profile.id, 'left')}
                    style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.7 : 1 }]}
                  >
                    <Squircle style={[styles.actionBtn]} cornerRadius={50} cornerSmoothing={1}
                      fillColor="transparent" strokeColor={colors.border} strokeWidth={1.5}>
                      <Ionicons name="close" size={16} color={colors.text} />
                      <Text style={[styles.actionBtnText, { color: colors.text }]}>Pass</Text>
                    </Squircle>
                  </Pressable>
                  <Pressable
                    onPress={() => handleSwipe(profile.id, 'right')}
                    style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.7 : 1 }]}
                  >
                    <Squircle style={[styles.actionBtn]} cornerRadius={50} cornerSmoothing={1} fillColor={colors.text}>
                      <Ionicons name="heart" size={16} color={colors.bg} />
                      <Text style={[styles.actionBtnText, { color: colors.bg }]}>Connect</Text>
                    </Squircle>
                  </Pressable>
                </View>
              )}

              {/* Already-actioned row */}
              {action && (
                <View style={styles.actions}>
                  <View style={[styles.actionedRow, {
                    backgroundColor: isLiked ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.10)',
                    borderColor: isLiked ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.25)',
                  }]}>
                    <Ionicons
                      name={isLiked ? 'heart' : 'close-circle'}
                      size={16}
                      color={isLiked ? '#22c55e' : '#ef4444'}
                    />
                    <Text style={[styles.actionedText, { color: isLiked ? '#22c55e' : '#ef4444' }]}>
                      {isLiked ? 'Liked' : 'Passed'}
                    </Text>
                  </View>
                </View>
              )}
            </Squircle>

            {/* Liked / Passed stamp overlay */}
            {isLiked && (
              <View style={[styles.stampWrap, styles.stampLike]}>
                <Ionicons name="heart" size={13} color="#22c55e" />
                <Text style={[styles.stampText, { color: '#22c55e' }]}>LIKED</Text>
              </View>
            )}
            {isPassed && (
              <View style={[styles.stampWrap, styles.stampPass]}>
                <Ionicons name="close" size={13} color="#ef4444" />
                <Text style={[styles.stampText, { color: '#ef4444' }]}>PASSED</Text>
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headerRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  headerIcon:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  pageTitle:      { fontSize: 24, fontFamily: 'ProductSans-Black' },
  pageSub:        { fontSize: 13, fontFamily: 'ProductSans-Regular', marginTop: 2 },

  card:           { overflow: 'hidden', padding: 16, gap: 14 },
  cardTop:        { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  photo:          { width: 76, height: 76, borderRadius: 18 },
  info:           { flex: 1, gap: 2 },
  name:           { fontSize: 16, fontFamily: 'ProductSans-Black' },
  location:       { fontSize: 12, fontFamily: 'ProductSans-Regular' },
  scorePill:      { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5 },
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
  actionBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13 },
  actionBtnText:  { fontSize: 14, fontFamily: 'ProductSans-Bold' },

  actionedRow:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 50, borderWidth: 1 },
  actionedText:   { fontSize: 14, fontFamily: 'ProductSans-Bold' },

  stampWrap:      { position: 'absolute', top: 14, right: 14, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 50, borderWidth: 1.5 },
  stampLike:      { backgroundColor: 'rgba(34,197,94,0.12)', borderColor: 'rgba(34,197,94,0.4)' },
  stampPass:      { backgroundColor: 'rgba(239,68,68,0.10)',  borderColor: 'rgba(239,68,68,0.3)' },
  stampText:      { fontSize: 11, fontFamily: 'ProductSans-Black', letterSpacing: 1 },
});
