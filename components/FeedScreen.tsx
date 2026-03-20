import { navPush, navReplace } from '@/utils/nav';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import SliderRN from '@react-native-community/slider';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import Squircle from '@/components/ui/Squircle';
import MatchScreen, { type MatchedProfile } from '@/components/MatchScreen';
import MyProfilePage from '@/components/MyProfilePage';
import ExplorePage from '@/components/ExplorePage';
import WorkFeedScreen from '@/components/WorkFeedScreen';
import ChatsPage from '@/components/ChatsPage';
import LikedYouPage from '@/components/LikedYouPage';
import AiMatchPage from '@/components/AiMatchPage';
import WorkMatchedPage from '@/components/WorkMatchedPage';
import WorkAiInsightsPage from '@/components/WorkAiInsightsPage';
import DateFilterSheet from '@/components/filters/DateFilterSheet';
import { apiFetch, WS_V1 } from '@/constants/api';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';

const { width: W, height: H } = Dimensions.get('window');
const CARD_W          = W - 32;
const CARD_H          = H * 0.68;
const LIKED_CARD_W    = Math.floor((W - 44) / 2);
const LIKED_PHOTO_H   = Math.floor(LIKED_CARD_W * 4 / 3);
const PHOTO_H         = CARD_H;
const SWIPE_THRESHOLD = W * 0.27;

// ─── Logo ─────────────────────────────────────────────────────────────────────

type AppMode = 'date' | 'work';

// ─── Shimmer Skeleton ─────────────────────────────────────────────────────────

function ShimmerBox({ width, height, borderRadius = 12, style }: {
  width: number | string; height: number; borderRadius?: number; style?: any;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [anim]);
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.65] });
  return (
    <Animated.View style={[{ width, height, borderRadius, backgroundColor: '#555', opacity }, style]} />
  );
}

function FeedCardSkeleton({ colors }: { colors: any }) {
  return (
    <View style={{ width: CARD_W, height: CARD_H, borderRadius: 28, overflow: 'hidden', backgroundColor: colors.surface }}>
      <ShimmerBox width={CARD_W} height={CARD_H} borderRadius={28} />
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, gap: 10 }}>
        <ShimmerBox width={160} height={22} borderRadius={8} />
        <ShimmerBox width={110} height={16} borderRadius={6} />
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
          <ShimmerBox width={72} height={28} borderRadius={20} />
          <ShimmerBox width={88} height={28} borderRadius={20} />
          <ShimmerBox width={64} height={28} borderRadius={20} />
        </View>
      </View>
    </View>
  );
}

function LikedCardSkeleton({ colors }: { colors: any }) {
  const cardW = Math.floor((W - 44) / 2);
  const photoH = Math.floor(cardW * 4 / 3);
  return (
    <View style={{ width: cardW, borderRadius: 24, overflow: 'hidden', backgroundColor: colors.surface, marginBottom: 12 }}>
      <ShimmerBox width={cardW} height={photoH} borderRadius={0} />
      <View style={{ padding: 12, gap: 8 }}>
        <ShimmerBox width={80} height={14} borderRadius={6} />
        <ShimmerBox width={50} height={12} borderRadius={6} />
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
          <ShimmerBox width={44} height={36} borderRadius={20} />
          <ShimmerBox width={44} height={36} borderRadius={20} />
        </View>
      </View>
    </View>
  );
}

function AppLogo({ color }: { color: string; mode?: AppMode; onPress?: () => void }) {
  return (
    <View style={styles.logoBtn}>
      <Text style={[styles.logoText, { color }]}>zod</Text>
    </View>
  );
}

// ─── Mode select modal ────────────────────────────────────────────────────────
// Work mode is disabled for now — modal is kept but only shows Date option.
function ModeModal({ visible, mode, onSelect, onClose, colors }: {
  visible: boolean; mode: AppMode;
  onSelect: (m: AppMode) => void; onClose: () => void; colors: any;
}) {
  return null; // Mode switching disabled — only date mode available
}

