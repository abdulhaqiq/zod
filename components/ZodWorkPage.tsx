import { navPush, navReplace } from '@/utils/nav';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import ChipSelectorSheet, { type ChipOption } from '@/components/ui/ChipSelectorSheet';
import ScreenHeader from '@/components/ui/ScreenHeader';
import Squircle from '@/components/ui/Squircle';
import { apiFetch } from '@/constants/api';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';
import type { AppColors } from '@/constants/appColors';
import { fetchWorkLookups, getCachedWorkLookups, clearWorkLookupsCache, resolveLabel, resolveLabels, type WorkLookupMap } from '@/utils/workLookups';

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ title, colors }: { title: string; colors: AppColors }) {
  return <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{title}</Text>;
}

function Group({ children, colors }: { children: React.ReactNode; colors: AppColors }) {
  return (
    <Squircle style={styles.group} cornerRadius={22} cornerSmoothing={1}
      fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
      {children}
    </Squircle>
  );
}

function Row({
  icon, label, value, preview, onPress, colors, last = false,
}: {
  icon: any; label: string; value?: string; preview?: string;
  onPress?: () => void; colors: AppColors; last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
        pressed && { opacity: 0.65 },
      ]}
    >
      <Squircle style={styles.iconWrap} cornerRadius={10} cornerSmoothing={1} fillColor={colors.surface2}>
        <Ionicons name={icon as any} size={16} color={colors.text} />
      </Squircle>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
        {preview ? (
          <Text style={[styles.rowPreview, { color: colors.textSecondary }]} numberOfLines={2}>{preview}</Text>
        ) : null}
      </View>
      {value ? <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{value}</Text> : null}
      <Ionicons name="chevron-forward" size={15} color={colors.textSecondary} />
    </Pressable>
  );
}

