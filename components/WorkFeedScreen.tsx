import { navPush, navReplace } from '@/utils/nav';
/**
 * WorkFeedScreen — the standalone Zod Work swipe feed.
 * Contains work profile cards, matched page, and AI insights page.
 * Consumed by FeedScreen when appMode === 'work'.
 */
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
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

// ─── Types & mock data ────────────────────────────────────────────────────────

interface WorkProfile {
  id: string;
  name: string;
  role: string;
  company: string;
  verified: boolean;
  linkedInUrl?: string;
  distance: string;
  about: string;
  images: string[];
  matchingGoals: string[];
  commitmentLevel: string;
  equitySplit: string;
  industries: string[];
  skills: string[];
  areYouHiring?: boolean;
  experience: { title: string; company: string; years: string }[];
  prompts: { question: string; answer: string }[];
}

const WORK_PROFILES: WorkProfile[] = [
  {
    id: 'w1', name: 'Alex Chen', role: 'CTO', company: 'Ex-Stripe', verified: true,
    linkedInUrl: 'https://linkedin.com', distance: '2.1 km',
    about: "Full-stack engineer with 8 years at Stripe building payments infra. Ready to go full-time on the right idea. Looking for a sales/GTM co-founder to build something in fintech or developer tools.",
    images: ['https://randomuser.me/api/portraits/men/32.jpg'],
    matchingGoals: ['Looking for co-founder'], commitmentLevel: 'Ready to go full-time right now',
    equitySplit: 'Equal split', industries: ['AI', 'SaaS', 'Developer Tools'], skills: ['Engineering', 'AI / ML', 'Product'],
    areYouHiring: false,
    experience: [{ title: 'Staff Engineer', company: 'Stripe', years: '5 yrs' }, { title: 'Senior Engineer', company: 'Plaid', years: '3 yrs' }],
    prompts: [
      { question: 'My idea in one line', answer: 'GPT-native ERP for small businesses — replace 5 SaaS tools with one.' },
      { question: 'The co-founder I\'m looking for', answer: 'A sales-obsessed operator who can close enterprise deals and build a GTM engine from scratch.' },
    ],
  },
  {
    id: 'w2', name: 'Priya Sharma', role: 'Product Lead', company: 'Revolut', verified: true,
    linkedInUrl: 'https://linkedin.com', distance: '4.3 km',
    about: "5 years fintech product @ Revolut & Monzo. Obsessed with growth loops. Exploring founding my own thing — open to the right idea + founding team.",
    images: ['https://randomuser.me/api/portraits/women/44.jpg'],
    matchingGoals: ['Have an idea, open to explore'], commitmentLevel: 'Ready to go full-time in the next year',
    equitySplit: 'Fully negotiable', industries: ['Fintech', 'Consumer', 'Growth'], skills: ['Product', 'Growth', 'Strategy'],
    areYouHiring: true,
    experience: [{ title: 'Product Lead', company: 'Revolut', years: '3 yrs' }, { title: 'PM', company: 'Monzo', years: '2 yrs' }],
    prompts: [
      { question: 'What I bring to the table', answer: 'Deep fintech domain, strong product sense, and a network of 200+ angel investors in London.' },
      { question: 'My biggest learning so far', answer: 'Distribution is harder than building. Founders who figure out growth early win.' },
    ],
  },
  {
    id: 'w3', name: 'Jordan Kim', role: 'Founder', company: 'Ex-Salesforce', verified: false,
    linkedInUrl: 'https://linkedin.com', distance: '7.8 km',
    about: "Serial founder with one exit (acquired by Salesforce). Now targeting climate tech. Looking for a technical co-founder who can own the entire stack.",
    images: ['https://randomuser.me/api/portraits/men/55.jpg'],
    matchingGoals: ['Looking for co-founder'], commitmentLevel: 'Already full-time on a startup',
    equitySplit: 'Equal split', industries: ['Climate Tech', 'B2B', 'SaaS'], skills: ['Sales', 'Strategy', 'Fundraising'],
    areYouHiring: false,
    experience: [{ title: 'Founder', company: 'GreenOps (acquired)', years: '4 yrs' }, { title: 'AE', company: 'Salesforce', years: '2 yrs' }],
    prompts: [{ question: 'Why now, why me', answer: 'Climate has a distribution problem — I know how to solve that.' }],
  },
  {
    id: 'w4', name: 'Sarah Liu', role: 'ML Engineer', company: 'Mistral AI', verified: true,
    linkedInUrl: 'https://linkedin.com', distance: '1.5 km',
    about: "Research engineer @ Mistral. Published 3 papers on LLM inference optimisation. Want to found an AI infrastructure startup targeting inference cost reduction.",
    images: ['https://randomuser.me/api/portraits/women/68.jpg'],
    matchingGoals: ['Looking for co-founder', 'Have an idea, open to explore'],
    commitmentLevel: 'Ready to go full-time right now',
    equitySplit: 'Equal split', industries: ['AI', 'Deep Tech'], skills: ['AI / ML', 'Engineering', 'Product'],
    areYouHiring: false,
    experience: [{ title: 'ML Engineer', company: 'Mistral AI', years: '2 yrs' }, { title: 'Research Intern', company: 'DeepMind', years: '1 yr' }],
    prompts: [{ question: 'My superpower is', answer: 'Making large models small — I cut inference cost by 60% at my last gig.' }],
  },
];

