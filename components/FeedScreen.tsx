import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import SliderRN from '@react-native-community/slider';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
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
import { apiFetch } from '@/constants/api';
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
      <Text style={[styles.logoMode, { color }]}> date</Text>
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
  { id: 'people',  icon: 'people-outline'      as const, iconActive: 'people'      as const },
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
  id: string; name: string; age: number; verified: boolean; premium: boolean;
  location: string; distance: string; about: string;
  images: string[];
  details: { height: string; drinks: string; smokes: string; gender: string; wantsKids: string; sign: string; politics: string; religion: string; work: string; education: string };
  lookingFor: string;
  interests: { emoji: string; label: string }[];
  prompts: { question: string; answer: string }[];
  languages: string[];
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

// ─── Profile Card (scrollable + swipeable) ────────────────────────────────────

function ProfileCard({ profile, onSwipedLeft, onSwipedRight, colors }: {
  profile: Profile;
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
      onStartShouldSetPanResponder:        () => false,
      onStartShouldSetPanResponderCapture: () => false,
      // Intercept in capture phase when clearly horizontal — beats ScrollView
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
  ];

  const likeOpacityAnim = position.x.interpolate({ inputRange: [0, SWIPE_THRESHOLD], outputRange: [0, 1], extrapolate: 'clamp' });
  const nopeOpacityAnim = position.x.interpolate({ inputRange: [-SWIPE_THRESHOLD, 0], outputRange: [1, 0], extrapolate: 'clamp' });

  return (
    <Animated.View style={[styles.card, cardStyle]} {...panResponder.panHandlers}>
      <Animated.View style={[styles.likeStamp, { opacity: likeOpacityAnim }]} pointerEvents="none">
        <Text style={styles.likeStampText}>LIKE</Text>
      </Animated.View>
      <Animated.View style={[styles.nopeStamp, { opacity: nopeOpacityAnim }]} pointerEvents="none">
        <Text style={styles.nopeStampText}>NOPE</Text>
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
          <Image source={{ uri: profile.images[0] }} style={styles.photo} resizeMode="cover" />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.92)']}
            locations={[0.45, 0.75, 1]}
            style={[StyleSheet.absoluteFill]}
            pointerEvents="none"
          />
          <View style={styles.photoInfo} pointerEvents="none">
        {profile.premium && (
          <View style={styles.premiumBadge}>
                <Ionicons name="star" size={10} color="#FFD60A" />
            <Text style={styles.premiumText}>PREMIUM</Text>
          </View>
        )}
        <View style={styles.nameRow}>
              <Text style={styles.photoName}>{profile.name}, {profile.age}</Text>
              {profile.verified && <Ionicons name="checkmark-circle" size={20} color="#4FC3F7" style={{ marginLeft: 6 }} />}
        </View>
        <View style={styles.locationRow}>
              <Ionicons name="location" size={12} color="rgba(255,255,255,0.7)" />
              <Text style={styles.locationText}>{profile.location} · {profile.distance}</Text>
            </View>
            <View style={styles.scrollHint}>
              <Ionicons name="chevron-down" size={13} color="rgba(255,255,255,0.6)" />
              <Text style={styles.scrollHintText}>Scroll to see more</Text>
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
            <Image source={{ uri: profile.images[1] }} style={styles.inlinePhoto} resizeMode="cover" />
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
            <Image source={{ uri: profile.images[2] }} style={styles.inlinePhoto} resizeMode="cover" />
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
}

