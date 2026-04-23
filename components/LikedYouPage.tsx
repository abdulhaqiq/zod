import { navPush, navReplace } from '@/utils/nav';
import { preFillProfile } from '@/components/ProfileView';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Animated,
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

interface Profile {
  id: string; name: string; age: number; verified: boolean; premium: boolean;
  location: string; distance: string; about: string;
  images: string[];
  is_super_like?: boolean;
  details: { height: string; drinks: string; smokes: string; gender: string; wantsKids: string; sign: string; politics: string; religion: string; work: string; education: string };
  lookingFor: string;
  interests: { emoji: string; label: string }[];
  prompts: { question: string; answer: string }[];
  languages: string[];
}

export interface RecentMatch {
  id: string; name: string; age: number; image: string; matchedAt: number;
  isSuperLike?: boolean;
}

function ShimmerBar({ width, height, borderRadius = 8, style }: { width: number | string; height: number; borderRadius?: number; style?: any }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 850, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 850, useNativeDriver: true }),
      ])
    ).start();
  }, [anim]);
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.65] });
  return (
    <Animated.View style={[{ width, height, borderRadius, backgroundColor: '#888', opacity }, style]} />
  );
}

function LikedCardSkeleton() {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.cardWrap, { width: LIKED_CARD_W }]}>
      <View style={[styles.card, { backgroundColor: colors.surface, overflow: 'hidden' }]}>
        <ShimmerBar width={LIKED_CARD_W} height={LIKED_PHOTO_H} borderRadius={0} />
        <View style={{ padding: 10, gap: 8 }}>
          <ShimmerBar width="70%" height={13} />
          <ShimmerBar width="45%" height={11} />
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
            <ShimmerBar width={38} height={38} borderRadius={19} />
            <ShimmerBar width={80} height={38} borderRadius={19} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </View>
  );
}

const REGULAR_WINDOW = 24 * 60 * 60 * 1000;   // 24 h
const SUPER_WINDOW   = 48 * 60 * 60 * 1000;   // 48 h

function formatMatchTimer(matchedAt: number, isSuper?: boolean): string {
  const window    = isSuper ? SUPER_WINDOW : REGULAR_WINDOW;
  const remaining = Math.max(0, window - (Date.now() - matchedAt));
  if (remaining === 0) return 'Expired';
  const hh = Math.floor(remaining / (60 * 60 * 1000));
  const mm = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
  return `${hh}h ${mm}m left`;
}

function isMatchExpired(matchedAt: number, isSuper?: boolean): boolean {
  const window = isSuper ? SUPER_WINDOW : REGULAR_WINDOW;
  return Date.now() - matchedAt > window;
}

