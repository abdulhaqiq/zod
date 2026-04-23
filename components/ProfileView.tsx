import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Squircle from '@/components/ui/Squircle';
import { useAppTheme } from '@/context/ThemeContext';
import { apiFetch } from '@/constants/api';
import { useAuth } from '@/context/AuthContext';

const { width: W, height: H } = Dimensions.get('window');
const PHOTO_HEIGHT = H * 0.62;

// ─── Shimmer ──────────────────────────────────────────────────────────────────

function Shimmer({ width, height, radius = 10, style }: {
  width: number | string; height: number; radius?: number; style?: any;
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
  return (
    <Animated.View style={[{
      width, height,
      borderRadius: radius,
      backgroundColor: '#444',
      opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.45] }),
    }, style]} />
  );
}

function SkeletonScreen({ insets }: { insets: any }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <Shimmer width={W} height={PHOTO_HEIGHT} radius={0} />
      <View style={{ padding: 20, gap: 14 }}>
        <Shimmer width={220} height={34} radius={8} />
        <Shimmer width={140} height={16} radius={6} />
        <View style={{ height: 1, backgroundColor: '#222', marginVertical: 4 }} />
        {[1, 0.85, 0.7].map((w, i) => (
          <Shimmer key={i} width={`${w * 100}%`} height={14} radius={6} />
        ))}
      </View>
    </View>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExtendedProfile {
  id: string;
  name: string;
  age: number | null;
  verified: boolean;
  premium: boolean;
  isOnline: boolean;
  location: string | null;
  distance: string | null;
  about: string | null;
  images: string[];
  details: {
    height: string | null;
    drinks: string | null;
    smokes: string | null;
    gender: string | null;
    wantsKids: string | null;
    sign: string | null;
    politics: string | null;
    religion: string | null;
    work: string | null;
    education: string | null;
  };
  lookingFor: string | null;
  interests: { emoji: string; label: string }[];
  prompts: { question: string; answer: string }[];
  languages: string[];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ children, colors }: { children: React.ReactNode; colors: any }) {
  return (
    <Squircle
      style={sectionCard.wrap}
      cornerRadius={22}
      cornerSmoothing={1}
      fillColor={colors.surface2}
      strokeColor={'rgba(255,255,255,0.11)'}
      strokeWidth={1}
    >
      {children}
    </Squircle>
  );
}
const sectionCard = StyleSheet.create({
  wrap: { padding: 18, marginBottom: 12 },
});

function SectionTitle({ label, colors }: { label: string; colors: any }) {
  return (
    <Text style={[st.label, { color: colors.textSecondary }]}>{label}</Text>
  );
}
const st = StyleSheet.create({
  label: { fontSize: 11, fontFamily: 'ProductSans-Bold', letterSpacing: 1.4, marginBottom: 12 },
});

function DetailItem({ icon, label, value, colors }: {
  icon: string; label: string; value: string; colors: any;
}) {
  return (
    <View style={di.row}>
      <View style={[di.iconWrap, { backgroundColor: `${colors.btnPrimaryBg}12` }]}>
        <Ionicons name={icon as any} size={15} color={colors.btnPrimaryBg} />
      </View>
      <View style={di.texts}>
        <Text style={[di.lbl, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[di.val, { color: colors.text }]}>{value}</Text>
      </View>
    </View>
  );
}
const di = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  iconWrap:{ width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  texts:   { flex: 1 },
  lbl:     { fontSize: 11, fontFamily: 'ProductSans-Regular' },
  val:     { fontSize: 14, fontFamily: 'ProductSans-Bold', marginTop: 1 },
});

// ─── Pre-fill cache (populated by callers before navigating) ─────────────────
// Callers like LikedYouPage can drop profile data here so ProfileView shows
// instantly without a loading skeleton, then refreshes in the background.

const _prefillCache = new Map<string, ExtendedProfile>();

