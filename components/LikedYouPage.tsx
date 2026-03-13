import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Squircle from '@/components/ui/Squircle';
import MatchScreen, { type MatchedProfile } from '@/components/MatchScreen';
import { apiFetch, WS_V1 } from '@/constants/api';
import { useAppTheme } from '@/context/ThemeContext';

const { width: W } = Dimensions.get('window');
const LIKED_CARD_W  = Math.floor((W - 44) / 2);
const LIKED_PHOTO_H = Math.floor(LIKED_CARD_W * 4 / 3);
const FREE_VISIBLE  = 2;

interface Profile {
  id: string; name: string; age: number; verified: boolean; premium: boolean;
  location: string; distance: string; about: string;
  images: string[];
  details: { height: string; drinks: string; smokes: string; gender: string; wantsKids: string; sign: string; politics: string; religion: string; work: string; education: string };
  lookingFor: string;
  interests: { emoji: string; label: string }[];
  prompts: { question: string; answer: string }[];
  languages: string[];
}

// A confirmed match (liked back) — stores when the match happened
interface RecentMatch {
  id: string;
  name: string;
  age: number;
  image: string;
  matchedAt: number; // timestamp ms
}

function LikedCardSkeleton() {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.cardWrap, { width: LIKED_CARD_W }]}>
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <View style={{ width: LIKED_CARD_W, height: LIKED_PHOTO_H, backgroundColor: colors.surface2 }} />
        <View style={{ padding: 10, gap: 8 }}>
          <View style={{ width: '70%', height: 12, borderRadius: 6, backgroundColor: colors.surface2 }} />
          <View style={{ width: '40%', height: 10, borderRadius: 6, backgroundColor: colors.surface2 }} />
        </View>
      </View>
    </View>
  );
}

function format24h(matchedAt: number): string {
  const diffMs   = Date.now() - matchedAt;
  const remaining = Math.max(0, 24 * 60 * 60 * 1000 - diffMs);
  if (remaining === 0) return 'Expired';
  const hh = Math.floor(remaining / (60 * 60 * 1000));
  const mm = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
  return `${hh}h ${mm}m left`;
}

