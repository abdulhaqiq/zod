import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
type IoniconsName = string;
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Alert,
  Dimensions,
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Squircle from '@/components/ui/Squircle';
import { useAppTheme } from '@/context/ThemeContext';
import { apiFetch } from '@/constants/api';
import { useAuth } from '@/context/AuthContext';

const { width: W } = Dimensions.get('window');

// ─── Shimmer helpers ──────────────────────────────────────────────────────────

function ShimmerBlock({ width, height, borderRadius = 10, style }: {
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
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.55] });
  return (
    <Animated.View style={[{ width, height, borderRadius, backgroundColor: '#777', opacity }, style]} />
  );
}

function ProfileViewSkeleton({ colors, insets }: { colors: any; insets: any }) {
  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 6, backgroundColor: colors.bg, borderBottomColor: colors.border }]}>
        <ShimmerBlock width={38} height={38} borderRadius={14} />
        <ShimmerBlock width={120} height={16} />
        <ShimmerBlock width={38} height={38} borderRadius={14} />
      </View>
      {/* Photo */}
      <ShimmerBlock width={W} height={W * 1.15} borderRadius={0} />
      {/* Content */}
      <View style={{ padding: 20, gap: 14 }}>
        <ShimmerBlock width={200} height={28} borderRadius={8} />
        <ShimmerBlock width={130} height={16} borderRadius={6} />
        <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />
        <ShimmerBlock width="100%" height={14} />
        <ShimmerBlock width="85%" height={14} />
        <ShimmerBlock width="70%" height={14} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
          {[140, 110, 90, 120, 95, 130].map((w, i) => (
            <ShimmerBlock key={i} width={w} height={36} borderRadius={18} />
          ))}
        </View>
      </View>
    </View>
  );
}

