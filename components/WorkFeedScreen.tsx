import { navPush, navReplace } from '@/utils/nav';
/**
 * WorkFeedScreen — the standalone Zod Work swipe feed.
 * Contains work profile cards, matched page, and AI insights page.
 * Consumed by FeedScreen when appMode === 'work'.
 */
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  Linking,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Squircle from '@/components/ui/Squircle';
import MatchScreen, { type MatchedProfile } from '@/components/MatchScreen';
import { apiFetch } from '@/constants/api';
import { useAuth } from '@/context/AuthContext';

const { width: W, height: H } = Dimensions.get('window');
const CARD_W          = W - 32;
const CARD_H          = H * 0.68;
const SWIPE_THRESHOLD = W * 0.27;

// ─── Shimmer skeleton ─────────────────────────────────────────────────────────

function ShimmerBox({ width, height, borderRadius = 12 }: {
  width: number | string; height: number; borderRadius?: number;
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
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.55] });
  return (
    <Animated.View style={{ width, height, borderRadius, backgroundColor: '#555', opacity }} />
  );
}

function WorkFeedSkeleton({ colors }: { colors: any }) {
  return (
    <View style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }}>
      {/* Card skeleton */}
      <View style={{ width: CARD_W, height: CARD_H, borderRadius: 28, overflow: 'hidden', backgroundColor: colors.surface }}>
        <ShimmerBox width={CARD_W} height={CARD_H} borderRadius={28} />
        {/* Bottom info area */}
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, gap: 10 }}>
          {/* Name + verified */}
          <ShimmerBox width={180} height={22} borderRadius={8} />
          {/* Headline */}
          <ShimmerBox width={CARD_W - 60} height={14} borderRadius={6} />
          <ShimmerBox width={CARD_W - 100} height={14} borderRadius={6} />
          {/* Persona + distance badges */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
            <ShimmerBox width={110} height={28} borderRadius={20} />
            <ShimmerBox width={80} height={28} borderRadius={20} />
          </View>
        </View>
      </View>
      {/* Pass / Connect buttons */}
      <View style={{ flexDirection: 'row', gap: 24, marginTop: 20, alignItems: 'center' }}>
        <ShimmerBox width={110} height={50} borderRadius={28} />
        <ShimmerBox width={130} height={50} borderRadius={28} />
      </View>
    </View>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkProfile {
  id: string;
  name: string;
  headline: string;
  role: string;
  company: string;
  verified: boolean;
  linkedInUrl?: string;
  distance: string;
  about: string;
  images: string[];
  persona?: string;
  matchingGoals: string[];
  commitmentLevel: string;
  equitySplit: string;
  numFounders?: string;
  primaryRole?: string;
  yearsExperience?: string;
  jobSearchStatus?: string;
  industries: string[];
  skills: string[];
  areYouHiring?: boolean;
  experience: { title: string; company: string; company_logo?: string; years: string }[];
  education?: { institution: string; degree?: string; field?: string; grad_year?: string }[];
  prompts: { question: string; answer: string }[];
}

const WORK_MATCHED: WorkProfile[] = [];

const WORK_AI_PICKS: { profile: WorkProfile; score: number; sharedAreas: string[]; reason: string; insights: string[] }[] = [];

// ─── LinkedIn & work badge styles ─────────────────────────────────────────────

const wStyles = StyleSheet.create({
  linkedInBadge:  { width: 20, height: 20, borderRadius: 5, backgroundColor: '#0A66C2', alignItems: 'center', justifyContent: 'center' },
  linkedInText:   { fontSize: 11, fontFamily: 'ProductSans-Black', color: '#fff' },
  cardHeadline:   { color: '#fff', fontSize: 14, fontFamily: 'ProductSans-Medium', marginTop: 2, lineHeight: 20 },
  cardRole:       { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontFamily: 'ProductSans-Medium', marginTop: 1 },
  hiringBadge:    { backgroundColor: '#22c55e', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  hiringText:     { fontSize: 10, fontFamily: 'ProductSans-Black', color: '#fff', letterSpacing: 0.5 },
  personaBadge:   { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  personaText:    { fontSize: 11, fontFamily: 'ProductSans-Bold', color: '#fff' },
  expDot:         { width: 8, height: 8, borderRadius: 4, backgroundColor: '#0A66C2', marginTop: 2 },
});

const wCardStyles = StyleSheet.create({
  heroWrap:    { width: '100%', height: H * 0.58, position: 'relative', overflow: 'hidden' },
  infoRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  infoIcon:    { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  showMoreBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, borderWidth: 1, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 14, alignSelf: 'flex-start' },
  showMoreText:    { fontSize: 12, fontFamily: 'ProductSans-Medium' },
  pitchCard:       { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 8, marginBottom: 10 },
  pitchCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});

// ─── All-entries modal ────────────────────────────────────────────────────────

type ModalEntry =
  | { kind: 'experience'; title: string; company: string; company_logo?: string; years: string }
  | { kind: 'education'; institution: string; degree?: string; field?: string; grad_year?: string };

function AllEntriesModal({
  visible, onClose, title, entries, colors,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  entries: ModalEntry[];
  colors: any;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={modalStyles.backdrop} onPress={onClose} />
      <View style={[modalStyles.sheet, { backgroundColor: colors.surface }]}>
        {/* Handle */}
        <View style={[modalStyles.handle, { backgroundColor: colors.border }]} />
        <Text style={[modalStyles.sheetTitle, { color: colors.text }]}>{title}</Text>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32, gap: 10 }}>
          {entries.map((entry, i) => (
            <View
              key={i}
              style={[modalStyles.entryRow, { backgroundColor: colors.surface2, borderColor: colors.border }]}
            >
              {entry.kind === 'experience' ? (
                <>
                  {entry.company_logo ? (
                    <Image
                      source={{ uri: entry.company_logo }}
                      style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: '#fff' }}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={[modalStyles.entryIcon, { backgroundColor: colors.surface }]}>
                      <Ionicons name="briefcase-outline" size={16} color={colors.textSecondary} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[modalStyles.entryMain, { color: colors.text }]}>{entry.title}</Text>
                    <Text style={[modalStyles.entrySub, { color: colors.textSecondary }]}>
                      {entry.company}{entry.years ? ` · ${entry.years}` : ''}
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={[modalStyles.entryIcon, { backgroundColor: colors.surface }]}>
                    <Ionicons name="school-outline" size={16} color={colors.textSecondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[modalStyles.entryMain, { color: colors.text }]}>{entry.institution}</Text>
                    <Text style={[modalStyles.entrySub, { color: colors.textSecondary }]}>
                      {[entry.degree, entry.field].filter(Boolean).join(' · ')}
                      {entry.grad_year ? ` · ${entry.grad_year}` : ''}
                    </Text>
                  </View>
                </>
              )}
            </View>
          ))}
        </ScrollView>
        <Pressable onPress={onClose} style={[modalStyles.closeBtn, { backgroundColor: colors.text }]}>
          <Text style={[modalStyles.closeBtnText, { color: colors.bg }]}>Close</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  backdrop:    { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:       { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingTop: 12, maxHeight: H * 0.72 },
  handle:      { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle:  { fontSize: 17, fontFamily: 'ProductSans-Bold', marginBottom: 16 },
  entryRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  entryIcon:   { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  entryMain:   { fontSize: 13, fontFamily: 'ProductSans-Bold' },
  entrySub:    { fontSize: 11, fontFamily: 'ProductSans-Regular', marginTop: 2 },
  closeBtn:    { borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  closeBtnText:{ fontSize: 15, fontFamily: 'ProductSans-Bold' },
});

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onReset, colors }: { onReset: () => void; colors: any }) {
  return (
    <View style={{ alignItems: 'center', gap: 16, padding: 32 }}>
      <Squircle style={{ width: 72, height: 72, alignItems: 'center', justifyContent: 'center' }} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface}>
        <Ionicons name="briefcase-outline" size={32} color={colors.textTertiary ?? colors.textSecondary} />
      </Squircle>
      <Text style={{ fontSize: 18, fontFamily: 'ProductSans-Bold', color: colors.text }}>You've seen everyone</Text>
      <Text style={{ fontSize: 14, fontFamily: 'ProductSans-Regular', color: colors.textSecondary, textAlign: 'center' }}>Check back soon for new co-founder matches</Text>
      <Squircle cornerRadius={16} cornerSmoothing={1} fillColor={colors.text} style={{ height: 44, paddingHorizontal: 24 }}>
        <Pressable onPress={onReset} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 14, fontFamily: 'ProductSans-Bold', color: colors.bg }}>Refresh</Text>
        </Pressable>
      </Squircle>
    </View>
  );
}