const mStyles = StyleSheet.create({
  backdrop:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet:        { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 44 },
  handle:       { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(128,128,128,0.4)', alignSelf: 'center', marginBottom: 20 },
  heading:      { fontSize: 22, fontFamily: 'PageSerif', textAlign: 'center' },
  option:       { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1.5, borderRadius: 18, padding: 16 },
  optIconWrap:  { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  optLabel:     { fontSize: 17, fontFamily: 'PageSerif' },
  optSub:       { fontSize: 12, fontFamily: 'ProductSans-Regular', marginTop: 2 },
});

// ─── Nav tabs ─────────────────────────────────────────────────────────────────

const BASE_DATE_NAV_TABS = [
  { id: 'people',  icon: 'layers-outline'      as const, iconActive: 'layers'      as const },
  { id: 'likeyou', icon: 'heart-outline'       as const, iconActive: 'heart'       as const },
  { id: 'ai',      icon: 'sparkles-outline'    as const, iconActive: 'sparkles'    as const },
  { id: 'chats',   icon: 'chatbubbles-outline' as const, iconActive: 'chatbubbles' as const },
  { id: 'profile', icon: 'person-outline'      as const, iconActive: 'person'      as const },
];

const WORK_NAV_TABS = [
  { id: 'people',   icon: 'briefcase-outline'          as const, iconActive: 'briefcase'          as const },
  { id: 'matched',  icon: 'people-circle-outline'      as const, iconActive: 'people-circle'      as const, badge: '5' },
  { id: 'insights', icon: 'analytics-outline'          as const, iconActive: 'analytics'          as const },
  { id: 'chats',    icon: 'chatbubbles-outline'        as const, iconActive: 'chatbubbles'        as const, badge: '3' },
  { id: 'profile',  icon: 'person-outline'             as const, iconActive: 'person'             as const },
];


// ─── Types ────────────────────────────────────────────────────────────────────

interface Profile {
  id: string; name: string; age: number | null; verified: boolean; premium: boolean;
  location: string; distance: string | null; about: string;
  images: string[];
  details: { height: string; drinks: string; smokes: string; gender: string; wantsKids: string; sign: string; politics: string; religion: string; ethnicity: string; work: string; education: string };
  lookingFor: string;
  interests: { emoji: string; label: string }[];
  prompts: { question: string; answer: string }[];
  languages: string[];
  last_active_at?: string;
  has_voice?: boolean;
  mood?: { emoji: string; text: string } | null;
}

// ─── Data ─────────────────────────────────────────────────────────────────────
// Discovery feed (PROFILES) is now API-driven via GET /discover/feed
// Likes, chats, and matches are pending backend implementation — shown as empty stubs

// LIKED_PROFILES: replaced by server-side likes system (pending)
const LIKED_PROFILES: Profile[] = [];

// ─── Work profile data ────────────────────────────────────────────────────────

interface WorkProfile {
  id: string; name: string; age: number; verified: boolean; premium: boolean;
  location: string; distance: string; role: string; company: string;
  linkedInUrl?: string; about: string; images: string[];
  industries: string[]; skills: string[];
  commitmentLevel: string; equitySplit: string;
  matchingGoals: string[]; areYouHiring: boolean;
  prompts: { question: string; answer: string }[];
  experience: { title: string; company: string; years: string }[];
}

// Work swipe handled entirely by WorkFeedScreen (API-driven)

// Work swipe and matched data handled entirely by WorkFeedScreen (API-driven)
// WorkProfile type kept here only for WorkMatchedPage stub in FeedScreen
const WORK_MATCHED: WorkProfile[] = [];  // replaced by server-side matches (pending)

// ─── Super Like Button ────────────────────────────────────────────────────────

const SuperLikeBtn = ({
  onPress,
  isPro,
  remaining,
}: {
  onPress: () => void;
  isPro: boolean;
  remaining: number;
}) => {
  const scale    = useRef(new Animated.Value(1)).current;
  const ring     = useRef(new Animated.Value(0)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const spin     = useRef(new Animated.Value(0)).current;
  const glow     = useRef(new Animated.Value(0)).current;

  const depleted = isPro && remaining <= 0;

  const fire = () => {
    // Reset
    ring.setValue(0);
    ringOpacity.setValue(1);
    spin.setValue(0);
    glow.setValue(0);

    Animated.parallel([
      // Pop scale
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.45, useNativeDriver: true, speed: 40, bounciness: 18 }),
        Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 28, bounciness: 6 }),
      ]),
      // Ring burst outward + fade
      Animated.parallel([
        Animated.timing(ring,        { toValue: 1, duration: 520, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
        Animated.timing(ringOpacity, { toValue: 0, duration: 520, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
      ]),
      // Star spin
      Animated.timing(spin, { toValue: 1, duration: 440, useNativeDriver: true, easing: Easing.out(Easing.back(1.2)) }),
      // Glow pulse
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
    ]).start();

    onPress();
  };

  const ringScale = ring.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] });
  const rotate    = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '72deg'] });
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.55] });

  const starColor = depleted ? '#888' : '#FFE066';

  return (
    <Pressable onPress={fire} style={{ alignItems: 'center', justifyContent: 'center', width: 56, height: 56 }}>
      {/* Burst ring */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: 56, height: 56, borderRadius: 28,
          borderWidth: 2.5, borderColor: '#FFE066',
          transform: [{ scale: ringScale }],
          opacity: ringOpacity,
        }}
      />
      {/* Glow halo */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: 56, height: 56, borderRadius: 28,
          backgroundColor: '#FFE066',
          opacity: glowOpacity,
        }}
      />
      {/* Button circle */}
      <Animated.View
        style={[
          styles.cardActionBtn,
          styles.cardActionSuper,
          { transform: [{ scale }], opacity: depleted ? 0.45 : 1 },
        ]}
      >
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Ionicons name={isPro ? 'star' : 'lock-closed'} size={isPro ? 22 : 18} color={starColor} />
        </Animated.View>
      </Animated.View>
      {/* Remaining count badge — only shown for Pro */}
      {isPro && (
        <View style={{
          position: 'absolute', top: -4, right: -4,
          backgroundColor: depleted ? '#555' : '#FFE066',
          borderRadius: 10, minWidth: 18, height: 18,
          alignItems: 'center', justifyContent: 'center',
          paddingHorizontal: 4,
        }}>
          <Text style={{ color: '#000', fontSize: 11, fontFamily: 'ProductSans-Bold' }}>
            {remaining}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

// ─── Profile Card (scrollable + swipeable) ────────────────────────────────────

export interface ProfileCardHandle {
  swipeLeft: () => void;
  swipeRight: () => void;
  swipeUp: () => void;
}

const ProfileCard = forwardRef<ProfileCardHandle, {
  profile: Profile;
  onSwipedLeft: () => void;
  onSwipedRight: () => void;
  onSuperLike: () => void;
  colors: any;
  isPro: boolean;
  superLikesRemaining: number;
}>(function ProfileCard({ profile, onSwipedLeft, onSwipedRight, onSuperLike, colors, isPro, superLikesRemaining }, ref) {
  const position = useRef(new Animated.ValueXY()).current;
  const superStampAnim = useRef(new Animated.Value(0)).current;

  const onSwipedLeftRef  = useRef(onSwipedLeft);
  const onSwipedRightRef = useRef(onSwipedRight);
  const onSuperLikeRef   = useRef(onSuperLike);
  useEffect(() => {
    onSwipedLeftRef.current  = onSwipedLeft;
    onSwipedRightRef.current = onSwipedRight;
    onSuperLikeRef.current   = onSuperLike;
  }, [onSwipedLeft, onSwipedRight, onSuperLike]);

  const resetCard = () => {
    Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: true, friction: 6, tension: 40 }).start();
  };

  const swipeRight = () => {
    Animated.timing(position, { toValue: { x: W + 200, y: 0 }, duration: 220, useNativeDriver: true })
      .start(() => onSwipedRightRef.current());
  };

  const swipeLeft = () => {
    Animated.timing(position, { toValue: { x: -(W + 200), y: 0 }, duration: 220, useNativeDriver: true })
      .start(() => onSwipedLeftRef.current());
  };

  const swipeUp = () => {
    superStampAnim.setValue(0);
    Animated.sequence([
      Animated.timing(superStampAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(650),
      Animated.timing(superStampAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => onSuperLikeRef.current());
  };

  useImperativeHandle(ref, () => ({ swipeLeft, swipeRight, swipeUp }));

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder:        () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: (_, g) => {
        const ax = Math.abs(g.dx);
        const ay = Math.abs(g.dy);
        return ax > ay && ax > 6;
      },
      onMoveShouldSetPanResponder: (_, g) => {
        const ax = Math.abs(g.dx);
        const ay = Math.abs(g.dy);
        return ax > ay && ax > 6;
      },
      onPanResponderGrant: () => {
        position.setOffset({ x: (position.x as any)._value, y: 0 });
        position.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: position.x }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (_, g) => {
        position.flattenOffset();
        if (g.dx > SWIPE_THRESHOLD || g.vx > 0.8) {
          Animated.timing(position, { toValue: { x: W + 200, y: g.dy }, duration: 220, useNativeDriver: true })
            .start(() => onSwipedRightRef.current());
        } else if (g.dx < -SWIPE_THRESHOLD || g.vx < -0.8) {
          Animated.timing(position, { toValue: { x: -(W + 200), y: g.dy }, duration: 220, useNativeDriver: true })
            .start(() => onSwipedLeftRef.current());
        } else {
          resetCard();
        }
      },
      onPanResponderTerminate: () => {
        position.flattenOffset();
        resetCard();
      },
    })
  ).current;

  const rotate    = position.x.interpolate({ inputRange: [-W * 0.6, 0, W * 0.6], outputRange: ['-12deg', '0deg', '12deg'], extrapolate: 'clamp' });
  const cardStyle = { transform: [{ translateX: position.x }, { translateY: position.y }, { rotate }] };

  const DETAILS = [
    { icon: 'resize-outline'      as const, label: 'Height',     value: profile.details.height    },
    { icon: 'wine-outline'        as const, label: 'Drinks',     value: profile.details.drinks    },
    { icon: 'flame-outline'       as const, label: 'Smokes',     value: profile.details.smokes    },
    { icon: 'transgender-outline' as const, label: 'Gender',     value: profile.details.gender    },
    { icon: 'people-outline'      as const, label: 'Wants kids', value: profile.details.wantsKids },
    { icon: 'star-outline'        as const, label: 'Star sign',  value: profile.details.sign      },
    { icon: 'flag-outline'        as const, label: 'Politics',   value: profile.details.politics  },
    { icon: 'globe-outline'       as const, label: 'Religion',   value: profile.details.religion  },
    { icon: 'people-outline'      as const, label: 'Ethnicity',  value: profile.details.ethnicity },
  ];

  const likeOpacityAnim  = position.x.interpolate({ inputRange: [0, SWIPE_THRESHOLD], outputRange: [0, 1], extrapolate: 'clamp' });
  const nopeOpacityAnim  = position.x.interpolate({ inputRange: [-SWIPE_THRESHOLD, 0], outputRange: [1, 0], extrapolate: 'clamp' });
  const superOpacityAnim = superStampAnim;

  return (
    <Animated.View style={[styles.card, cardStyle]} {...panResponder.panHandlers}>
      <Animated.View style={[styles.likeStamp, { opacity: likeOpacityAnim }]} pointerEvents="none">
        <Text style={styles.likeStampText}>LIKE</Text>
      </Animated.View>
      <Animated.View style={[styles.nopeStamp, { opacity: nopeOpacityAnim }]} pointerEvents="none">
        <Text style={styles.nopeStampText}>NOPE</Text>
      </Animated.View>
      <Animated.View style={[styles.superStamp, { opacity: superOpacityAnim, transform: [{ scale: superStampAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.7, 1.08, 1] }) }] }]} pointerEvents="none">
        <Ionicons name="star" size={22} color="#3B82F6" />
        <Text style={styles.superStampText}>SUPER LIKE</Text>
      </Animated.View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        directionalLockEnabled
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {/* Photo */}
        <View style={styles.photoContainer}>
          <ExpoImage source={{ uri: profile.images[0] }} style={styles.photo} contentFit="cover" cachePolicy="disk" />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.92)']}
            locations={[0.45, 0.75, 1]}
            style={[StyleSheet.absoluteFill]}
            pointerEvents="none"
          />
          {/* Active now dot */}
          {profile.last_active_at && (Date.now() - new Date(profile.last_active_at).getTime()) < 30 * 60 * 1000 && (
            <View style={styles.activeDot} pointerEvents="none">
              <View style={styles.activeDotInner} />
              <Text style={styles.activeDotText}>Active now</Text>
            </View>
          )}
          {/* Voice intro badge */}
          {profile.has_voice && (
            <View style={styles.voiceBadge} pointerEvents="none">
              <Ionicons name="mic" size={12} color="#fff" />
            </View>
          )}
          <View style={styles.photoInfo}>
            {/* Left: name / location / mood */}
            <View style={{ flex: 1 }} pointerEvents="none">
              {profile.premium && (
                <View style={styles.premiumBadge}>
                  <Ionicons name="star" size={10} color="#FFD60A" />
                  <Text style={styles.premiumText}>PREMIUM</Text>
                </View>
              )}
              <View style={styles.nameRow}>
                <Text
                  style={styles.photoName}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.72}
                >
                  {profile.name}{profile.age != null ? `, ${profile.age}` : ''}
                </Text>
                {profile.verified && <Ionicons name="checkmark-circle" size={20} color="#4FC3F7" style={{ marginLeft: 6 }} />}
              </View>
              <View style={styles.locationRow}>
                <Ionicons name="location" size={12} color="rgba(255,255,255,0.7)" />
                <Text style={styles.locationText}>
                  {[profile.location, profile.distance].filter(Boolean).join(' · ')}
                </Text>
              </View>
              {profile.mood?.text && (
                <View style={styles.moodPill}>
                  {profile.mood.emoji ? <Text style={styles.moodEmoji}>{profile.mood.emoji}</Text> : null}
                  <Text style={styles.moodText} numberOfLines={1}>{profile.mood.text}</Text>
                </View>
              )}
              <View style={styles.scrollHint}>
                <Ionicons name="chevron-down" size={13} color="rgba(255,255,255,0.6)" />
                <Text style={styles.scrollHintText}>Scroll to see more</Text>
              </View>
            </View>

            {/* Right: super like button */}
            <View style={styles.cardActionCol}>
              <SuperLikeBtn onPress={swipeUp} isPro={isPro} remaining={superLikesRemaining} />
            </View>
          </View>
        </View>

        {/* Details */}
        <View style={[styles.detailsSection, { backgroundColor: colors.surface }]}>

          {profile.about ? <>
            <View style={styles.sec}>
              <Text style={[styles.secLabel, { color: colors.textSecondary }]}>ABOUT</Text>
              <Text style={[styles.aboutText, { color: colors.text }]}>{profile.about}</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
          </> : null}

          {(profile.location || profile.distance) ? <>
            <View style={styles.sec}>
              <Text style={[styles.secLabel, { color: colors.textSecondary }]}>LOCATION</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="location" size={15} color={colors.btnPrimaryBg} />
                {profile.location ? <Text style={[styles.locationCardCity, { color: colors.text }]}>{profile.location}</Text> : null}
                {profile.distance ? <Text style={[styles.locationCardDist, { color: colors.textSecondary }]}>· {profile.distance} away</Text> : null}
              </View>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
          </> : null}

          {profile.prompts[0] && <>
            <View style={[styles.promptCard, { backgroundColor: colors.surface2 }]}>
              <Text style={[styles.promptQ, { color: colors.textSecondary }]}>{profile.prompts[0].question}</Text>
              <Text style={[styles.promptA, { color: colors.text }]}>{profile.prompts[0].answer}</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
          </>}

          {profile.images[1] && <>
            <ExpoImage source={{ uri: profile.images[1] }} style={styles.inlinePhoto} contentFit="cover" cachePolicy="disk" />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
          </>}

          {profile.lookingFor ? <>
            <View style={styles.sec}>
              <Text style={[styles.secLabel, { color: colors.textSecondary }]}>LOOKING FOR</Text>
              <View style={[styles.lookingRow, { backgroundColor: colors.surface2 }]}>
                <Ionicons name="heart" size={16} color={colors.btnPrimaryBg} />
                <Text style={[styles.lookingText, { color: colors.text }]}>{profile.lookingFor}</Text>
              </View>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
          </> : null}

          {profile.interests?.length > 0 ? <>
            <View style={styles.sec}>
              <Text style={[styles.secLabel, { color: colors.textSecondary }]}>INTERESTS</Text>
              <View style={styles.chipRow}>
                {profile.interests.map(item => (
                  <View key={item.label} style={[styles.chip, { backgroundColor: colors.surface2 }]}>
                    <Text style={styles.chipEmoji}>{item.emoji}</Text>
                    <Text style={[styles.chipLabel, { color: colors.text }]}>{item.label}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
          </> : null}

          {profile.prompts[1] && <>
            <View style={[styles.promptCard, { backgroundColor: colors.surface2 }]}>
              <Text style={[styles.promptQ, { color: colors.textSecondary }]}>{profile.prompts[1].question}</Text>
              <Text style={[styles.promptA, { color: colors.text }]}>{profile.prompts[1].answer}</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
          </>}

          {profile.images[2] && <>
            <ExpoImage source={{ uri: profile.images[2] }} style={styles.inlinePhoto} contentFit="cover" cachePolicy="disk" />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
          </>}

          {(profile.details.work || profile.details.education) ? <>
            <View style={styles.sec}>
              <Text style={[styles.secLabel, { color: colors.textSecondary }]}>WORK & STUDIES</Text>
              <View style={styles.workRow}>
                {profile.details.work ? (
                  <View style={[styles.workCard, { backgroundColor: colors.surface2 }]}>
                    <Ionicons name="briefcase-outline" size={18} color={colors.text} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={[styles.workLabel, { color: colors.textSecondary }]}>Works at</Text>
                      <Text style={[styles.workValue, { color: colors.text }]} numberOfLines={2}>{profile.details.work}</Text>
                    </View>
                  </View>
                ) : null}
                {profile.details.education ? (
                  <View style={[styles.workCard, { backgroundColor: colors.surface2 }]}>
                    <Ionicons name="school-outline" size={18} color={colors.text} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={[styles.workLabel, { color: colors.textSecondary }]}>Studied at</Text>
                      <Text style={[styles.workValue, { color: colors.text }]} numberOfLines={2}>{profile.details.education}</Text>
                    </View>
                  </View>
                ) : null}
              </View>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
          </> : null}

          {DETAILS.some(d => d.value) ? <>
            <View style={styles.sec}>
              <Text style={[styles.secLabel, { color: colors.textSecondary }]}>DETAILS</Text>
              <View style={styles.detailGrid}>
                {DETAILS.filter(d => d.value).map(d => (
                  <View key={d.label} style={[styles.detailChip, { backgroundColor: colors.surface2 }]}>
                    <Ionicons name={d.icon} size={13} color={colors.btnPrimaryBg} />
                    <View>
                      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{d.label}</Text>
                      <Text style={[styles.detailValue, { color: colors.text }]}>{d.value}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
          </> : null}

          {profile.languages?.length > 0 ? <>
            <View style={styles.sec}>
              <Text style={[styles.secLabel, { color: colors.textSecondary }]}>LANGUAGES</Text>
              <View style={styles.chipRow}>
                {profile.languages.map(lang => (
                  <View key={lang} style={[styles.chip, { backgroundColor: colors.surface2 }]}>
                    <Ionicons name="language-outline" size={13} color={colors.textSecondary} />
                    <Text style={[styles.chipLabel, { color: colors.text }]}>{lang}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
          </> : null}

          <View style={styles.dangerRow}>
            <Pressable style={({ pressed }) => [styles.dangerBtn, { borderColor: colors.border, backgroundColor: colors.surface2 }, pressed && { opacity: 0.65 }]}>
              <Ionicons name="flag-outline" size={15} color={colors.error} />
              <Text style={[styles.dangerBtnText, { color: colors.error }]}>Report</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [styles.dangerBtn, { borderColor: colors.border, backgroundColor: colors.surface2 }, pressed && { opacity: 0.65 }]}>
              <Ionicons name="ban-outline" size={15} color={colors.textSecondary} />
              <Text style={[styles.dangerBtnText, { color: colors.textSecondary }]}>Block</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </Animated.View>
  );
});

function EmptyState({ onReset, colors }: { onReset: () => void; colors: any }) {
  return (
    <View style={styles.emptyWrap}>
      <Squircle style={styles.emptyIcon} cornerRadius={32} cornerSmoothing={1} fillColor={colors.surface2}>
        <Ionicons name="heart-circle-outline" size={44} color={colors.textTertiary} />
      </Squircle>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>You've seen everyone!</Text>
      <Text style={[styles.emptySub, { color: colors.textSecondary }]}>Check back soon for more people nearby</Text>
      <Pressable onPress={onReset} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
        <Squircle style={styles.resetBtn} cornerRadius={20} cornerSmoothing={1} fillColor={colors.surface2} strokeColor={colors.border} strokeWidth={1.5}>
          <Ionicons name="refresh" size={18} color={colors.text} style={{ marginRight: 6 }} />
          <Text style={[styles.resetBtnText, { color: colors.text }]}>Start over</Text>
        </Squircle>
      </Pressable>
    </View>
  );
}

// ─── Work Profile Card ────────────────────────────────────────────────────────

function WorkProfileCard({ profile, onSwipedLeft, onSwipedRight, colors }: {
  profile: WorkProfile;
  onSwipedLeft: () => void;
  onSwipedRight: () => void;
  colors: any;
}) {
  const position = useRef(new Animated.ValueXY()).current;
  const onSwipedLeftRef  = useRef(onSwipedLeft);
  const onSwipedRightRef = useRef(onSwipedRight);
  useEffect(() => { onSwipedLeftRef.current = onSwipedLeft; onSwipedRightRef.current = onSwipedRight; }, [onSwipedLeft, onSwipedRight]);

  const resetCard = () => {
    Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: true, friction: 6, tension: 40 }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: (_, g) => { const ax = Math.abs(g.dx); const ay = Math.abs(g.dy); return ax > ay && ax > 6; },
      onMoveShouldSetPanResponder: (_, g) => { const ax = Math.abs(g.dx); const ay = Math.abs(g.dy); return ax > ay && ax > 6; },
      onPanResponderGrant: () => { position.setOffset({ x: (position.x as any)._value, y: 0 }); position.setValue({ x: 0, y: 0 }); },
      onPanResponderMove: Animated.event([null, { dx: position.x }], { useNativeDriver: false }),
      onPanResponderRelease: (_, g) => {
        position.flattenOffset();
        if (g.dx > SWIPE_THRESHOLD || g.vx > 0.8) {
          Animated.timing(position, { toValue: { x: W + 200, y: g.dy }, duration: 220, useNativeDriver: true }).start(() => onSwipedRightRef.current());
        } else if (g.dx < -SWIPE_THRESHOLD || g.vx < -0.8) {
          Animated.timing(position, { toValue: { x: -(W + 200), y: g.dy }, duration: 220, useNativeDriver: true }).start(() => onSwipedLeftRef.current());
        } else { resetCard(); }
      },
      onPanResponderTerminate: () => { position.flattenOffset(); resetCard(); },
    })
  ).current;

  const rotate    = position.x.interpolate({ inputRange: [-W * 0.6, 0, W * 0.6], outputRange: ['-12deg', '0deg', '12deg'], extrapolate: 'clamp' });
  const cardStyle = { transform: [{ translateX: position.x }, { translateY: position.y }, { rotate }] };
  const connectOpacity = position.x.interpolate({ inputRange: [0, SWIPE_THRESHOLD], outputRange: [0, 1], extrapolate: 'clamp' });
  const passOpacity    = position.x.interpolate({ inputRange: [-SWIPE_THRESHOLD, 0], outputRange: [1, 0], extrapolate: 'clamp' });

  return (
    <Animated.View style={[styles.card, cardStyle]} {...panResponder.panHandlers}>
      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        {/* Cover photo */}
        <View style={{ height: CARD_H * 0.42, position: 'relative' }}>
          <ExpoImage source={{ uri: profile.images[0] }} style={{ width: '100%', height: '100%' }} contentFit="cover" cachePolicy="disk" />
          {/* Gradient */}
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', padding: 16 }]}>
            {/* CONNECT / PASS badges */}
            <Animated.View style={[styles.likeStamp, { opacity: connectOpacity, borderColor: '#4ade80' }]}>
              <Text style={[styles.likeStampText, { color: '#4ade80' }]}>CONNECT</Text>
            </Animated.View>
            <Animated.View style={[styles.nopeStamp, { opacity: passOpacity }]}>
              <Text style={styles.nopeStampText}>PASS</Text>
            </Animated.View>

            {/* Name + role */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.photoName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{profile.name}</Text>
                  {profile.verified && <Ionicons name="checkmark-circle" size={16} color="#fff" />}
                  {/* LinkedIn badge */}
                  {profile.linkedInUrl && (
                    <View style={wStyles.linkedInBadge}>
                      <Text style={wStyles.linkedInText}>in</Text>
                    </View>
                  )}
                </View>
                <Text style={wStyles.cardRole}>{profile.role} · {profile.company}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <Ionicons name="location-outline" size={11} color="rgba(255,255,255,0.7)" />
                  {profile.distance ? <Text style={styles.locationText}>{profile.distance} away</Text> : null}
                </View>
              </View>
              {profile.areYouHiring && (
                <View style={wStyles.hiringBadge}>
                  <Text style={wStyles.hiringText}>HIRING</Text>
                </View>
              )}
            </View>
          </LinearGradient>
        </View>

        {/* Card body */}
        <View style={[styles.detailsSection, { backgroundColor: colors.surface }]}>

          {/* About */}
          <Text style={[styles.aboutText, { color: colors.text }]}>{profile.about}</Text>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Work chips */}
          <View style={{ gap: 10 }}>
            <Text style={[styles.secLabel, { color: colors.textSecondary }]}>INDUSTRIES</Text>
            <View style={styles.chipRow}>
              {profile.industries.map(ind => (
                <View key={ind} style={[styles.chip, { backgroundColor: colors.surface2 }]}>
                  <Text style={[styles.chipLabel, { color: colors.text }]}>{ind}</Text>
                </View>
              ))}
            </View>
            <Text style={[styles.secLabel, { color: colors.textSecondary, marginTop: 4 }]}>SKILLS</Text>
            <View style={styles.chipRow}>
              {profile.skills.map(sk => (
                <View key={sk} style={[styles.chip, { backgroundColor: colors.surface2 }]}>
                  <Text style={[styles.chipLabel, { color: colors.text }]}>{sk}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Key work details */}
          <View style={{ gap: 10 }}>
            {[
              { icon: 'time-outline' as const,       label: 'Commitment',  value: profile.commitmentLevel },
              { icon: 'pie-chart-outline' as const,  label: 'Equity',      value: profile.equitySplit },
              { icon: 'flag-outline' as const,       label: 'Goals',       value: profile.matchingGoals.join(', ') },
            ].map(d => (
              <View key={d.label} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
                <View style={[{ width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }, { backgroundColor: colors.surface2 }]}>
                  <Ionicons name={d.icon} size={13} color={colors.textSecondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{d.label}</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]} numberOfLines={2}>{d.value}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Experience */}
          <Text style={[styles.secLabel, { color: colors.textSecondary }]}>EXPERIENCE</Text>
          <View style={{ gap: 8, marginTop: 8 }}>
            {profile.experience.map((ex, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={wStyles.expDot} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{ex.title} · {ex.company}</Text>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{ex.years}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Prompts */}
          {profile.prompts.map((p, i) => (
            <View key={i} style={[styles.promptCard, { backgroundColor: colors.surface2, marginBottom: 8 }]}>
              <Text style={[styles.promptQ, { color: colors.textSecondary }]}>{p.question}</Text>
              <Text style={[styles.promptA, { color: colors.text }]}>{p.answer}</Text>
            </View>
          ))}

          <View style={[styles.dangerRow, { marginTop: 8 }]}>
            <Pressable style={({ pressed }) => [styles.dangerBtn, { borderColor: colors.border, backgroundColor: colors.surface2 }, pressed && { opacity: 0.65 }]}>
              <Ionicons name="flag-outline" size={15} color={colors.error} />
              <Text style={[styles.dangerBtnText, { color: colors.error }]}>Report</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [styles.dangerBtn, { borderColor: colors.border, backgroundColor: colors.surface2 }, pressed && { opacity: 0.65 }]}>
              <Ionicons name="ban-outline" size={15} color={colors.textSecondary} />
              <Text style={[styles.dangerBtnText, { color: colors.textSecondary }]}>Block</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </Animated.View>
  );
}

// Work card supplemental styles
const wStyles = StyleSheet.create({
  linkedInBadge: { width: 20, height: 20, borderRadius: 5, backgroundColor: '#0A66C2', alignItems: 'center', justifyContent: 'center' },
  linkedInText:  { fontSize: 11, fontFamily: 'ProductSans-Black', color: '#fff' },
  cardRole:      { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontFamily: 'ProductSans-Medium', marginTop: 1 },
  hiringBadge:   { backgroundColor: '#22c55e', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  hiringText:    { fontSize: 10, fontFamily: 'ProductSans-Black', color: '#fff', letterSpacing: 0.5 },
  expDot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: '#0A66C2', marginTop: 2 },
});

// ─── Range Slider ─────────────────────────────────────────────────────────────

function RangeSlider({
  min, max, low, high, step = 1, colors,
  onLowChange, onHighChange,
}: {
  min: number; max: number; low: number; high: number; step?: number; colors: any;
  onLowChange: (v: number) => void; onHighChange: (v: number) => void;
}) {
  const THUMB = 26;
  const TRACK_H = 4;
  const MIN_GAP = THUMB * 0.9;

  // Plain refs — no private Animated internals
  const trackWRef    = useRef(0);
  const lowPxRef     = useRef(0);
  const highPxRef    = useRef(0);
  const startLowRef  = useRef(0);
  const startHighRef = useRef(0);

  const lowAnim  = useRef(new Animated.Value(0)).current;
  const highAnim = useRef(new Animated.Value(0)).current;
  const fillLeft = useRef(Animated.add(lowAnim,  new Animated.Value(THUMB / 2))).current;
  const fillWidth= useRef(Animated.subtract(highAnim, lowAnim)).current;

  const valToPx = (val: number, tw: number) =>
    ((val - min) / (max - min)) * tw;

  const pxToVal = (px: number, tw: number) => {
    const pct = Math.max(0, Math.min(1, px / tw));
    return Math.round((pct * (max - min)) / step) * step + min;
  };

  const initPositions = (tw: number) => {
    const lx = valToPx(low,  tw);
    const hx = valToPx(high, tw);
    lowPxRef.current  = lx;
    highPxRef.current = hx;
    lowAnim.setValue(lx);
    highAnim.setValue(hx);
  };

  const lowPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: () => {
        startLowRef.current = lowPxRef.current;
      },
      onPanResponderMove: (_, g) => {
        const tw = trackWRef.current;
        const raw = startLowRef.current + g.dx;
        const clamped = Math.max(0, Math.min(raw, highPxRef.current - MIN_GAP));
        lowPxRef.current = clamped;
        lowAnim.setValue(clamped);
        onLowChange(pxToVal(clamped, tw));
      },
      onPanResponderRelease: () => {
        const tw  = trackWRef.current;
        const val = pxToVal(lowPxRef.current, tw);
        const px  = valToPx(val, tw);
        lowPxRef.current = px;
        lowAnim.setValue(px);
        onLowChange(val);
      },
      onPanResponderTerminate: () => {},
    })
  ).current;

  const highPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: () => {
        startHighRef.current = highPxRef.current;
      },
      onPanResponderMove: (_, g) => {
        const tw = trackWRef.current;
        const raw = startHighRef.current + g.dx;
        const clamped = Math.max(lowPxRef.current + MIN_GAP, Math.min(raw, tw));
        highPxRef.current = clamped;
        highAnim.setValue(clamped);
        onHighChange(pxToVal(clamped, tw));
      },
      onPanResponderRelease: () => {
        const tw  = trackWRef.current;
        const val = pxToVal(highPxRef.current, tw);
        const px  = valToPx(val, tw);
        highPxRef.current = px;
        highAnim.setValue(px);
        onHighChange(val);
      },
      onPanResponderTerminate: () => {},
    })
  ).current;

  return (
    <View
      style={{ height: THUMB + 8, justifyContent: 'center' }}
      onLayout={e => {
        trackWRef.current = e.nativeEvent.layout.width - THUMB;
        initPositions(trackWRef.current);
      }}
    >
      {/* Track background */}
      <View style={{ height: TRACK_H, borderRadius: TRACK_H / 2, backgroundColor: colors.surface2, marginHorizontal: THUMB / 2 }} />
      {/* Active fill */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          height: TRACK_H,
          borderRadius: TRACK_H / 2,
          backgroundColor: colors.text,
          left: fillLeft,
          width: fillWidth,
        }}
      />
      {/* Low thumb */}
      <Animated.View
        {...lowPan.panHandlers}
        style={{
          position: 'absolute',
          left: lowAnim,
          width: THUMB, height: THUMB, borderRadius: THUMB / 2,
          backgroundColor: colors.text,
          shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 4,
        }}
      />
      {/* High thumb */}
      <Animated.View
        {...highPan.panHandlers}
        style={{
          position: 'absolute',
          left: highAnim,
          width: THUMB, height: THUMB, borderRadius: THUMB / 2,
          backgroundColor: colors.text,
          shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 4,
        }}
      />
    </View>
  );
}

