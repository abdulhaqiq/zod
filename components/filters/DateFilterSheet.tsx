/**
 * DateFilterSheet — discover filters for Date mode.
 *
 * All filter state is loaded from profile.filter_* on open.
 * Pressing "Apply Filters" PATCHes the backend to persist the preferences,
 * then calls onApply() so the parent FeedScreen re-fetches the discover feed.
 *
 * Pro tab is gated by the user's subscription_tier from the backend.
 */
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import SliderRN from '@react-native-community/slider';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import Squircle from '@/components/ui/Squircle';
import { apiFetch, API_V1 } from '@/constants/api';
import { useAuth } from '@/context/AuthContext';
import { LOOKUP, RELATIONSHIP_TYPES } from '@/constants/lookupData';

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

  const trackWRef    = useRef(0);
  const lowPxRef     = useRef(0);
  const highPxRef    = useRef(0);
  const startLowRef  = useRef(0);
  const startHighRef = useRef(0);

  const lowAnim  = useRef(new Animated.Value(0)).current;
  const highAnim = useRef(new Animated.Value(0)).current;
  const fillLeft  = useRef(Animated.add(lowAnim, new Animated.Value(THUMB / 2))).current;
  const fillWidth = useRef(Animated.subtract(highAnim, lowAnim)).current;

  const valToPx = (val: number, tw: number) => ((val - min) / (max - min)) * tw;
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

  const lowPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: () => { startLowRef.current = lowPxRef.current; },
    onPanResponderMove: (_, g) => {
      const tw = trackWRef.current;
      const clamped = Math.max(0, Math.min(startLowRef.current + g.dx, highPxRef.current - MIN_GAP));
      lowPxRef.current = clamped;
      lowAnim.setValue(clamped);
      onLowChange(pxToVal(clamped, tw));
    },
    onPanResponderRelease: () => {
      const tw = trackWRef.current;
      const val = pxToVal(lowPxRef.current, tw);
      lowPxRef.current = valToPx(val, tw);
      lowAnim.setValue(lowPxRef.current);
      onLowChange(val);
    },
    onPanResponderTerminate: () => {},
  })).current;

  const highPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: () => { startHighRef.current = highPxRef.current; },
    onPanResponderMove: (_, g) => {
      const tw = trackWRef.current;
      const clamped = Math.max(lowPxRef.current + MIN_GAP, Math.min(startHighRef.current + g.dx, tw));
      highPxRef.current = clamped;
      highAnim.setValue(clamped);
      onHighChange(pxToVal(clamped, tw));
    },
    onPanResponderRelease: () => {
      const tw = trackWRef.current;
      const val = pxToVal(highPxRef.current, tw);
      highPxRef.current = valToPx(val, tw);
      highAnim.setValue(highPxRef.current);
      onHighChange(val);
    },
    onPanResponderTerminate: () => {},
  })).current;

  return (
    <View
      style={{ height: THUMB + 8, justifyContent: 'center' }}
      onLayout={e => {
        trackWRef.current = e.nativeEvent.layout.width - THUMB;
        initPositions(trackWRef.current);
      }}
    >
      <View style={{ height: TRACK_H, borderRadius: TRACK_H / 2, backgroundColor: colors.surface2, marginHorizontal: THUMB / 2 }} />
      <Animated.View pointerEvents="none" style={{ position: 'absolute', height: TRACK_H, borderRadius: TRACK_H / 2, backgroundColor: colors.text, left: fillLeft, width: fillWidth }} />
      <Animated.View {...lowPan.panHandlers} style={{ position: 'absolute', left: lowAnim, width: THUMB, height: THUMB, borderRadius: THUMB / 2, backgroundColor: colors.text, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 4 }} />
      <Animated.View {...highPan.panHandlers} style={{ position: 'absolute', left: highAnim, width: THUMB, height: THUMB, borderRadius: THUMB / 2, backgroundColor: colors.text, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 4 }} />
    </View>
  );
}

// ─── Filter Chip ──────────────────────────────────────────────────────────────