// ─── Work Profile Card ────────────────────────────────────────────────────────

interface WorkProfileCardHandle {
  dismiss: (type: 'pass' | 'connect') => void;
}

type WorkProfileCardProps = {
  profile: WorkProfile;
  onSwipedLeft: () => void;
  onSwipedRight: () => void;
  colors: any;
};

const WorkProfileCard = forwardRef<WorkProfileCardHandle, WorkProfileCardProps>(
function WorkProfileCard({ profile, onSwipedLeft, onSwipedRight, colors }, ref) {
  const dragX       = useRef(new Animated.Value(0)).current;
  const exitY       = useRef(new Animated.Value(0)).current;
  const exitOpacity = useRef(new Animated.Value(1)).current;
  const flashAnim   = useRef(new Animated.Value(0)).current;
  const onLeftRef   = useRef(onSwipedLeft);
  const onRightRef  = useRef(onSwipedRight);
  const [expModalVisible, setExpModalVisible] = useState(false);
  const [eduModalVisible, setEduModalVisible] = useState(false);
  useEffect(() => { onLeftRef.current = onSwipedLeft; onRightRef.current = onSwipedRight; }, [onSwipedLeft, onSwipedRight]);

  const resetDrag = () =>
    Animated.spring(dragX, { toValue: 0, useNativeDriver: true, friction: 7, tension: 40 }).start();

  const flyOff = useCallback((dir: 'left' | 'right', cb: () => void) => {
    const tx = dir === 'left' ? -(W + 200) : W + 200;
    Animated.parallel([
      Animated.timing(dragX,       { toValue: tx, duration: 260, useNativeDriver: true, easing: Easing.in(Easing.quad) }),
      Animated.timing(exitOpacity, { toValue: 0,  duration: 220, useNativeDriver: true }),
    ]).start(cb);
  }, [dragX, exitOpacity]);

  const dismiss = useCallback((type: 'pass' | 'connect') => {
    if (type === 'connect') {
      Animated.sequence([
        Animated.timing(flashAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
        Animated.timing(flashAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      ]).start();
    }
    const tx = type === 'pass' ? -(W + 200) : W + 200;
    Animated.parallel([
      Animated.timing(dragX,       { toValue: tx, duration: 300, useNativeDriver: true, easing: Easing.in(Easing.quad) }),
      Animated.timing(exitOpacity, { toValue: 0,  duration: 260, useNativeDriver: true }),
    ]).start(() => {
      if (type === 'pass') onLeftRef.current(); else onRightRef.current();
    });
  }, [dragX, exitOpacity, flashAnim]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder:        () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: (_, g) => { const ax = Math.abs(g.dx), ay = Math.abs(g.dy); return ax > ay && ax > 6; },
      onMoveShouldSetPanResponder:        (_, g) => { const ax = Math.abs(g.dx), ay = Math.abs(g.dy); return ax > ay && ax > 6; },
      onPanResponderGrant: () => { dragX.setOffset((dragX as any)._value); dragX.setValue(0); },
      onPanResponderMove: Animated.event([null, { dx: dragX }], { useNativeDriver: false }),
      onPanResponderRelease: (_, g) => {
        dragX.flattenOffset();
        if (g.dx > SWIPE_THRESHOLD || g.vx > 0.8)       flyOff('right', () => onRightRef.current());
        else if (g.dx < -SWIPE_THRESHOLD || g.vx < -0.8) flyOff('left',  () => onLeftRef.current());
        else resetDrag();
      },
      onPanResponderTerminate: () => { dragX.flattenOffset(); resetDrag(); },
    })
  ).current;

  useImperativeHandle(ref, () => ({ dismiss }));

  const rotate      = dragX.interpolate({ inputRange: [-W * 0.5, 0, W * 0.5], outputRange: ['-8deg', '0deg', '8deg'], extrapolate: 'clamp' });
  const connectTint = dragX.interpolate({ inputRange: [0, SWIPE_THRESHOLD], outputRange: [0, 0.35], extrapolate: 'clamp' });
  const passTint    = dragX.interpolate({ inputRange: [-SWIPE_THRESHOLD, 0], outputRange: [0.35, 0], extrapolate: 'clamp' });

  const firstExp     = profile.experience[0];
  const extraExpCount = profile.experience.length - 1;
  const eduList      = profile.education ?? [];
  const firstEdu     = eduList[0];
  const extraEduCount = eduList.length - 1;

  return (
    <Animated.View style={[cardStyles.card, { transform: [{ translateX: dragX }, { translateY: exitY }, { rotate }], opacity: exitOpacity }]} {...panResponder.panHandlers}>
      {/* Edge tints while dragging */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 24, backgroundColor: '#22c55e', opacity: connectTint, zIndex: 20 }]} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 24, backgroundColor: '#ef4444', opacity: passTint,    zIndex: 20 }]} />
      {/* Button-triggered flash */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 24, backgroundColor: '#22c55e', opacity: flashAnim, zIndex: 30 }]} />
      <ScrollView showsVerticalScrollIndicator={false} bounces={false} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* ── Full-width hero image ── */}
        <View style={wCardStyles.heroWrap}>
          <ExpoImage
            source={profile.images?.[0] ? { uri: profile.images[0] } : undefined}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="disk"
          />
          {/* LinkedIn icon — top-right corner */}
          <Pressable
            onPress={() => profile.linkedInUrl && Linking.openURL(
              profile.linkedInUrl.startsWith('http') ? profile.linkedInUrl : `https://${profile.linkedInUrl}`
            )}
            hitSlop={10}
            style={{
              position: 'absolute', top: 14, right: 14, zIndex: 10,
              opacity: profile.linkedInUrl ? 1 : 0.45,
            }}
          >
            <View style={wStyles.linkedInBadge}>
              <Text style={wStyles.linkedInText}>in</Text>
            </View>
          </Pressable>

          {/* Gradient overlay at bottom */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.92)']}
            style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', padding: 18 }]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Text style={cardStyles.photoName}>{profile.name}</Text>
                  {profile.verified && <Ionicons name="checkmark-circle" size={17} color="#fff" />}
                  {profile.areYouHiring && (
                    <View style={wStyles.hiringBadge}><Text style={wStyles.hiringText}>HIRING</Text></View>
                  )}
                </View>
                {/* Headline */}
                {profile.headline ? (
                  <Text style={wStyles.cardHeadline} numberOfLines={2}>{profile.headline}</Text>
                ) : (
                  <Text style={wStyles.cardRole}>{profile.role}</Text>
                )}
                {/* Persona badge */}
                {profile.persona && (
                  <View style={[wStyles.personaBadge, { marginTop: 5 }]}>
                    <Ionicons
                      name={profile.persona === 'founder' ? 'rocket-outline' : profile.persona === 'job_seeker' ? 'search-outline' : 'person-outline'}
                      size={11} color="#fff"
                    />
                    <Text style={wStyles.personaText}>
                      {profile.persona === 'founder' ? 'Founder' : profile.persona === 'job_seeker' ? 'Job Seeker' : 'Founder & Job Seeker'}
                    </Text>
                  </View>
                )}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <Ionicons name="location-outline" size={12} color="rgba(255,255,255,0.7)" />
                  <Text style={cardStyles.locationText}>{profile.distance} away</Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* ── Card body ── */}
        <View style={[cardStyles.detailsSection, { backgroundColor: colors.surface }]}>

          {/* Work headline / pitch */}
          {!!profile.headline && (
            <>
              <Text style={[cardStyles.aboutText, { color: colors.text, fontFamily: 'ProductSans-Medium' }]}>{profile.headline}</Text>
              <View style={[cardStyles.divider, { backgroundColor: colors.border }]} />
            </>
          )}

          {/* Goals */}
          {profile.matchingGoals.length > 0 && (
            <View style={wCardStyles.infoRow}>
              <View style={[wCardStyles.infoIcon, { backgroundColor: colors.surface2 }]}>
                <Ionicons name="flag-outline" size={14} color={colors.textSecondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[cardStyles.detailLabel, { color: colors.textSecondary }]}>Looking for</Text>
                <Text style={[cardStyles.detailValue, { color: colors.text }]}>{profile.matchingGoals.join(' · ')}</Text>
              </View>
            </View>
          )}

          {/* Commitment */}
          {!!profile.commitmentLevel && (
            <View style={wCardStyles.infoRow}>
              <View style={[wCardStyles.infoIcon, { backgroundColor: colors.surface2 }]}>
                <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[cardStyles.detailLabel, { color: colors.textSecondary }]}>Commitment</Text>
                <Text style={[cardStyles.detailValue, { color: colors.text }]}>{profile.commitmentLevel}</Text>
              </View>
            </View>
          )}

          {/* Equity */}
          {!!profile.equitySplit && (
            <View style={wCardStyles.infoRow}>
              <View style={[wCardStyles.infoIcon, { backgroundColor: colors.surface2 }]}>
                <Ionicons name="pie-chart-outline" size={14} color={colors.textSecondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[cardStyles.detailLabel, { color: colors.textSecondary }]}>Equity Split</Text>
                <Text style={[cardStyles.detailValue, { color: colors.text }]}>{profile.equitySplit}</Text>
              </View>
            </View>
          )}

          {/* Number of founders */}
          {!!profile.numFounders && (
            <View style={wCardStyles.infoRow}>
              <View style={[wCardStyles.infoIcon, { backgroundColor: colors.surface2 }]}>
                <Ionicons name="people-outline" size={14} color={colors.textSecondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[cardStyles.detailLabel, { color: colors.textSecondary }]}>Founders so far</Text>
                <Text style={[cardStyles.detailValue, { color: colors.text }]}>{profile.numFounders}</Text>
              </View>
            </View>
          )}

          {/* Primary role (job seeker) */}
          {!!profile.primaryRole && (
            <View style={wCardStyles.infoRow}>
              <View style={[wCardStyles.infoIcon, { backgroundColor: colors.surface2 }]}>
                <Ionicons name="briefcase-outline" size={14} color={colors.textSecondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[cardStyles.detailLabel, { color: colors.textSecondary }]}>Primary Role</Text>
                <Text style={[cardStyles.detailValue, { color: colors.text }]}>{profile.primaryRole}</Text>
              </View>
            </View>
          )}

          {/* Years experience */}
          {!!profile.yearsExperience && (
            <View style={wCardStyles.infoRow}>
              <View style={[wCardStyles.infoIcon, { backgroundColor: colors.surface2 }]}>
                <Ionicons name="trending-up-outline" size={14} color={colors.textSecondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[cardStyles.detailLabel, { color: colors.textSecondary }]}>Years of Experience</Text>
                <Text style={[cardStyles.detailValue, { color: colors.text }]}>{profile.yearsExperience}</Text>
              </View>
            </View>
          )}

          {/* Job search status */}
          {!!profile.jobSearchStatus && (
            <View style={wCardStyles.infoRow}>
              <View style={[wCardStyles.infoIcon, { backgroundColor: colors.surface2 }]}>
                <Ionicons name="search-outline" size={14} color={colors.textSecondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[cardStyles.detailLabel, { color: colors.textSecondary }]}>Job Search</Text>
                <Text style={[cardStyles.detailValue, { color: colors.text }]}>{profile.jobSearchStatus}</Text>
              </View>
            </View>
          )}

          <View style={[cardStyles.divider, { backgroundColor: colors.border }]} />

          {/* Industries */}
          {profile.industries.length > 0 && (
            <>
              <Text style={[cardStyles.secLabel, { color: colors.textSecondary }]}>INDUSTRIES</Text>
              <View style={[cardStyles.chipRow, { marginTop: 8 }]}>
                {profile.industries.map(ind => (
                  <View key={ind} style={[cardStyles.chip, { backgroundColor: colors.surface2 }]}>
                    <Text style={[cardStyles.chipLabel, { color: colors.text }]}>{ind}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Skills */}
          {profile.skills.length > 0 && (
            <>
              <Text style={[cardStyles.secLabel, { color: colors.textSecondary, marginTop: 14 }]}>SKILLS</Text>
              <View style={[cardStyles.chipRow, { marginTop: 8 }]}>
                {profile.skills.map(sk => (
                  <View key={sk} style={[cardStyles.chip, { backgroundColor: colors.surface2 }]}>
                    <Text style={[cardStyles.chipLabel, { color: colors.text }]}>{sk}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {(profile.industries.length > 0 || profile.skills.length > 0) && (
            <View style={[cardStyles.divider, { backgroundColor: colors.border }]} />
          )}

          {/* Experience */}
          {(firstExp || extraExpCount > 0) && (
            <>
              <Text style={[cardStyles.secLabel, { color: colors.textSecondary }]}>EXPERIENCE</Text>
              {firstExp && (
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 10 }}>
                  {firstExp.company_logo ? (
                    <Image
                      source={{ uri: firstExp.company_logo }}
                      style={{ width: 24, height: 24, borderRadius: 5, marginTop: 2, backgroundColor: '#fff' }}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={wStyles.expDot} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[cardStyles.detailValue, { color: colors.text }]}>{firstExp.title}</Text>
                    <Text style={[cardStyles.detailLabel, { color: colors.textSecondary }]}>{firstExp.company} · {firstExp.years}</Text>
                  </View>
                </View>
              )}
              {extraExpCount > 0 && (
                <Pressable
                  onPress={() => setExpModalVisible(true)}
                  style={({ pressed }) => [wCardStyles.showMoreBtn, { borderColor: colors.border, backgroundColor: colors.surface2 }, pressed && { opacity: 0.65 }]}
                >
                  <Ionicons name="briefcase-outline" size={14} color={colors.textSecondary} />
                  <Text style={[wCardStyles.showMoreText, { color: colors.textSecondary }]}>
                    +{extraExpCount} more
                  </Text>
                </Pressable>
              )}
            </>
          )}

          {/* Education */}
          {(firstEdu || extraEduCount > 0) && (
            <>
              <Text style={[cardStyles.secLabel, { color: colors.textSecondary, marginTop: firstExp || extraExpCount > 0 ? 14 : 0 }]}>EDUCATION</Text>
              {firstEdu && (
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 10 }}>
                  <Ionicons name="school-outline" size={16} color={colors.textSecondary} style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[cardStyles.detailValue, { color: colors.text }]}>{firstEdu.institution}</Text>
                    <Text style={[cardStyles.detailLabel, { color: colors.textSecondary }]}>
                      {[firstEdu.degree, firstEdu.field].filter(Boolean).join(' · ')}
                      {firstEdu.grad_year ? ` · ${firstEdu.grad_year}` : ''}
                    </Text>
                  </View>
                </View>
              )}
              {extraEduCount > 0 && (
                <Pressable
                  onPress={() => setEduModalVisible(true)}
                  style={({ pressed }) => [wCardStyles.showMoreBtn, { borderColor: colors.border, backgroundColor: colors.surface2 }, pressed && { opacity: 0.65 }]}
                >
                  <Ionicons name="school-outline" size={14} color={colors.textSecondary} />
                  <Text style={[wCardStyles.showMoreText, { color: colors.textSecondary }]}>
                    +{extraEduCount} more
                  </Text>
                </Pressable>
              )}
            </>
          )}

          {(firstExp || firstEdu) && (
            <View style={[cardStyles.divider, { backgroundColor: colors.border }]} />
          )}

          {/* Experience modal */}
          <AllEntriesModal
            visible={expModalVisible}
            onClose={() => setExpModalVisible(false)}
            title="Work Experience"
            entries={profile.experience.map(e => ({ kind: 'experience' as const, ...e }))}
            colors={colors}
          />

          {/* Education modal */}
          <AllEntriesModal
            visible={eduModalVisible}
            onClose={() => setEduModalVisible(false)}
            title="Education"
            entries={eduList.map(e => ({ kind: 'education' as const, ...e }))}
            colors={colors}
          />

          {/* Work prompts — pitch cards (looking for co-founder, my idea, etc.) */}
          {profile.prompts.filter(p => p.question && p.answer).map((p, i) => (
            <View key={i} style={[wCardStyles.pitchCard, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
              <View style={wCardStyles.pitchCardHeader}>
                <Ionicons name="rocket-outline" size={13} color={colors.textSecondary} />
                <Text style={[cardStyles.promptQ, { color: colors.textSecondary }]}>{p.question}</Text>
              </View>
              <Text style={[cardStyles.promptA, { color: colors.text }]}>{p.answer}</Text>
            </View>
          ))}

          {/* Report / Block */}
          <View style={[cardStyles.dangerRow, { marginTop: profile.prompts.length > 0 ? 10 : 4 }]}>
            <Pressable style={({ pressed }) => [cardStyles.dangerBtn, { borderColor: colors.border, backgroundColor: colors.surface2 }, pressed && { opacity: 0.65 }]}>
              <Ionicons name="flag-outline" size={15} color={colors.error ?? '#FF3B30'} />
              <Text style={[cardStyles.dangerBtnText, { color: colors.error ?? '#FF3B30' }]}>Report</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [cardStyles.dangerBtn, { borderColor: colors.border, backgroundColor: colors.surface2 }, pressed && { opacity: 0.65 }]}>
              <Ionicons name="ban-outline" size={15} color={colors.textSecondary} />
              <Text style={[cardStyles.dangerBtnText, { color: colors.textSecondary }]}>Block</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </Animated.View>
  );
});

// ─── Work Matched Page ────────────────────────────────────────────────────────

function WorkMatchedPage({ colors, insets }: { colors: any; insets: any }) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const visible = WORK_MATCHED.filter(p => !dismissed.includes(p.id));

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: insets.bottom + 90 }} showsVerticalScrollIndicator={false}>
      <View style={pageStyles.likedHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[pageStyles.pageTitle, { color: colors.text }]}>Matched</Text>
          <Text style={[pageStyles.pageSub, { color: colors.textSecondary }]}>{visible.length} people matched with you</Text>
        </View>
      </View>

      <View style={[pageStyles.likedGrid, { paddingHorizontal: 16 }]}>
        {visible.map(p => (
          <View key={p.id} style={[pageStyles.likedCardWrap, { width: (W - 44) / 2 }]}>
            <Squircle style={pageStyles.likedCard} cornerRadius={24} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={StyleSheet.hairlineWidth}>
              <View style={pageStyles.likedPhotoWrap}>
                <ExpoImage source={{ uri: p.images[0] }} style={pageStyles.likedPhoto} contentFit="cover" />
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.75)']} style={pageStyles.likedPhotoGrad}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={pageStyles.likedPhotoName}>{p.name}</Text>
                    {p.verified && <Ionicons name="checkmark-circle" size={11} color="#fff" />}
                  </View>
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 10, fontFamily: 'ProductSans-Regular' }} numberOfLines={1}>{p.role}</Text>
                </LinearGradient>
                {p.linkedInUrl && (
                  <View style={[wStyles.linkedInBadge, { position: 'absolute', top: 8, right: 8 }]}>
                    <Text style={wStyles.linkedInText}>in</Text>
                  </View>
                )}
                <View style={[pageStyles.likedHeartBadge, { backgroundColor: colors.text }]}>
                  <Ionicons name="checkmark" size={11} color={colors.bg} />
                </View>
              </View>
              <View style={pageStyles.likedInfo}>
                <Squircle style={pageStyles.likedChip} cornerRadius={20} cornerSmoothing={1} fillColor={colors.surface2}>
                  <Text style={[pageStyles.likedChipLabel, { color: colors.text }]} numberOfLines={1}>{p.industries[0]}</Text>
                </Squircle>
                <View style={pageStyles.likedActions}>
                  <Pressable onPress={() => setDismissed(prev => [...prev, p.id])} style={({ pressed }) => [pressed && { opacity: 0.65 }]} hitSlop={6}>
                    <Squircle style={pageStyles.likedPassBtn} cornerRadius={50} cornerSmoothing={1} fillColor={colors.surface2} strokeColor={colors.border} strokeWidth={StyleSheet.hairlineWidth}>
                      <Ionicons name="close" size={18} color={colors.text} />
                    </Squircle>
                  </Pressable>
                  <Pressable onPress={() => navPush({ pathname: '/chat', params: { name: p.name, image: p.images[0], online: 'false' } })} style={({ pressed }) => [pressed && { opacity: 0.65 }, { flex: 1 }]} hitSlop={6}>
                    <Squircle style={pageStyles.likedLikeBtn} cornerRadius={50} cornerSmoothing={1} fillColor={colors.text}>
                      <Ionicons name="chatbubble" size={14} color={colors.bg} />
                      <Text style={[pageStyles.likedLikeBtnText, { color: colors.bg }]}>Message</Text>
                    </Squircle>
                  </Pressable>
                </View>
              </View>
            </Squircle>
          </View>
        ))}
      </View>

      {visible.length === 0 && (
        <View style={pageStyles.likedEmpty}>
          <Squircle style={pageStyles.likedEmptyIcon} cornerRadius={28} cornerSmoothing={1} fillColor={colors.surface}>
            <Ionicons name="briefcase-outline" size={32} color={colors.textSecondary} />
          </Squircle>
          <Text style={[pageStyles.likedEmptyTitle, { color: colors.text }]}>No matches yet</Text>
          <Text style={[pageStyles.likedEmptySub, { color: colors.textSecondary }]}>Keep connecting to find your co-founder</Text>
        </View>
      )}
    </ScrollView>
  );
}

