import { navPush, navReplace } from '@/utils/nav';
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
import { useLookups, type LookupOption } from '@/hooks/useLookups';

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

function FilterChip({ label, selected, onPress, colors }: {
  label: string; selected: boolean; onPress: () => void; colors: any;
}) {
  return (
    <Pressable onPress={onPress}>
      <Squircle style={styles.filterChip} cornerRadius={16} cornerSmoothing={1} fillColor={selected ? colors.text : colors.surface2} strokeColor={selected ? colors.text : colors.border} strokeWidth={1}>
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
  onNavigateToVerification?: () => void;
  colors: any;
  insets: any;
  halalMode?: boolean;   // when true, only the Halal tab is shown
}

export default function DateFilterSheet({ visible, onClose, onApply, onNavigateToVerification, colors, insets, halalMode = false }: Props) {
  const router = useRouter();
  const navGuardRef = useRef(false);
  const { profile, token, updateProfile } = useAuth();
  const isPro = profile?.subscription_tier === 'pro';
  const isFaceVerified = profile?.verification_status === 'verified';

  // ── Live lookup data from API (same source as EditProfilePage) ─────────────
  const { lookups } = useLookups();

  // Halal-specific fallbacks so filters always render even before DB is seeded
  const HALAL_FALLBACKS: Record<string, LookupOption[]> = {
    sect: [
      { id: -1, label: 'Sunni' }, { id: -2, label: 'Shia' },
      { id: -3, label: 'Sufi' },  { id: -4, label: 'Any' },
    ],
    prayer_frequency: [
      { id: -10, label: '5× Daily' }, { id: -11, label: 'Regularly' },
      { id: -12, label: 'Occasionally' },
    ],
    marriage_timeline: [
      { id: -20, label: 'ASAP' },       { id: -21, label: 'Within 1 year' },
      { id: -22, label: '1–3 years' },  { id: -23, label: 'Eventually' },
    ],
  };

  const lo = (cat: string): LookupOption[] =>
    (lookups[cat] && lookups[cat].length > 0)
      ? lookups[cat]
      : (HALAL_FALLBACKS[cat] ?? []);

  // Only users whose religion is specifically Islam/Muslim see the Halal tab.
  const religionLabel = profile?.religion_id
    ? (lookups['religion']?.find(r => r.id === profile.religion_id)?.label ?? '').toLowerCase()
    : '';
  const isMuslim = religionLabel.includes('muslim') || religionLabel.includes('islam');

  // When halal mode is on, default to halal tab and lock out basic/pro
  const [activeTab, setActiveTab] = useState<'basic' | 'pro' | 'halal'>(halalMode ? 'halal' : 'basic');

  // Re-sync tab when halalMode prop changes (e.g. user toggles mid-session)
  useEffect(() => {
    if (halalMode) setActiveTab('halal');
    else setActiveTab('basic');
  }, [halalMode]);
  const [saving,       setSaving]       = useState(false);

  // ── Filter state (initialised from saved profile on each open) ────────────
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [ageMin,       setAgeMin]       = useState(18);
  const [ageMax,       setAgeMax]       = useState(45);
  const [distance,     setDistance]     = useState(50);
  const [langs,        setLangs]        = useState<number[]>([]);
  const [signs,        setSigns]        = useState<number[]>([]);
  const [interests,    setInterests]    = useState<number[]>([]);
  // Basic lifestyle filters
  const [ethnicities,  setEthnicities]  = useState<number[]>([]);
  const [exercise,     setExercise]     = useState<number[]>([]);
  const [drinking,     setDrinking]     = useState<number[]>([]);
  const [smoking,      setSmoking]      = useState<number[]>([]);
  const [heightMin,    setHeightMin]    = useState(140);
  // Pro filter state (IDs)
  const [lookingFor,   setLookingFor]   = useState<number[]>([]);
  const [education,    setEducation]    = useState<number[]>([]);
  const [familyPlans,  setFamilyPlans]  = useState<number[]>([]);
  const [havingKids,   setHavingKids]   = useState<number[]>([]);
  // Halal filter state
  const [sectIds,           setSectIds]           = useState<number[]>([]);
  const [prayerFreqIds,     setPrayerFreqIds]     = useState<number[]>([]);
  const [marriageTimeIds,   setMarriageTimeIds]   = useState<number[]>([]);
  const [waliVerifiedOnly,  setWaliVerifiedOnly]  = useState(false);
  const [wantsToWork,       setWantsToWork]       = useState<boolean | null>(null);

  // Reset nav guard when sheet closes
  useEffect(() => {
    if (!visible) navGuardRef.current = false;
  }, [visible]);

  // Sync from saved profile whenever the sheet opens
  useEffect(() => {
    if (!visible || !profile) return;
    setVerifiedOnly(profile.filter_verified_only ?? false);
    setAgeMin(profile.filter_age_min ?? 18);
    setAgeMax(profile.filter_age_max ?? 80);
    setDistance(profile.filter_max_distance_km != null ? Math.min(profile.filter_max_distance_km, 80) : 80);
    setSigns(profile.filter_star_signs ?? []);
    setInterests(profile.filter_interests ?? []);
    setLangs(profile.filter_languages ?? []);
    setEthnicities(profile.filter_ethnicities ?? []);
    setExercise(profile.filter_exercise ?? []);
    setDrinking(profile.filter_drinking ?? []);
    setSmoking(profile.filter_smoking ?? []);
    setHeightMin(profile.filter_height_min ?? 140);
    setLookingFor(profile.filter_looking_for ?? []);
    setEducation(profile.filter_education_level ?? []);
    setFamilyPlans(profile.filter_family_plans ?? []);
    setHavingKids(profile.filter_have_kids ?? []);
    setSectIds(profile.filter_sect ?? []);
    setPrayerFreqIds(profile.filter_prayer_frequency ?? []);
    setMarriageTimeIds(profile.filter_marriage_timeline ?? []);
    setWaliVerifiedOnly(profile.filter_wali_verified_only ?? false);
    setWantsToWork(profile.filter_wants_to_work ?? null);
  }, [visible]);

  const toggle = (arr: number[], setArr: (v: number[]) => void, val: number) =>
    setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);

  const reset = () => {
    setVerifiedOnly(false); setAgeMin(18); setAgeMax(80); setDistance(80);
    setSigns([]); setInterests([]); setLangs([]); setEthnicities([]);
    setExercise([]); setDrinking([]); setSmoking([]); setHeightMin(140);
    setLookingFor([]); setEducation([]); setFamilyPlans([]); setHavingKids([]);
    setSectIds([]); setPrayerFreqIds([]); setMarriageTimeIds([]);
    setWaliVerifiedOnly(false); setWantsToWork(null);
  };

  const handleApply = async () => {
    if (!token) { onClose(); return; }
    setSaving(true);
    try {
      // Build patch — always include every basic filter so the backend
      // overwrites any stale values.  null = "clear / any".
      const patch: Record<string, any> = {
        filter_age_min:         ageMin <= 18 ? null : ageMin,
        filter_age_max:         ageMax >= 80 ? null : ageMax,
        filter_max_distance_km: distance >= 80 ? null : distance,
        filter_verified_only:   verifiedOnly,
        filter_star_signs:      signs.length     ? signs     : null,
        filter_interests:       interests.length ? interests : null,
        filter_languages:       langs.length     ? langs     : null,
        filter_ethnicities:     ethnicities.length ? ethnicities : null,
        filter_exercise:        exercise.length  ? exercise  : null,
        filter_drinking:        drinking.length  ? drinking  : null,
        filter_smoking:         smoking.length   ? smoking   : null,
        // height slider default (140) = "Any" → store null
        filter_height_min:      heightMin > 140 ? heightMin : null,
      };

      // Only send Pro-only filters when the user has Pro — avoids sending
      // useless nulls that the backend would silently strip anyway.
      if (isPro) {
        patch.filter_looking_for     = lookingFor.length  ? lookingFor  : null;
        patch.filter_education_level = education.length   ? education   : null;
        patch.filter_family_plans    = familyPlans.length ? familyPlans : null;
        patch.filter_have_kids       = havingKids.length  ? havingKids  : null;
      }

      // Halal filters — always sent when user is Muslim (free tier)
      if (isMuslim) {
        patch.filter_sect               = sectIds.length         ? sectIds         : null;
        patch.filter_prayer_frequency   = prayerFreqIds.length   ? prayerFreqIds   : null;
        patch.filter_marriage_timeline  = marriageTimeIds.length ? marriageTimeIds : null;
        patch.filter_wali_verified_only = waliVerifiedOnly;
        patch.filter_wants_to_work      = wantsToWork;
      }

      const updated = await apiFetch<any>('/profile/me/filters', {
        method: 'PATCH',
        token,
        body: JSON.stringify(patch),
      });

      updateProfile(updated);
      onApply();
      onClose();
    } catch (err: any) {
      Alert.alert('Could not save filters', err.message ?? 'Unknown error — please try again.');
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
            <Text style={[styles.sheetTitle, { color: colors.text }]}>{halalMode ? 'Halal Filters' : 'Discover'}</Text>
            <Pressable onPress={reset} hitSlop={8}>
              <Text style={[styles.sheetResetText, { color: colors.textSecondary }]}>Reset</Text>
            </Pressable>
          </View>

          {/* Tabs — in halal mode only the Halal tab is shown */}
          <View style={styles.filterTabRow}>
            {!halalMode && (
              <Pressable onPress={() => setActiveTab('basic')}>
                <View style={[styles.filterTabPill, activeTab === 'basic' && { backgroundColor: colors.text }]}>
                  <Text style={[styles.filterTabText, { color: activeTab === 'basic' ? colors.bg : colors.textSecondary }]}>Basic</Text>
                </View>
              </Pressable>
            )}
            {!halalMode && (
              <Pressable onPress={() => setActiveTab('pro')}>
                <View style={[styles.filterTabPill, activeTab === 'pro' && { backgroundColor: colors.text }]}>
                  <Ionicons name="sparkles" size={11} color={activeTab === 'pro' ? colors.bg : colors.textSecondary} style={{ marginRight: 4 }} />
                  <Text style={[styles.filterTabText, { color: activeTab === 'pro' ? colors.bg : colors.textSecondary }]}>Pro</Text>
                </View>
              </Pressable>
            )}
            {halalMode && (
              <Pressable disabled>
                <View style={[styles.filterTabPill, { backgroundColor: colors.text }]}>
                  <Text style={[styles.filterTabText, { color: colors.bg }]}>Halal</Text>
                </View>
              </Pressable>
            )}
          </View>
        </LinearGradient>

        {activeTab === 'basic' && !halalMode ? (
          /* ── Basic filters ── */
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 120, gap: 14 }} showsVerticalScrollIndicator={false}>

            {/* Age range */}
            <Squircle style={styles.filterCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <View style={styles.sliderLabelRow}>
                <SecHead title="AGE RANGE" />
                <Text style={[styles.sliderValue, { color: colors.text }]}>
                  {ageMin <= 18 && ageMax >= 80 ? 'Any' : `${ageMin} – ${ageMax}`}
                </Text>
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
                <Text style={[styles.sliderValue, { color: colors.text }]}>{distance >= 80 ? 'Any' : `${distance} km`}</Text>
              </View>
              <View style={[styles.sliderRow, { marginTop: 10 }]}>
                <Text style={[styles.sliderSub, { color: colors.textSecondary }]}>1 km</Text>
                <SliderRN
                  style={{ flex: 1 }}
                  minimumValue={1} maximumValue={80} step={1}
                  value={distance}
                  onValueChange={v => setDistance(Math.round(v))}
                  minimumTrackTintColor={colors.text}
                  maximumTrackTintColor={colors.surface2}
                  thumbTintColor={colors.text}
                />
                <Text style={[styles.sliderSub, { color: colors.textSecondary }]}>80 km</Text>
              </View>
            </Squircle>

            {/* Verified only */}
            <View>
              <Squircle
                style={[styles.filterCard, { gap: 12 }]}
                cornerRadius={22} cornerSmoothing={1}
                fillColor={colors.surface}
                strokeColor={colors.border}
                strokeWidth={1}
              >
                {/* Top row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Squircle
                    style={styles.filterRowIcon}
                    cornerRadius={12} cornerSmoothing={1}
                    fillColor={colors.surface2}
                  >
                    <Ionicons
                      name={isFaceVerified ? 'shield-checkmark' : 'scan-outline' as any}
                      size={18}
                      color={colors.textSecondary}
                    />
                  </Squircle>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.filterRowTitle, { color: colors.text }]}>Verified only</Text>
                    <Text style={[styles.filterRowSub, { color: colors.textSecondary }]}>
                      {isFaceVerified ? 'Show only face-verified profiles' : 'Only show verified profiles in your feed'}
                    </Text>
                  </View>
                  <Switch
                    value={isFaceVerified ? verifiedOnly : false}
                    onValueChange={isFaceVerified ? setVerifiedOnly : undefined}
                    disabled={!isFaceVerified}
                    thumbColor={isFaceVerified ? colors.bg : colors.surface2}
                    trackColor={{ false: colors.surface2, true: colors.text }}
                    style={{ opacity: isFaceVerified ? 1 : 0.35 }}
                  />
                </View>

                {/* Verification prompt banner — only shown when NOT verified */}
                {!isFaceVerified && (
                  <Pressable
                    onPress={() => {
                      if (navGuardRef.current) return;
                      navGuardRef.current = true;
                      if (onNavigateToVerification) {
                        onNavigateToVerification();
                      } else {
                        onClose();
                        setTimeout(() => { router.push({ pathname: '/verification', params: { tab: 'face' } } as any); navGuardRef.current = false; }, 350);
                      }
                    }}
                    style={({ pressed }) => [{
                      flexDirection: 'row', alignItems: 'center', gap: 10,
                      backgroundColor: colors.surface2,
                      borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10,
                      opacity: pressed ? 0.75 : 1,
                    }]}
                  >
                    <Ionicons name="camera-outline" size={16} color={colors.textSecondary} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontFamily: 'ProductSans-Bold', color: colors.text }}>
                        Verify your face to unlock
                      </Text>
                      <Text style={{ fontSize: 11, fontFamily: 'ProductSans-Regular', color: colors.textSecondary, marginTop: 1 }}>
                        Takes 30 seconds · Your face is never stored
                      </Text>
                    </View>
                    <View style={{
                      flexDirection: 'row', alignItems: 'center', gap: 4,
                      backgroundColor: colors.text, borderRadius: 20,
                      paddingHorizontal: 12, paddingVertical: 6,
                    }}>
                      <Text style={{ fontSize: 12, fontFamily: 'ProductSans-Bold', color: colors.bg }}>Start</Text>
                      <Ionicons name="arrow-forward" size={12} color={colors.bg} />
                    </View>
                  </Pressable>
                )}
              </Squircle>
            </View>

            {/* Interests */}
            <Squircle style={styles.filterCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <SecHead title="INTERESTS" />
              <View style={[styles.filterChipRow, { marginTop: 12 }]}>
                {lo('interests').map(v => (
                  <FilterChip key={v.id} label={v.label} selected={interests.includes(v.id)} onPress={() => toggle(interests, setInterests, v.id)} colors={colors} />
                ))}
              </View>
            </Squircle>

            {/* Languages */}
            <Squircle style={styles.filterCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <SecHead title="LANGUAGE" />
              <View style={[styles.filterChipRow, { marginTop: 12 }]}>
                {lo('language').map(v => (
                  <FilterChip key={v.id} label={v.label} selected={langs.includes(v.id)} onPress={() => toggle(langs, setLangs, v.id)} colors={colors} />
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

            {/* Min Height — single slider */}
            <Squircle style={styles.filterCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <View style={styles.sliderLabelRow}>
                <SecHead title="MIN HEIGHT" />
                <Text style={[styles.sliderValue, { color: colors.text }]}>
                  {heightMin <= 140 ? 'Any' : `≥ ${heightMin} cm`}
                </Text>
              </View>
              <View style={[styles.sliderRow, { marginTop: 10 }]}>
                <Text style={[styles.sliderSub, { color: colors.textSecondary }]}>Any</Text>
                <SliderRN
                  style={{ flex: 1 }}
                  minimumValue={140} maximumValue={220} step={1}
                  value={heightMin}
                  onValueChange={v => setHeightMin(Math.round(v))}
                  minimumTrackTintColor={colors.text}
                  maximumTrackTintColor={colors.surface2}
                  thumbTintColor={colors.text}
                />
                <Text style={[styles.sliderSub, { color: colors.textSecondary }]}>220 cm</Text>
              </View>
            </Squircle>

            {/* Ethnicity */}
            <Squircle style={styles.filterCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <SecHead title="ETHNICITY" />
              <View style={[styles.filterChipRow, { marginTop: 12 }]}>
                {lo('ethnicity').map(v => (
                  <FilterChip key={v.id} label={v.label} selected={ethnicities.includes(v.id)} onPress={() => toggle(ethnicities, setEthnicities, v.id)} colors={colors} />
                ))}
              </View>
            </Squircle>

            {/* Exercise */}
            <Squircle style={styles.filterCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <SecHead title="EXERCISE" />
              <View style={[styles.filterChipRow, { marginTop: 12 }]}>
                {lo('exercise').map(v => (
                  <FilterChip key={v.id} label={v.label} selected={exercise.includes(v.id)} onPress={() => toggle(exercise, setExercise, v.id)} colors={colors} />
                ))}
              </View>
            </Squircle>

            {/* Drinking */}
            <Squircle style={styles.filterCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <SecHead title="DRINKING" />
              <View style={[styles.filterChipRow, { marginTop: 12 }]}>
                {lo('drinking').map(v => (
                  <FilterChip key={v.id} label={v.label} selected={drinking.includes(v.id)} onPress={() => toggle(drinking, setDrinking, v.id)} colors={colors} />
                ))}
              </View>
            </Squircle>

            {/* Smoking */}
            <Squircle style={styles.filterCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <SecHead title="SMOKING" />
              <View style={[styles.filterChipRow, { marginTop: 12 }]}>
                {lo('smoking').map(v => (
                  <FilterChip key={v.id} label={v.label} selected={smoking.includes(v.id)} onPress={() => toggle(smoking, setSmoking, v.id)} colors={colors} />
                ))}
              </View>
            </Squircle>

            {/* Star sign */}
            <Squircle style={styles.filterCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <SecHead title="STAR SIGN" />
              <View style={[styles.filterChipRow, { marginTop: 12 }]}>
                {lo('star_sign').map(v => (
                  <FilterChip key={v.id} label={v.label} selected={signs.includes(v.id)} onPress={() => toggle(signs, setSigns, v.id)} colors={colors} />
                ))}
              </View>
            </Squircle>

            {/* Education level */}
            <Squircle style={styles.filterCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <SecHead title="EDUCATION LEVEL" />
              <View style={[styles.filterChipRow, { marginTop: 12 }]}>
                {lo('education_level').map(v => (
                  <FilterChip key={v.id} label={v.label} selected={education.includes(v.id)} onPress={() => toggle(education, setEducation, v.id)} colors={colors} />
                ))}
              </View>
            </Squircle>

            <Squircle style={styles.filterCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <SecHead title="LOOKING FOR" />
              <View style={[styles.filterChipRow, { marginTop: 12 }]}>
                {lo('looking_for').map(v => (
                  <FilterChip key={v.id} label={v.label} selected={lookingFor.includes(v.id)} onPress={() => toggle(lookingFor, setLookingFor, v.id)} colors={colors} />
                ))}
              </View>
            </Squircle>

            <Squircle style={styles.filterCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <SecHead title="FAMILY PLANS" />
              <View style={[styles.filterChipRow, { marginTop: 12 }]}>
                {lo('family_plans').map(v => (
                  <FilterChip key={v.id} label={v.label} selected={familyPlans.includes(v.id)} onPress={() => toggle(familyPlans, setFamilyPlans, v.id)} colors={colors} />
                ))}
              </View>
            </Squircle>

            <Squircle style={styles.filterCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <SecHead title="HAVE KIDS" />
              <View style={[styles.filterChipRow, { marginTop: 12 }]}>
                {lo('have_kids').map(v => (
                  <FilterChip key={v.id} label={v.label} selected={havingKids.includes(v.id)} onPress={() => toggle(havingKids, setHavingKids, v.id)} colors={colors} />
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

        ) : activeTab === 'pro' ? (
          /* ── Pro tab — locked (non-pro user) ── */
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 120, gap: 14 }} showsVerticalScrollIndicator={false}>

            <Squircle style={styles.proHeaderCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <View style={styles.proHeaderRow}>
                <Squircle style={styles.proHeaderIcon} cornerRadius={14} cornerSmoothing={1} fillColor={colors.surface2}>
                  <Ionicons name="sparkles" size={20} color={colors.text} />
                </Squircle>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.proHeaderTitle, { color: colors.text }]}>Pro Filters</Text>
                  <Text style={[styles.proHeaderSub, { color: colors.textSecondary }]}>Advanced filters + AI features</Text>
                </View>
                <Squircle style={styles.proLockBadge} cornerRadius={10} cornerSmoothing={1} fillColor={colors.surface2}>
                  <Ionicons name="lock-closed" size={13} color={colors.textSecondary} />
                </Squircle>
              </View>
            </Squircle>

            <Text style={[styles.filterSecHead, { color: colors.textSecondary, marginLeft: 2 }]}>ADVANCED FILTERS</Text>

            {[
              { title: 'MIN HEIGHT',          items: ['Any', '≥ 155 cm', '≥ 160 cm', '≥ 165 cm', '≥ 170 cm', '≥ 175 cm'] },
              { title: 'ETHNICITY',           items: lo('ethnicity').map(v => v.label) },
              { title: 'EXERCISE',            items: lo('exercise').map(v => v.label) },
              { title: 'DRINKING',            items: lo('drinking').map(v => v.label) },
              { title: 'SMOKING',             items: lo('smoking').map(v => v.label) },
              { title: 'STAR SIGN',           items: lo('star_sign').map(v => v.label) },
              { title: 'EDUCATION LEVEL',     items: lo('education_level').map(v => v.label) },
              { title: 'LOOKING FOR',         items: lo('looking_for').map(v => v.label) },
              { title: 'FAMILY PLANS',        items: lo('family_plans').map(v => v.label) },
              { title: 'HAVE KIDS',           items: lo('have_kids').map(v => v.label) },
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
        ) : null}

        {/* ── Halal filters tab ── */}
        {activeTab === 'halal' && (
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 120, gap: 14 }} showsVerticalScrollIndicator={false}>

            {/* Halal header */}
            <Squircle style={[styles.filterCard, { gap: 6 }]} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.filterRowTitle, { color: colors.text }]}>Halal Mode Filters</Text>
                  <Text style={[styles.filterRowSub, { color: colors.textSecondary }]}>
                    Only shown to other users in Halal mode
                  </Text>
                </View>
              </View>
            </Squircle>

            {/* Sect */}
            <Squircle style={styles.filterCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <SecHead title="SECT" />
              <View style={[styles.filterChipRow, { marginTop: 12 }]}>
                {lo('sect').map(v => (
                  <FilterChip
                    key={v.id} label={v.label}
                    selected={sectIds.includes(v.id)}
                    onPress={() => toggle(sectIds, setSectIds, v.id)}
                    colors={colors}
                  />
                ))}
              </View>
            </Squircle>

            {/* Prayer frequency */}
            <Squircle style={styles.filterCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <SecHead title="PRAYER FREQUENCY" />
              <View style={[styles.filterChipRow, { marginTop: 12 }]}>
                {lo('prayer_frequency').map(v => (
                  <FilterChip
                    key={v.id} label={v.label}
                    selected={prayerFreqIds.includes(v.id)}
                    onPress={() => toggle(prayerFreqIds, setPrayerFreqIds, v.id)}
                    colors={colors}
                  />
                ))}
              </View>
            </Squircle>

            {/* Marriage timeline */}
            <Squircle style={styles.filterCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <SecHead title="MARRIAGE TIMELINE" />
              <View style={[styles.filterChipRow, { marginTop: 12 }]}>
                {lo('marriage_timeline').map(v => (
                  <FilterChip
                    key={v.id} label={v.label}
                    selected={marriageTimeIds.includes(v.id)}
                    onPress={() => toggle(marriageTimeIds, setMarriageTimeIds, v.id)}
                    colors={colors}
                  />
                ))}
              </View>
            </Squircle>

            {/* Wali verified only */}
            <Squircle style={[styles.filterCard, { gap: 0 }]} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Squircle style={styles.filterRowIcon} cornerRadius={12} cornerSmoothing={1} fillColor={colors.surface2}>
                  <Ionicons name="shield-checkmark-outline" size={18} color={colors.textSecondary} />
                </Squircle>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.filterRowTitle, { color: colors.text }]}>Wali Verified Only</Text>
                  <Text style={[styles.filterRowSub, { color: colors.textSecondary }]}>
                    Only show profiles with a confirmed guardian
                  </Text>
                </View>
                <Switch
                  value={waliVerifiedOnly}
                  onValueChange={setWaliVerifiedOnly}
                  thumbColor={colors.bg}
                  trackColor={{ false: colors.surface2, true: colors.text }}
                />
              </View>
            </Squircle>

            {/* Wants to work */}
            <Squircle style={styles.filterCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <SecHead title="PARTNER CAREER" />
              <View style={[styles.filterChipRow, { marginTop: 12 }]}>
                {[
                  { label: 'No preference', value: null },
                  { label: 'Works / Career-focused', value: true },
                  { label: "Doesn't need to work", value: false },
                ].map(opt => (
                  <FilterChip
                    key={String(opt.value)}
                    label={opt.label}
                    selected={wantsToWork === opt.value}
                    onPress={() => setWantsToWork(opt.value)}
                    colors={colors}
                  />
                ))}
              </View>
            </Squircle>

          </ScrollView>
        )}

        {/* Footer */}
        <View style={[styles.sheetFooter, { borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 20), backgroundColor: colors.bg, gap: 10 }]}>
          {activeTab === 'halal' ? (
            <Squircle cornerRadius={18} cornerSmoothing={1} fillColor={colors.text} style={styles.applyBtn}>
              <Pressable onPress={handleApply} disabled={saving} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={[styles.applyBtnText, { color: colors.bg }]}>{saving ? 'Saving…' : 'Apply Halal Filters'}</Text>
              </Pressable>
            </Squircle>
          ) : activeTab === 'basic' && !halalMode ? (
            <>
              <Pressable onPress={() => setActiveTab('pro')}>
                <Squircle style={styles.upsellBanner} cornerRadius={18} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
                  <View style={styles.upsellLeft}>
                    <Squircle style={styles.upsellIconWrap} cornerRadius={12} cornerSmoothing={1} fillColor={colors.surface2}>
                      <Ionicons name="sparkles" size={15} color={colors.text} />
                    </Squircle>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.upsellTitle, { color: colors.text }]}>Unlock Advanced Filters</Text>
                      <Text style={[styles.upsellSub, { color: colors.textSecondary }]}>Height, ethnicity, lifestyle, star sign & more</Text>
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
              <Pressable onPress={() => navPush('/subscription')} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
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