function FilterChip({ emoji, label, selected, onPress, colors }: {
  emoji?: string; label: string; selected: boolean; onPress: () => void; colors: any;
}) {
  return (
    <Pressable onPress={onPress}>
      <Squircle style={styles.filterChip} cornerRadius={16} cornerSmoothing={1} fillColor={selected ? colors.text : colors.surface2} strokeColor={selected ? colors.text : colors.border} strokeWidth={1}>
        {emoji ? <Text style={{ fontSize: 13 }}>{emoji}</Text> : null}
        <Text style={[styles.filterChipText, { color: selected ? colors.bg : colors.text }]}>{label}</Text>
      </Squircle>
    </Pressable>
  );
}

// ─── DateFilterSheet ──────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
  onApply: () => void;   // called after filters saved — parent re-fetches feed
  colors: any;
  insets: any;
}

export default function DateFilterSheet({ visible, onClose, onApply, colors, insets }: Props) {
  const router = useRouter();
  const { profile, token, updateProfile } = useAuth();
  const isPro = profile?.subscription_tier === 'pro';
  const isFaceVerified = profile?.verification_status === 'verified' || profile?.is_verified === true;

  const [activeTab,    setActiveTab]    = useState<'basic' | 'pro'>('basic');
  const [saving,       setSaving]       = useState(false);

  // ── Filter state (initialised from saved profile on each open) ────────────
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [ageMin,       setAgeMin]       = useState(18);
  const [ageMax,       setAgeMax]       = useState(45);
  const [distance,     setDistance]     = useState(50);   // 150 = "any"
  const [langs,        setLangs]        = useState<number[]>([]);
  const [signs,        setSigns]        = useState<number[]>([]);
  const [interests,    setInterests]    = useState<number[]>([]);
  // Pro filter state (IDs)
  const [lookingFor,   setLookingFor]   = useState<number[]>([]);
  const [education,    setEducation]    = useState<number[]>([]);
  const [familyPlans,  setFamilyPlans]  = useState<number[]>([]);
  const [havingKids,   setHavingKids]   = useState<number[]>([]);
  const [purpose,      setPurpose]      = useState<number[]>([]);

  // Sync from saved profile whenever the sheet opens
  useEffect(() => {
    if (!visible || !profile) return;
    setVerifiedOnly(profile.filter_verified_only ?? false);
    setAgeMin(profile.filter_age_min ?? 18);
    setAgeMax(profile.filter_age_max ?? 45);
    setDistance(profile.filter_max_distance_km ?? 50);
    setSigns(profile.filter_star_signs ?? []);
    setInterests(profile.filter_interests ?? []);
    setLangs(profile.filter_languages ?? []);
    setPurpose(profile.filter_purpose ?? []);
    setLookingFor(profile.filter_looking_for ?? []);
    setEducation(profile.filter_education_level ?? []);
    setFamilyPlans(profile.filter_family_plans ?? []);
    setHavingKids(profile.filter_have_kids ?? []);
  }, [visible]);

  const toggle = (arr: number[], setArr: (v: number[]) => void, val: number) =>
    setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);

  const reset = () => {
    setVerifiedOnly(false); setAgeMin(18); setAgeMax(45); setDistance(50);
    setSigns([]); setInterests([]); setLangs([]);
    setPurpose([]); setLookingFor([]); setEducation([]); setFamilyPlans([]); setHavingKids([]);
  };

  const handleApply = async () => {
    if (!token) { onClose(); return; }
    setSaving(true);
    try {
      const patch = {
        filter_age_min:         ageMin,
        filter_age_max:         ageMax,
        filter_max_distance_km: distance >= 150 ? null : distance,
        filter_verified_only:   verifiedOnly,
        filter_star_signs:      signs.length     ? signs     : null,
        filter_interests:       interests.length ? interests : null,
        filter_languages:       langs.length     ? langs     : null,
        // Pro filters
        filter_purpose:         purpose.length     ? purpose     : null,
        filter_looking_for:     lookingFor.length  ? lookingFor  : null,
        filter_education_level: education.length   ? education   : null,
        filter_family_plans:    familyPlans.length ? familyPlans : null,
        filter_have_kids:       havingKids.length  ? havingKids  : null,
      };

      const updated = await apiFetch<any>('/profile/me', {
        method: 'PATCH',
        token,
        body: JSON.stringify(patch),
      });

      updateProfile(updated);
      onApply();
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Could not save filters.');
    } finally {
      setSaving(false);
    }
  };

  const SecHead = ({ title }: { title: string }) => (
    <Text style={[styles.filterSecHead, { color: colors.textSecondary }]}>{title}</Text>
  );

  const isDark = colors.bg === '#000000';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.sheetContainer, { backgroundColor: colors.bg }]}>

        {/* Header */}
        <LinearGradient
          colors={isDark ? ['#1a1a1a','#111111','#000000'] : ['#e8e8ed','#f2f2f7','#ffffff']}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          style={[styles.sheetHeader, { paddingTop: insets.top + 10 }]}
        >
          <View style={styles.sheetHeaderRow}>
            <Pressable onPress={onClose} style={({ pressed }) => [styles.sheetClose, pressed && { opacity: 0.6 }]}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Discover</Text>
            <Pressable onPress={reset} hitSlop={8}>
              <Text style={[styles.sheetResetText, { color: colors.textSecondary }]}>Reset</Text>
            </Pressable>
          </View>

          {/* Tabs */}
          <View style={styles.filterTabRow}>
            <Pressable onPress={() => setActiveTab('basic')}>
              <View style={[styles.filterTabPill, activeTab === 'basic' && { backgroundColor: colors.text }]}>
                <Text style={[styles.filterTabText, { color: activeTab === 'basic' ? colors.bg : colors.textSecondary }]}>Basic</Text>
              </View>
            </Pressable>
            <Pressable onPress={() => setActiveTab('pro')}>
              <View style={[styles.filterTabPill, activeTab === 'pro' && { backgroundColor: colors.text }]}>
                <Ionicons name="sparkles" size={11} color={activeTab === 'pro' ? colors.bg : colors.textSecondary} style={{ marginRight: 4 }} />
                <Text style={[styles.filterTabText, { color: activeTab === 'pro' ? colors.bg : colors.textSecondary }]}>Pro</Text>
              </View>
            </Pressable>
          </View>
        </LinearGradient>

        {activeTab === 'basic' ? (
          /* ── Basic filters ── */
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 120, gap: 14 }} showsVerticalScrollIndicator={false}>

            {/* Age range */}
            <Squircle style={styles.filterCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <View style={styles.sliderLabelRow}>
                <SecHead title="AGE RANGE" />
                <Text style={[styles.sliderValue, { color: colors.text }]}>{ageMin} – {ageMax}</Text>
              </View>
              <View style={[styles.sliderEdgeRow, { marginTop: 10 }]}>
                <Text style={[styles.sliderEdge, { color: colors.textSecondary }]}>18</Text>
                <View style={{ flex: 1 }}>
                  <RangeSlider min={18} max={80} low={ageMin} high={ageMax} colors={colors} onLowChange={setAgeMin} onHighChange={setAgeMax} />
                </View>
                <Text style={[styles.sliderEdge, { color: colors.textSecondary }]}>80</Text>
              </View>
            </Squircle>

            {/* Distance */}
            <Squircle style={styles.filterCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <View style={styles.sliderLabelRow}>
                <SecHead title="MAX DISTANCE" />
                <Text style={[styles.sliderValue, { color: colors.text }]}>{distance >= 150 ? 'Any' : `${distance} km`}</Text>
              </View>
              <View style={[styles.sliderRow, { marginTop: 10 }]}>
                <Text style={[styles.sliderSub, { color: colors.textSecondary }]}>1 km</Text>
                <SliderRN
                  style={{ flex: 1 }}
                  minimumValue={1} maximumValue={150} step={1}
                  value={distance}
                  onValueChange={v => setDistance(Math.round(v))}
                  minimumTrackTintColor={colors.text}
                  maximumTrackTintColor={colors.surface2}
                  thumbTintColor={colors.text}
                />
                <Text style={[styles.sliderSub, { color: colors.textSecondary }]}>Any</Text>
              </View>
            </Squircle>

            {/* Verified only */}
            <Pressable
              onPress={!isFaceVerified ? () => router.push('/verify-face' as any) : undefined}
              disabled={isFaceVerified}
              activeOpacity={1}
            >
              <Squircle
                style={[styles.filterCard, { flexDirection: 'row', alignItems: 'center', gap: 12 }, !isFaceVerified && { opacity: 0.55 }]}
                cornerRadius={22} cornerSmoothing={1}
                fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}
              >
                <Squircle style={styles.filterRowIcon} cornerRadius={12} cornerSmoothing={1} fillColor={colors.surface2}>
                  <Ionicons name="checkmark-circle-outline" size={18} color={colors.text} />
                </Squircle>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.filterRowTitle, { color: colors.text }]}>Verified only</Text>
                  <Text style={[styles.filterRowSub, { color: colors.textSecondary }]}>
                    {isFaceVerified ? 'Show only verified profiles' : 'Verify your face first to use this filter'}
                  </Text>
                </View>
                {isFaceVerified ? (
                  <Switch
                    value={verifiedOnly}
                    onValueChange={setVerifiedOnly}
                    thumbColor={colors.bg}
                    trackColor={{ false: colors.surface2, true: colors.text }}
                  />
                ) : (
                  <Squircle style={styles.verifyGateBadge} cornerRadius={10} cornerSmoothing={1} fillColor={colors.surface2} strokeColor={colors.border} strokeWidth={1}>
                    <Ionicons name="camera-outline" size={12} color={colors.textSecondary} />
                    <Text style={[styles.verifyGateText, { color: colors.textSecondary }]}>Verify</Text>
                  </Squircle>
                )}
              </Squircle>
            </Pressable>

            {/* Interests */}
            <Squircle style={styles.filterCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <SecHead title="INTERESTS" />
              <View style={[styles.filterChipRow, { marginTop: 12 }]}>
                {LOOKUP.interests.map(v => (
                  <FilterChip key={v.id} emoji={v.emoji} label={v.label} selected={interests.includes(v.id)} onPress={() => toggle(interests, setInterests, v.id)} colors={colors} />
                ))}
              </View>
            </Squircle>

            {/* Star sign */}
            <Squircle style={styles.filterCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <SecHead title="STAR SIGN" />
              <View style={[styles.filterChipRow, { marginTop: 12 }]}>
                {LOOKUP.star_sign.map(v => (
                  <FilterChip key={v.id} emoji={v.emoji} label={v.label} selected={signs.includes(v.id)} onPress={() => toggle(signs, setSigns, v.id)} colors={colors} />
                ))}
              </View>
            </Squircle>

            {/* Languages */}
            <Squircle style={styles.filterCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <SecHead title="LANGUAGE" />
              <View style={[styles.filterChipRow, { marginTop: 12 }]}>
                {LOOKUP.language.map(v => (
                  <FilterChip key={v.id} emoji={v.emoji} label={v.label} selected={langs.includes(v.id)} onPress={() => toggle(langs, setLangs, v.id)} colors={colors} />
                ))}
              </View>
            </Squircle>
          </ScrollView>

        ) : isPro ? (
          /* ── Pro filters — unlocked ── */
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 120, gap: 14 }} showsVerticalScrollIndicator={false}>

            <Squircle style={styles.proHeaderCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <View style={styles.proHeaderRow}>
                <Squircle style={styles.proHeaderIcon} cornerRadius={14} cornerSmoothing={1} fillColor={colors.text}>
                  <Ionicons name="sparkles" size={20} color={colors.bg} />
                </Squircle>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.proHeaderTitle, { color: colors.text }]}>Pro Filters</Text>
                  <Text style={[styles.proHeaderSub, { color: colors.textSecondary }]}>Advanced filters — all unlocked</Text>
                </View>
                <Squircle style={styles.proLockBadge} cornerRadius={10} cornerSmoothing={1} fillColor={colors.text}>
                  <Ionicons name="checkmark" size={13} color={colors.bg} />
                </Squircle>
              </View>
            </Squircle>

            <Text style={[styles.filterSecHead, { color: colors.textSecondary, marginLeft: 2 }]}>ADVANCED FILTERS</Text>

            <Squircle style={styles.filterCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <SecHead title="RELATIONSHIP INTENT" />
              <View style={[styles.filterChipRow, { marginTop: 12 }]}>
                {RELATIONSHIP_TYPES.map(v => (
                  <FilterChip key={v.id} label={v.label} selected={purpose.includes(v.id)} onPress={() => toggle(purpose, setPurpose, v.id)} colors={colors} />
                ))}
              </View>
            </Squircle>

            <Squircle style={styles.filterCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <SecHead title="LOOKING FOR" />
              <View style={[styles.filterChipRow, { marginTop: 12 }]}>
                {LOOKUP.looking_for.map(v => (
                  <FilterChip key={v.id} emoji={v.emoji} label={v.label} selected={lookingFor.includes(v.id)} onPress={() => toggle(lookingFor, setLookingFor, v.id)} colors={colors} />
                ))}
              </View>
            </Squircle>

            <Squircle style={styles.filterCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <SecHead title="EDUCATION LEVEL" />
              <View style={[styles.filterChipRow, { marginTop: 12 }]}>
                {LOOKUP.education_level.map(v => (
                  <FilterChip key={v.id} emoji={v.emoji} label={v.label} selected={education.includes(v.id)} onPress={() => toggle(education, setEducation, v.id)} colors={colors} />
                ))}
              </View>
            </Squircle>

            <Squircle style={styles.filterCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <SecHead title="FAMILY PLANS" />
              <View style={[styles.filterChipRow, { marginTop: 12 }]}>
                {LOOKUP.family_plans.map(v => (
                  <FilterChip key={v.id} emoji={v.emoji} label={v.label} selected={familyPlans.includes(v.id)} onPress={() => toggle(familyPlans, setFamilyPlans, v.id)} colors={colors} />
                ))}
              </View>
            </Squircle>

            <Squircle style={styles.filterCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <SecHead title="HAVE KIDS" />
              <View style={[styles.filterChipRow, { marginTop: 12 }]}>
                {LOOKUP.have_kids.map(v => (
                  <FilterChip key={v.id} emoji={v.emoji} label={v.label} selected={havingKids.includes(v.id)} onPress={() => toggle(havingKids, setHavingKids, v.id)} colors={colors} />
                ))}
              </View>
            </Squircle>

            <Text style={[styles.filterSecHead, { color: colors.textSecondary, marginLeft: 2, marginTop: 6 }]}>AI FEATURES</Text>

            {[
              { icon: 'analytics-outline',        title: 'Match Score',            sub: 'Every profile shows a % of how well you match — before you swipe' },
              { icon: 'shield-checkmark-outline',  title: 'Must-Haves Filter',      sub: "Set things you can't compromise on and we hide everyone who doesn't fit" },
              { icon: 'pulse-outline',             title: 'Vibe Check',             sub: 'We tell you if your energy naturally clicks before you match' },
              { icon: 'heart-circle-outline',      title: 'Personality Match',      sub: 'Filter by love language, attachment style or personality type' },
              { icon: 'time-outline',              title: 'Best Time to Be Active', sub: 'We show the exact times to go online for the most views and likes' },
            ].map(f => (
              <Squircle key={f.title} style={[styles.filterCard, { flexDirection: 'row', alignItems: 'center', gap: 14 }]} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
                <Squircle style={styles.proAiIcon} cornerRadius={14} cornerSmoothing={1} fillColor={colors.surface2}>
                  <Ionicons name={f.icon as any} size={20} color={colors.text} />
                </Squircle>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.proAiTitle, { color: colors.text }]}>{f.title}</Text>
                  <Text style={[styles.proAiSub, { color: colors.textSecondary }]}>{f.sub}</Text>
                </View>
                <Ionicons name="checkmark-circle" size={16} color={colors.text} />
              </Squircle>
            ))}
          </ScrollView>

        ) : (
          /* ── Pro tab — locked (non-pro user) ── */
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 120, gap: 14 }} showsVerticalScrollIndicator={false}>

            <Squircle style={styles.proHeaderCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <View style={styles.proHeaderRow}>
                <Squircle style={styles.proHeaderIcon} cornerRadius={14} cornerSmoothing={1} fillColor={colors.surface2}>
                  <Ionicons name="sparkles" size={20} color={colors.text} />
                </Squircle>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.proHeaderTitle, { color: colors.text }]}>Pro Filters</Text>
                  <Text style={[styles.proHeaderSub, { color: colors.textSecondary }]}>10 advanced filters + AI features</Text>
                </View>
                <Squircle style={styles.proLockBadge} cornerRadius={10} cornerSmoothing={1} fillColor={colors.surface2}>
                  <Ionicons name="lock-closed" size={13} color={colors.textSecondary} />
                </Squircle>
              </View>
            </Squircle>

            <Text style={[styles.filterSecHead, { color: colors.textSecondary, marginLeft: 2 }]}>ADVANCED FILTERS</Text>

            {[
              { title: 'RELATIONSHIP INTENT', items: RELATIONSHIP_TYPES.map(v => v.label) },
              { title: 'LOOKING FOR',         items: LOOKUP.looking_for.map(v => v.label) },
              { title: 'EDUCATION LEVEL',     items: LOOKUP.education_level.map(v => v.label) },
              { title: 'FAMILY PLANS',        items: LOOKUP.family_plans.map(v => v.label) },
              { title: 'HAVE KIDS',           items: LOOKUP.have_kids.map(v => v.label) },
            ].map(sec => (
              <Squircle key={sec.title} style={styles.filterCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
                <View style={styles.proFeatureRow}>
                  <Text style={[styles.filterSecHead, { color: colors.textSecondary }]}>{sec.title}</Text>
                  <Ionicons name="lock-closed" size={11} color={colors.textSecondary} />
                </View>
                <View style={[styles.filterChipRow, { marginTop: 12 }]}>
                  {sec.items.map(v => (
                    <Squircle key={v} style={styles.filterChip} cornerRadius={16} cornerSmoothing={1} fillColor={colors.surface2} strokeColor={colors.border} strokeWidth={1}>
                      <Text style={[styles.filterChipText, { color: colors.textSecondary }]}>{v}</Text>
                    </Squircle>
                  ))}
                </View>
              </Squircle>
            ))}

            <Text style={[styles.filterSecHead, { color: colors.textSecondary, marginLeft: 2, marginTop: 6 }]}>AI FEATURES</Text>

            {[
              { icon: 'analytics-outline',        title: 'Match Score',            sub: 'Every profile shows a % of how well you match — before you swipe' },
              { icon: 'shield-checkmark-outline',  title: 'Must-Haves Filter',      sub: "Set things you can't compromise on and we hide everyone who doesn't fit" },
              { icon: 'pulse-outline',             title: 'Vibe Check',             sub: 'We tell you if your energy naturally clicks before you match' },
              { icon: 'heart-circle-outline',      title: 'Personality Match',      sub: 'Filter by love language, attachment style or personality type' },
              { icon: 'time-outline',              title: 'Best Time to Be Active', sub: 'We show the exact times to go online for the most views and likes' },
            ].map(f => (
              <Squircle key={f.title} style={[styles.filterCard, { flexDirection: 'row', alignItems: 'center', gap: 14 }]} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
                <Squircle style={styles.proAiIcon} cornerRadius={14} cornerSmoothing={1} fillColor={colors.surface2}>
                  <Ionicons name={f.icon as any} size={20} color={colors.text} />
                </Squircle>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.proAiTitle, { color: colors.text }]}>{f.title}</Text>
                  <Text style={[styles.proAiSub, { color: colors.textSecondary }]}>{f.sub}</Text>
                </View>
                <Ionicons name="lock-closed" size={13} color={colors.textSecondary} />
              </Squircle>
            ))}
          </ScrollView>
        )}

        {/* Footer */}
        <View style={[styles.sheetFooter, { borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 20), backgroundColor: colors.bg, gap: 10 }]}>
          {activeTab === 'basic' ? (
            <>
              <Pressable onPress={() => setActiveTab('pro')}>
                <Squircle style={styles.upsellBanner} cornerRadius={18} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
                  <View style={styles.upsellLeft}>
                    <Squircle style={styles.upsellIconWrap} cornerRadius={12} cornerSmoothing={1} fillColor={colors.surface2}>
                      <Ionicons name="sparkles" size={15} color={colors.text} />
                    </Squircle>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.upsellTitle, { color: colors.text }]}>Unlock Advanced Filters</Text>
                      <Text style={[styles.upsellSub, { color: colors.textSecondary }]}>Education, lifestyle, looking for & more</Text>
                    </View>
                  </View>
                  <Squircle style={styles.upsellBtn} cornerRadius={12} cornerSmoothing={1} fillColor={colors.surface2} strokeColor={colors.border} strokeWidth={1}>
                    <Text style={[styles.upsellBtnText, { color: colors.text }]}>Pro</Text>
                  </Squircle>
                </Squircle>
              </Pressable>
              <Squircle cornerRadius={18} cornerSmoothing={1} fillColor={colors.text} style={styles.applyBtn}>
                <Pressable onPress={handleApply} disabled={saving} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={[styles.applyBtnText, { color: colors.bg }]}>{saving ? 'Saving…' : 'Apply Filters'}</Text>
                </Pressable>
              </Squircle>
            </>
          ) : isPro ? (
            <Squircle cornerRadius={18} cornerSmoothing={1} fillColor={colors.text} style={styles.applyBtn}>
              <Pressable onPress={handleApply} disabled={saving} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={[styles.applyBtnText, { color: colors.bg }]}>{saving ? 'Saving…' : 'Apply Filters'}</Text>
              </Pressable>
            </Squircle>
          ) : (
            <Squircle cornerRadius={18} cornerSmoothing={1} fillColor={colors.surface2} strokeColor={colors.border} strokeWidth={1} style={[styles.applyBtn, { opacity: 0.6 }]}>
              <Pressable onPress={() => router.push('/subscription')} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Ionicons name="lock-closed" size={14} color={colors.textSecondary} />
                <Text style={[styles.applyBtnText, { color: colors.textSecondary }]}>Unlock Pro</Text>
              </Pressable>
            </Squircle>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  sheetContainer: { flex: 1 },
  sheetHeader:    { paddingHorizontal: 20, paddingBottom: 12 },
  sheetHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sheetClose:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  sheetTitle:     { fontSize: 16, fontFamily: 'ProductSans-Bold' },
  sheetResetText: { fontSize: 14, fontFamily: 'ProductSans-Regular' },
  filterTabRow:   { flexDirection: 'row', gap: 8 },
  filterTabPill:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 50 },
  filterTabText:  { fontSize: 13, fontFamily: 'ProductSans-Bold' },
  filterCard:     { padding: 16 },
  filterChipRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7 },
  filterChipText: { fontSize: 12, fontFamily: 'ProductSans-Regular' },
  filterRowIcon:  { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  filterRowTitle: { fontSize: 14, fontFamily: 'ProductSans-Bold' },
  filterRowSub:   { fontSize: 12, fontFamily: 'ProductSans-Regular', marginTop: 1 },
  verifyGateBadge:{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6 },
  verifyGateText: { fontSize: 11, fontFamily: 'ProductSans-Bold' },
  filterSecHead:  { fontSize: 11, fontFamily: 'ProductSans-Bold', letterSpacing: 1.2 },
  sliderLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sliderValue:    { fontSize: 13, fontFamily: 'ProductSans-Bold' },
  sliderRow:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sliderSub:      { fontSize: 11, fontFamily: 'ProductSans-Regular' },
  sliderEdgeRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sliderEdge:     { fontSize: 11, fontFamily: 'ProductSans-Regular' },
  proHeaderCard:  { padding: 16 },
  proHeaderRow:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  proHeaderIcon:  { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  proHeaderTitle: { fontSize: 15, fontFamily: 'ProductSans-Bold' },
  proHeaderSub:   { fontSize: 12, fontFamily: 'ProductSans-Regular', marginTop: 1 },
  proLockBadge:   { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  proFeatureRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  proAiIcon:      { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  proAiTitle:     { fontSize: 14, fontFamily: 'ProductSans-Bold' },
  proAiSub:       { fontSize: 12, fontFamily: 'ProductSans-Regular', marginTop: 2, lineHeight: 17 },
  sheetFooter:    { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, paddingHorizontal: 16 },
  upsellBanner:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, gap: 10 },
  upsellLeft:     { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  upsellIconWrap: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  upsellTitle:    { fontSize: 13, fontFamily: 'ProductSans-Bold' },
  upsellSub:      { fontSize: 11, fontFamily: 'ProductSans-Regular', marginTop: 1 },
  upsellBtn:      { paddingHorizontal: 14, paddingVertical: 7 },
  upsellBtnText:  { fontSize: 12, fontFamily: 'ProductSans-Bold' },
  applyBtn:       { height: 52 },
  applyBtnText:   { fontSize: 15, fontFamily: 'ProductSans-Bold' },
});