const WORK_MATCHED: WorkProfile[] = [];

const WORK_AI_PICKS: { profile: WorkProfile; score: number; sharedAreas: string[]; reason: string; insights: string[] }[] = [];

// ─── LinkedIn & work badge styles ─────────────────────────────────────────────

const wStyles = StyleSheet.create({
  linkedInBadge: { width: 20, height: 20, borderRadius: 5, backgroundColor: '#0A66C2', alignItems: 'center', justifyContent: 'center' },
  linkedInText:  { fontSize: 11, fontFamily: 'ProductSans-Black', color: '#fff' },
  cardRole:      { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontFamily: 'ProductSans-Medium', marginTop: 1 },
  hiringBadge:   { backgroundColor: '#22c55e', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  hiringText:    { fontSize: 10, fontFamily: 'ProductSans-Black', color: '#fff', letterSpacing: 0.5 },
  expDot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: '#0A66C2', marginTop: 2 },
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

function WorkProfileCard({ profile, onSwipedLeft, onSwipedRight, colors }: {
  profile: WorkProfile;
  onSwipedLeft: () => void;
  onSwipedRight: () => void;
  colors: any;
}) {
  const position = useRef(new Animated.ValueXY()).current;
  const onLeftRef  = useRef(onSwipedLeft);
  const onRightRef = useRef(onSwipedRight);
  useEffect(() => { onLeftRef.current = onSwipedLeft; onRightRef.current = onSwipedRight; }, [onSwipedLeft, onSwipedRight]);

  const resetCard = () =>
    Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: true, friction: 6, tension: 40 }).start();

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
          Animated.timing(position, { toValue: { x: W + 200, y: g.dy }, duration: 220, useNativeDriver: true }).start(() => onRightRef.current());
        } else if (g.dx < -SWIPE_THRESHOLD || g.vx < -0.8) {
          Animated.timing(position, { toValue: { x: -(W + 200), y: g.dy }, duration: 220, useNativeDriver: true }).start(() => onLeftRef.current());
        } else { resetCard(); }
      },
      onPanResponderTerminate: () => { position.flattenOffset(); resetCard(); },
    })
  ).current;

  const rotate = position.x.interpolate({ inputRange: [-W * 0.6, 0, W * 0.6], outputRange: ['-12deg', '0deg', '12deg'], extrapolate: 'clamp' });
  const connectOpacity = position.x.interpolate({ inputRange: [0, SWIPE_THRESHOLD], outputRange: [0, 1], extrapolate: 'clamp' });
  const passOpacity    = position.x.interpolate({ inputRange: [-SWIPE_THRESHOLD, 0], outputRange: [1, 0], extrapolate: 'clamp' });

  return (
    <Animated.View style={[cardStyles.card, { transform: [{ translateX: position.x }, { translateY: position.y }, { rotate }] }]} {...panResponder.panHandlers}>
      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        {/* Cover photo */}
        <View style={{ height: CARD_H * 0.42, position: 'relative' }}>
          <ExpoImage source={{ uri: profile.images[0] }} style={{ width: '100%', height: '100%' }} contentFit="cover" cachePolicy="disk" />
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', padding: 16 }]}>
            <Animated.View style={[cardStyles.likeStamp, { opacity: connectOpacity, borderColor: '#4ade80' }]}>
              <Text style={[cardStyles.likeStampText, { color: '#4ade80' }]}>CONNECT</Text>
            </Animated.View>
            <Animated.View style={[cardStyles.nopeStamp, { opacity: passOpacity }]}>
              <Text style={cardStyles.nopeStampText}>PASS</Text>
            </Animated.View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={cardStyles.photoName}>{profile.name}</Text>
                  {profile.verified && <Ionicons name="checkmark-circle" size={16} color="#fff" />}
                  {profile.linkedInUrl && (
                    <View style={wStyles.linkedInBadge}><Text style={wStyles.linkedInText}>in</Text></View>
                  )}
                </View>
                <Text style={wStyles.cardRole}>{profile.role} · {profile.company}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <Ionicons name="location-outline" size={11} color="rgba(255,255,255,0.7)" />
                  <Text style={cardStyles.locationText}>{profile.distance} away</Text>
                </View>
              </View>
              {profile.areYouHiring && (
                <View style={wStyles.hiringBadge}><Text style={wStyles.hiringText}>HIRING</Text></View>
              )}
            </View>
          </LinearGradient>
        </View>

        {/* Card body */}
        <View style={[cardStyles.detailsSection, { backgroundColor: colors.surface }]}>
          <Text style={[cardStyles.aboutText, { color: colors.text }]}>{profile.about}</Text>
          <View style={[cardStyles.divider, { backgroundColor: colors.border }]} />

          <View style={{ gap: 10 }}>
            <Text style={[cardStyles.secLabel, { color: colors.textSecondary }]}>INDUSTRIES</Text>
            <View style={cardStyles.chipRow}>
              {profile.industries.map(ind => (
                <View key={ind} style={[cardStyles.chip, { backgroundColor: colors.surface2 }]}>
                  <Text style={[cardStyles.chipLabel, { color: colors.text }]}>{ind}</Text>
                </View>
              ))}
            </View>
            <Text style={[cardStyles.secLabel, { color: colors.textSecondary, marginTop: 4 }]}>SKILLS</Text>
            <View style={cardStyles.chipRow}>
              {profile.skills.map(sk => (
                <View key={sk} style={[cardStyles.chip, { backgroundColor: colors.surface2 }]}>
                  <Text style={[cardStyles.chipLabel, { color: colors.text }]}>{sk}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={[cardStyles.divider, { backgroundColor: colors.border }]} />

          <View style={{ gap: 10 }}>
            {[
              { icon: 'time-outline' as const,      label: 'Commitment', value: profile.commitmentLevel },
              { icon: 'pie-chart-outline' as const,  label: 'Equity',     value: profile.equitySplit },
              { icon: 'flag-outline' as const,       label: 'Goals',      value: profile.matchingGoals.join(', ') },
            ].map(d => (
              <View key={d.label} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
                <View style={[{ width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }, { backgroundColor: colors.surface2 }]}>
                  <Ionicons name={d.icon} size={13} color={colors.textSecondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[cardStyles.detailLabel, { color: colors.textSecondary }]}>{d.label}</Text>
                  <Text style={[cardStyles.detailValue, { color: colors.text }]} numberOfLines={2}>{d.value}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={[cardStyles.divider, { backgroundColor: colors.border }]} />

          <Text style={[cardStyles.secLabel, { color: colors.textSecondary }]}>EXPERIENCE</Text>
          <View style={{ gap: 8, marginTop: 8 }}>
            {profile.experience.map((ex, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={wStyles.expDot} />
                <View style={{ flex: 1 }}>
                  <Text style={[cardStyles.detailValue, { color: colors.text }]}>{ex.title} · {ex.company}</Text>
                  <Text style={[cardStyles.detailLabel, { color: colors.textSecondary }]}>{ex.years}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={[cardStyles.divider, { backgroundColor: colors.border }]} />

          {profile.prompts.map((p, i) => (
            <View key={i} style={[cardStyles.promptCard, { backgroundColor: colors.surface2, marginBottom: 8 }]}>
              <Text style={[cardStyles.promptQ, { color: colors.textSecondary }]}>{p.question}</Text>
              <Text style={[cardStyles.promptA, { color: colors.text }]}>{p.answer}</Text>
            </View>
          ))}

          <View style={[cardStyles.dangerRow, { marginTop: 8 }]}>
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
}

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
            {insights.map((ins, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.text, marginTop: 5 }} />
                <Text style={[pageStyles.aiReason, { color: colors.text, flex: 1 }]}>{ins}</Text>
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

interface WorkFeedScreenProps {
  colors: any;
  insets: any;
  activeTab: string;
}

export default function WorkFeedScreen({ colors, insets, activeTab }: WorkFeedScreenProps) {
  const router = useRouter();
  const { token } = useAuth();
  const [workProfiles, setWorkProfiles] = useState<WorkProfile[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [feedPage,     setFeedPage]     = useState(0);
  const [hasMore,      setHasMore]      = useState(true);
  const [matched,      setMatched]      = useState<string[]>([]);
  const [matchedProfile, setMatchedProfile] = useState<MatchedProfile | null>(null);

  const fetchFeed = useCallback(async (page: number = 0, replace: boolean = true) => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await apiFetch<{ profiles: any[]; has_more: boolean }>(
        `/discover/feed?page=${page}&limit=10&mode=work`,
        { token },
      );
      // Map API response to WorkProfile shape
      const mapped: WorkProfile[] = res.profiles.map(p => ({
        id:              p.id,
        name:            p.name ?? 'Unknown',
        role:            (p.work?.prompts?.[0]?.answer ?? p.about ?? '').slice(0, 60),
        company:         '',
        verified:        p.verified,
        linkedInUrl:     undefined,
        distance:        p.distance ?? '',
        about:           p.about ?? '',
        images:          p.work?.photos?.length ? p.work.photos : (p.images ?? []),
        matchingGoals:   p.work?.matchingGoals ?? [],
        commitmentLevel: p.work?.commitmentLevel ?? '',
        equitySplit:     p.work?.equitySplit ?? '',
        industries:      p.work?.industries ?? [],
        skills:          p.work?.skills ?? [],
        areYouHiring:    p.work?.areYouHiring ?? false,
        experience:      (p.work_experience ?? []).map((e: any) => ({
          title:   e.job_title ?? '',
          company: e.company ?? '',
          years:   e.start_year ? `${e.start_year}${e.end_year ? '–' + e.end_year : '–now'}` : '',
        })),
        prompts: p.work?.prompts ?? p.prompts ?? [],
      }));
      setWorkProfiles(prev => replace ? mapped : [...prev, ...mapped]);
      setHasMore(res.has_more);
      setFeedPage(page);
    } catch {
      // keep existing on error
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchFeed(0, true);
  }, [fetchFeed]);

  const removeTop = () => {
    setWorkProfiles(p => {
      const next = p.slice(1);
      if (next.length <= 2 && hasMore) fetchFeed(feedPage + 1, false);
      return next;
    });
  };
  const reset = () => fetchFeed(0, true);

  // Record swipe to backend (fire-and-forget)
  const recordSwipe = (profileId: string, direction: 'left' | 'right') => {
    if (!token) return;
    apiFetch('/discover/swipe', {
      token,
      method: 'POST',
      body: JSON.stringify({ swiped_id: profileId, direction, mode: 'work' }),
    }).catch(() => {});
  };

  const handleSwipeLeft = (p: WorkProfile) => {
    recordSwipe(p.id, 'left');
    removeTop();
  };

  const handleSwipeRight = (p: WorkProfile) => {
    recordSwipe(p.id, 'right');
    setMatched(prev => [...prev, p.id]);
    setTimeout(() => {
      setMatchedProfile({ id: p.id, name: p.name, age: 0, image: p.images[0] });
    }, 350);
    removeTop();
  };

  if (activeTab === 'matched') {
    return <WorkMatchedPage colors={colors} insets={insets} />;
  }

  if (activeTab === 'insights') {
    return <WorkAiInsightsPage colors={colors} insets={insets} />;
  }

  // 'people' tab — swipe feed
  return (
    <View style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' }}>
      {loading && workProfiles.length === 0 ? (
        <View style={{ alignItems: 'center', gap: 12 }}>
          <Text style={[{ fontSize: 14, fontFamily: 'ProductSans-Regular', color: colors.textSecondary }]}>Finding co-founders near you…</Text>
        </View>
      ) : workProfiles.length === 0 ? (
        <EmptyState onReset={reset} colors={colors} />
      ) : (
        <WorkProfileCard
          key={workProfiles[0].id}
          profile={workProfiles[0]}
          onSwipedLeft={() => handleSwipeLeft(workProfiles[0])}
          onSwipedRight={() => handleSwipeRight(workProfiles[0])}
          colors={colors}
        />
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
}

// ─── Card styles ──────────────────────────────────────────────────────────────

const cardStyles = StyleSheet.create({
  card:           { position: 'absolute', width: CARD_W, height: CARD_H, borderRadius: 28, overflow: 'hidden', backgroundColor: '#111' },
  likeStamp:      { position: 'absolute', top: 52, left: 24, zIndex: 20, borderWidth: 4, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8, transform: [{ rotate: '-22deg' }], backgroundColor: 'rgba(0,230,118,0.08)' },
  likeStampText:  { fontSize: 32, fontFamily: 'ProductSans-Black', letterSpacing: 3 },
  nopeStamp:      { position: 'absolute', top: 52, right: 24, zIndex: 20, borderWidth: 4, borderColor: '#FF3B30', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8, transform: [{ rotate: '22deg' }], backgroundColor: 'rgba(255,59,48,0.08)' },
  nopeStampText:  { color: '#FF3B30', fontSize: 32, fontFamily: 'ProductSans-Black', letterSpacing: 3 },
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
