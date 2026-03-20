import { navPush, navReplace } from '@/utils/nav';
/**
 * WorkFilterSheet — filters for Zod Work mode.
 *
 * All chip options are loaded from the DB via the shared workLookups utility.
 * Every selection is tracked by DB row ID (ChipOption.value), so "Apply"
 * delivers stable IDs that can be sent directly to filter API calls.
 *
 * Pro tab is gated server-side: only shown as active when the user's
 * subscription_tier (from backend /profile/me) equals "pro".
 */
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import SliderRN from '@react-native-community/slider';
import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import Squircle from '@/components/ui/Squircle';
import { useAuth } from '@/context/AuthContext';
import { fetchWorkLookups, getCachedWorkLookups } from '@/utils/workLookups';
import type { WorkLookupMap } from '@/utils/workLookups';
import type { ChipOption } from '@/components/ui/ChipSelectorSheet';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WorkFilters {
  distance: number;
  verifiedOnly: boolean;
  hiringOnly: boolean;
  priorityStartup: boolean;
  /** All arrays contain DB row IDs (ChipOption.value strings) */
  industries: string[];
  skills: string[];
  commitmentLevels: string[];
  whoToSee: string[];
  matchingGoals: string[];
  equityPrefs: string[];
  stages: string[];
  roles: string[];
}

// ─── Filter Chip (ID-aware) ───────────────────────────────────────────────────

function FilterChip({ option, selected, onPress, colors, locked = false }: {
  option: ChipOption; selected: boolean; onPress: () => void; colors: any; locked?: boolean;
}) {
  return (
    <Pressable onPress={locked ? undefined : onPress} style={{ opacity: locked ? 0.45 : 1 }}>
      <Squircle
        style={styles.filterChip}
        cornerRadius={16} cornerSmoothing={1}
        fillColor={selected ? colors.text : colors.surface2}
        strokeColor={selected ? colors.text : colors.border}
        strokeWidth={1}
      >
        {option.emoji ? <Text style={{ fontSize: 13 }}>{option.emoji}</Text> : null}
        <Text style={[styles.filterChipText, { color: selected ? colors.bg : colors.text }]}>
          {option.label}
        </Text>
      </Squircle>
    </Pressable>
  );
}

// ─── WorkFilterSheet ──────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
  colors: any;
  insets: any;
  onApply?: (filters: WorkFilters) => void;
}