// ─── Empty State ──────────────────────────────────────────────────────────────

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
          <Image source={{ uri: profile.images[0] }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
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
                  <Text style={styles.photoName}>{profile.name}</Text>
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
                  <Text style={styles.locationText}>{profile.distance} away</Text>
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
  const insets = useSafeAreaInsets();
  const myAvatar = profile?.photos?.[0] ?? null;

  const [profiles,       setProfiles]     = useState<Profile[]>([]);
  const [loadingFeed,    setLoadingFeed]  = useState(false);
  const [feedPage,       setFeedPage]     = useState(0);
  const [hasMore,        setHasMore]      = useState(true);
  const [activeTab,      setActiveTab]    = useState('people');
  const [filterOpen,     setFilterOpen]   = useState(false);
  const [exploreOpen,    setExploreOpen]  = useState(false);
  const [appMode]                         = useState<AppMode>('date');
  const [likedYouCount,  setLikedYouCount] = useState(0);
  const [unreadChats,    setUnreadChats]   = useState(0);

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

  // ── Fetch discover feed from API ──────────────────────────────────────────
  const fetchFeed = useCallback(async (page: number = 0, replace: boolean = true) => {
    if (!token) return;
    setLoadingFeed(true);
    try {
      const res = await apiFetch<{ profiles: Profile[]; has_more: boolean }>(
        `/discover/feed?page=${page}&limit=10`,
        { token },
      );
      setProfiles(prev => replace ? res.profiles : [...prev, ...res.profiles]);
      setHasMore(res.has_more);
      setFeedPage(page);
    } catch {
      // keep existing profiles on error
    } finally {
      setLoadingFeed(false);
    }
  }, [token]);

  useEffect(() => {
    if (appMode === 'date') fetchFeed(0, true);
  }, [appMode, fetchFeed]);

  useEffect(() => { fetchCounts(); }, [fetchCounts]);

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
    fetchFeed(0, true);
  }, [token, fetchFeed]);

  // Record swipe to backend (fire-and-forget — don't block the UI)
  const recordSwipe = (profileId: string, direction: 'left' | 'right') => {
    if (!token) return;
    apiFetch('/discover/swipe', {
      token,
      method: 'POST',
      body: JSON.stringify({ swiped_id: profileId, direction, mode: 'date' }),
    }).catch(() => {/* silent — swipe is already gone from deck */});
  };

  const handleSwipeLeft = (profileId: string) => {
    recordSwipe(profileId, 'left');
    removeTop();
  };

  const handleSwipeRight = (profileId: string) => {
    recordSwipe(profileId, 'right');
    removeTop();
  };

  // Reset activeTab to 'people' when mode changes to avoid stale tab
  useEffect(() => { setActiveTab('people'); }, [appMode]);

  const showTopBar = activeTab === 'people';

  return (
    <View style={[styles.container, { backgroundColor: colors.bg, paddingTop: insets.top }]}>

      {/* Top bar — only on People tab */}
      {showTopBar && (
        <View style={styles.topBar}>
          <Pressable onPress={() => setExploreOpen(true)} hitSlop={8}>
            <Squircle style={styles.iconBtn} cornerRadius={14} cornerSmoothing={1} fillColor={colors.surface2}>
              <Ionicons name="compass-outline" size={20} color={colors.text} />
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
                profile={profiles[0]}
                onSwipedLeft={() => handleSwipeLeft(profiles[0].id)}
                onSwipedRight={() => handleSwipeRight(profiles[0].id)}
                colors={colors}
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
          const active    = activeTab === item.id;
          const isProfile = item.id === 'profile';
          return (
            <Pressable key={item.id} onPress={() => setActiveTab(item.id)} style={styles.navItem} hitSlop={8}>
              <View style={styles.navIconWrap}>
                {isProfile ? (
                  <View style={[styles.avatarWrap, active && { borderWidth: 2, borderColor: colors.text }]}>
                    {myAvatar ? (
                      <ExpoImage
                        source={{ uri: myAvatar }}
                        style={styles.avatarImg}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        transition={150}
                      />
                    ) : (
                      <Ionicons name={active ? 'person' : 'person-outline'} size={20} color={active ? colors.text : colors.textSecondary} />
                    )}
                  </View>
                ) : (
                  <Ionicons name={active ? item.iconActive : item.icon} size={22} color={active ? colors.text : colors.textSecondary} />
                )}
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
      <DateFilterSheet visible={filterOpen} onClose={() => setFilterOpen(false)} onApply={refetchFeed} colors={colors} insets={insets} />

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
  cardStack: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  card:      { position: 'absolute', width: CARD_W, height: CARD_H, borderRadius: 28, overflow: 'hidden', backgroundColor: '#111' },

  // Photo section
  photoContainer: { width: CARD_W, height: PHOTO_H },
  photo:          { width: CARD_W, height: PHOTO_H },
  photoInfo:      { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 18, gap: 4 },
  premiumBadge:   { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  premiumText:    { color: '#FFD60A', fontSize: 10, fontFamily: 'ProductSans-Bold', letterSpacing: 1 },
  nameRow:        { flexDirection: 'row', alignItems: 'center' },
  photoName:      { fontSize: 28, fontFamily: 'ProductSans-Black', color: '#fff' },
  locationRow:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText:   { fontSize: 13, fontFamily: 'ProductSans-Regular', color: 'rgba(255,255,255,0.7)' },
  scrollHint:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  scrollHintText: { fontSize: 11, fontFamily: 'ProductSans-Regular', color: 'rgba(255,255,255,0.55)' },

  // LIKE / NOPE stamps
  likeStamp:     { position: 'absolute', top: 52, left: 24, zIndex: 20, borderWidth: 4, borderColor: '#00E676', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8, transform: [{ rotate: '-22deg' }], backgroundColor: 'rgba(0,230,118,0.08)' },
  likeStampText: { color: '#00E676', fontSize: 32, fontFamily: 'ProductSans-Black', letterSpacing: 3 },
  nopeStamp:     { position: 'absolute', top: 52, right: 24, zIndex: 20, borderWidth: 4, borderColor: '#FF3B30', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8, transform: [{ rotate: '22deg' }], backgroundColor: 'rgba(255,59,48,0.08)' },
  nopeStampText: { color: '#FF3B30', fontSize: 32, fontFamily: 'ProductSans-Black', letterSpacing: 3 },

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