interface ExtendedProfile {
  id: string;
  name: string;
  age: number | null;
  verified: boolean;
  premium: boolean;
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

// ─── Detail chip ──────────────────────────────────────────────────────────────

function DetailChip({ icon, label, value, colors }: {
  icon: IoniconsName;
  label: string;
  value: string;
  colors: any;
}) {
  return (
    <Squircle
      style={styles.detailChip}
      cornerRadius={16}
      cornerSmoothing={0.8}
      fillColor={colors.surface}
    >
      <Ionicons name={icon as any} size={14} color={colors.btnPrimaryBg} />
      <View>
        <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[styles.detailValue, { color: colors.text }]}>{value}</Text>
      </View>
    </Squircle>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ProfileView() {
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { token } = useAuth();
  const { id }   = useLocalSearchParams<{ id: string }>();

  const [profile,    setProfile]    = useState<ExtendedProfile | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [loadError,  setLoadError]  = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [superLiked, setSuperLiked] = useState(false);
  const [liked,      setLiked]      = useState(false);

  useEffect(() => {
    if (!id || !token) { setLoading(false); setLoadError(true); return; }
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    apiFetch<any>(`/discover/profile/${id}`, { token, timeoutMs: 12000 })
      .then(data => {
        if (cancelled) return;
        setProfile({
          id:         data.id,
          name:       data.name ?? 'Unknown',
          age:        data.age ?? null,
          verified:   data.verified ?? false,
          premium:    data.premium ?? false,
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
            Alert.alert('Report submitted', 'Thank you for helping keep our community safe. Your report is anonymous and will be reviewed within 24 hours.');
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
      `${pName} will no longer be able to see your profile or contact you. They won't be notified.`,
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
    const idx = Math.round(e.nativeEvent.contentOffset.x / W);
    setPhotoIndex(idx);
  };

  if (loading) {
    return <ProfileViewSkeleton colors={colors} insets={insets} />;
  }

  if (loadError || !profile) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 16 }]}>
        <Squircle style={{ width: 64, height: 64, alignItems: 'center', justifyContent: 'center' }} cornerRadius={20} cornerSmoothing={1} fillColor={colors.surface}>
          <Ionicons name="wifi-outline" size={28} color={colors.textSecondary} />
        </Squircle>
        <Text style={{ fontSize: 16, fontFamily: 'ProductSans-Bold', color: colors.text }}>Couldn't load profile</Text>
        <Text style={{ fontSize: 13, fontFamily: 'ProductSans-Regular', color: colors.textSecondary }}>Check your connection and try again</Text>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
          <Squircle style={{ paddingHorizontal: 24, paddingVertical: 12 }} cornerRadius={20} cornerSmoothing={1} fillColor={colors.text}>
            <Text style={{ fontSize: 14, fontFamily: 'ProductSans-Bold', color: colors.bg }}>Go back</Text>
          </Squircle>
        </Pressable>
      </View>
    );
  }

  const DETAIL_ROWS = [
    { icon: 'resize-outline'       as const, label: 'Height',      value: profile.details.height     },
    { icon: 'wine-outline'         as const, label: 'Drinks',      value: profile.details.drinks     },
    { icon: 'flame-outline'        as const, label: 'Smokes',      value: profile.details.smokes     },
    { icon: 'transgender-outline'  as const, label: 'Gender',      value: profile.details.gender     },
    { icon: 'people-outline'       as const, label: 'Wants kids',  value: profile.details.wantsKids  },
    { icon: 'star-outline'         as const, label: 'Star sign',   value: profile.details.sign       },
    { icon: 'flag-outline'         as const, label: 'Politics',    value: profile.details.politics   },
    { icon: 'globe-outline'        as const, label: 'Religion',    value: profile.details.religion   },
    { icon: 'briefcase-outline'    as const, label: 'Works at',    value: profile.details.work       },
    { icon: 'school-outline'       as const, label: 'Studied at',  value: profile.details.education  },
  ].filter(r => r.value); // hide rows with no data

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>

      {/* ── Header (fixed) ── */}
      <View style={[styles.header, { paddingTop: insets.top + 6, backgroundColor: colors.bg, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Squircle style={styles.headerBtn} cornerRadius={14} cornerSmoothing={1} fillColor={colors.surface2}>
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </Squircle>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerName, { color: colors.text }]}>{profile.name}, {profile.age}</Text>
          {profile.verified && <Ionicons name="checkmark-circle" size={18} color="#4FC3F7" style={{ marginLeft: 4 }} />}
        </View>
        <Pressable hitSlop={12}>
          <Squircle style={styles.headerBtn} cornerRadius={14} cornerSmoothing={1} fillColor={colors.surface2}>
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
          </Squircle>
        </Pressable>
      </View>

      {/* ── Scrollable content ── */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* Photos carousel */}
        <View style={styles.photosWrap}>
          <FlatList
            data={profile.images}
            keyExtractor={(_, i) => String(i)}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onPhotoScroll}
            scrollEventThrottle={16}
            renderItem={({ item }) => (
              <Image source={{ uri: item }} style={styles.photo} />
            )}
          />
          {/* Dot indicators */}
          {profile.images.length > 1 && (
            <View style={styles.dots}>
              {profile.images.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    { backgroundColor: i === photoIndex ? colors.text : `${colors.text}44` },
                    i === photoIndex && styles.dotActive,
                  ]}
                />
              ))}
            </View>
          )}
        </View>

        <View style={styles.content}>

          {/* Name + location */}
          <View style={styles.nameBlock}>
            <View style={styles.nameRow}>
              <Text style={[styles.bigName, { color: colors.text }]}>
                {profile.name}{profile.age != null ? `, ${profile.age}` : ''}
              </Text>
              {profile.verified && <Ionicons name="checkmark-circle" size={22} color="#4FC3F7" style={{ marginLeft: 6 }} />}
              {profile.premium && (
                <View style={styles.premiumBadge}>
                  <Ionicons name="star" size={10} color="#FFD60A" />
                  <Text style={styles.premiumText}>PREMIUM</Text>
                </View>
              )}
            </View>
            {(profile.location || profile.distance) && (
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
                <Text style={[styles.locationText, { color: colors.textSecondary }]}>
                  {[profile.location, profile.distance ? `${profile.distance} away` : null].filter(Boolean).join('  ·  ')}
                </Text>
              </View>
            )}
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* About */}
          {!!profile.about && (
            <>
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>ABOUT</Text>
                <Text style={[styles.aboutText, { color: colors.text }]}>{profile.about}</Text>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
            </>
          )}

          {/* Details grid */}
          {DETAIL_ROWS.length > 0 && (
            <>
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>DETAILS</Text>
                <View style={styles.detailGrid}>
                  {DETAIL_ROWS.map((row) => (
                    <DetailChip key={row.label} {...row} value={row.value!} colors={colors} />
                  ))}
                </View>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
            </>
          )}

          {/* Interests */}
          {profile.interests.length > 0 && (
            <>
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>INTERESTS</Text>
                <View style={styles.chipRow}>
                  {profile.interests.map((item) => (
                    <Squircle
                      key={item.label}
                      style={styles.interestChip}
                      cornerRadius={20}
                      cornerSmoothing={0.8}
                      fillColor={colors.surface}
                    >
                      <Text style={styles.interestEmoji}>{item.emoji}</Text>
                      <Text style={[styles.interestLabel, { color: colors.text }]}>{item.label}</Text>
                    </Squircle>
                  ))}
                </View>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
            </>
          )}

          {/* Looking for */}
          {!!profile.lookingFor && (
            <>
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>LOOKING FOR</Text>
                <Squircle
                  style={styles.lookingForCard}
                  cornerRadius={18}
                  cornerSmoothing={1}
                  fillColor={colors.surface}
                >
                  <Ionicons name="heart" size={18} color={colors.btnPrimaryBg} />
                  <Text style={[styles.lookingForText, { color: colors.text }]}>{profile.lookingFor}</Text>
                </Squircle>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
            </>
          )}

          {/* Prompts */}
          {profile.prompts.length > 0 && (
            <>
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>PROMPTS</Text>
                <View style={styles.promptList}>
                  {profile.prompts.map((p, i) => (
                    <Squircle
                      key={i}
                      style={styles.promptCard}
                      cornerRadius={18}
                      cornerSmoothing={1}
                      fillColor={colors.surface}
                    >
                      <Text style={[styles.promptQuestion, { color: colors.textSecondary }]}>{p.question}</Text>
                      <Text style={[styles.promptAnswer, { color: colors.text }]}>{p.answer}</Text>
                    </Squircle>
                  ))}
                </View>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
            </>
          )}

          {/* Language */}
          {profile.languages.length > 0 && (
            <>
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>LANGUAGES</Text>
                <View style={styles.chipRow}>
                  {profile.languages.map((lang) => (
                    <Squircle
                      key={lang}
                      style={styles.langChip}
                      cornerRadius={16}
                      cornerSmoothing={0.8}
                      fillColor={colors.surface}
                    >
                      <Ionicons name="language-outline" size={14} color={colors.textSecondary} />
                      <Text style={[styles.langText, { color: colors.text }]}>{lang}</Text>
                    </Squircle>
                  ))}
                </View>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
            </>
          )}

          {/* Location */}
          {(profile.location || profile.distance) && (
            <>
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>LOCATION</Text>
                <Squircle
                  style={[styles.mapCard, { borderColor: colors.border }]}
                  cornerRadius={18}
                  cornerSmoothing={1}
                  fillColor={colors.surface}
                >
                  <Ionicons name="map-outline" size={28} color={colors.textSecondary} />
                  <Text style={[styles.mapText, { color: colors.textSecondary }]}>
                    {[profile.location, profile.distance ? `${profile.distance} away` : null].filter(Boolean).join('  ·  ')}
                  </Text>
                </Squircle>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
            </>
          )}

          {/* Report / Block */}
          <View style={[styles.section, { gap: 8 }]}>
            <Pressable onPress={handleReport} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
              <View style={styles.dangerRow}>
                <Ionicons name="flag-outline" size={16} color={colors.error} />
                <Text style={[styles.dangerText, { color: colors.error }]}>Report {profile.name}</Text>
              </View>
            </Pressable>
            <Pressable onPress={handleBlock} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
              <View style={styles.dangerRow}>
                <Ionicons name="ban-outline" size={16} color={colors.error} />
                <Text style={[styles.dangerText, { color: colors.error }]}>Block {profile.name}</Text>
              </View>
            </Pressable>
          </View>

        </View>
      </ScrollView>

      {/* ── Fixed action bar ── */}
      <View style={[styles.actionBar, { backgroundColor: colors.bg, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 16) }]}>
        {/* Dislike */}
        <Pressable onPress={() => router.back()} style={({ pressed }) => pressed && { opacity: 0.8 }}>
          <Squircle style={styles.dislikeBtn} cornerRadius={28} cornerSmoothing={1} fillColor={colors.surface2} strokeColor={colors.border} strokeWidth={1.5}>
            <Ionicons name="close" size={28} color="#FF3B30" />
          </Squircle>
        </Pressable>

        {/* Super Like */}
        <Pressable onPress={() => setSuperLiked(v => !v)} style={({ pressed }) => pressed && { opacity: 0.8 }}>
          <Squircle style={styles.superLikeBtn} cornerRadius={22} cornerSmoothing={1} fillColor={superLiked ? '#FFD60A' : colors.surface2} strokeColor={superLiked ? '#FFD60A' : colors.border} strokeWidth={1.5}>
            <Ionicons name="star" size={22} color={superLiked ? '#fff' : '#FFD60A'} />
          </Squircle>
        </Pressable>

        {/* Like */}
        <Pressable onPress={() => { setLiked(v => !v); }} style={({ pressed }) => pressed && { opacity: 0.8 }}>
          <Squircle style={styles.likeBtn} cornerRadius={28} cornerSmoothing={1} fillColor={liked ? '#E8175D' : colors.surface2} strokeColor={liked ? '#E8175D' : colors.border} strokeWidth={1.5}>
            <Ionicons name="heart" size={28} color={liked ? '#fff' : '#E8175D'} />
          </Squircle>
        </Pressable>
      </View>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:       { flex: 1 },

  // Header
  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  headerBtn:       { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  headerCenter:    { flexDirection: 'row', alignItems: 'center' },
  headerName:      { fontSize: 16, fontFamily: 'ProductSans-Bold' },

  // Photos
  photosWrap:      { width: W, height: W * 1.15 },
  photo:           { width: W, height: W * 1.15, resizeMode: 'cover' },
  dots:            { position: 'absolute', bottom: 14, alignSelf: 'center', flexDirection: 'row', gap: 5 },
  dot:             { width: 6, height: 6, borderRadius: 3 },
  dotActive:       { width: 18 },

  content:         { paddingHorizontal: 20, paddingTop: 20 },

  // Name block
  nameBlock:       { gap: 5, marginBottom: 16 },
  nameRow:         { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  bigName:         { fontSize: 26, fontFamily: 'ProductSans-Black' },
  premiumBadge:    { flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 8, backgroundColor: '#FFD60A22', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  premiumText:     { color: '#FFD60A', fontSize: 10, fontFamily: 'ProductSans-Bold', letterSpacing: 1 },
  locationRow:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText:    { fontSize: 13, fontFamily: 'ProductSans-Regular' },

  divider:         { height: StyleSheet.hairlineWidth, marginVertical: 18 },

  // Section
  section:         { gap: 12 },
  sectionLabel:    { fontSize: 11, fontFamily: 'ProductSans-Bold', letterSpacing: 1.4 },
  aboutText:       { fontSize: 15, fontFamily: 'ProductSans-Regular', lineHeight: 24 },

  // Detail grid
  detailGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  detailChip:      { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, paddingVertical: 10 },
  detailLabel:     { fontSize: 10, fontFamily: 'ProductSans-Regular' },
  detailValue:     { fontSize: 13, fontFamily: 'ProductSans-Bold' },

  // Interests
  chipRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  interestChip:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9 },
  interestEmoji:   { fontSize: 16 },
  interestLabel:   { fontSize: 13, fontFamily: 'ProductSans-Medium' },

  // Looking for
  lookingForCard:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 14 },
  lookingForText:  { fontSize: 15, fontFamily: 'ProductSans-Bold' },

  // Prompts
  promptList:      { gap: 10 },
  promptCard:      { padding: 16, gap: 6 },
  promptQuestion:  { fontSize: 12, fontFamily: 'ProductSans-Bold', letterSpacing: 0.3 },
  promptAnswer:    { fontSize: 15, fontFamily: 'ProductSans-Regular', lineHeight: 23 },

  // Language
  langChip:        { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9 },
  langText:        { fontSize: 13, fontFamily: 'ProductSans-Medium' },

  // Map
  mapCard:         { alignItems: 'center', justifyContent: 'center', paddingVertical: 28, gap: 8 },
  mapText:         { fontSize: 13, fontFamily: 'ProductSans-Regular' },

  // Danger
  dangerRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  dangerText:      { fontSize: 14, fontFamily: 'ProductSans-Medium' },

  // Action bar
  actionBar:       { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  dislikeBtn:      { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  superLikeBtn:    { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  likeBtn:         { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
});