export default function LikedYouPage({ insets, token }: { insets: any; token: string | null }) {
  const router   = useRouter();
  const { colors } = useAppTheme();

  const [likedProfiles, setLikedProfiles] = useState<Profile[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [removed,       setRemoved]       = useState<string[]>([]);   // disliked or liked-back
  const [recentMatches, setRecentMatches] = useState<RecentMatch[]>([]);
  const [matchedProfile, setMatchedProfile] = useState<MatchedProfile | null>(null);
  const [isPro,         setIsPro]         = useState(false);

  const [, setTick] = useState(0); // force re-render every minute for countdown
  const wsRef = useRef<WebSocket | null>(null);

  // Tick every 60s to refresh countdown timers
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  // Initial load
  useEffect(() => {
    if (!token) return;
    setLoading(true);
    apiFetch<{ profiles: Profile[]; total: number }>('/discover/liked-you', { token })
      .then(res => setLikedProfiles(res.profiles))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  // WebSocket — real-time liked_you / match events
  useEffect(() => {
    if (!token) return;
    const ws = new WebSocket(`${WS_V1}/ws/notify?token=${token}`);
    wsRef.current = ws;
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'liked_you' && msg.profile) {
          setLikedProfiles(prev => {
            if (prev.some(p => p.id === msg.profile.id)) return prev;
            return [msg.profile, ...prev];
          });
        } else if (msg.type === 'match' && msg.profile) {
          // WS-initiated match (the other person liked us first via feed, we liked back)
          setMatchedProfile({
            id: msg.profile.id, name: msg.profile.name,
            age: msg.profile.age, image: msg.profile.images?.[0] ?? '',
          });
        }
      } catch { /* ignore */ }
    };
    ws.onerror = () => {};
    return () => { ws.close(); wsRef.current = null; };
  }, [token]);

  const visible = likedProfiles.filter(p => !removed.includes(p.id));
  const count   = visible.length;

  // ── Like back ────────────────────────────────────────────────────────────────
  const handleLike = async (p: Profile) => {
    if (!token) return;
    setRemoved(prev => [...prev, p.id]);   // optimistically remove from grid
    try {
      const res = await apiFetch<{ match: boolean; match_id?: string }>(
        '/discover/swipe',
        { method: 'POST', token, body: JSON.stringify({ swiped_id: p.id, direction: 'right', mode: 'date' }) },
      );
      if (res.match) {
        // It's a mutual match — show celebration overlay
        const mp: MatchedProfile = { id: p.id, name: p.name, age: p.age, image: p.images[0] ?? '' };
        setMatchedProfile(mp);
        setRecentMatches(prev => [{ id: p.id, name: p.name, age: p.age, image: p.images[0] ?? '', matchedAt: Date.now() }, ...prev]);
      }
    } catch { /* ignore — swipe recorded locally */ }
  };

  // ── Dislike ──────────────────────────────────────────────────────────────────
  const handleDislike = async (id: string) => {
    setRemoved(prev => [...prev, id]);     // immediately remove from grid
    if (!token) return;
    try {
      await apiFetch('/discover/swipe', {
        method: 'POST', token,
        body: JSON.stringify({ swiped_id: id, direction: 'left', mode: 'date' }),
      });
    } catch { /* ignore */ }
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.pageTitle, { color: colors.text }]}>Liked You</Text>
            <Text style={[styles.pageSub, { color: colors.textSecondary }]}>{count} people already like you</Text>
          </View>
          <Pressable onPress={() => setIsPro(v => !v)} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
            <Squircle style={styles.proBtn} cornerRadius={20} cornerSmoothing={1}
              fillColor={isPro ? colors.text : colors.surface2}
              strokeColor={colors.border} strokeWidth={StyleSheet.hairlineWidth}>
              <Ionicons name="star" size={13} color={isPro ? colors.bg : colors.text} />
              <Text style={[styles.proBtnText, { color: isPro ? colors.bg : colors.text }]}>{isPro ? 'Pro' : 'Free'}</Text>
            </Squircle>
          </Pressable>
        </View>

        {/* Upgrade banner */}
        {!isPro && (
          <Pressable onPress={() => router.push('/subscription')} style={({ pressed }) => [pressed && { opacity: 0.85 }]}>
            <Squircle style={styles.upgradeBanner} cornerRadius={20} cornerSmoothing={1}
              fillColor={colors.surface} strokeColor={colors.border} strokeWidth={StyleSheet.hairlineWidth}>
              <Squircle style={styles.upgradeIcon} cornerRadius={14} cornerSmoothing={1} fillColor={colors.surface2}>
                <Ionicons name="lock-closed" size={18} color={colors.text} />
              </Squircle>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.upgradeTitle, { color: colors.text }]}>See everyone who liked you</Text>
                <Text style={[styles.upgradeSub, { color: colors.textSecondary }]}>Upgrade to Zod Pro to unlock all profiles</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            </Squircle>
          </Pressable>
        )}

        {/* Recent matches row — circular avatars with 24h countdown */}
        {recentMatches.length > 0 && (
          <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
            <Text style={[styles.matchesRowLabel, { color: colors.textSecondary }]}>MATCHES</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingTop: 10 }}>
              {recentMatches.map(m => {
                const expired = Date.now() - m.matchedAt > 24 * 60 * 60 * 1000;
                return (
                  <Pressable
                    key={m.id}
                    style={({ pressed }) => [styles.matchCircleWrap, pressed && { opacity: 0.75 }]}
                    onPress={() => router.push({ pathname: '/chat', params: { matchId: m.id, name: m.name, image: m.image, online: 'true' } } as any)}
                  >
                    <View style={[styles.matchCircleRing, { borderColor: expired ? colors.surface2 : colors.text }]}>
                      <ExpoImage source={{ uri: m.image }} style={styles.matchCircleAvatar} contentFit="cover" />
                    </View>
                    <Text style={[styles.matchCircleName, { color: colors.text }]} numberOfLines={1}>{m.name.split(' ')[0]}</Text>
                    <Text style={[styles.matchCircleTimer, { color: expired ? colors.textSecondary : colors.text }]}>
                      {expired ? 'Expired' : format24h(m.matchedAt)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Cards grid */}
        <View style={styles.grid}>
          {loading ? (
            <>
              <LikedCardSkeleton /><LikedCardSkeleton />
              <LikedCardSkeleton /><LikedCardSkeleton />
            </>
          ) : visible.map((p, i) => {
            const isBlurred = !isPro && i >= FREE_VISIBLE;
            return (
              <View key={p.id} style={[styles.cardWrap, { width: LIKED_CARD_W }]}>
                <Squircle style={styles.card} cornerRadius={24} cornerSmoothing={1}
                  fillColor={colors.surface} strokeColor={colors.border} strokeWidth={StyleSheet.hairlineWidth}>
                  <View style={styles.photoWrap}>
                    <ExpoImage
                      source={{ uri: p.images[0] }}
                      style={[styles.photo, isBlurred && styles.photoBlurred]}
                      contentFit="cover"
                      blurRadius={isBlurred ? 18 : 0}
                    />
                    {!isBlurred && (
                      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.72)']} style={styles.photoGrad}>
                        <Text style={styles.photoName}>{p.name}, {p.age}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          {p.distance ? (
                            <>
                              <Ionicons name="location-outline" size={10} color="rgba(255,255,255,0.7)" />
                              <Text style={styles.photoDist}>{p.distance}</Text>
                            </>
                          ) : p.location ? (
                            <>
                              <Ionicons name="location-outline" size={10} color="rgba(255,255,255,0.7)" />
                              <Text style={styles.photoDist}>{p.location}</Text>
                            </>
                          ) : null}
                          {p.verified && <Ionicons name="checkmark-circle" size={11} color="#fff" />}
                        </View>
                      </LinearGradient>
                    )}
                    {isBlurred && (
                      <Pressable
                        style={[StyleSheet.absoluteFill, styles.lockOverlay]}
                        onPress={() => router.push('/subscription')}
                      >
                        <Squircle style={styles.lockIcon} cornerRadius={14} cornerSmoothing={1} fillColor="rgba(0,0,0,0.45)">
                          <Ionicons name="lock-closed" size={18} color="#fff" />
                        </Squircle>
                        <Text style={styles.lockText}>Upgrade{'\n'}to see</Text>
                      </Pressable>
                    )}
                    {!isBlurred && (
                      <View style={[styles.heartBadge, { backgroundColor: colors.text }]}>
                        <Ionicons name="heart" size={11} color={colors.bg} />
                      </View>
                    )}
                  </View>

                  {!isBlurred && (
                    <View style={styles.infoRow}>
                      {p.interests[0] && (
                        <Squircle style={styles.chip} cornerRadius={20} cornerSmoothing={1} fillColor={colors.surface2}>
                          <Text style={styles.chipEmoji}>{p.interests[0].emoji}</Text>
                          <Text style={[styles.chipLabel, { color: colors.text }]}>{p.interests[0].label}</Text>
                        </Squircle>
                      )}
                      <View style={styles.actions}>
                        {/* Dislike — calls API + removes from list */}
                        <Pressable
                          onPress={() => handleDislike(p.id)}
                          style={({ pressed }) => [pressed && { opacity: 0.65 }]}
                          hitSlop={6}
                        >
                          <Squircle style={styles.passBtn} cornerRadius={50} cornerSmoothing={1}
                            fillColor={colors.surface2} strokeColor={colors.border} strokeWidth={StyleSheet.hairlineWidth}>
                            <Ionicons name="close" size={18} color={colors.text} />
                          </Squircle>
                        </Pressable>
                        {/* Like back — calls API → if match, opens chat */}
                        <Pressable
                          onPress={() => handleLike(p)}
                          style={({ pressed }) => [pressed && { opacity: 0.65 }, { flex: 1 }]}
                          hitSlop={6}
                        >
                          <Squircle style={styles.likeBtn} cornerRadius={50} cornerSmoothing={1} fillColor={colors.text}>
                            <Ionicons name="heart" size={15} color={colors.bg} />
                            <Text style={[styles.likeBtnText, { color: colors.bg }]}>Like back</Text>
                          </Squircle>
                        </Pressable>
                      </View>
                    </View>
                  )}
                </Squircle>
              </View>
            );
          })}
        </View>

        {/* Empty state */}
        {!loading && visible.length === 0 && recentMatches.length === 0 && (
          <View style={styles.emptyWrap}>
            <Squircle style={styles.emptyIcon} cornerRadius={28} cornerSmoothing={1} fillColor={colors.surface}>
              <Ionicons name="heart-outline" size={32} color={colors.textTertiary} />
            </Squircle>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>You're all caught up</Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary }]}>Keep swiping to get more likes</Text>
          </View>
        )}
      </ScrollView>

      {/* Match celebration overlay */}
      {matchedProfile && (
        <MatchScreen
          profile={matchedProfile}
          onChat={() => {
            const p = matchedProfile;
            setMatchedProfile(null);
            router.push({ pathname: '/chat', params: { matchId: p.id, name: p.name, image: p.image, online: 'true' } } as any);
          }}
          onDismiss={() => setMatchedProfile(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header:             { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16 },
  pageTitle:          { fontSize: 24, fontFamily: 'ProductSans-Black' },
  pageSub:            { fontSize: 13, fontFamily: 'ProductSans-Regular', marginTop: 2, marginBottom: 16 },
  proBtn:             { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7 },
  proBtnText:         { fontSize: 12, fontFamily: 'ProductSans-Bold' },

  upgradeBanner:      { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginBottom: 16, paddingHorizontal: 14, paddingVertical: 14 },
  upgradeIcon:        { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  upgradeTitle:       { fontSize: 14, fontFamily: 'ProductSans-Black' },
  upgradeSub:         { fontSize: 12, fontFamily: 'ProductSans-Regular' },

  matchesRowLabel:    { fontSize: 11, fontFamily: 'ProductSans-Bold', letterSpacing: 1.2 },
  matchCircleWrap:    { alignItems: 'center', gap: 4, width: 68 },
  matchCircleRing:    { width: 60, height: 60, borderRadius: 30, borderWidth: 2, overflow: 'hidden' },
  matchCircleAvatar:  { width: '100%', height: '100%' },
  matchCircleName:    { fontSize: 11, fontFamily: 'ProductSans-Bold', maxWidth: 68, textAlign: 'center' },
  matchCircleTimer:   { fontSize: 10, fontFamily: 'ProductSans-Regular', textAlign: 'center' },

  grid:               { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16 },
  cardWrap:           {},
  card:               { width: '100%', overflow: 'hidden', borderRadius: 24 },
  photoWrap:          { width: LIKED_CARD_W, height: LIKED_PHOTO_H, position: 'relative' },
  photo:              { width: LIKED_CARD_W, height: LIKED_PHOTO_H },
  photoBlurred:       { opacity: 0.6 },
  photoGrad:          { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 10, gap: 2 },
  photoName:          { fontSize: 14, fontFamily: 'ProductSans-Black', color: '#fff' },
  photoDist:          { fontSize: 10, fontFamily: 'ProductSans-Regular', color: 'rgba(255,255,255,0.75)' },
  heartBadge:         { position: 'absolute', top: 10, right: 10, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  lockOverlay:        { alignItems: 'center', justifyContent: 'center', gap: 8 },
  lockIcon:           { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  lockText:           { fontSize: 12, fontFamily: 'ProductSans-Bold', color: '#fff', textAlign: 'center' },

  infoRow:            { padding: 10, gap: 8 },
  chip:               { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5 },
  chipEmoji:          { fontSize: 13 },
  chipLabel:          { fontSize: 12, fontFamily: 'ProductSans-Medium' },
  actions:            { flexDirection: 'row', gap: 8, alignItems: 'center' },
  passBtn:            { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  likeBtn:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  likeBtnText:        { fontSize: 13, fontFamily: 'ProductSans-Bold' },

  emptyWrap:          { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyIcon:          { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  emptyTitle:         { fontSize: 18, fontFamily: 'ProductSans-Black' },
  emptySub:           { fontSize: 14, fontFamily: 'ProductSans-Regular', textAlign: 'center' },
});