// ─── Work AI Insights Page ────────────────────────────────────────────────────

function WorkAiInsightsPage({ colors, insets }: { colors: any; insets: any }) {
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: insets.bottom + 90, gap: 12 }} showsVerticalScrollIndicator={false}>

      <View style={{ marginBottom: 4 }}>
        <View style={pageStyles.aiHeaderRow}>
          <Squircle style={pageStyles.aiHeaderIcon} cornerRadius={14} cornerSmoothing={1} fillColor={colors.surface2}>
            <Ionicons name="analytics" size={18} color={colors.text} />
          </Squircle>
          <View style={{ flex: 1 }}>
            <Text style={[pageStyles.pageTitle, { color: colors.text }]}>AI Insights</Text>
            <Text style={[pageStyles.pageSub, { color: colors.textSecondary }]}>Co-founder matches scored by compatibility</Text>
          </View>
        </View>
      </View>

      {WORK_AI_PICKS.map(({ profile, score, sharedAreas, reason, insights }) => (
        <Squircle key={profile.id} style={pageStyles.aiCard} cornerRadius={24} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={StyleSheet.hairlineWidth}>

          <View style={pageStyles.aiCardTop}>
            <ExpoImage source={{ uri: profile.images[0] }} style={pageStyles.aiPhoto} contentFit="cover" cachePolicy="disk" />
            <View style={pageStyles.aiInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[pageStyles.aiName, { color: colors.text }]}>{profile.name}</Text>
                {profile.verified && <Ionicons name="checkmark-circle" size={14} color={colors.text} />}
                <View style={wStyles.linkedInBadge}><Text style={wStyles.linkedInText}>in</Text></View>
              </View>
              <Text style={[pageStyles.aiLocation, { color: colors.textSecondary }]}>{profile.role} · {profile.company}</Text>
              <Text style={[pageStyles.aiLocation, { color: colors.textSecondary }]}>{profile.distance} away</Text>
              <Squircle style={pageStyles.aiScorePill} cornerRadius={20} cornerSmoothing={1} fillColor={colors.surface2}>
                <Ionicons name="pulse" size={12} color={colors.text} />
                <Text style={[pageStyles.aiScoreNum, { color: colors.text }]}>{score}% match</Text>
              </Squircle>
              <View style={[pageStyles.aiScoreTrack, { backgroundColor: colors.surface2, marginTop: 8 }]}>
                <View style={[pageStyles.aiScoreFill, { width: `${score}%` as any, backgroundColor: colors.text }]} />
              </View>
            </View>
          </View>

          <View style={[pageStyles.aiDivider, { backgroundColor: colors.border }]} />

          <View style={{ gap: 8 }}>
            <Text style={[pageStyles.aiSecLabel, { color: colors.textSecondary }]}>SHARED FOCUS AREAS</Text>
            <View style={pageStyles.chipRow}>
              {sharedAreas.map(area => (
                <Squircle key={area} style={pageStyles.aiChip} cornerRadius={20} cornerSmoothing={1} fillColor={colors.surface2}>
                  <Text style={[pageStyles.aiChipText, { color: colors.text }]}>{area}</Text>
                </Squircle>
              ))}
            </View>
          </View>

          <View style={[pageStyles.aiDivider, { backgroundColor: colors.border }]} />

          <View style={{ gap: 8 }}>
            <Text style={[pageStyles.aiSecLabel, { color: colors.textSecondary }]}>KEY SIGNALS</Text>
            {insights.filter(Boolean).map((ins, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.text, marginTop: 5 }} />
                <Text style={[pageStyles.aiReason, { color: colors.text, flex: 1 }]}>{String(ins)}</Text>
              </View>
            ))}
          </View>

          <View style={[pageStyles.aiDivider, { backgroundColor: colors.border }]} />

          <View style={{ gap: 6 }}>
            <Text style={[pageStyles.aiSecLabel, { color: colors.textSecondary }]}>WHY YOU MATCH</Text>
            <Text style={[pageStyles.aiReason, { color: colors.text }]}>{reason}</Text>
          </View>

          <View style={pageStyles.aiActions}>
            <Squircle style={[pageStyles.aiActionBtn, pageStyles.aiActionBtnOutline]} cornerRadius={50} cornerSmoothing={1} fillColor="transparent" strokeColor={colors.border} strokeWidth={1.5}>
              <Text style={[pageStyles.aiActionBtnText, { color: colors.text }]}>View Profile</Text>
            </Squircle>
            <Squircle style={[pageStyles.aiActionBtn, pageStyles.aiActionBtnFill]} cornerRadius={50} cornerSmoothing={1} fillColor={colors.text}>
              <Text style={[pageStyles.aiActionBtnText, { color: colors.bg }]}>Connect</Text>
            </Squircle>
          </View>
        </Squircle>
      ))}
    </ScrollView>
  );
}