export default function LikedYouPage({
  insets, token, externalMatch, feedDislikedId, onCountChange,
}: {
  insets: any;
  token: string | null;
  /** Match created outside this page (e.g. super_like from the feed) */
  externalMatch?: RecentMatch | null;
  /** ID of a profile just left-swiped on the feed — remove them instantly */
  feedDislikedId?: string | null;
  /** Called whenever the real liked-you count changes so the parent can sync its badge */
  onCountChange?: (count: number) => void;
}) {
  const router     = useRouter();
  const { colors } = useAppTheme();

  const [likedProfiles,  setLikedProfiles]  = useState<Profile[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [isPro,          setIsPro]          = useState(false);
  const [recentMatches,  setRecentMatches]  = useState<RecentMatch[]>([]);
  const [matchedProfile, setMatchedProfile] = useState<MatchedProfile | null>(null);

  const [, setTick] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  // Load from API on mount
  useEffect(() => {
    if (!token) return;
    setLoading(true);
    apiFetch<{ profiles: Profile[]; total: number; is_pro: boolean }>('/discover/liked-you', { token })
      .then(res => {
        setLikedProfiles(res.profiles);
        setIsPro(res.is_pro ?? false);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  // Absorb an external match (e.g. super_like from the feed) into the circle row
  useEffect(() => {
    if (!externalMatch) return;
    setRecentMatches(prev => prev.some(m => m.id === externalMatch.id) ? prev : [externalMatch, ...prev]);
  }, [externalMatch]);

  // Instantly remove a profile the user left-swiped on the feed
  useEffect(() => {
    if (!feedDislikedId) return;
    setLikedProfiles(prev => prev.filter(p => p.id !== feedDislikedId));
  }, [feedDislikedId]);

  // Sync actual count up to parent so the badge stays accurate
  useEffect(() => {
    onCountChange?.(likedProfiles.length);
  }, [likedProfiles.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // WebSocket — real-time new likes / matches
  useEffect(() => {
    if (!token) return;
    const ws = new WebSocket(`${WS_V1}/ws/notify?token=${token}`);
    wsRef.current = ws;
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'liked_you' && msg.profile) {
          setLikedProfiles(prev => prev.some(p => p.id === msg.profile.id) ? prev : [msg.profile, ...prev]);
        } else if (msg.type === 'match' && msg.profile) {
          const matchEntry: RecentMatch = {
            id: msg.profile.id,
            name: msg.profile.name,
            age: msg.profile.age,
            image: msg.profile.images?.[0] ?? '',
            matchedAt: Date.now(),
            isSuperLike: !!msg.is_super,
          };
          setMatchedProfile({ id: msg.profile.id, name: msg.profile.name, age: msg.profile.age, image: msg.profile.images?.[0] ?? '', interests: msg.profile.interests, prompts: msg.profile.prompts, isSuperLike: !!msg.is_super });
          setRecentMatches(prev => prev.some(m => m.id === matchEntry.id) ? prev : [matchEntry, ...prev]);
        }
      } catch { /* ignore */ }
    };
    ws.onerror = () => {};
    return () => { ws.close(); wsRef.current = null; };
  }, [token]);

  // Remove a profile from the list (after like or dislike)
  const removeProfile = (id: string) => setLikedProfiles(prev => prev.filter(p => p.id !== id));

  // Like back → guaranteed match (they're already in liked_you = they liked us first)
  const handleLike = async (p: Profile) => {
    if (!token) return;
    // Optimistically show match immediately — no need to wait for API since
    // the other person is already in our liked_you list (mutual like = match).
    removeProfile(p.id);
    const matchEntry: RecentMatch = {
      id: p.id, name: p.name, age: p.age,
      image: p.images[0] ?? '', matchedAt: Date.now(), isSuperLike: false,
    };
    setMatchedProfile({ id: p.id, name: p.name, age: p.age, image: p.images[0] ?? '', interests: p.interests, prompts: p.prompts, isSuperLike: !!p.is_super_like });
    setRecentMatches(prev => prev.some(m => m.id === p.id) ? prev : [matchEntry, ...prev]);

    // Fire API in background to persist the swipe record
    apiFetch('/discover/swipe', {
      method: 'POST', token,
      body: JSON.stringify({ swiped_id: p.id, direction: 'right', mode: 'date' }),
    }).catch(() => {/* match already shown — ignore errors */});
  };

  // Dislike → swipe left → remove from list
  const handleDislike = async (id: string) => {
    removeProfile(id);
    if (!token) return;
    try {
      await apiFetch('/discover/swipe', {
        method: 'POST', token,
        body: JSON.stringify({ swiped_id: id, direction: 'left', mode: 'date' }),
      });
    } catch { /* ignore */ }
  };

  const count = likedProfiles.length;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.pageTitle, { color: colors.text }]}>Liked You</Text>
          <Text style={[styles.pageSub, { color: colors.textSecondary }]}>
            {count} {count === 1 ? 'person' : 'people'} already like you
          </Text>
        </View>

        {/* Upgrade banner — only for non-Pro users */}
        {!isPro && (
          <Pressable onPress={() => navPush('/subscription')} style={({ pressed }) => [pressed && { opacity: 0.85 }]}>
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

        {/* Matches row — same circle style as Chats page + 24h timer */}
        {recentMatches.length > 0 && (
          <View style={{ marginBottom: 24 }}>
            <Text style={[styles.matchesRowLabel, { color: colors.textSecondary, paddingHorizontal: 16, marginBottom: 14 }]}>
              MATCHES
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingHorizontal: 16 }}>
              {recentMatches.map(m => {
                const expired   = isMatchExpired(m.matchedAt, m.isSuperLike);
                const ringColor = expired ? colors.surface2 : m.isSuperLike ? '#F59E0B' : '#6366f1';
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => navPush({ pathname: '/chat', params: { matchId: m.id, name: m.name, image: m.image, online: 'true' } } as any)}
                    style={({ pressed }) => [{ alignItems: 'center', gap: 6, maxWidth: 72 }, pressed && { opacity: 0.75 }]}
                  >
                    {/* Ring + avatar */}
                    <View style={styles.matchRingWrap}>
                      <View style={[styles.matchRing, { borderColor: ringColor }, m.isSuperLike && !expired && styles.matchCircleGolden]}>
                        <ExpoImage source={{ uri: m.image }} style={styles.matchAvatar} contentFit="cover" />
                      </View>
                      {/* NEW pill (only for non-expired non-superlike) */}
                      {!expired && !m.isSuperLike && (
                        <View style={[styles.newBadge, { borderColor: colors.bg }]}>
                          <Text style={styles.newBadgeText}>NEW</Text>
                        </View>
                      )}
                      {/* Star badge for super likes */}
                      {m.isSuperLike && !expired && (
                        <View style={[styles.superStarBadge, { borderColor: colors.bg }]}>
                          <Ionicons name="star" size={9} color="#fff" />
                        </View>
                      )}
                    </View>
                    <Text style={[styles.matchName, { color: m.isSuperLike && !expired ? '#F59E0B' : colors.text }]} numberOfLines={1}>
                      {m.name.split(' ')[0]}
                    </Text>
                    <Text style={[styles.matchCircleTimer, { color: expired ? colors.textSecondary : m.isSuperLike ? '#F59E0B' : '#6366f1' }]}>
                      {expired ? 'Expired' : formatMatchTimer(m.matchedAt, m.isSuperLike)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Cards grid — blurred for free users, visible for Pro */}
        <View style={styles.grid}>
          {loading ? (
            <>
              <LikedCardSkeleton /><LikedCardSkeleton />
              <LikedCardSkeleton /><LikedCardSkeleton />
            </>
          ) : likedProfiles.map(p => {
            const isBlurred = !isPro;
            return (
              <View key={p.id} style={[styles.cardWrap, { width: LIKED_CARD_W }]}>
                <Squircle style={styles.card} cornerRadius={24} cornerSmoothing={1}
                  fillColor={colors.surface} strokeColor={colors.border} strokeWidth={StyleSheet.hairlineWidth}>
                  <Pressable
                    style={styles.photoWrap}
                    onPress={() => {
                      if (isBlurred) return;
                      preFillProfile(p);
                      navPush({ pathname: '/profile-view', params: { id: p.id } } as any);
                    }}
                    disabled={isBlurred}
                  >
                    <ExpoImage
                      source={{ uri: p.images[0] }}
                      style={styles.photo}
                      contentFit="cover"
                      blurRadius={isBlurred ? 22 : 0}
                    />

                    {/* Gradient + name overlay — unblurred only */}
                    {!isBlurred && (
                      <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.82)']}
                        style={styles.photoGrad}
                      >
                        {/* Verified badge */}
                        {p.verified && (
                          <View style={styles.verifiedBadge}>
                            <Ionicons name="checkmark-circle" size={11} color="#fff" />
                            <Text style={styles.verifiedText}>Verified</Text>
                          </View>
                        )}
                        <Text style={styles.photoName} numberOfLines={1}>{p.name}, {p.age}</Text>
                        {(p.distance || p.location) && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                            <Ionicons name="location-outline" size={10} color="rgba(255,255,255,0.7)" />
                            <Text style={styles.photoDist}>{p.distance || p.location}</Text>
                          </View>
                        )}
                      </LinearGradient>
                    )}

                    {/* Blurred lock overlay */}
                    {isBlurred && (
                      <Pressable
                        style={[StyleSheet.absoluteFill, styles.lockOverlay]}
                        onPress={() => navPush('/subscription')}
                      >
                        <LinearGradient
                          colors={['transparent', 'rgba(0,0,0,0.6)']}
                          style={StyleSheet.absoluteFill}
                        />
                        <Squircle style={styles.lockIcon} cornerRadius={16} cornerSmoothing={1} fillColor="rgba(0,0,0,0.5)">
                          <Ionicons name="lock-closed" size={20} color="#fff" />
                        </Squircle>
                        <Text style={styles.lockText}>Upgrade to see</Text>
                      </Pressable>
                    )}

                    {/* Heart / Super Like badge top-right — unblurred only */}
                    {!isBlurred && (
                      <View style={[styles.heartBadge, p.is_super_like ? styles.superBadge : styles.heartBadgeDefault]}>
                        <Ionicons name={p.is_super_like ? 'star' : 'heart' as any} size={12} color="#fff" />
                      </View>
                    )}
                  </Pressable>

                  {/* Action row — unblurred only */}
                  {!isBlurred && (
                    <View style={styles.infoRow}>
                      {p.interests[0] && (
                        <Squircle style={styles.chip} cornerRadius={20} cornerSmoothing={1} fillColor={colors.surface2}>
                          <Text style={styles.chipEmoji}>{p.interests[0].emoji}</Text>
                          <Text style={[styles.chipLabel, { color: colors.text }]} numberOfLines={1}>{p.interests[0].label}</Text>
                        </Squircle>
                      )}
                      <View style={styles.actions}>
                        <Pressable onPress={() => handleDislike(p.id)} hitSlop={6}
                          style={({ pressed }) => [pressed && { opacity: 0.65 }]}>
                          <Squircle style={styles.passBtn} cornerRadius={50} cornerSmoothing={1}
                            fillColor={colors.surface2} strokeColor={colors.border} strokeWidth={StyleSheet.hairlineWidth}>
                            <Ionicons name="close" size={18} color={colors.text} />
                          </Squircle>
                        </Pressable>
                        <Pressable onPress={() => handleLike(p)} hitSlop={6}
                          style={({ pressed }) => [pressed && { opacity: 0.65 }, { flex: 1 }]}>
                          <Squircle style={styles.likeBtn} cornerRadius={50} cornerSmoothing={1} fillColor={colors.text}>
                            <Ionicons name="heart" size={14} color={colors.bg} />
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
        {!loading && likedProfiles.length === 0 && recentMatches.length === 0 && (
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
            navPush({ pathname: '/chat', params: { matchId: p.id, name: p.name, image: p.image, online: 'true' } } as any);
          }}
          onDismiss={() => setMatchedProfile(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header:             { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16 },
  pageTitle:          { fontSize: 24, fontFamily: 'ProductSans-Black' },
  pageSub:            { fontSize: 13, fontFamily: 'ProductSans-Regular', marginTop: 2, marginBottom: 4 },

  upgradeBanner:      { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginBottom: 16, paddingHorizontal: 14, paddingVertical: 14 },
  upgradeIcon:        { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  upgradeTitle:       { fontSize: 14, fontFamily: 'ProductSans-Black' },
  upgradeSub:         { fontSize: 12, fontFamily: 'ProductSans-Regular' },

  matchesRowLabel:   { fontSize: 10, fontFamily: 'ProductSans-Bold', letterSpacing: 1.5 },
  matchRingWrap:     { position: 'relative' },
  matchRing:         { width: 66, height: 66, borderRadius: 33, borderWidth: 2, padding: 2 },
  matchAvatar:       { width: 58, height: 58, borderRadius: 29 },
  matchCircleGolden: { borderWidth: 2.5, shadowColor: '#F59E0B', shadowOpacity: 0.6, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  matchName:         { fontSize: 12, fontFamily: 'ProductSans-Medium', textAlign: 'center' },
  matchCircleTimer:  { fontSize: 10, fontFamily: 'ProductSans-Regular', textAlign: 'center' },
  newBadge:          { position: 'absolute', top: 0, right: 0, backgroundColor: '#6366f1', borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2 },
  newBadgeText:      { color: '#fff', fontSize: 9, fontFamily: 'ProductSans-Bold' },
  superStarBadge:    { position: 'absolute', bottom: 1, right: 1, width: 16, height: 16, borderRadius: 8, backgroundColor: '#F59E0B', alignItems: 'center', justifyContent: 'center', borderWidth: 2 },

  grid:               { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16 },
  cardWrap:           {},
  card:               { width: '100%', overflow: 'hidden', borderRadius: 24 },
  photoWrap:          { width: LIKED_CARD_W, height: LIKED_PHOTO_H, position: 'relative' },
  photo:              { width: LIKED_CARD_W, height: LIKED_PHOTO_H },
  photoGrad:          { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 10, paddingTop: 28, paddingBottom: 10, gap: 3 },
  photoName:          { fontSize: 14, fontFamily: 'ProductSans-Black', color: '#fff' },
  photoDist:          { fontSize: 10, fontFamily: 'ProductSans-Regular', color: 'rgba(255,255,255,0.75)' },
  verifiedBadge:      { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start', backgroundColor: 'rgba(79,195,247,0.25)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20, marginBottom: 2 },
  verifiedText:       { fontSize: 10, fontFamily: 'ProductSans-Bold', color: '#fff' },
  heartBadge:         { position: 'absolute', top: 10, right: 10, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  heartBadgeDefault:  { backgroundColor: 'rgba(232,23,93,0.9)' },
  superBadge:         { backgroundColor: '#3B82F6' },
  lockOverlay:        { alignItems: 'center', justifyContent: 'center', gap: 10 },
  lockIcon:           { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
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