// ─── Main FeedScreen shell ────────────────────────────────────────────────────

export default function FeedScreen() {
  const { colors, isDark } = useAppTheme();
  const { profile, token } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isPro = profile?.subscription_tier === 'pro';
  const [superLikesRemaining, setSuperLikesRemaining] = useState(
    profile?.super_likes_remaining ?? 0,
  );

  // Keep local count in sync whenever the profile refreshes (e.g. after app restart)
  useEffect(() => {
    setSuperLikesRemaining(profile?.super_likes_remaining ?? 0);
  }, [profile?.super_likes_remaining, profile?.subscription_tier]);

  const [profiles,       setProfiles]     = useState<Profile[]>([]);
  const [loadingFeed,    setLoadingFeed]  = useState(false);
  const [feedPage,       setFeedPage]     = useState(0);
  const [hasMore,        setHasMore]      = useState(true);
  // Synchronous in-memory set — updated instantly on every swipe so fetches
  // triggered by removeTop() always see the just-swiped profile excluded.
  const swipedThisSessionRef = useRef<Set<string>>(new Set());
  const [activeTab,      setActiveTab]    = useState('people');
  const [filterOpen,     setFilterOpen]   = useState(false);
  const cardRef = useRef<ProfileCardHandle>(null);
  const [exploreOpen,    setExploreOpen]  = useState(false);
  const [appMode]                         = useState<AppMode>('date');
  const [likedYouCount,  setLikedYouCount] = useState(0);
  const [unreadChats,    setUnreadChats]   = useState(0);
  const [matchedProfile, setMatchedProfile] = useState<MatchedProfile | null>(null);

  // ── WebSocket — real-time match / liked_you events while on the feed ──────
  useEffect(() => {
    if (!token) return;
    const ws = new WebSocket(`${WS_V1}/ws/notify?token=${token}`);

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'match' && msg.profile) {
          const p = msg.profile;
          setMatchedProfile({
            id: p.id,
            name: p.name,
            age: p.age,
            image: p.images?.[0] ?? '',
            interests: p.interests ?? [],
            prompts: p.prompts ?? [],
          });
        } else if (msg.type === 'liked_you') {
          setLikedYouCount(n => n + 1);
        }
      } catch { /* ignore malformed */ }
    };
    ws.onerror = () => {};

    return () => ws.close();
  }, [token]);

  const fmtBadge = (n: number) => n > 9 ? '9+' : String(n);

  // Build nav tabs with live badge counts
  const navTabs = BASE_DATE_NAV_TABS.map(t => ({
    ...t,
    badge: t.id === 'likeyou' && likedYouCount > 0
      ? fmtBadge(likedYouCount)
      : t.id === 'chats' && unreadChats > 0
        ? fmtBadge(unreadChats)
        : undefined,
  }));

  // ── Fetch badge counts from API ──────────────────────────────────────────
  const fetchCounts = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiFetch<{ liked_you: number; matches: number; unread_chats: number }>(
        '/discover/counts',
        { token },
      );
      setLikedYouCount(res.liked_you);
      setUnreadChats(res.unread_chats);
    } catch { /* ignore */ }
  }, [token]);

  // ── Local swipe cache (persists across restarts) ──────────────────────────
  // Use a ref so SWIPE_CACHE_KEY never causes useCallback/useEffect to re-fire
  // when the profile object reference changes (avoids spurious feed re-fetches).
  const swipeCacheKeyRef = useRef(`swiped_ids_${profile?.id ?? 'unknown'}`);
  useEffect(() => {
    if (profile?.id) swipeCacheKeyRef.current = `swiped_ids_${profile.id}`;
  }, [profile?.id]);

  const markSwipedLocally = useCallback(async (profileId: string) => {
    const key = swipeCacheKeyRef.current;
    try {
      const raw = await AsyncStorage.getItem(key);
      const existing: string[] = raw ? JSON.parse(raw) : [];
      if (!existing.includes(profileId)) {
        existing.push(profileId);
        // Cap at 5000 entries to avoid unbounded growth
        const trimmed = existing.slice(-5000);
        await AsyncStorage.setItem(key, JSON.stringify(trimmed));
      }
    } catch { /* silent */ }
  }, []);

  const getLocalSwipedIds = useCallback(async (): Promise<Set<string>> => {
    const key = swipeCacheKeyRef.current;
    try {
      const raw = await AsyncStorage.getItem(key);
      return new Set<string>(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set();
    }
  }, []);

  // ── Fetch discover feed from API ──────────────────────────────────────────
  const fetchFeed = useCallback(async (page: number = 0, replace: boolean = true) => {
    if (!token) return;
    setLoadingFeed(true);
    try {
      const [res, localSwiped] = await Promise.all([
        apiFetch<{ profiles: Profile[]; has_more: boolean }>(
          `/discover/feed?page=${page}&limit=10`,
          { token },
        ),
        getLocalSwipedIds(),
      ]);

      // Auto-reconcile: if the backend returns a profile that's in our local cache,
      // the cache is stale (no backend swipe record exists for it). Remove those
      // entries so the profile can appear correctly.
      const stale = res.profiles.map(p => p.id).filter(id => localSwiped.has(id));
      if (stale.length > 0) {
        stale.forEach(id => localSwiped.delete(id));
        try {
          await AsyncStorage.setItem(
            swipeCacheKeyRef.current,
            JSON.stringify(Array.from(localSwiped)),
          );
        } catch { /* ignore */ }
      }

      // Filter: remove profiles swiped in this session (instant) OR persisted in AsyncStorage
      const sessionSwiped = swipedThisSessionRef.current;
      const fresh = res.profiles.filter(
        p => !sessionSwiped.has(p.id) && !localSwiped.has(p.id),
      );
      setProfiles(prev => {
        if (replace) return fresh;
        // Deduplicate against cards already in the deck
        const existingIds = new Set(prev.map(p => p.id));
        return [...prev, ...fresh.filter(p => !existingIds.has(p.id))];
      });
      setHasMore(res.has_more);
      setFeedPage(page);
    } catch {
      // keep existing profiles on error
    } finally {
      setLoadingFeed(false);
    }
  }, [token, getLocalSwipedIds]);

  useEffect(() => {
    if (appMode === 'date') fetchFeed(0, true);
  }, [appMode, fetchFeed]);

  useEffect(() => { fetchCounts(); }, [fetchCounts]);

  // ── Clear local swipe cache only (no backend reset) ──────────────────────
  const clearLocalCache = useCallback(async () => {
    try { await AsyncStorage.removeItem(swipeCacheKeyRef.current); } catch { /* ignore */ }
    swipedThisSessionRef.current.clear();
    fetchFeed(0, true);
  }, [fetchFeed]);

  const removeTop = () => {
    setProfiles(p => {
      const next = p.slice(1);
      // Pre-load next page when running low
      if (next.length <= 2 && hasMore) fetchFeed(feedPage + 1, false);
      return next;
    });
  };
  const refetchFeed = () => fetchFeed(0, true);

  const handleStartOver = useCallback(async () => {
    if (!token) return;
    try {
      await apiFetch('/discover/swipes/reset?mode=date', { token, method: 'DELETE' });
    } catch { /* ignore */ }
    // Also clear local swipe cache so reset takes full effect
    try { await AsyncStorage.removeItem(swipeCacheKeyRef.current); } catch { /* ignore */ }
    swipedThisSessionRef.current.clear();
    fetchFeed(0, true);
  }, [token, fetchFeed]);

  // Show the match celebration for a profile that was on the deck
  const _showMatchIfNeeded = (res: { match: boolean }, p: Profile) => {
    if (res.match) {
      setMatchedProfile({
        id: p.id,
        name: p.name,
        age: p.age,
        image: p.images?.[0] ?? '',
        interests: p.interests ?? [],
        prompts: p.prompts ?? [],
      });
    }
  };

  const handleSwipeLeft = (profileId: string) => {
    swipedThisSessionRef.current.add(profileId);  // in-memory dedup for this session
    removeTop();
    if (!token) return;
    apiFetch('/discover/swipe', {
      token, method: 'POST',
      body: JSON.stringify({ swiped_id: profileId, direction: 'left', mode: 'date' }),
    })
      .then(() => markSwipedLocally(profileId))   // persist only after backend confirms
      .catch(() => {});
  };

  const handleSwipeRight = (profileId: string) => {
    const swiped = profiles[0];
    swipedThisSessionRef.current.add(profileId);
    removeTop();
    if (!token || !swiped) return;
    apiFetch<{ match: boolean }>('/discover/swipe', {
      token, method: 'POST',
      body: JSON.stringify({ swiped_id: profileId, direction: 'right', mode: 'date' }),
    })
      .then(res => {
        markSwipedLocally(profileId);             // persist only after backend confirms
        _showMatchIfNeeded(res, swiped);
      })
      .catch(() => {});
  };

  const handleSuperLike = (profileId: string) => {
    if (!token) return;

    // Non-pro: prompt upgrade
    if (!isPro) {
      Alert.alert(
        'Super Likes are Pro',
        'Upgrade to Pro to send super likes and stand out from the crowd.',
        [{ text: 'Maybe Later', style: 'cancel' }, { text: 'Upgrade', onPress: () => navPush('/subscription' as any) }],
      );
      return;
    }

    // Pro but no remaining super likes this cycle
    if (superLikesRemaining <= 0) {
      Alert.alert(
        'No Super Likes Left',
        'You\'ve used all 10 super likes for this billing cycle. Your next 10 drop on your renewal date.',
        [{ text: 'OK' }],
      );
      return;
    }

    const swiped = profiles[0];
    swipedThisSessionRef.current.add(profileId);
    setSuperLikesRemaining(r => Math.max(0, r - 1));
    removeTop();
    apiFetch<{ match: boolean; super_likes_remaining?: number }>('/discover/swipe', {
      token, method: 'POST',
      body: JSON.stringify({ swiped_id: profileId, direction: 'super', mode: 'date' }),
    }).then(res => {
      markSwipedLocally(profileId);               // persist only after backend confirms
      if (res.super_likes_remaining !== undefined && res.super_likes_remaining !== null) {
        setSuperLikesRemaining(res.super_likes_remaining);
      }
      if (swiped) _showMatchIfNeeded(res, swiped);
    }).catch(() => {
      setSuperLikesRemaining(r => r + 1);
    });
  };

  // Reset activeTab to 'people' when mode changes to avoid stale tab
  useEffect(() => { setActiveTab('people'); }, [appMode]);

  const showTopBar = activeTab === 'people';

  return (
    <View style={[styles.container, { backgroundColor: colors.bg, paddingTop: insets.top }]}>

      {/* Top bar — only on People tab */}
      {showTopBar && (
        <View style={styles.topBar}>
          <Pressable onPress={clearLocalCache} hitSlop={8}>
            <Squircle style={styles.iconBtn} cornerRadius={14} cornerSmoothing={1} fillColor={colors.surface2}>
              <Ionicons name="refresh-outline" size={20} color={colors.text} />
            </Squircle>
          </Pressable>
          <AppLogo color={colors.text} />
          <Pressable onPress={() => setFilterOpen(true)} hitSlop={8}>
            <Squircle style={styles.iconBtn} cornerRadius={14} cornerSmoothing={1} fillColor={colors.surface2}>
              <Ionicons name="options-outline" size={20} color={colors.text} />
            </Squircle>
          </Pressable>
        </View>
      )}

      {/* Tab content */}
      {activeTab === 'people' && (
        <View style={styles.cardStack}>
          {appMode === 'work' ? (
            <WorkFeedScreen colors={colors} insets={insets} activeTab="people" />
          ) : loadingFeed && profiles.length === 0 ? (
            <FeedCardSkeleton colors={colors} />
          ) : (
            profiles.length === 0 ? (
              <EmptyState onReset={handleStartOver} colors={colors} />
            ) : (
              <ProfileCard
                key={profiles[0].id}
                ref={cardRef}
                profile={profiles[0]}
                onSwipedLeft={() => handleSwipeLeft(profiles[0].id)}
                onSwipedRight={() => handleSwipeRight(profiles[0].id)}
                onSuperLike={() => handleSuperLike(profiles[0].id)}
                colors={colors}
                isPro={isPro}
                superLikesRemaining={superLikesRemaining}
              />
            )
          )}
        </View>
      )}


      {/* Date mode tabs */}
      {appMode === 'date' && activeTab === 'likeyou'  && <View style={{ flex: 1 }}><LikedYouPage insets={insets} token={token} /></View>}
      {appMode === 'date' && activeTab === 'ai'       && <View style={{ flex: 1 }}><AiMatchPage  insets={insets} /></View>}
      {/* Work mode — dedicated WorkFeedScreen handles all work tabs */}
      {appMode === 'work' && (activeTab === 'matched' || activeTab === 'insights') && (
        <View style={{ flex: 1 }}>
          <WorkFeedScreen colors={colors} insets={insets} activeTab={activeTab} />
        </View>
      )}
      {/* Shared tabs */}
      {activeTab === 'chats'   && <View style={{ flex: 1 }}><ChatsPage     insets={insets} token={token} /></View>}
      {activeTab === 'profile' && <View style={{ flex: 1 }}><MyProfilePage colors={colors} insets={insets} /></View>}

      {/* Sticky bottom tab bar */}
      <View style={[styles.bottomNav, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 8) }]}>
        {navTabs.map(item => {
          const active = activeTab === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveTab(item.id);
              }}
              style={styles.navItem}
              hitSlop={8}
            >
              <View style={styles.navIconWrap}>
                <Ionicons name={active ? item.iconActive : item.icon} size={22} color={active ? colors.text : colors.textSecondary} />
                {item.badge && (
                  <View style={[styles.badge, { backgroundColor: colors.text }]}>
                    <Text style={[styles.badgeText, { color: colors.bg }]}>{item.badge}</Text>
                  </View>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Filter sheet */}
      <DateFilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        onApply={refetchFeed}
        onNavigateToVerification={() => {
          setFilterOpen(false);
          router.push({ pathname: '/verification', params: { tab: 'face' } } as any);
        }}
        colors={colors}
        insets={insets}
      />

      {/* Explore overlay */}
      {exploreOpen && (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.bg, zIndex: 100 }]}>
          {/* Explore header */}
          <View style={[styles.exploreHeader, { paddingTop: insets.top, backgroundColor: colors.bg, borderBottomColor: colors.border }]}>
            <Pressable onPress={() => setExploreOpen(false)} hitSlop={10}>
              <Squircle style={styles.iconBtn} cornerRadius={14} cornerSmoothing={1} fillColor={colors.surface2}>
                <Ionicons name="arrow-back" size={20} color={colors.text} />
              </Squircle>
            </Pressable>
            <AppLogo color={colors.text} />
            <View style={styles.iconBtn} />
          </View>
          <ExplorePage colors={colors} insets={insets} />
        </View>
      )}

      {/* Match celebration — shown when a swipe creates a mutual match */}
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'column' },

  // Top bar
  topBar:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  iconBtn:       { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  exploreHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },

  // Logo
  logoBtn:       { flexDirection: 'row', alignItems: 'center', gap: 2 },
  logoText:      { fontFamily: 'PageSerif', fontSize: 26, lineHeight: 30, letterSpacing: -0.5 },
  logoMode:      { fontFamily: 'PageSerif', fontSize: 20, letterSpacing: -0.3 },

  // Card stack
  cardStack: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', minHeight: 0 },
  card:      { position: 'absolute', width: CARD_W, height: CARD_H, borderRadius: 28, overflow: 'hidden', backgroundColor: '#111' },

  // Photo section
  photoContainer: { width: CARD_W, height: PHOTO_H },
  photo:          { width: CARD_W, height: PHOTO_H },
  photoInfo:      { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 18, gap: 4, flexDirection: 'row', alignItems: 'flex-end' },
  premiumBadge:   { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  premiumText:    { color: '#FFD60A', fontSize: 10, fontFamily: 'ProductSans-Bold', letterSpacing: 1 },
  nameRow:        { flexDirection: 'row', alignItems: 'center', flex: 1 },
  photoName:      { fontSize: 28, fontFamily: 'ProductSans-Black', color: '#fff', flexShrink: 1 },
  locationRow:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText:   { fontSize: 13, fontFamily: 'ProductSans-Regular', color: 'rgba(255,255,255,0.7)' },
  scrollHint:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  scrollHintText: { fontSize: 11, fontFamily: 'ProductSans-Regular', color: 'rgba(255,255,255,0.55)' },

  // Active now + voice badges
  activeDot:      { position: 'absolute', top: 14, left: 14, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  activeDotInner: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#34D399' },
  activeDotText:  { fontSize: 11, fontFamily: 'ProductSans-Bold', color: '#fff' },
  voiceBadge:     { position: 'absolute', top: 14, right: 14, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },

  // Mood pill
  moodPill:  { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginTop: 6, alignSelf: 'flex-start' },
  moodEmoji: { fontSize: 13 },
  moodText:  { fontSize: 12, fontFamily: 'ProductSans-Medium', color: '#fff', maxWidth: 160 },

  // LIKE / NOPE stamps
  likeStamp:     { position: 'absolute', top: 52, left: 24, zIndex: 20, borderWidth: 4, borderColor: '#00E676', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8, transform: [{ rotate: '-22deg' }], backgroundColor: 'rgba(0,230,118,0.08)' },
  likeStampText: { color: '#00E676', fontSize: 32, fontFamily: 'ProductSans-Black', letterSpacing: 3 },
  nopeStamp:     { position: 'absolute', top: 52, right: 24, zIndex: 20, borderWidth: 4, borderColor: '#FF3B30', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8, transform: [{ rotate: '22deg' }], backgroundColor: 'rgba(255,59,48,0.08)' },
  nopeStampText: { color: '#FF3B30', fontSize: 32, fontFamily: 'ProductSans-Black', letterSpacing: 3 },
  superStamp:    { position: 'absolute', top: '35%', alignSelf: 'center', left: 0, right: 0, alignItems: 'center', zIndex: 20, borderWidth: 3, borderColor: '#3B82F6', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8, marginHorizontal: 80, flexDirection: 'row', gap: 8, justifyContent: 'center', backgroundColor: 'rgba(59,130,246,0.1)' },
  superStampText: { color: '#3B82F6', fontSize: 28, fontFamily: 'ProductSans-Black', letterSpacing: 3 },

  // Action buttons
  actionRow:   { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 20, paddingVertical: 14, paddingBottom: 8 },
  actionBtn:   { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 6 },
  actionNope:  { backgroundColor: '#fff', borderWidth: 2, borderColor: '#FF3B30' },
  actionSuper: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#fff', borderWidth: 2, borderColor: '#3B82F6' },
  actionLike:  { backgroundColor: '#fff', borderWidth: 2, borderColor: '#FF2D55' },
  cardActionCol:   { flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 10, paddingBottom: 2, paddingLeft: 10 },
  cardActionBtn:   { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 1.5 },
  cardActionNope:  { borderColor: '#FF3B30' },
  cardActionSuper: { borderColor: '#FFE066', backgroundColor: 'rgba(255,224,102,0.12)' },
  cardActionLike:  { borderColor: '#FF2D55' },

  // Detail sections
  detailsSection: { paddingHorizontal: 16, paddingTop: 18 },
  sec:            { gap: 10, marginBottom: 4 },
  secLabel:       { fontSize: 10, fontFamily: 'ProductSans-Bold', letterSpacing: 1.5 },
  aboutText:      { fontSize: 14, fontFamily: 'ProductSans-Regular', lineHeight: 22 },
  divider:        { height: StyleSheet.hairlineWidth, marginVertical: 16 },
  promptCard:     { borderRadius: 14, padding: 14, gap: 6, marginBottom: 4 },
  promptQ:        { fontSize: 11, fontFamily: 'ProductSans-Bold', letterSpacing: 0.3 },
  promptA:        { fontSize: 14, fontFamily: 'ProductSans-Regular', lineHeight: 21 },
  lookingRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  lookingText:    { fontSize: 14, fontFamily: 'ProductSans-Bold' },
  chipRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:           { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  chipEmoji:      { fontSize: 15 },
  chipLabel:      { fontSize: 13, fontFamily: 'ProductSans-Medium' },
  detailGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  detailChip:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14 },
  detailLabel:    { fontSize: 10, fontFamily: 'ProductSans-Regular' },
  detailValue:    { fontSize: 12, fontFamily: 'ProductSans-Bold' },
  dangerRow:      { flexDirection: 'row', gap: 10, paddingBottom: 4 },
  dangerBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 12, borderRadius: 14, borderWidth: 1 },
  dangerBtnText:  { fontSize: 14, fontFamily: 'ProductSans-Medium' },
  workRow:        { flexDirection: 'row', gap: 10 },
  workCard:       { flex: 1, flexDirection: 'row', alignItems: 'flex-start', borderRadius: 14, padding: 12 },
  workLabel:      { fontSize: 10, fontFamily: 'ProductSans-Regular', marginBottom: 2 },
  workValue:      { fontSize: 13, fontFamily: 'ProductSans-Bold', lineHeight: 18 },
  locationCardCity: { fontSize: 14, fontFamily: 'ProductSans-Bold' },
  locationCardDist: { fontSize: 13, fontFamily: 'ProductSans-Regular' },
  inlinePhoto:      { width: '100%', height: 260, borderRadius: 16 },

  // Sticky bottom tab bar
  bottomNav:   { flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  navItem:     { flex: 1, alignItems: 'center', justifyContent: 'center', height: 44 },
  navIconWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  avatarWrap:  { width: 30, height: 30, borderRadius: 15, overflow: 'hidden' },
  avatarImg:   { width: 30, height: 30, borderRadius: 15 },
  badge:       { position: 'absolute', top: -5, right: -9, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText:   { fontSize: 9, fontFamily: 'ProductSans-Bold' },

  // Empty state
  emptyWrap:    { alignItems: 'center', gap: 14, paddingHorizontal: 32 },
  emptyIcon:    { width: 88, height: 88, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle:   { fontSize: 20, fontFamily: 'ProductSans-Black', textAlign: 'center' },
  emptySub:     { fontSize: 14, fontFamily: 'ProductSans-Regular', textAlign: 'center', lineHeight: 21 },
  resetBtn:     { flexDirection: 'row', alignItems: 'center', height: 46, paddingHorizontal: 22 },
  resetBtnText: { fontSize: 15, fontFamily: 'ProductSans-Medium' },

  // Filter sheet
  sheetContainer:   { flex: 1 },
  sheetHeader:      { paddingHorizontal: 20, paddingBottom: 16 },
  sheetHeaderRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  sheetTitle:       { fontSize: 18, fontFamily: 'ProductSans-Black' },
  sheetClose:       { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  sheetResetText:   { fontSize: 13, fontFamily: 'ProductSans-Medium' },
  sheetFooter:      { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  applyBtn:         { height: 52, overflow: 'hidden' },
  applyBtnText:     { fontSize: 16, fontFamily: 'ProductSans-Bold' },
  filterTabRow:  { flexDirection: 'row', gap: 10, marginTop: 14, justifyContent: 'center' },
  filterTabPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, paddingVertical: 9, borderRadius: 20 },
  filterTabText: { fontSize: 14, fontFamily: 'ProductSans-Bold' },
  filterCard:       { padding: 16 },
  filterRow:        { flexDirection: 'row', alignItems: 'center', gap: 12 },
  filterRowIcon:    { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  filterRowTitle:   { fontSize: 15, fontFamily: 'ProductSans-Bold' },
  filterRowSub:     { fontSize: 12, fontFamily: 'ProductSans-Regular', marginTop: 2 },
  filterSecHead:    { fontSize: 10, fontFamily: 'ProductSans-Bold', letterSpacing: 1.5 },
  filterChipRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, gap: 5 },
  filterChipText:   { fontSize: 13, fontFamily: 'ProductSans-Medium' },
  upsellBanner:     { padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  upsellLeft:       { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  upsellIconWrap:   { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  upsellTitle:      { fontSize: 13, fontFamily: 'ProductSans-Bold' },
  upsellSub:        { fontSize: 11, fontFamily: 'ProductSans-Regular', marginTop: 1 },
  upsellBtn:        { paddingHorizontal: 14, paddingVertical: 8 },
  upsellBtnText:    { fontSize: 12, fontFamily: 'ProductSans-Bold' },
  sliderLabelRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sliderValue:      { fontSize: 15, fontFamily: 'ProductSans-Bold' },
  sliderRow:        { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sliderSub:        { fontSize: 12, fontFamily: 'ProductSans-Medium', minWidth: 28 },
  sliderEdgeRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sliderEdge:       { fontSize: 11, fontFamily: 'ProductSans-Medium', minWidth: 20, textAlign: 'center' },
  proHeaderCard:    { padding: 16 },
  proHeaderRow:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  proHeaderIcon:    { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  proHeaderTitle:   { fontSize: 16, fontFamily: 'ProductSans-Bold' },
  proHeaderSub:     { fontSize: 12, fontFamily: 'ProductSans-Regular', marginTop: 2 },
  proLockBadge:     { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  proFeatureRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  proFakeFill:      { height: 26, justifyContent: 'center', position: 'relative' },
  proFakeTrack:     { height: 4, borderRadius: 2, position: 'absolute', left: 0, right: 0 },
  proFakeActive:    { height: 4, borderRadius: 2, position: 'absolute' },
  proFakeThumb:     { width: 22, height: 22, borderRadius: 11, position: 'absolute', top: 2 },
  proAiIcon:        { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  proAiTitle:       { fontSize: 14, fontFamily: 'ProductSans-Bold' },
  proAiSub:         { fontSize: 11, fontFamily: 'ProductSans-Regular', marginTop: 2, lineHeight: 16 },

  // Liked you — moved to LikedYouPage.tsx
  // AI Match — moved to AiMatchPage.tsx
  // Work Matched — moved to WorkMatchedPage.tsx
  // Work AI Insights — moved to WorkAiInsightsPage.tsx

  // Chats — moved to ChatsPage.tsx

});