// ─── WorkFeedScreen ───────────────────────────────────────────────────────────

export interface WorkFeedScreenHandle {
  /** Reload the feed from page 0 — called by parent after work filters are saved */
  refresh: () => void;
}

interface WorkFeedScreenProps {
  colors: any;
  insets: any;
  activeTab: string;
}

const WorkFeedScreen = forwardRef<WorkFeedScreenHandle, WorkFeedScreenProps>(
function WorkFeedScreen({ colors, insets, activeTab }, ref) {
  const router = useRouter();
  const { token } = useAuth();
  // Keep a ref so fetchFeed never needs token as a useCallback dependency.
  // This prevents the effect from re-running every time a background token
  // refresh updates the token value in AuthContext.
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const [workProfiles, setWorkProfiles] = useState<WorkProfile[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [feedPage,     setFeedPage]     = useState(0);
  // Must be declared here (not after conditional returns) to satisfy Rules of Hooks
  const workCardRef = useRef<WorkProfileCardHandle>(null);
  const [hasMore,      setHasMore]      = useState(true);
  const [matched,      setMatched]      = useState<string[]>([]);
  const [matchedProfile, setMatchedProfile] = useState<MatchedProfile | null>(null);
  const DAILY_CONNECT_LIMIT = 20;
  const [connectsUsed, setConnectsUsed] = useState(0);

  // Hydrate daily connect count from DB on mount (runs once)
  useEffect(() => {
    const t = tokenRef.current;
    if (!t) return;
    apiFetch<{ connects_used: number }>('/discover/work/daily-status', { token: t })
      .then(res => setConnectsUsed(res.connects_used))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchFeed = useCallback(async (page: number = 0, replace: boolean = true) => {
    const t = tokenRef.current;
    if (!t) return;
    setLoading(true);
    try {
      const res = await apiFetch<{ profiles: any[]; has_more: boolean }>(
        `/discover/feed?page=${page}&limit=10&mode=work`,
        { token: t },
      );
      // Map API response to WorkProfile shape
      const mapped: WorkProfile[] = res.profiles.map(p => ({
        id:              p.id,
        name:            p.name ?? 'Unknown',
        headline:        p.work_headline ?? '',
        role:            p.work_headline ?? (p.work?.prompts?.[0]?.answer ?? p.about ?? '').slice(0, 60),
        company:         '',
        verified:        p.verified,
        linkedInUrl:     p.work?.linkedInUrl ?? p.linkedin_url ?? undefined,
        distance:        p.distance ?? '',
        about:           p.about ?? '',
        images:          p.work?.photos?.length ? p.work.photos : (p.images ?? []),
        persona:         p.work_persona ?? null,
        matchingGoals:   p.work?.matchingGoals ?? [],
        commitmentLevel: p.work?.commitmentLevel ?? '',
        equitySplit:     p.work?.equitySplit ?? '',
        numFounders:     p.work?.numFounders ?? null,
        primaryRole:     p.work?.primaryRole ?? null,
        yearsExperience: p.work?.yearsExperience ?? null,
        jobSearchStatus: p.work?.jobSearchStatus ?? null,
        industries:      p.work?.industries ?? [],
        skills:          p.work?.skills ?? [],
        areYouHiring:    p.work?.areYouHiring ?? false,
        experience:      (p.work_experience ?? []).map((e: any) => ({
          title:        e.job_title ?? '',
          company:      e.company ?? '',
          company_logo: e.company_logo ?? '',
          years:        e.start_year ? `${e.start_year}${e.end_year ? '–' + e.end_year : '–now'}` : '',
        })),
        education:       (p.education ?? []).map((e: any) => ({
          institution: e.institution ?? '',
          degree:      e.degree ?? '',
          field:       e.course ?? e.field ?? '',
          grad_year:   e.grad_year ?? '',
        })),
        prompts: p.work?.prompts ?? [],
      }));
      setWorkProfiles(prev => replace ? mapped : [...prev, ...mapped]);
      setHasMore(res.has_more);
      setFeedPage(page);
    } catch {
      // keep existing on error
    } finally {
      setLoading(false);
    }
  // Stable reference — reads token from tokenRef at call time so token
  // changes never cause the initial-load useEffect to re-fire.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchFeed(0, true);
  }, [fetchFeed]);

  // Expose refresh() so the parent (FeedScreen) can trigger a refetch after
  // work filters are saved without needing to remount the component.
  useImperativeHandle(ref, () => ({ refresh: () => fetchFeed(0, true) }), [fetchFeed]);

  const removeTop = () => {
    setWorkProfiles(p => {
      const next = p.slice(1);
      if (next.length <= 2 && hasMore) fetchFeed(feedPage + 1, false);
      return next;
    });
  };
  const reset = () => fetchFeed(0, true);

  // Record swipe — returns the API response; handles 403 limit errors
  const recordSwipe = (profileId: string, direction: 'left' | 'right') => {
    const t = tokenRef.current;
    if (!t) return Promise.resolve(null);
    return apiFetch<{
      match: boolean;
      work_connects_used?: number;
      work_connects_remaining?: number;
    }>('/discover/swipe', {
      token: t,
      method: 'POST',
      body: JSON.stringify({ swiped_id: profileId, direction, mode: 'work' }),
    }).catch(() => null);
  };

  const handleSwipeLeft = (p: WorkProfile) => {
    recordSwipe(p.id, 'left');
    removeTop();
  };

  const handleSwipeRight = async (p: WorkProfile) => {
    if (connectsUsed >= DAILY_CONNECT_LIMIT) return;
    // Optimistic UI increment
    setConnectsUsed(n => n + 1);
    removeTop();
    const res = await recordSwipe(p.id, 'right');
    if (res) {
      // Sync exact count from server (handles restarts / multi-device)
      if (typeof res.work_connects_used === 'number') {
        setConnectsUsed(res.work_connects_used);
      }
      if (res.match) {
        setMatched(prev => [...prev, p.id]);
        setTimeout(() => {
          setMatchedProfile({ id: p.id, name: p.name, image: p.images[0] });
        }, 350);
      }
    }
  };

  if (activeTab === 'matched') {
    return <WorkMatchedPage colors={colors} insets={insets} />;
  }

  if (activeTab === 'insights') {
    return <WorkAiInsightsPage colors={colors} insets={insets} />;
  }

  // 'people' tab — button-driven feed
  return (
    <View style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' }}>
      {loading && workProfiles.length === 0 ? (
        <WorkFeedSkeleton colors={colors} />
      ) : workProfiles.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <EmptyState onReset={reset} colors={colors} />
        </View>
      ) : (
        <>
          {/* Connects left pill — above the card, matching date feed style */}
          <View style={{
            alignSelf: 'center', marginBottom: 10,
            flexDirection: 'row', alignItems: 'center', gap: 6,
            backgroundColor: connectsUsed >= DAILY_CONNECT_LIMIT ? 'rgba(239,68,68,0.12)' : colors.surface2,
            borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: connectsUsed >= DAILY_CONNECT_LIMIT ? 'rgba(239,68,68,0.35)' : colors.border,
          }}>
            <Ionicons
              name={connectsUsed >= DAILY_CONNECT_LIMIT ? 'lock-closed' : 'briefcase-outline'}
              size={12}
              color={connectsUsed >= DAILY_CONNECT_LIMIT ? '#ef4444' : colors.text}
            />
            <Text style={{ fontSize: 12, fontFamily: 'ProductSans-Medium', color: connectsUsed >= DAILY_CONNECT_LIMIT ? '#ef4444' : colors.text }}>
              {connectsUsed >= DAILY_CONNECT_LIMIT
                ? 'Limit reached · Resets at 12 AM UTC'
                : `${DAILY_CONNECT_LIMIT - connectsUsed} connects left today`}
            </Text>
          </View>

          <WorkProfileCard
            key={workProfiles[0].id}
            ref={workCardRef}
            profile={workProfiles[0]}
            onSwipedLeft={() => handleSwipeLeft(workProfiles[0])}
            onSwipedRight={() => handleSwipeRight(workProfiles[0])}
            colors={colors}
          />

          {/* ── Decision bar — floats over bottom of card ─────────────── */}
          <View style={wDecisionStyles.bar} pointerEvents="box-none">
            {/* Gradient scrim */}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.55)']}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            {/* Pass */}
            <Pressable
              onPress={() => workCardRef.current?.dismiss('pass')}
              style={({ pressed }) => [wDecisionStyles.passBtn, pressed && { transform: [{ scale: 0.93 }] }]}
            >
              <Ionicons name="close" size={20} color="#FF3B30" />
              <Text style={wDecisionStyles.passBtnLabel}>Pass</Text>
            </Pressable>
            {/* Connect */}
            <Pressable
              onPress={() => {
                if (connectsUsed >= DAILY_CONNECT_LIMIT) return;
                workCardRef.current?.dismiss('connect');
              }}
              style={({ pressed }) => [
                wDecisionStyles.connectBtn,
                connectsUsed >= DAILY_CONNECT_LIMIT && { opacity: 0.4 },
                pressed && connectsUsed < DAILY_CONNECT_LIMIT && { transform: [{ scale: 0.93 }] },
              ]}
            >
              <Ionicons name="briefcase" size={18} color="#fff" />
              <Text style={wDecisionStyles.connectBtnLabel}>
                {connectsUsed >= DAILY_CONNECT_LIMIT ? 'Limit reached' : 'Connect'}
              </Text>
            </Pressable>
          </View>
        </>
      )}

      {matchedProfile && (
        <MatchScreen
          profile={matchedProfile}
          onChat={() => {
            const p = matchedProfile;
            setMatchedProfile(null);
            navPush({ pathname: '/chat', params: { name: p.name, image: p.image, online: 'true' } });
          }}
          onDismiss={() => setMatchedProfile(null)}
        />
      )}
    </View>
  );
});

export default WorkFeedScreen;

// ─── Card styles ──────────────────────────────────────────────────────────────

const cardStyles = StyleSheet.create({
  card:           { width: CARD_W, height: CARD_H, borderRadius: 24, overflow: 'hidden', backgroundColor: '#111' },
  photoName:      { fontSize: 28, fontFamily: 'ProductSans-Black', color: '#fff' },
  locationText:   { fontSize: 13, fontFamily: 'ProductSans-Regular', color: 'rgba(255,255,255,0.7)' },
  detailsSection: { paddingHorizontal: 16, paddingTop: 18 },
  secLabel:       { fontSize: 10, fontFamily: 'ProductSans-Bold', letterSpacing: 1.5 },
  aboutText:      { fontSize: 14, fontFamily: 'ProductSans-Regular', lineHeight: 22 },
  divider:        { height: StyleSheet.hairlineWidth, marginVertical: 16 },
  chipRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:           { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  chipLabel:      { fontSize: 12, fontFamily: 'ProductSans-Regular' },
  detailLabel:    { fontSize: 11, fontFamily: 'ProductSans-Regular' },
  detailValue:    { fontSize: 13, fontFamily: 'ProductSans-Bold', marginTop: 1 },
  promptCard:     { borderRadius: 14, padding: 14, gap: 6, marginBottom: 4 },
  promptQ:        { fontSize: 11, fontFamily: 'ProductSans-Bold', letterSpacing: 0.3 },
  promptA:        { fontSize: 14, fontFamily: 'ProductSans-Regular', lineHeight: 21 },
  dangerRow:      { flexDirection: 'row', gap: 10 },
  dangerBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  dangerBtnText:  { fontSize: 13, fontFamily: 'ProductSans-Regular' },
});

// ─── Page styles ──────────────────────────────────────────────────────────────

const LIKED_CARD_W   = Math.floor((W - 44) / 2);
const LIKED_PHOTO_H  = Math.floor(LIKED_CARD_W * 4 / 3);

const pageStyles = StyleSheet.create({
  likedHeader:     { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, gap: 12 },
  pageTitle:       { fontSize: 24, fontFamily: 'ProductSans-Black' },
  pageSub:         { fontSize: 13, fontFamily: 'ProductSans-Regular', marginTop: 2 },
  likedGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  likedCardWrap:   {},
  likedCard:       { overflow: 'hidden' },
  likedPhotoWrap:  { width: '100%', height: LIKED_PHOTO_H, position: 'relative' },
  likedPhoto:      { width: '100%', height: '100%' },
  likedPhotoGrad:  { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 10, paddingBottom: 12, gap: 2 },
  likedPhotoName:  { fontSize: 13, fontFamily: 'ProductSans-Bold', color: '#fff' },
  likedHeartBadge: { position: 'absolute', bottom: 8, right: 8, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  likedInfo:       { padding: 10, gap: 8 },
  likedChip:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5 },
  likedChipLabel:  { fontSize: 11, fontFamily: 'ProductSans-Regular' },
  likedActions:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  likedPassBtn:    { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  likedLikeBtn:    { height: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 10 },
  likedLikeBtnText:{ fontSize: 12, fontFamily: 'ProductSans-Bold' },
  likedEmpty:      { alignItems: 'center', paddingTop: 60, gap: 12 },
  likedEmptyIcon:  { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  likedEmptyTitle: { fontSize: 18, fontFamily: 'ProductSans-Bold' },
  likedEmptySub:   { fontSize: 13, fontFamily: 'ProductSans-Regular', textAlign: 'center', paddingHorizontal: 32 },
  aiHeaderRow:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  aiHeaderIcon:    { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  aiCard:          { padding: 16, gap: 0 },
  aiCardTop:       { flexDirection: 'row', gap: 12, marginBottom: 16 },
  aiPhoto:         { width: 80, height: 80, borderRadius: 16 },
  aiInfo:          { flex: 1 },
  aiName:          { fontSize: 15, fontFamily: 'ProductSans-Bold' },
  aiLocation:      { fontSize: 12, fontFamily: 'ProductSans-Regular', marginTop: 2 },
  aiScorePill:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, marginTop: 8, alignSelf: 'flex-start' },
  aiScoreNum:      { fontSize: 12, fontFamily: 'ProductSans-Bold' },
  aiScoreTrack:    { height: 4, borderRadius: 2 },
  aiScoreFill:     { height: 4, borderRadius: 2 },
  aiDivider:       { height: StyleSheet.hairlineWidth, marginVertical: 14 },
  aiSecLabel:      { fontSize: 10, fontFamily: 'ProductSans-Bold', letterSpacing: 1.5 },
  chipRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  aiChip:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6 },
  aiChipText:      { fontSize: 12, fontFamily: 'ProductSans-Regular' },
  aiReason:        { fontSize: 13, fontFamily: 'ProductSans-Regular', lineHeight: 20 },
  aiActions:       { flexDirection: 'row', gap: 10, marginTop: 14 },
  aiActionBtn:     { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center' },
  aiActionBtnOutline: {},
  aiActionBtnFill: {},
  aiActionBtnText: { fontSize: 13, fontFamily: 'ProductSans-Bold' },
});

const wDecisionStyles = StyleSheet.create({
  bar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingTop: 40,
    paddingBottom: 24,
    overflow: 'hidden',
  },
  passBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 2, borderColor: '#FF3B30',
    borderRadius: 50,
    paddingVertical: 13,
    paddingHorizontal: 22,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  passBtnLabel: {
    fontSize: 15,
    fontFamily: 'ProductSans-Bold',
    color: '#FF3B30',
  },
  connectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#0A66C2',
    borderRadius: 50,
    paddingVertical: 13,
    paddingHorizontal: 22,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 7,
  },
  connectBtnLabel: {
    fontSize: 15,
    fontFamily: 'ProductSans-Bold',
    color: '#fff',
  },
});