function ToggleRow({
  icon, label, subtitle, value, onChange, colors, last = false,
}: {
  icon: any; label: string; subtitle?: string;
  value: boolean; onChange: (v: boolean) => void;
  colors: AppColors; last?: boolean;
}) {
  return (
    <View style={[
      styles.row,
      !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    ]}>
      <Squircle style={styles.iconWrap} cornerRadius={10} cornerSmoothing={1} fillColor={colors.surface2}>
        <Ionicons name={icon as any} size={16} color={colors.text} />
      </Squircle>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
        {subtitle ? (
          <Text style={[styles.rowPreview, { color: colors.textSecondary }]}>{subtitle}</Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={(v) => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onChange(v);
        }}
        thumbColor={colors.bg}
        trackColor={{ false: colors.surface2, true: colors.text }}
      />
    </View>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ZodWorkPage() {
  const router = useRouter();
  const { token, profile, updateProfile } = useAuth();
  const { colors } = useAppTheme();

  // ── Lookup options from DB ────────────────────────────────────────────────
  // Always bust the cache on mount so emoji-stripped data is fetched fresh
  clearWorkLookupsCache();
  const [lookups,      setLookups]      = useState<WorkLookupMap>({});
  const [lookupsReady, setLookupsReady] = useState(false);
  const lookupsLoaded = useRef(false);

  useEffect(() => {
    if (lookupsLoaded.current) return;
    lookupsLoaded.current = true;
    fetchWorkLookups().then((map) => {
      setLookups(map);
      setLookupsReady(true);
    });
  }, []);

  const opts = (cat: string): ChipOption[] => lookups[cat] ?? [];

  // ── Category groupings (label-based, applied at render time) ─────────────
  const SKILL_GROUPS: Record<string, string> = {
    // Technical
    'Engineering':       'Technical',
    'AI / ML':           'Technical',
    'AI/ML':             'Technical',
    'DevOps / Infra':    'Technical',
    'DevOps/Infra':      'Technical',
    'Cybersecurity':     'Technical',
    'Blockchain':        'Technical',
    'Mobile':            'Technical',
    'Data & Analytics':  'Technical',
    // Product & Design
    'Product':           'Product & Design',
    'Design':            'Product & Design',
    'Content':           'Product & Design',
    // Business
    'Sales':             'Business',
    'Marketing':         'Business',
    'Operations':        'Business',
    'Finance':           'Business',
    'Legal':             'Business',
    'Growth':            'Business',
    'Fundraising':       'Business',
    'Strategy':          'Business',
    'Business Development': 'Business',
    'Customer Success':  'Business',
  };

  const INDUSTRY_GROUPS: Record<string, string> = {
    // Technology
    'AI':                'Technology',
    'SaaS':              'Technology',
    'Developer Tools':   'Technology',
    'Mobile / Apps':     'Technology',
    'Cybersecurity':     'Technology',
    'Blockchain / Web3': 'Technology',
    'Cloud':             'Technology',
    'Hardware':          'Technology',
    // Business & Finance
    'Fintech':           'Finance & Commerce',
    'Finance':           'Finance & Commerce',
    'E-commerce':        'Finance & Commerce',
    'Real Estate':       'Finance & Commerce',
    'Insurance':         'Finance & Commerce',
    // Health & Life
    'HealthTech':        'Health & Science',
    'Biotech':           'Health & Science',
    'MedTech':           'Health & Science',
    'Mental Health':     'Health & Science',
    'FoodTech':          'Health & Science',
    // People & Society
    'EdTech':            'People & Society',
    'GovTech':           'People & Society',
    'LegalTech':         'People & Society',
    'Social Impact':     'People & Society',
    'Non-profit':        'People & Society',
    'Media':             'People & Society',
    'Entertainment':     'People & Society',
    'Sports':            'People & Society',
    // Consumer & Lifestyle
    'Consumer':          'Consumer & Lifestyle',
    'Fashion':           'Consumer & Lifestyle',
    'Travel':            'Consumer & Lifestyle',
    'Gaming':            'Consumer & Lifestyle',
    'Creator Economy':   'Consumer & Lifestyle',
    // Industry & Energy
    'CleanTech':         'Industry & Energy',
    'Energy':            'Industry & Energy',
    'Agriculture':       'Industry & Energy',
    'Manufacturing':     'Industry & Energy',
    'Logistics':         'Industry & Energy',
    'Construction':      'Industry & Energy',
    'SpaceTech':         'Industry & Energy',
  };

  /** Attaches a `group` field to each option based on label matching */
  const withGroups = (options: ChipOption[], map: Record<string, string>): ChipOption[] =>
    options.map(o => ({ ...o, group: map[o.label] ?? 'Other' }));

  // ── Chip picker ───────────────────────────────────────────────────────────
  interface ChipState {
    title: string; subtitle?: string; options: ChipOption[];
    selected: string[]; single?: boolean; onDone: (vals: string[]) => void;
  }
  const [chipPicker, setChipPicker] = useState<ChipState | null>(null);

  // Guard: open chip picker only when lookups are ready; otherwise show a toast
  const openChip = (state: ChipState) => {
    if (!lookupsReady) {
      Alert.alert('Loading…', 'Options are still loading, please try again in a moment.');
      return;
    }
    setChipPicker(state);
  };

  // ── Local state from profile — stored as string IDs for ChipSelectorSheet ──
  const [matchingGoals,     setMatchingGoals]     = useState<string[]>((profile?.work_matching_goals ?? []).map(String));
  const [hiring,            setHiring]            = useState<boolean>(profile?.work_are_you_hiring ?? false);
  const [commitmentLevel,   setCommitmentLevel]   = useState(profile?.work_commitment_level_id ? String(profile.work_commitment_level_id) : '');
  const [skills,            setSkills]            = useState<string[]>((profile?.work_skills ?? []).map(String));
  const [equitySplit,       setEquitySplit]        = useState(profile?.work_equity_split_id ? String(profile.work_equity_split_id) : '');
  const [industries,        setIndustries]        = useState<string[]>((profile?.work_industries ?? []).map(String));
  const [schedulingUrl,     setSchedulingUrl]     = useState(profile?.work_scheduling_url ?? '');
  const LI_PREFIX = 'https://www.linkedin.com/in/';
  const extractLiUsername = (url: string) =>
    url.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//i, '').replace(/\/$/, '');
  const [linkedInUrl,       setLinkedInUrl]       = useState(extractLiUsername(profile?.linkedin_url ?? ''));
  const [whoToShow,         setWhoToShow]         = useState(profile?.work_who_to_show_id ? String(profile.work_who_to_show_id) : '');
  const [priorityStartup,   setPriorityStartup]   = useState<boolean>(profile?.work_priority_startup ?? false);
  const [urlFocused,        setUrlFocused]        = useState(false);
  const [liUrlFocused,      setLiUrlFocused]      = useState(false);

  // ── New work profile fields ────────────────────────────────────────────────
  const [headline,          setHeadline]          = useState((profile as any)?.work_headline ?? '');
  const [persona,           setPersona]           = useState<string>((profile as any)?.work_persona ?? '');
  const [numFoundersId,     setNumFoundersId]     = useState((profile as any)?.work_num_founders_id ? String((profile as any).work_num_founders_id) : '');
  const [primaryRoleId,     setPrimaryRoleId]     = useState((profile as any)?.work_primary_role_id ? String((profile as any).work_primary_role_id) : '');
  const [yearsExpId,        setYearsExpId]        = useState((profile as any)?.work_years_experience_id ? String((profile as any).work_years_experience_id) : '');
  const [jobSearchStatusId, setJobSearchStatusId] = useState((profile as any)?.work_job_search_status_id ? String((profile as any).work_job_search_status_id) : '');
  const [headlineFocused,   setHeadlineFocused]   = useState(false);

  const showFounder    = !persona || persona === 'founder'    || persona === 'both';
  const showJobSeeker  = !persona || persona === 'job_seeker' || persona === 'both';

  // ── LinkedIn connect / verify ────────────────────────────────────────────
  const [linkedInVerified,  setLinkedInVerified]  = useState(profile?.linkedin_verified ?? false);
  const [linkedInLoading,   setLinkedInLoading]   = useState(false);

  const LINKEDIN_CLIENT_ID   = '86limpriduno69';
  const LINKEDIN_REDIRECT_URI = 'https://dev.zod.ailoo.co/api/v1/linkedin/callback';
  const LINKEDIN_DEEP_LINK    = 'zod://linkedin';

  const connectLinkedIn = async () => {
    setLinkedInLoading(true);
    try {
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: LINKEDIN_CLIENT_ID,
        redirect_uri: LINKEDIN_REDIRECT_URI,
        scope: 'openid profile email',
        state: Math.random().toString(36).slice(2),
      });
      const authUrl = `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
      const result = await WebBrowser.openAuthSessionAsync(authUrl, LINKEDIN_DEEP_LINK);
      if (result.type !== 'success' || !result.url) return;

      let code: string | undefined;
      try { code = new URL(result.url).searchParams.get('code') ?? undefined; }
      catch { code = result.url.match(/[?&]code=([^&]+)/)?.[1]; }
      if (!code || !token) return;

      const res = await apiFetch<{ linkedin_verified: boolean; linkedin_url: string | null }>(
        '/linkedin/verify',
        { method: 'POST', token, body: JSON.stringify({ code, redirect_uri: LINKEDIN_REDIRECT_URI }) },
      );
      setLinkedInVerified(res.linkedin_verified);
      if (res.linkedin_url) {
        setLinkedInUrl(extractLiUsername(res.linkedin_url));
        updateProfile({ linkedin_url: res.linkedin_url, linkedin_verified: true } as any);
      }
      Alert.alert('LinkedIn Connected', 'Your LinkedIn account is now linked. Tap "Import from LinkedIn" below to fill your work profile automatically.');
    } catch (e: any) {
      const msg: string = e?.message ?? '';
      if (msg.includes('503') || msg.toLowerCase().includes('not configured')) {
        Alert.alert('Not available', 'LinkedIn OAuth is not configured on the server. Enter your LinkedIn username manually and use "Import from LinkedIn" instead.');
      } else if (msg.includes('400')) {
        Alert.alert('Connection failed', 'LinkedIn returned an error. Please try again.');
      } else {
        Alert.alert('Error', msg || 'Could not connect LinkedIn. Please try again.');
      }
    } finally {
      setLinkedInLoading(false);
    }
  };

  const openLinkedInProfile = () => {
    const url = linkedInUrl.trim() ? `${LI_PREFIX}${linkedInUrl.trim()}` : (profile?.linkedin_url ?? '');
    if (url) WebBrowser.openBrowserAsync(url);
  };

  // Sync verified state from profile context
  useEffect(() => {
    setLinkedInVerified(profile?.linkedin_verified ?? false);
  }, [profile?.linkedin_verified]);

  // ── LinkedIn import ───────────────────────────────────────────────────────
  const [importing,       setImporting]       = useState(false);
  const [importResult,    setImportResult]    = useState<string[] | null>(null);
  const [importsUsed,     setImportsUsed]     = useState<number | null>(null);
  const [importsLimit,    setImportsLimit]    = useState<number | null>(null);

  // Compute limit from profile on load and after each import
  const MONTHLY_LIMITS: Record<string, number | null> = { free: 1, pro: 2, premium_plus: null };
  const profileTier = (profile?.subscription_tier as string | undefined) ?? 'free';
  const tierLimit   = MONTHLY_LIMITS[profileTier] ?? 1;

  // Derive effective used/limit: prefer live state (post-import), else fall back to profile
  const effectiveUsed  = importsUsed  ?? (profile?.linkedin_import_count as number | undefined) ?? 0;
  const effectiveLimit = importsLimit !== undefined ? importsLimit : tierLimit;
  const isAtImportLimit = effectiveLimit !== null && effectiveUsed >= effectiveLimit;

  const handleLinkedInImport = async () => {
    if (isAtImportLimit) {
      Alert.alert(
        'Monthly limit reached',
        `You've used all ${effectiveLimit} LinkedIn import${effectiveLimit === 1 ? '' : 's'} for this month. Upgrade your plan to import more.`
      );
      return;
    }
    const url = linkedInUrl.trim();
    if (!url) {
      Alert.alert('LinkedIn username required', 'Enter your LinkedIn username (e.g. john-doe) in the field above, then tap Import.');
      return;
    }
    // Save the URL first so the backend can find it
    const fullUrl = `${LI_PREFIX}${url}`;
    await save({ linkedin_url: fullUrl });

    setImporting(true);
    setImportResult(null);
    try {
      const res = await apiFetch<{ updated_fields: string[]; imports_used: number; imports_limit: number | null }>(
        '/linkedin/enrich', { method: 'POST', token: token ?? undefined }
      );
      const fields = res.updated_fields ?? [];
      setImportsUsed(res.imports_used ?? null);
      setImportsLimit(res.imports_limit ?? null);
      if (fields.length > 0) {
        const refreshed = await apiFetch<any>('/profile/me', { token: token ?? undefined });
        updateProfile(refreshed);
      }
      setImportResult(fields.length > 0
        ? fields.map((f: string) => f.replace(/_/g, ' '))
        : ['Nothing new to import — all fields already filled']
      );
    } catch (e: any) {
      const msg: string = e?.message ?? '';
      if (msg.includes('429') || msg.toLowerCase().includes('import_limit_reached')) {
        Alert.alert('Monthly limit reached', "You've used all your LinkedIn imports for this month. Upgrade your plan to import more.");
      } else if (msg.includes('503') || msg.toLowerCase().includes('not configured')) {
        Alert.alert('Import unavailable', 'LinkedIn import is not configured on the server yet. Contact support.');
      } else if (msg.includes('400') || msg.toLowerCase().includes('no linkedin url')) {
        Alert.alert('No LinkedIn URL', 'Save your LinkedIn username first, then try again.');
      } else if (msg.includes('422') || msg.toLowerCase().includes('scrape failed')) {
        Alert.alert('Could not import', 'LinkedIn profile is private or scraping is blocked. Try connecting via LinkedIn OAuth above.');
      } else {
        Alert.alert('Import failed', msg || 'Could not import from LinkedIn. Please try again.');
      }
    } finally {
      setImporting(false);
    }
  };

  // Sync when profile loads after mount
  useEffect(() => {
    if (!profile) return;
    setMatchingGoals((profile.work_matching_goals ?? []).map(String));
    setHiring(profile.work_are_you_hiring ?? false);
    setCommitmentLevel(profile.work_commitment_level_id ? String(profile.work_commitment_level_id) : '');
    setSkills((profile.work_skills ?? []).map(String));
    setEquitySplit(profile.work_equity_split_id ? String(profile.work_equity_split_id) : '');
    setIndustries((profile.work_industries ?? []).map(String));
    setSchedulingUrl(profile.work_scheduling_url ?? '');
    setLinkedInUrl(extractLiUsername(profile.linkedin_url ?? ''));
    setWhoToShow(profile.work_who_to_show_id ? String(profile.work_who_to_show_id) : '');
    setPriorityStartup(profile.work_priority_startup ?? false);
    const p = profile as any;
    setHeadline(p.work_headline ?? '');
    setPersona(p.work_persona ?? '');
    setNumFoundersId(p.work_num_founders_id ? String(p.work_num_founders_id) : '');
    setPrimaryRoleId(p.work_primary_role_id ? String(p.work_primary_role_id) : '');
    setYearsExpId(p.work_years_experience_id ? String(p.work_years_experience_id) : '');
    setJobSearchStatusId(p.work_job_search_status_id ? String(p.work_job_search_status_id) : '');
  }, [profile?.id]);

  // ── Save helper ───────────────────────────────────────────────────────────
  const save = async (fields: Record<string, unknown>) => {
    if (!Object.keys(fields).length) return;
    try {
      await apiFetch('/profile/me', {
        method: 'PATCH', token: token ?? undefined,
        body: JSON.stringify(fields),
      });
      updateProfile(fields as any);
    } catch {
      Alert.alert('Error', 'Failed to save. Please try again.');
    }
  };

  // ── Preview helpers: resolve DB IDs → human-readable labels ──────────────
  // Return '—' when the category hasn't loaded yet (prevents raw IDs showing)
  const previewOne = (cat: string, id: string) => {
    if (!id) return '—';
    const opts = lookups[cat];
    if (!opts?.length) return '—';  // lookups still loading
    return resolveLabel(lookups, cat, id);
  };
  const previewList = (cat: string, ids: string[]) => {
    if (!ids.length) return 'Not set';
    const opts = lookups[cat];
    if (!opts?.length) return '—';  // lookups still loading
    return resolveLabels(lookups, cat, ids).join(', ');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title="Zod Work" />
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── WORK PROFILE — temporarily hidden
        <View style={styles.section}>
          <SectionLabel title="WORK PROFILE" colors={colors} />
          <Group colors={colors}>
            <Row
              icon="create-outline"
              label="Edit Work Profile"
              preview="Work photos & prompts"
              colors={colors}
              last
              onPress={() => navPush('/work-edit-profile')}
            />
          </Group>
        </View>
        */}

        {/* ── WORK HEADLINE — temporarily hidden
        <View style={styles.section}>
          <SectionLabel title="WORK HEADLINE" colors={colors} />
          <Group colors={colors}>
            <View style={{ padding: 14, gap: 8 }}>
              <TextInput
                value={headline}
                onChangeText={(v) => setHeadline(v.slice(0, 256))}
                onFocus={() => setHeadlineFocused(true)}
                onBlur={() => {
                  setHeadlineFocused(false);
                  save({ work_headline: headline.trim() || null });
                }}
                placeholder="e.g. Co-Founder & CEO at Ailoo, or Seeking Product Design roles"
                placeholderTextColor={colors.textSecondary}
                maxLength={256}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                style={{
                  fontSize: 14,
                  fontFamily: 'ProductSans-Regular',
                  color: colors.text,
                  minHeight: 72,
                  borderWidth: 1,
                  borderColor: headlineFocused ? colors.text : colors.border,
                  borderRadius: 10,
                  padding: 10,
                }}
              />
              <Text style={{ fontSize: 11, fontFamily: 'ProductSans-Regular', color: colors.textSecondary, textAlign: 'right' }}>
                {headline.length}/256
              </Text>
            </View>
          </Group>
        </View>
        */}

        {/* ── I AM A... — temporarily hidden
        <View style={styles.section}>
          <SectionLabel title="I AM A..." colors={colors} />
          <Group colors={colors}>
            {[
              { id: 'founder',    icon: 'rocket-outline',   label: 'Founder / Entrepreneur' },
              { id: 'job_seeker', icon: 'briefcase-outline', label: 'Talent / Job Seeker' },
              { id: 'both',       icon: 'people-outline',   label: 'Both' },
            ].map(({ id, icon, label }, idx, arr) => (
              <Pressable
                key={id}
                onPress={() => {
                  const next = persona === id ? '' : id;
                  setPersona(next);
                  save({ work_persona: next || null });
                }}
                style={({ pressed }) => [
                  styles.row,
                  idx < arr.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                  pressed && { opacity: 0.65 },
                ]}
              >
                <Squircle
                  style={styles.iconWrap} cornerRadius={10} cornerSmoothing={1}
                  fillColor={persona === id ? colors.text : colors.surface2}
                >
                  <Ionicons name={icon as any} size={16} color={persona === id ? colors.bg : colors.text} />
                </Squircle>
                <Text style={[styles.rowLabel, { color: colors.text, flex: 1 }]}>{label}</Text>
                {persona === id && (
                  <Ionicons name="checkmark-circle" size={20} color={colors.text} />
                )}
              </Pressable>
            ))}
          </Group>
        </View>
        */}

        {/* ── FOUNDER PROFILE — temporarily hidden */}
        {false && showFounder && (
          <View style={styles.section}>
            <SectionLabel title="FOUNDER PROFILE" colors={colors} />
            <Group colors={colors}>

              <Row
                icon="people-outline"
                label="Matching Goals"
                preview={previewList('work_matching_goals', matchingGoals)}
                colors={colors}
                onPress={() => openChip({
                  title: 'Matching Goals', subtitle: 'Select all that apply',
                  options: opts('work_matching_goals'), selected: matchingGoals, single: false,
                  onDone: (vals) => { setMatchingGoals(vals); save({ work_matching_goals: vals.map(Number) }); },
                })}
              />

              <Row
                icon="time-outline"
                label="Commitment Level"
                value={previewOne('work_commitment_level', commitmentLevel)}
                colors={colors}
                onPress={() => openChip({
                  title: 'Commitment Level',
                  options: opts('work_commitment_level'),
                  selected: commitmentLevel ? [commitmentLevel] : [], single: true,
                  onDone: ([v]) => { setCommitmentLevel(v); save({ work_commitment_level_id: Number(v) }); },
                })}
              />

              <Row
                icon="people-circle-outline"
                label="Number of Founders"
                value={previewOne('work_num_founders', numFoundersId)}
                colors={colors}
                onPress={() => openChip({
                  title: 'Number of Founders',
                  options: opts('work_num_founders'),
                  selected: numFoundersId ? [numFoundersId] : [], single: true,
                  onDone: ([v]) => { setNumFoundersId(v); save({ work_num_founders_id: Number(v) }); },
                })}
              />

              <Row
                icon="pie-chart-outline"
                label="Equity Split"
                value={previewOne('work_equity_split', equitySplit)}
                colors={colors}
                onPress={() => openChip({
                  title: 'Equity Split Preference',
                  options: opts('work_equity_split'),
                  selected: equitySplit ? [equitySplit] : [], single: true,
                  onDone: ([v]) => { setEquitySplit(v); save({ work_equity_split_id: Number(v) }); },
                })}
              />

              <ToggleRow
                icon="rocket-outline"
                label="Prioritise Startup Experience"
                subtitle="Show people with startup background first"
                value={priorityStartup}
                onChange={(v) => { setPriorityStartup(v); save({ work_priority_startup: v }); }}
                colors={colors}
                last
              />
            </Group>
          </View>
        )}

        {/* ── JOB SEEKER PROFILE — temporarily hidden */}
        {false && showJobSeeker && (
          <View style={styles.section}>
            <SectionLabel title="JOB SEEKER PROFILE" colors={colors} />
            <Group colors={colors}>

              <Row
                icon="search-outline"
                label="Job Search Status"
                value={previewOne('work_job_search_status', jobSearchStatusId)}
                colors={colors}
                onPress={() => openChip({
                  title: 'Job Search Status',
                  options: opts('work_job_search_status'),
                  selected: jobSearchStatusId ? [jobSearchStatusId] : [], single: true,
                  onDone: ([v]) => { setJobSearchStatusId(v); save({ work_job_search_status_id: Number(v) }); },
                })}
              />

              <Row
                icon="briefcase-outline"
                label="Primary Role"
                preview={previewOne('work_role', primaryRoleId)}
                colors={colors}
                onPress={() => openChip({
                  title: 'Primary Role', subtitle: 'Select your main position',
                  options: opts('work_role'),
                  selected: primaryRoleId ? [primaryRoleId] : [], single: true,
                  onDone: ([v]) => { setPrimaryRoleId(v); save({ work_primary_role_id: Number(v) }); },
                })}
              />

              <Row
                icon="timer-outline"
                label="Years of Experience"
                value={previewOne('work_years_experience', yearsExpId)}
                colors={colors}
                last
                onPress={() => openChip({
                  title: 'Years of Experience',
                  options: opts('work_years_experience'),
                  selected: yearsExpId ? [yearsExpId] : [], single: true,
                  onDone: ([v]) => { setYearsExpId(v); save({ work_years_experience_id: Number(v) }); },
                })}
              />
            </Group>
          </View>
        )}

        {/* ── SKILLS & EXPERIENCE ──────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionLabel title="SKILLS & EXPERIENCE" colors={colors} />
          <Group colors={colors}>
            <Row
              icon="construct-outline"
              label="Skills"
              preview={previewList('work_skills', skills)}
              colors={colors}
              onPress={() => openChip({
                title: 'Skills & Experience', subtitle: 'Select all that apply',
                options: withGroups(opts('work_skills'), SKILL_GROUPS), selected: skills, single: false,
                onDone: (vals) => { setSkills(vals); save({ work_skills: vals.map(Number) }); },
              })}
            />
            <Row
              icon="grid-outline"
              label="Industries & Interests"
              preview={previewList('work_industries', industries)}
              colors={colors}
              last
              onPress={() => openChip({
                title: 'Industries & Interests', subtitle: 'Select all that apply',
                options: withGroups(opts('work_industries'), INDUSTRY_GROUPS), selected: industries, single: false,
                onDone: (vals) => { setIndustries(vals); save({ work_industries: vals.map(Number) }); },
              })}
            />
          </Group>
        </View>

        {/* ── LINKEDIN ─────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionLabel title="LINKEDIN" colors={colors} />

          {/* ── Connect button — standalone Squircle, no borderRadius anywhere ── */}
          <Pressable
            onPress={linkedInVerified ? openLinkedInProfile : (linkedInLoading ? undefined : connectLinkedIn)}
            disabled={linkedInLoading}
            style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
          >
            <Squircle
              cornerRadius={22}
              cornerSmoothing={1}
              fillColor="#0A66C2"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 15 }}
            >
              <Squircle
                style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}
                cornerRadius={11} cornerSmoothing={1} fillColor="rgba(255,255,255,0.2)"
              >
                <Ionicons name="logo-linkedin" size={20} color="#fff" />
              </Squircle>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontFamily: 'ProductSans-Bold', color: '#fff' }}>
                  {linkedInVerified ? 'LinkedIn Connected ✓' : 'Connect LinkedIn'}
                </Text>
                <Text style={{ fontSize: 11, fontFamily: 'ProductSans-Regular', color: 'rgba(255,255,255,0.72)', marginTop: 2 }}>
                  {linkedInVerified
                    ? (linkedInUrl ? 'Tap to view profile' : 'Account connected')
                    : 'Verify to auto-fill your profile in one tap'}
                </Text>
              </View>
              {linkedInLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Squircle
                  style={{ paddingHorizontal: 14, paddingVertical: 8 }}
                  cornerRadius={20} cornerSmoothing={1}
                  fillColor={linkedInVerified ? 'rgba(255,255,255,0.2)' : '#fff'}
                >
                  <Text style={{ fontSize: 12, fontFamily: 'ProductSans-Bold', color: linkedInVerified ? '#fff' : '#0A66C2' }}>
                    {linkedInVerified ? 'View' : 'Connect'}
                  </Text>
                </Squircle>
              )}
            </Squircle>
          </Pressable>

          {/* ── Username + Import inside Group squircle ── */}
          <Group colors={colors}>

            {/* LinkedIn Username */}
            <View style={[styles.row, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
              <Squircle style={styles.iconWrap} cornerRadius={10} cornerSmoothing={1} fillColor="#0A66C2">
                <Text style={{ fontSize: 11, fontFamily: 'ProductSans-Black', color: '#fff' }}>in</Text>
              </Squircle>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.rowLabel, { color: colors.text }]}>LinkedIn Username</Text>
                  {linkedInVerified && (
                    <Ionicons name="checkmark-circle" size={14} color="#0A66C2" />
                  )}
                </View>
                <View style={[
                  styles.urlInput,
                  { flexDirection: 'row', alignItems: 'center', borderColor: liUrlFocused ? '#0A66C2' : colors.border, borderWidth: 1, paddingVertical: 0, paddingHorizontal: 8 },
                ]}>
                  <Text style={{ fontSize: 12, fontFamily: 'ProductSans-Regular', color: colors.textSecondary }}>
                    linkedin.com/in/
                  </Text>
                  <TextInput
                    value={linkedInUrl}
                    onChangeText={(v) => setLinkedInUrl(v.replace(/\s/g, ''))}
                    onFocus={() => setLiUrlFocused(true)}
                    onBlur={() => {
                      setLiUrlFocused(false);
                      const fullUrl = linkedInUrl.trim() ? `${LI_PREFIX}${linkedInUrl.trim()}` : '';
                      save({ linkedin_url: fullUrl });
                    }}
                    placeholder="yourname"
                    placeholderTextColor={colors.textSecondary}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    style={{ flex: 1, fontSize: 12, fontFamily: 'ProductSans-Regular', color: colors.text, paddingVertical: 6 }}
                  />
                </View>
              </View>
            </View>

            {/* Import from LinkedIn */}
            <View style={{ paddingHorizontal: 14, paddingVertical: 12, gap: 8 }}>
              <Pressable
                onPress={handleLinkedInImport}
                disabled={importing}
                style={({ pressed }) => ({ opacity: pressed || importing ? 0.7 : 1 })}
              >
                <Squircle
                  cornerRadius={14}
                  cornerSmoothing={1}
                  fillColor={isAtImportLimit ? colors.surface2 : '#0A66C2'}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 11, paddingHorizontal: 16 }}
                >
                  {importing ? (
                    <ActivityIndicator size="small" color={isAtImportLimit ? colors.textSecondary : '#fff'} />
                  ) : isAtImportLimit ? (
                    <Ionicons name="lock-closed-outline" size={14} color={colors.textSecondary} />
                  ) : (
                    <Squircle style={{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }} cornerRadius={6} cornerSmoothing={1} fillColor="#fff">
                      <Text style={{ fontSize: 10, fontFamily: 'ProductSans-Black', color: '#0A66C2' }}>in</Text>
                    </Squircle>
                  )}
                  <Text style={{ fontSize: 13, fontFamily: 'ProductSans-Bold', color: isAtImportLimit ? colors.textSecondary : '#fff' }}>
                    {importing ? 'Importing…' : isAtImportLimit ? `Limit reached (${effectiveUsed}/${effectiveLimit} this month)` : 'Import from LinkedIn'}
                  </Text>
                </Squircle>
              </Pressable>
              {isAtImportLimit && (
                <Text style={{ fontSize: 11, fontFamily: 'ProductSans-Regular', color: colors.textSecondary, textAlign: 'center' }}>
                  Upgrade to Pro for more imports
                </Text>
              )}
              {importResult && (
                <View style={{ backgroundColor: importResult[0].toLowerCase().startsWith('nothing') ? colors.surface2 : '#E8F4E8', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }}>
                  {importResult[0].toLowerCase().startsWith('nothing') ? (
                    <Text style={{ fontSize: 12, fontFamily: 'ProductSans-Regular', color: colors.textSecondary, textAlign: 'center' }}>
                      Nothing new to import — fields already filled
                    </Text>
                  ) : (
                    <>
                      <Text style={{ fontSize: 12, fontFamily: 'ProductSans-Bold', color: '#2E7D32', marginBottom: 2 }}>Imported successfully:</Text>
                      {importResult.map((f) => (
                        <Text key={f} style={{ fontSize: 12, fontFamily: 'ProductSans-Regular', color: '#2E7D32' }}>• {f}</Text>
                      ))}
                      {importsUsed !== null && (
                        <Text style={{ fontSize: 11, fontFamily: 'ProductSans-Regular', color: '#4CAF50', marginTop: 4 }}>
                          {importsLimit === null
                            ? `Import ${importsUsed} used (unlimited plan)`
                            : `${importsUsed}/${importsLimit} imports used this month`}
                        </Text>
                      )}
                    </>
                  )}
                </View>
              )}
              <Text style={{ fontSize: 11, fontFamily: 'ProductSans-Regular', color: colors.textSecondary, textAlign: 'center' }}>
                Enter your username above, then tap Import. Fills experience, education, bio & location.
              </Text>
            </View>

          </Group>
        </View>

        {/* ── EXPERIENCE ───────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionLabel title="EXPERIENCE" colors={colors} />
          <Group colors={colors}>
            {profile?.work_experience?.length ? (
              (profile.work_experience as any[]).map((exp: any, idx: number) => {
                const isLast = idx === (profile.work_experience?.length ?? 0) - 1;
                const years = (exp.start_year || exp.startYear)
                  ? ` · ${exp.start_year ?? exp.startYear}–${exp.current ? 'Present' : (exp.end_year ?? exp.endYear ?? '?')}`
                  : '';
                const singleLine = [exp.job_title || exp.jobTitle || 'Role', exp.company].filter(Boolean).join(' · ') + years;
                return (
                  <Pressable
                    key={idx}
                    onPress={() => navPush('/work-experience')}
                    style={({ pressed }) => [
                      styles.row,
                      !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                      pressed && { opacity: 0.65 },
                    ]}
                  >
                    {exp.company_logo ? (
                      <View style={[styles.iconWrap, { backgroundColor: '#fff', overflow: 'hidden', borderRadius: 10 }]}>
                        <Image
                          source={{ uri: exp.company_logo }}
                          style={{ width: 32, height: 32, borderRadius: 8 }}
                          resizeMode="contain"
                        />
                      </View>
                    ) : (
                      <Squircle style={styles.iconWrap} cornerRadius={10} cornerSmoothing={1} fillColor={colors.surface2}>
                        <Ionicons name="briefcase-outline" size={16} color={colors.text} />
                      </Squircle>
                    )}
                    <Text style={[styles.rowLabel, { color: colors.text, flex: 1 }]} numberOfLines={1}>
                      {singleLine}
                    </Text>
                    <Ionicons name="chevron-forward" size={15} color={colors.textSecondary} />
                  </Pressable>
                );
              })
            ) : (
              <Row
                icon="add-outline"
                label="Add Work Experience"
                preview="Or import from LinkedIn above"
                colors={colors}
                last
                onPress={() => navPush('/work-experience')}
              />
            )}
          </Group>
        </View>

        {/* ── EDUCATION ────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionLabel title="EDUCATION" colors={colors} />
          <Group colors={colors}>
            {profile?.education?.length ? (() => {
              const eduList = profile.education as any[];
              // Show only the current/most recent entry
              const current = eduList.find((e: any) => e.current) ?? eduList[0];
              const extraCount = eduList.length - 1;
              return (
                <>
                  <Pressable
                    onPress={() => navPush('/education')}
                    style={({ pressed }) => [
                      styles.row,
                      extraCount > 0 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                      pressed && { opacity: 0.65 },
                    ]}
                  >
                    <Squircle style={styles.iconWrap} cornerRadius={10} cornerSmoothing={1} fillColor={colors.surface2}>
                      <Ionicons name="school-outline" size={16} color={colors.text} />
                    </Squircle>
                    <Text style={[styles.rowLabel, { color: colors.text, flex: 1 }]} numberOfLines={1}>
                      {[current.institution || 'Institution', current.degree, current.course || current.field].filter(Boolean).join(' · ')}
                      {current.grad_year ? ` · ${current.grad_year}` : ''}
                    </Text>
                    <Ionicons name="chevron-forward" size={15} color={colors.textSecondary} />
                  </Pressable>
                  {extraCount > 0 && (
                    <Pressable
                      onPress={() => navPush('/education')}
                      style={({ pressed }) => [styles.row, pressed && { opacity: 0.65 }]}
                    >
                      <Squircle style={styles.iconWrap} cornerRadius={10} cornerSmoothing={1} fillColor={colors.surface2}>
                        <Ionicons name="ellipsis-horizontal" size={16} color={colors.textSecondary} />
                      </Squircle>
                      <Text style={[styles.rowLabel, { color: colors.textSecondary, flex: 1 }]}>
                        +{extraCount} more
                      </Text>
                      <Ionicons name="chevron-forward" size={15} color={colors.textSecondary} />
                    </Pressable>
                  )}
                </>
              );
            })() : (
              <Row
                icon="add-outline"
                label="Add Education"
                preview="Schools, degrees & graduation years"
                colors={colors}
                last
                onPress={() => navPush('/education')}
              />
            )}
          </Group>
        </View>

        {/* ── PREFERENCES ──────────────────────────────────────────────────── */}
        {/* Preferences section removed — Who I Want to See, Are You Hiring?, Scheduling Link */}

      </ScrollView>

      {/* ── Chip picker sheet ─────────────────────────────────────────────── */}
      {chipPicker && (
        <ChipSelectorSheet
          visible={!!chipPicker}
          onClose={() => setChipPicker(null)}
          title={chipPicker.title}
          subtitle={chipPicker.subtitle}
          singleSelect={chipPicker.single ?? false}
          maxSelect={chipPicker.single ? 1 : 99}
          options={chipPicker.options}
          selected={chipPicker.selected}
          onChange={(vals) => { chipPicker.onDone(vals); setChipPicker(null); }}
          colors={colors}
        />
      )}
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  section:      { paddingHorizontal: 16, marginTop: 22, gap: 6 },
  sectionLabel: { fontSize: 12, fontFamily: 'ProductSans-Bold', letterSpacing: 1.5, marginLeft: 2, marginBottom: 2 },
  group:        { overflow: 'hidden' },
  row:          { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13 },
  iconWrap:     { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rowLabel:     { fontSize: 14, fontFamily: 'ProductSans-Regular' },
  rowPreview:   { fontSize: 11, fontFamily: 'ProductSans-Regular' },
  rowValue:     { fontSize: 12, fontFamily: 'ProductSans-Regular', maxWidth: 140, textAlign: 'right' },
  urlInput:     { fontSize: 12, fontFamily: 'ProductSans-Regular', paddingVertical: 4, paddingHorizontal: 8, borderWidth: 1, borderRadius: 8 },
});