export function preFillProfile(p: {
  id: string; name: string; age: number | null; verified: boolean; premium: boolean;
  location: string | null; distance: string | null; about: string | null;
  images: string[];
  details: {
    height?: string | null; drinks?: string | null; smokes?: string | null;
    gender?: string | null; wantsKids?: string | null; sign?: string | null;
    politics?: string | null; religion?: string | null; work?: string | null;
    education?: string | null;
  };
  lookingFor?: string | null;
  interests: { emoji: string; label: string }[];
  prompts: { question: string; answer: string }[];
  languages: string[];
}): void {
  _prefillCache.set(p.id, {
    id:       p.id,
    name:     p.name,
    age:      p.age,
    verified: p.verified,
    premium:  p.premium,
    isOnline: false,
    location: p.location,
    distance: p.distance,
    about:    p.about,
    images:   p.images,
    details: {
      height:    p.details.height    ?? null,
      drinks:    p.details.drinks    ?? null,
      smokes:    p.details.smokes    ?? null,
      gender:    p.details.gender    ?? null,
      wantsKids: p.details.wantsKids ?? null,
      sign:      p.details.sign      ?? null,
      politics:  p.details.politics  ?? null,
      religion:  p.details.religion  ?? null,
      work:      p.details.work      ?? null,
      education: p.details.education ?? null,
    },
    lookingFor: p.lookingFor ?? null,
    interests:  p.interests,
    prompts:    p.prompts,
    languages:  p.languages,
  });
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ProfileView() {
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const { token } = useAuth();
  const { id }   = useLocalSearchParams<{ id: string }>();

  const cached = id ? _prefillCache.get(id) ?? null : null;

  const [profile,    setProfile]    = useState<ExtendedProfile | null>(cached);
  const [loading,    setLoading]    = useState(!cached);
  const [loadError,  setLoadError]  = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [superLiked, setSuperLiked] = useState(false);
  const [liked,      setLiked]      = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!id || !token) { setLoading(false); setLoadError(true); return; }
    let cancelled = false;
    // Only show skeleton when there's no cached data to display immediately
    if (!cached) setLoading(true);
    setLoadError(false);
    apiFetch<any>(`/discover/profile/${id}`, { token, timeoutMs: 12000 })
      .then(data => {
        if (cancelled) return;
        _prefillCache.delete(id);
        setProfile({
          id:         data.id,
          name:       data.name ?? 'Unknown',
          age:        data.age ?? null,
          verified:   data.verified ?? false,
          premium:    data.premium ?? false,
          isOnline:   data.is_online ?? false,
          location:   data.location ?? null,
          distance:   data.distance ?? null,
          about:      data.about ?? null,
          images:     Array.isArray(data.images) ? data.images : [],
          details: {
            height:    data.details?.height    ?? null,
            drinks:    data.details?.drinks    ?? null,
            smokes:    data.details?.smokes    ?? null,
            gender:    data.details?.gender    ?? null,
            wantsKids: data.details?.wantsKids ?? null,
            sign:      data.details?.sign      ?? null,
            politics:  data.details?.politics  ?? null,
            religion:  data.details?.religion  ?? null,
            work:      data.details?.work      ?? null,
            education: data.details?.education ?? null,
          },
          lookingFor: data.lookingFor ?? null,
          interests:  Array.isArray(data.interests) ? data.interests : [],
          prompts:    Array.isArray(data.prompts)   ? data.prompts   : [],
          languages:  Array.isArray(data.languages) ? data.languages : [],
        });
      })
      .catch(() => { if (!cancelled) setLoadError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, token]);

  const handleReport = () => {
    const reasons = [
      { label: 'Fake profile',         key: 'fake_profile' },
      { label: 'Inappropriate photos', key: 'inappropriate_photos' },
      { label: 'Harassment',           key: 'harassment' },
      { label: 'Spam',                 key: 'spam' },
      { label: 'Underage',             key: 'underage' },
      { label: 'Hate speech',          key: 'hate_speech' },
      { label: 'Scam',                 key: 'scam' },
      { label: 'Other',                key: 'other' },
    ];
    Alert.alert(
      `Report ${profile?.name ?? ''}`,
      'Why are you reporting this profile?',
      [
        ...reasons.map(r => ({
          text: r.label,
          onPress: () => {
            if (!token) return;
            apiFetch('/moderation/report', {
              token, method: 'POST',
              body: JSON.stringify({ reported_id: id, reason: r.key }),
            }).catch(() => {});
            Alert.alert('Reported', 'Thank you. Your report is anonymous and will be reviewed within 24 hours.');
          },
        })),
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  const handleBlock = () => {
    const pName = profile?.name ?? '';
    Alert.alert(
      `Block ${pName}`,
      `${pName} won't be able to see your profile or contact you. They won't be notified.`,
      [
        {
          text: 'Block',
          style: 'destructive',
          onPress: () => {
            if (token) {
              apiFetch('/moderation/block', {
                token, method: 'POST',
                body: JSON.stringify({ blocked_id: id }),
              }).catch(() => {});
            }
            router.back();
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  const onPhotoScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setPhotoIndex(Math.round(e.nativeEvent.contentOffset.x / W));
  };

  if (loading) return <SkeletonScreen insets={insets} />;

  if (loadError || !profile) {
    return (
      <View style={[{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 16 }]}>
        <Squircle style={{ width: 72, height: 72, alignItems: 'center', justifyContent: 'center' }} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface}>
          <Ionicons name="wifi-outline" size={30} color={colors.textSecondary} />
        </Squircle>
        <Text style={{ fontSize: 17, fontFamily: 'ProductSans-Bold', color: colors.text }}>Couldn't load profile</Text>
        <Text style={{ fontSize: 14, fontFamily: 'ProductSans-Regular', color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 40 }}>Check your connection and try again</Text>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
          <Squircle style={{ paddingHorizontal: 28, paddingVertical: 14 }} cornerRadius={22} cornerSmoothing={1} fillColor={colors.text}>
            <Text style={{ fontSize: 15, fontFamily: 'ProductSans-Bold', color: colors.bg }}>Go back</Text>
          </Squircle>
        </Pressable>
      </View>
    );
  }

  const DETAIL_ROWS = [
    { icon: 'resize-outline',       label: 'Height',     value: profile.details.height    },
    { icon: 'wine-outline',         label: 'Drinks',     value: profile.details.drinks    },
    { icon: 'flame-outline',        label: 'Smokes',     value: profile.details.smokes    },
    { icon: 'transgender-outline',  label: 'Gender',     value: profile.details.gender    },
    { icon: 'people-outline',       label: 'Wants kids', value: profile.details.wantsKids },
    { icon: 'star-outline',         label: 'Star sign',  value: profile.details.sign      },
    { icon: 'flag-outline',         label: 'Politics',   value: profile.details.politics  },
    { icon: 'globe-outline',        label: 'Religion',   value: profile.details.religion  },
    { icon: 'briefcase-outline',    label: 'Works at',   value: profile.details.work      },
    { icon: 'school-outline',       label: 'Studied at', value: profile.details.education },
  ].filter(r => r.value);

  const photoCount = profile.images.length;

  // Parallax: photo scrolls at 0.4× speed
  const photoTranslate = scrollY.interpolate({
    inputRange: [-200, 0, PHOTO_HEIGHT],
    outputRange: [0, 0, -PHOTO_HEIGHT * 0.3],
    extrapolate: 'clamp',
  });
  const headerOpacity = scrollY.interpolate({
    inputRange: [PHOTO_HEIGHT - 120, PHOTO_HEIGHT - 40],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>

      {/* ── Floating back + options buttons ── */}
      <View style={[s.floatRow, { top: insets.top + 10 }]} pointerEvents="box-none">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <View style={s.floatBtn}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </View>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable
          hitSlop={12}
          onPress={() =>
            Alert.alert(profile.name, 'What would you like to do?', [
              { text: `Report ${profile.name}`, style: 'destructive', onPress: handleReport },
              { text: `Block ${profile.name}`,  style: 'destructive', onPress: handleBlock  },
              { text: 'Cancel', style: 'cancel' },
            ])
          }
        >
          <View style={s.floatBtn}>
            <Ionicons name="ellipsis-horizontal" size={20} color="#fff" />
          </View>
        </Pressable>
      </View>

      {/* ── Sticky header (appears when scrolled past photo) ── */}
      <Animated.View
        style={[s.stickyHeader, {
          opacity: headerOpacity,
          top: 0,
          paddingTop: insets.top,
          backgroundColor: colors.bg,
          borderBottomColor: colors.border,
        }]}
        pointerEvents="none"
      >
        <Text style={[s.stickyName, { color: colors.text }]}>
          {profile.name}{profile.age != null ? `, ${profile.age}` : ''}
        </Text>
      </Animated.View>

      {/* ── Scrollable content ── */}
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      >

        {/* ── Photo hero ── */}
        <Animated.View style={[{ width: W, height: PHOTO_HEIGHT, overflow: 'hidden' }, { transform: [{ translateY: photoTranslate }] }]}>
          {/* Photos carousel */}
          <FlatList
            data={profile.images}
            keyExtractor={(_, i) => String(i)}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onPhotoScroll}
            scrollEventThrottle={16}
            style={{ flex: 1 }}
            renderItem={({ item }) => (
              <Image source={{ uri: item }} style={{ width: W, height: PHOTO_HEIGHT }} contentFit="cover" />
            )}
          />

          {/* Photo progress bars — top */}
          {photoCount > 1 && (
            <View style={[s.progressBars, { top: 12 }]}>
              {profile.images.map((_, i) => (
                <View
                  key={i}
                  style={[
                    s.progressBar,
                    {
                      flex: 1,
                      backgroundColor: i === photoIndex
                        ? 'rgba(255,255,255,0.95)'
                        : 'rgba(255,255,255,0.35)',
                      height: i === photoIndex ? 3 : 2.5,
                    },
                  ]}
                />
              ))}
            </View>
          )}

          {/* Gradient overlay bottom of photo */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.82)']}
            locations={[0.3, 0.6, 1]}
            style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end' }]}
          >
            <View style={s.photoInfo}>
              {/* Online status */}
              {profile.isOnline && (
                <View style={s.onlinePill}>
                  <View style={s.onlineDot} />
                  <Text style={s.onlineText}>Online</Text>
                </View>
              )}

              {/* Name + age + verified */}
              <View style={s.nameAgeRow}>
                <Text style={s.heroName}>
                  {profile.name}
                </Text>
                {profile.age != null && (
                  <Text style={s.heroAge}>{profile.age}</Text>
                )}
                {profile.verified && (
                  <Ionicons name="checkmark-circle" size={22} color="#4FC3F7" style={{ marginLeft: 4 }} />
                )}
                {profile.premium && (
                  <View style={s.premiumBadge}>
                    <Ionicons name="star" size={10} color="#FFD60A" />
                    <Text style={s.premiumText}>PRO</Text>
                  </View>
                )}
              </View>

              {/* Location + distance */}
              {(profile.location || profile.distance) && (
                <View style={s.locationRow}>
                  <Ionicons name="location" size={13} color="rgba(255,255,255,0.85)" />
                  <Text style={s.locationText}>
                    {[profile.location, profile.distance ? `${profile.distance} away` : null].filter(Boolean).join('  ·  ')}
                  </Text>
                </View>
              )}

              {/* Interest chips on photo */}
              {profile.interests.length > 0 && (
                <View style={s.photoChips}>
                  {profile.interests.slice(0, 3).map(item => (
                    <View key={item.label} style={s.photoChip}>
                      <Text style={s.photoChipText}>{item.emoji} {item.label}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </LinearGradient>
        </Animated.View>

        {/* ── Content cards ── */}
        <View style={[s.content, { backgroundColor: colors.bg }]}>

          {/* About */}
          {!!profile.about && (
            <SectionCard colors={colors}>
              <SectionTitle label="ABOUT" colors={colors} />
              <Text style={[s.aboutText, { color: colors.text }]}>{profile.about}</Text>
            </SectionCard>
          )}

          {/* Details */}
          {DETAIL_ROWS.length > 0 && (
            <SectionCard colors={colors}>
              <SectionTitle label="DETAILS" colors={colors} />
              <View style={{ gap: 0 }}>
                {DETAIL_ROWS.map((row, i) => (
                  <View key={row.label}>
                    <DetailItem {...row} value={row.value!} colors={colors} />
                    {i < DETAIL_ROWS.length - 1 && (
                      <View style={[s.inlineDivider, { backgroundColor: colors.border }]} />
                    )}
                  </View>
                ))}
              </View>
            </SectionCard>
          )}

          {/* Interests */}
          {profile.interests.length > 0 && (
            <SectionCard colors={colors}>
              <SectionTitle label="INTERESTS" colors={colors} />
              <View style={s.chipWrap}>
                {profile.interests.map(item => (
                  <Squircle
                    key={item.label}
                    style={s.interestChip}
                    cornerRadius={20}
                    cornerSmoothing={0.8}
                    fillColor={colors.surface2}
                  >
                    <Text style={s.chipEmoji}>{item.emoji}</Text>
                    <Text style={[s.chipLabel, { color: colors.text }]}>{item.label}</Text>
                  </Squircle>
                ))}
              </View>
            </SectionCard>
          )}

          {/* Looking For */}
          {!!profile.lookingFor && (
            <SectionCard colors={colors}>
              <SectionTitle label="LOOKING FOR" colors={colors} />
              <View style={s.lookingRow}>
                <View style={[s.lookingIcon, { backgroundColor: '#E8175D20' }]}>
                  <Ionicons name="heart" size={18} color="#E8175D" />
                </View>
                <Text style={[s.lookingText, { color: colors.text }]}>{profile.lookingFor}</Text>
              </View>
            </SectionCard>
          )}

          {/* Prompts */}
          {profile.prompts.length > 0 && (
            <View style={{ gap: 10, marginBottom: 12 }}>
              {profile.prompts.map((p, i) => (
                <Squircle
                  key={i}
                  style={s.promptCard}
                  cornerRadius={22}
                  cornerSmoothing={1}
                  fillColor={colors.surface2}
                  strokeColor={'rgba(255,255,255,0.11)'}
                  strokeWidth={1}
                >
                  <Text style={[s.promptQ, { color: colors.textSecondary }]}>{p.question}</Text>
                  <Text style={[s.promptA, { color: colors.text }]}>{p.answer}</Text>
                </Squircle>
              ))}
            </View>
          )}

          {/* Languages */}
          {profile.languages.length > 0 && (
            <SectionCard colors={colors}>
              <SectionTitle label="LANGUAGES" colors={colors} />
              <View style={s.chipWrap}>
                {profile.languages.map(lang => (
                  <Squircle
                    key={lang}
                    style={s.langChip}
                    cornerRadius={16}
                    cornerSmoothing={0.8}
                    fillColor={colors.surface2}
                  >
                    <Ionicons name="language-outline" size={14} color={colors.textSecondary} />
                    <Text style={[s.chipLabel, { color: colors.text }]}>{lang}</Text>
                  </Squircle>
                ))}
              </View>
            </SectionCard>
          )}

          {/* Location card */}
          {(profile.location || profile.distance) && (
            <Squircle
              style={[s.locationCard, { marginBottom: 12 }]}
              cornerRadius={22}
              cornerSmoothing={1}
              fillColor={colors.surface2}
              strokeColor={'rgba(255,255,255,0.11)'}
              strokeWidth={1}
            >
              <View style={[s.locationIconWrap, { backgroundColor: `${colors.btnPrimaryBg}12` }]}>
                <Ionicons name="navigate-circle-outline" size={26} color={colors.btnPrimaryBg} />
              </View>
              <View>
                <Text style={[{ fontSize: 11, fontFamily: 'ProductSans-Bold', letterSpacing: 1.2, color: colors.textSecondary, marginBottom: 3 }]}>LOCATION</Text>
                <Text style={[{ fontSize: 15, fontFamily: 'ProductSans-Bold', color: colors.text }]}>
                  {[profile.location, profile.distance ? `${profile.distance} away` : null].filter(Boolean).join(' · ')}
                </Text>
              </View>
            </Squircle>
          )}

          {/* Report / Block */}
          <Squircle
            style={{ marginBottom: 12 }}
            cornerRadius={22}
            cornerSmoothing={1}
            fillColor={colors.surface2}
            strokeColor={'rgba(255,255,255,0.11)'}
            strokeWidth={1}
          >
            <Pressable
              onPress={handleReport}
              style={({ pressed }) => [s.dangerRow, pressed && { opacity: 0.7 }]}
            >
              <View style={[s.dangerIcon, { backgroundColor: '#FF3B3018' }]}>
                <Ionicons name="flag-outline" size={16} color="#FF3B30" />
              </View>
              <Text style={[s.dangerText, { color: '#FF3B30' }]}>Report {profile.name}</Text>
              <Ionicons name="chevron-forward" size={16} color="#FF3B3060" style={{ marginLeft: 'auto' }} />
            </Pressable>
            <View style={[s.inlineDivider, { backgroundColor: colors.border, marginHorizontal: 16 }]} />
            <Pressable
              onPress={handleBlock}
              style={({ pressed }) => [s.dangerRow, pressed && { opacity: 0.7 }]}
            >
              <View style={[s.dangerIcon, { backgroundColor: '#FF3B3018' }]}>
                <Ionicons name="ban-outline" size={16} color="#FF3B30" />
              </View>
              <Text style={[s.dangerText, { color: '#FF3B30' }]}>Block {profile.name}</Text>
              <Ionicons name="chevron-forward" size={16} color="#FF3B3060" style={{ marginLeft: 'auto' }} />
            </Pressable>
          </Squircle>

        </View>
      </Animated.ScrollView>

      {/* ── Action bar ── */}
      <View style={[s.actionBar, {
        backgroundColor: colors.bg,
        borderTopColor: colors.border,
        paddingBottom: Math.max(insets.bottom, 16),
      }]}>
        {/* Pass */}
        <Pressable onPress={() => router.back()} style={({ pressed }) => pressed && { opacity: 0.8 }}>
          <Squircle style={s.passBtn} cornerRadius={30} cornerSmoothing={1} fillColor={colors.surface2} strokeColor={'rgba(255,59,48,0.35)'} strokeWidth={1.5}>
            <Ionicons name="close" size={30} color="#FF3B30" />
          </Squircle>
        </Pressable>

        {/* Super Like */}
        <Pressable onPress={() => setSuperLiked(v => !v)} style={({ pressed }) => pressed && { opacity: 0.8 }}>
          <Squircle
            style={s.superBtn}
            cornerRadius={24}
            cornerSmoothing={1}
            fillColor={superLiked ? '#FFD60A' : colors.surface2}
            strokeColor={superLiked ? '#FFD60A' : 'rgba(255,214,10,0.45)'}
            strokeWidth={1.5}
          >
            <Ionicons name="star" size={22} color={superLiked ? '#fff' : '#FFD60A'} />
          </Squircle>
        </Pressable>

        {/* Like */}
        <Pressable onPress={() => setLiked(v => !v)} style={({ pressed }) => pressed && { opacity: 0.8 }}>
          <Squircle
            style={s.likeBtn}
            cornerRadius={30}
            cornerSmoothing={1}
            fillColor={liked ? '#E8175D' : colors.surface2}
            strokeColor={liked ? '#E8175D' : 'rgba(232,23,93,0.35)'}
            strokeWidth={1.5}
          >
            <Ionicons name="heart" size={30} color={liked ? '#fff' : '#E8175D'} />
          </Squircle>
        </Pressable>
      </View>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Floating overlay buttons
  floatRow: {
    position: 'absolute', left: 16, right: 16, flexDirection: 'row', zIndex: 100,
  },
  floatBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.42)',
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({ ios: { backdropFilter: 'blur(8px)' } }),
  },

  // Sticky header
  stickyHeader: {
    position: 'absolute', left: 0, right: 0, zIndex: 50,
    alignItems: 'center', paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stickyName: { fontSize: 17, fontFamily: 'ProductSans-Bold' },

  // Photo progress bars
  progressBars: {
    position: 'absolute', left: 10, right: 10,
    flexDirection: 'row', gap: 4, zIndex: 10,
  },
  progressBar: { borderRadius: 2 },

  // Photo info overlay
  photoInfo: { paddingHorizontal: 16, paddingBottom: 20, gap: 6 },
  onlinePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(34,197,94,0.25)', borderRadius: 20,
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.5)',
  },
  onlineDot:   { width: 7, height: 7, borderRadius: 4, backgroundColor: '#22c55e' },
  onlineText:  { color: '#22c55e', fontSize: 12, fontFamily: 'ProductSans-Bold' },
  nameAgeRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroName:    { fontSize: 34, fontFamily: 'ProductSans-Black', color: '#fff', letterSpacing: -0.3 },
  heroAge:     { fontSize: 30, fontFamily: 'ProductSans-Light', color: 'rgba(255,255,255,0.85)' },
  premiumBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#FFD60A22', borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 3, marginLeft: 4,
  },
  premiumText:  { color: '#FFD60A', fontSize: 10, fontFamily: 'ProductSans-Bold', letterSpacing: 1 },
  locationRow:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  locationText: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontFamily: 'ProductSans-Medium' },

  // Chips on photo
  photoChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  photoChip: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 20, paddingHorizontal: 11, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  photoChipText: { color: '#fff', fontSize: 12, fontFamily: 'ProductSans-Medium' },

  // Content area
  content: { paddingHorizontal: 16, paddingTop: 16 },
  aboutText: { fontSize: 15, fontFamily: 'ProductSans-Regular', lineHeight: 24 },
  inlineDivider: { height: StyleSheet.hairlineWidth },

  // Interests
  chipWrap:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  interestChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9 },
  chipEmoji:    { fontSize: 16 },
  chipLabel:    { fontSize: 13, fontFamily: 'ProductSans-Medium' },
  langChip:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9 },

  // Looking for
  lookingRow:  { flexDirection: 'row', alignItems: 'center', gap: 14 },
  lookingIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  lookingText: { fontSize: 15, fontFamily: 'ProductSans-Bold', flex: 1 },

  // Prompts
  promptCard: { padding: 18, gap: 8 },
  promptQ:    { fontSize: 12, fontFamily: 'ProductSans-Bold', letterSpacing: 0.3 },
  promptA:    { fontSize: 15, fontFamily: 'ProductSans-Regular', lineHeight: 23 },

  // Location card
  locationCard:    { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18 },
  locationIconWrap: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },

  // Danger
  dangerRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  dangerIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  dangerText: { fontSize: 15, fontFamily: 'ProductSans-Medium' },

  // Action bar
  actionBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 22,
    paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth,
  },
  passBtn:  { width: 66, height: 66, alignItems: 'center', justifyContent: 'center' },
  superBtn: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center' },
  likeBtn:  { width: 66, height: 66, alignItems: 'center', justifyContent: 'center' },
});