export default function WorkFilterSheet({ visible, onClose, colors, insets, onApply }: Props) {
  const router = useRouter();
  const { profile } = useAuth();
  const isPro = profile?.subscription_tier === 'pro';
  const isFaceVerified = profile?.verification_status === 'verified';
  const isDark = colors.bg === '#000000';

  // ── Lookups from DB ───────────────────────────────────────────────────────
  const [lookups, setLookups] = useState<WorkLookupMap>(getCachedWorkLookups() ?? {});
  const lookupsLoaded = useRef(false);
  useEffect(() => {
    if (lookupsLoaded.current) return;
    lookupsLoaded.current = true;
    fetchWorkLookups().then(setLookups);
  }, []);
  const opts = (cat: string): ChipOption[] => lookups[cat] ?? [];

  // ── UI state ──────────────────────────────────────────────────────────────
  const [activeTab,    setActiveTab]    = useState<'basic' | 'pro'>('basic');

  // Filter state — all chip arrays store DB IDs (ChipOption.value)
  const [verifiedOnly,     setVerifiedOnly]     = useState(false);
  const [distance,         setDistance]         = useState(80);
  const [industries,       setIndustries]       = useState<string[]>([]);
  const [skills,           setSkills]           = useState<string[]>([]);
  const [commitment,       setCommitment]       = useState<string[]>([]);
  const [whoToSee,         setWhoToSee]         = useState<string[]>([]);
  const [wMatchGoals,      setWMatchGoals]      = useState<string[]>([]);
  const [wEquity,          setWEquity]          = useState<string[]>([]);
  const [wStage,           setWStage]           = useState<string[]>([]);
  const [wRole,            setWRole]            = useState<string[]>([]);
  const [wHiringOnly,      setWHiringOnly]      = useState(false);
  const [wPriorityStartup, setWPriorityStartup] = useState(false);

  const toggle = (arr: string[], set: (v: string[]) => void, id: string) =>
    set(arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id]);

  const reset = () => {
    setVerifiedOnly(false); setDistance(80);
    setIndustries([]); setSkills([]); setCommitment([]); setWhoToSee([]);
    setWMatchGoals([]); setWEquity([]); setWStage([]); setWRole([]);
    setWHiringOnly(false); setWPriorityStartup(false);
  };

  const applyFilters = () => {
    onApply?.({
      distance, verifiedOnly,
      hiringOnly: wHiringOnly, priorityStartup: wPriorityStartup,
      industries, skills, commitmentLevels: commitment, whoToSee,
      matchingGoals: wMatchGoals, equityPrefs: wEquity, stages: wStage, roles: wRole,
    });
    onClose();
  };

  const SecHead = ({ title }: { title: string }) => (
    <Text style={[styles.filterSecHead, { color: colors.textSecondary }]}>{title}</Text>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.sheetContainer, { backgroundColor: colors.bg }]}>

        {/* ── Header ── */}
        <LinearGradient
          colors={isDark ? ['#1a1a1a','#111111','#000000'] : ['#e8e8ed','#f2f2f7','#ffffff']}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          style={[styles.sheetHeader, { paddingTop: insets.top + 10 }]}
        >
          <View style={styles.sheetHeaderRow}>
            <Pressable onPress={onClose} style={({ pressed }) => [styles.sheetClose, pressed && { opacity: 0.6 }]}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Work Filters</Text>
            <Pressable onPress={reset} hitSlop={8}>
              <Text style={[styles.sheetResetText, { color: colors.textSecondary }]}>Reset</Text>
            </Pressable>
          </View>

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

        {/* ── Basic tab ── */}
        {activeTab === 'basic' ? (
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 120, gap: 14 }} showsVerticalScrollIndicator={false}>

            {/* Distance */}
            <Squircle style={styles.filterCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <View style={styles.sliderLabelRow}>
                <SecHead title="MAX DISTANCE" />
                <Text style={[styles.sliderValue, { color: colors.text }]}>{`${distance} km`}</Text>
              </View>
              <View style={[styles.sliderRow, { marginTop: 10 }]}>
                <Text style={[styles.sliderSub, { color: colors.textSecondary }]}>1 km</Text>
                <SliderRN style={{ flex: 1 }} minimumValue={1} maximumValue={80} step={1} value={distance}
                  onValueChange={v => setDistance(Math.round(v))}
                  minimumTrackTintColor={colors.text} maximumTrackTintColor={colors.surface2} thumbTintColor={colors.text} />
                <Text style={[styles.sliderSub, { color: colors.textSecondary }]}>80 km</Text>
              </View>
            </Squircle>

            {/* Verified only — requires own face scan to be verified */}
            <Pressable
              onPress={() => !isFaceVerified && navPush('/verification' as any)}
              disabled={isFaceVerified}
              style={({ pressed }) => [{ opacity: pressed && !isFaceVerified ? 0.75 : 1 }]}
            >
              <Squircle
                style={[styles.filterCard, { gap: 12 }]}
                cornerRadius={22} cornerSmoothing={1}
                fillColor={isFaceVerified ? colors.surface : 'rgba(34,197,94,0.06)'}
                strokeColor={isFaceVerified ? colors.border : 'rgba(34,197,94,0.3)'}
                strokeWidth={1}
              >
                {/* Top row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Squircle
                    style={styles.filterRowIcon}
                    cornerRadius={12} cornerSmoothing={1}
                    fillColor={isFaceVerified ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.12)'}
                  >
                    <Ionicons
                      name={isFaceVerified ? 'shield-checkmark' : 'scan-outline'}
                      size={18}
                      color="#22c55e"
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
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', gap: 10,
                    backgroundColor: 'rgba(34,197,94,0.1)',
                    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10,
                  }}>
                    <Ionicons name="camera-outline" size={16} color="#22c55e" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontFamily: 'ProductSans-Bold', color: '#22c55e' }}>
                        Verify your face to unlock
                      </Text>
                      <Text style={{ fontSize: 11, fontFamily: 'ProductSans-Regular', color: 'rgba(34,197,94,0.75)', marginTop: 1 }}>
                        Takes 30 seconds · Your face is never stored
                      </Text>
                    </View>
                    <View style={{
                      flexDirection: 'row', alignItems: 'center', gap: 4,
                      backgroundColor: '#22c55e', borderRadius: 20,
                      paddingHorizontal: 12, paddingVertical: 6,
                    }}>
                      <Text style={{ fontSize: 12, fontFamily: 'ProductSans-Bold', color: '#000' }}>Start</Text>
                      <Ionicons name="arrow-forward" size={12} color="#000" />
                    </View>
                  </View>
                )}
              </Squircle>
            </Pressable>
            </Squircle>

            {/* Industries — from DB */}
            <Squircle style={styles.filterCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <SecHead title="INDUSTRIES" />
              <View style={[styles.filterChipRow, { marginTop: 12 }]}>
                {opts('work_industries').map(o => (
                  <FilterChip key={o.value} option={o} selected={industries.includes(o.value!)}
                    onPress={() => toggle(industries, setIndustries, o.value!)} colors={colors} />
                ))}
              </View>
            </Squircle>

            {/* Skills — from DB */}
            <Squircle style={styles.filterCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <SecHead title="SKILLS" />
              <View style={[styles.filterChipRow, { marginTop: 12 }]}>
                {opts('work_skills').map(o => (
                  <FilterChip key={o.value} option={o} selected={skills.includes(o.value!)}
                    onPress={() => toggle(skills, setSkills, o.value!)} colors={colors} />
                ))}
              </View>
            </Squircle>

            {/* Commitment Level — from DB */}
            <Squircle style={styles.filterCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <SecHead title="COMMITMENT LEVEL" />
              <View style={[styles.filterChipRow, { marginTop: 12 }]}>
                {opts('work_commitment_level').map(o => (
                  <FilterChip key={o.value} option={o} selected={commitment.includes(o.value!)}
                    onPress={() => toggle(commitment, setCommitment, o.value!)} colors={colors} />
                ))}
              </View>
            </Squircle>

            {/* Who to see — from DB (single-select) */}
            <Squircle style={styles.filterCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <SecHead title="WHO I WANT TO SEE" />
              <View style={[styles.filterChipRow, { marginTop: 12 }]}>
                {opts('work_who_to_show').map(o => (
                  <FilterChip key={o.value} option={o} selected={whoToSee.includes(o.value!)}
                    onPress={() => setWhoToSee([o.value!])} colors={colors} />
                ))}
              </View>
            </Squircle>

          </ScrollView>

        ) : isPro ? (
          /* ── Pro tab — unlocked ── */
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 120, gap: 14 }} showsVerticalScrollIndicator={false}>

            <Squircle style={styles.proHeaderCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <View style={styles.proHeaderRow}>
                <Squircle style={styles.proHeaderIcon} cornerRadius={14} cornerSmoothing={1} fillColor={colors.text}>
                  <Ionicons name="sparkles" size={20} color={colors.bg} />
                </Squircle>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.proHeaderTitle, { color: colors.text }]}>Pro Filters</Text>
                  <Text style={[styles.proHeaderSub, { color: colors.textSecondary }]}>Advanced work filters — all unlocked</Text>
                </View>
                <Squircle style={styles.proLockBadge} cornerRadius={10} cornerSmoothing={1} fillColor={colors.text}>
                  <Ionicons name="checkmark" size={13} color={colors.bg} />
                </Squircle>
              </View>
            </Squircle>

            <Text style={[styles.filterSecHead, { color: colors.textSecondary, marginLeft: 2 }]}>ADVANCED FILTERS</Text>

            {/* Matching Goals — from DB */}
            <Squircle style={styles.filterCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <SecHead title="MATCHING GOALS" />
              <View style={[styles.filterChipRow, { marginTop: 12 }]}>
                {opts('work_matching_goals').map(o => (
                  <FilterChip key={o.value} option={o} selected={wMatchGoals.includes(o.value!)}
                    onPress={() => toggle(wMatchGoals, setWMatchGoals, o.value!)} colors={colors} />
                ))}
              </View>
            </Squircle>

            {/* Equity Preference — from DB */}
            <Squircle style={styles.filterCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <SecHead title="EQUITY PREFERENCE" />
              <View style={[styles.filterChipRow, { marginTop: 12 }]}>
                {opts('work_equity_split').map(o => (
                  <FilterChip key={o.value} option={o} selected={wEquity.includes(o.value!)}
                    onPress={() => toggle(wEquity, setWEquity, o.value!)} colors={colors} />
                ))}
              </View>
            </Squircle>

            {/* Startup Stage — from DB */}
            <Squircle style={styles.filterCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <SecHead title="STARTUP STAGE" />
              <View style={[styles.filterChipRow, { marginTop: 12 }]}>
                {opts('work_stage').map(o => (
                  <FilterChip key={o.value} option={o} selected={wStage.includes(o.value!)}
                    onPress={() => toggle(wStage, setWStage, o.value!)} colors={colors} />
                ))}
              </View>
            </Squircle>

            {/* Co-founder Role — from DB */}
            <Squircle style={styles.filterCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <SecHead title="CO-FOUNDER ROLE" />
              <View style={[styles.filterChipRow, { marginTop: 12 }]}>
                {opts('work_role').map(o => (
                  <FilterChip key={o.value} option={o} selected={wRole.includes(o.value!)}
                    onPress={() => toggle(wRole, setWRole, o.value!)} colors={colors} />
                ))}
              </View>
            </Squircle>

            <Squircle style={[styles.filterCard, { flexDirection: 'row', alignItems: 'center', gap: 12 }]} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <Squircle style={styles.filterRowIcon} cornerRadius={12} cornerSmoothing={1} fillColor={colors.surface2}>
                <Ionicons name="megaphone-outline" size={18} color={colors.text} />
              </Squircle>
              <View style={{ flex: 1 }}>
                <Text style={[styles.filterRowTitle, { color: colors.text }]}>Actively Hiring</Text>
                <Text style={[styles.filterRowSub, { color: colors.textSecondary }]}>Show only people who are hiring</Text>
              </View>
              <Switch value={wHiringOnly} onValueChange={setWHiringOnly} thumbColor={colors.bg} trackColor={{ false: colors.surface2, true: colors.text }} />
            </Squircle>

            <Squircle style={[styles.filterCard, { flexDirection: 'row', alignItems: 'center', gap: 12 }]} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <Squircle style={styles.filterRowIcon} cornerRadius={12} cornerSmoothing={1} fillColor={colors.surface2}>
                <Ionicons name="rocket-outline" size={18} color={colors.text} />
              </Squircle>
              <View style={{ flex: 1 }}>
                <Text style={[styles.filterRowTitle, { color: colors.text }]}>Startup Experience Only</Text>
                <Text style={[styles.filterRowSub, { color: colors.textSecondary }]}>Prioritise people with startup background</Text>
              </View>
              <Switch value={wPriorityStartup} onValueChange={setWPriorityStartup} thumbColor={colors.bg} trackColor={{ false: colors.surface2, true: colors.text }} />
            </Squircle>

            <Text style={[styles.filterSecHead, { color: colors.textSecondary, marginLeft: 2, marginTop: 6 }]}>AI FEATURES</Text>

            {AI_FEATURES.map(f => (
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
          /* ── Pro tab — locked ── */
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 120, gap: 14 }} showsVerticalScrollIndicator={false}>

            <Squircle style={styles.proHeaderCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <View style={styles.proHeaderRow}>
                <Squircle style={styles.proHeaderIcon} cornerRadius={14} cornerSmoothing={1} fillColor={colors.surface2}>
                  <Ionicons name="sparkles" size={20} color={colors.text} />
                </Squircle>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.proHeaderTitle, { color: colors.text }]}>Pro Filters</Text>
                  <Text style={[styles.proHeaderSub, { color: colors.textSecondary }]}>Advanced work filters + AI features</Text>
                </View>
                <Squircle style={styles.proLockBadge} cornerRadius={10} cornerSmoothing={1} fillColor={colors.surface2}>
                  <Ionicons name="lock-closed" size={13} color={colors.textSecondary} />
                </Squircle>
              </View>
            </Squircle>

            <Text style={[styles.filterSecHead, { color: colors.textSecondary, marginLeft: 2 }]}>ADVANCED FILTERS</Text>

            {/* Show all locked sections with DB options (greyed out) */}
            {(['work_matching_goals','work_equity_split','work_stage','work_role'] as const).map(cat => (
              <Squircle key={cat} style={styles.filterCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
                <View style={styles.proFeatureRow}>
                  <SecHead title={CAT_TITLE[cat]} />
                  <Ionicons name="lock-closed" size={11} color={colors.textSecondary} />
                </View>
                <View style={[styles.filterChipRow, { marginTop: 12 }]}>
                  {opts(cat).map(o => (
                    <FilterChip key={o.value} option={o} selected={false} onPress={() => {}} colors={colors} locked />
                  ))}
                </View>
              </Squircle>
            ))}

            <Text style={[styles.filterSecHead, { color: colors.textSecondary, marginLeft: 2, marginTop: 6 }]}>AI FEATURES</Text>

            {AI_FEATURES.map(f => (
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

        {/* ── Footer ── */}
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
                      <Text style={[styles.upsellSub, { color: colors.textSecondary }]}>Matching goals, equity, stage & more</Text>
                    </View>
                  </View>
                  <Squircle style={styles.upsellBtn} cornerRadius={12} cornerSmoothing={1} fillColor={colors.surface2} strokeColor={colors.border} strokeWidth={1}>
                    <Text style={[styles.upsellBtnText, { color: colors.text }]}>Pro</Text>
                  </Squircle>
                </Squircle>
              </Pressable>
              <Squircle cornerRadius={18} cornerSmoothing={1} fillColor={colors.text} style={styles.applyBtn}>
                <Pressable onPress={applyFilters} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={[styles.applyBtnText, { color: colors.bg }]}>Apply Filters</Text>
                </Pressable>
              </Squircle>
            </>
          ) : isPro ? (
            <Squircle cornerRadius={18} cornerSmoothing={1} fillColor={colors.text} style={styles.applyBtn}>
              <Pressable onPress={applyFilters} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={[styles.applyBtnText, { color: colors.bg }]}>Apply Filters</Text>
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

// ─── Static data ──────────────────────────────────────────────────────────────

const CAT_TITLE: Record<string, string> = {
  work_matching_goals:  'MATCHING GOALS',
  work_equity_split:    'EQUITY PREFERENCE',
  work_stage:           'STARTUP STAGE',
  work_role:            'CO-FOUNDER ROLE',
};

const AI_FEATURES = [
  { icon: 'analytics-outline',        title: 'Co-founder Match Score',  sub: 'See a % compatibility score for every profile based on goals, skills, and commitment' },
  { icon: 'shield-checkmark-outline', title: 'Must-Haves Filter',       sub: 'Set non-negotiables (equity, stage, commitment) and hide everyone who doesn\'t fit' },
  { icon: 'pulse-outline',            title: 'Work Style Alignment',    sub: 'Flag how well your working styles naturally complement each other' },
  { icon: 'construct-outline',        title: 'Skill Gap Analysis',      sub: 'Find co-founders whose skills fill the exact gaps in your current team' },
  { icon: 'time-outline',             title: 'Best Time to Be Active',  sub: 'We tell you the optimal times to go online for the most visibility' },
];

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
