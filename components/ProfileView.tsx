import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Squircle from '@/components/ui/Squircle';
import { useAppTheme } from '@/context/ThemeContext';

const { width: W } = Dimensions.get('window');

// ─── Mock extended profiles ───────────────────────────────────────────────────

const EXTENDED_PROFILES: Record<string, ExtendedProfile> = {
  '1': {
    id: '1',
    name: 'Sophia',
    age: 25,
    verified: true,
    premium: false,
    location: 'Los Angeles, CA',
    distance: '3.5 km',
    about: "Hey! I'm Sophia 👋 I love long drives, spontaneous trips, and deep conversations over coffee. If you can make me laugh, we'll get along great 😄",
    images: [
      'https://randomuser.me/api/portraits/women/44.jpg',
      'https://randomuser.me/api/portraits/women/45.jpg',
      'https://randomuser.me/api/portraits/women/46.jpg',
    ],
    details: {
      height: "5'6\" (168 cm)",
      drinks: 'Socially',
      smokes: 'Never',
      gender: 'Woman',
      wantsKids: 'Open to it',
      sign: '♊ Gemini',
      politics: 'Liberal',
      religion: 'Spiritual',
      work: 'UX Designer at Adobe',
      education: 'UCLA – Design',
    },
    lookingFor: 'Something serious',
    interests: [
      { emoji: '☕', label: 'Coffee' },
      { emoji: '✈️', label: 'Travel' },
      { emoji: '📚', label: 'Books' },
      { emoji: '🎨', label: 'Art' },
      { emoji: '🍕', label: 'Food' },
    ],
    prompts: [
      { question: "Don't be mad if I…", answer: "Order dessert before checking the menu properly 🍰" },
      { question: 'My ideal Sunday looks like…', answer: "Farmers market → coffee → nowhere to be 🌿" },
    ],
    languages: ['English', 'Spanish'],
  },
  '2': {
    id: '2',
    name: 'Elena',
    age: 22,
    verified: true,
    premium: true,
    location: 'New York, NY',
    distance: '1.2 km',
    about: "Artist by day, dreamer by night 🎨 I find magic in small things — a good book, a rainy afternoon, and the perfect playlist.",
    images: [
      'https://randomuser.me/api/portraits/women/68.jpg',
      'https://randomuser.me/api/portraits/women/69.jpg',
    ],
    details: {
      height: "5'4\" (163 cm)",
      drinks: 'Never',
      smokes: 'Never',
      gender: 'Woman',
      wantsKids: 'Yes, I do',
      sign: '♓ Pisces',
      politics: 'Progressive',
      religion: 'Agnostic',
      work: 'Fine Art Painter',
      education: 'NYU – Fine Arts',
    },
    lookingFor: 'My forever person',
    interests: [
      { emoji: '🎨', label: 'Art' },
      { emoji: '🎵', label: 'Music' },
      { emoji: '🧘', label: 'Yoga' },
      { emoji: '📸', label: 'Photography' },
      { emoji: '🍷', label: 'Wine' },
    ],
    prompts: [
      { question: 'The way to win me over is…', answer: "Show up with coffee and zero agenda ☕" },
      { question: 'My most controversial opinion is…', answer: "Pineapple on pizza is actually fine. Come at me 🍍" },
    ],
    languages: ['English', 'French'],
  },
  '3': { id: '3', name: 'Maya', age: 27, verified: false, premium: false, location: 'Miami, FL', distance: '5.8 km', about: "Beach lover, fitness freak, and foodie 🌊 Living my best life in Miami. Let's explore this city together!", images: ['https://randomuser.me/api/portraits/women/50.jpg'], details: { height: "5'7\" (170 cm)", drinks: 'Socially', smokes: 'Never', gender: 'Woman', wantsKids: 'No', sign: '♌ Leo', politics: 'Moderate', religion: 'Christian', work: 'Personal Trainer', education: 'FIU – Sports Science' }, lookingFor: 'Casual dating', interests: [{ emoji: '🏖️', label: 'Beach' }, { emoji: '🏋️', label: 'Gym' }, { emoji: '🍜', label: 'Food' }, { emoji: '🏄', label: 'Surfing' }, { emoji: '📸', label: 'Photography' }], prompts: [{ question: "Don't be mad if I…", answer: "Drag you to the gym at 6am and actually enjoy it 💪" }], languages: ['English', 'Portuguese'] },
  '4': { id: '4', name: 'Aria', age: 24, verified: true, premium: false, location: 'Austin, TX', distance: '2.1 km', about: "Engineer who codes by day and dances by night 💃 Looking for someone who challenges me intellectually and can keep up on the dance floor.", images: ['https://randomuser.me/api/portraits/women/79.jpg', 'https://randomuser.me/api/portraits/women/80.jpg'], details: { height: "5'5\" (165 cm)", drinks: 'Regularly', smokes: 'Never', gender: 'Woman', wantsKids: 'Open to it', sign: '♈ Aries', politics: 'Liberal', religion: 'Atheist', work: 'Software Engineer at Apple', education: 'UT Austin – CS' }, lookingFor: 'Something serious', interests: [{ emoji: '💃', label: 'Dancing' }, { emoji: '👗', label: 'Fashion' }, { emoji: '💻', label: 'Tech' }, { emoji: '🎮', label: 'Gaming' }, { emoji: '🌮', label: 'Tacos' }], prompts: [{ question: 'Two truths and a lie…', answer: "I've met Elon Musk. I speak 3 languages. I hate tacos. 👀" }], languages: ['English', 'Korean'] },
  '5': { id: '5', name: 'Zara', age: 26, verified: true, premium: true, location: 'Chicago, IL', distance: '4.0 km', about: "Adventure seeker with a glass of red 🍷 Happiest on a mountain trail or at a rooftop bar. Let's do both.", images: ['https://randomuser.me/api/portraits/women/32.jpg', 'https://randomuser.me/api/portraits/women/33.jpg', 'https://randomuser.me/api/portraits/women/34.jpg'], details: { height: "5'8\" (173 cm)", drinks: 'Regularly', smokes: 'Socially', gender: 'Woman', wantsKids: 'No', sign: '♏ Scorpio', politics: 'Moderate', religion: 'Buddhist', work: 'Travel Photographer', education: 'Northwestern – Journalism' }, lookingFor: 'Casual dating', interests: [{ emoji: '🥾', label: 'Hiking' }, { emoji: '📸', label: 'Photography' }, { emoji: '🍷', label: 'Wine' }, { emoji: '🏕️', label: 'Camping' }, { emoji: '⛷️', label: 'Skiing' }], prompts: [{ question: 'I know the best spot in town for…', answer: "Rooftop sunsets and cheap cocktails. Proven formula. 🌅" }, { question: 'Catch flights or catch feelings?', answer: "Both. At the same time. It's called efficiency 🛫❤️" }], languages: ['English', 'Swahili'] },
};

interface ExtendedProfile {
  id: string;
  name: string;
  age: number;
  verified: boolean;
  premium: boolean;
  location: string;
  distance: string;
  about: string;
  images: string[];
  details: {
    height: string;
    drinks: string;
    smokes: string;
    gender: string;
    wantsKids: string;
    sign: string;
    politics: string;
    religion: string;
    work: string;
    education: string;
  };
  lookingFor: string;
  interests: { emoji: string; label: string }[];
  prompts: { question: string; answer: string }[];
  languages: string[];
}

// ─── Detail chip ──────────────────────────────────────────────────────────────

function DetailChip({ icon, label, value, colors }: {
  icon: keyof typeof import('@expo/vector-icons/build/Ionicons').glyphMap;
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
      <Ionicons name={icon} size={14} color={colors.btnPrimaryBg} />
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
  const { id }   = useLocalSearchParams<{ id: string }>();

  const profile = EXTENDED_PROFILES[id ?? '1'] ?? EXTENDED_PROFILES['1'];

  const [photoIndex, setPhotoIndex] = useState(0);
  const [superLiked, setSuperLiked] = useState(false);
  const [liked,      setLiked]      = useState(false);

  const onPhotoScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / W);
    setPhotoIndex(idx);
  };

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
  ];

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
              <Text style={[styles.bigName, { color: colors.text }]}>{profile.name}, {profile.age}</Text>
              {profile.verified && <Ionicons name="checkmark-circle" size={22} color="#4FC3F7" style={{ marginLeft: 6 }} />}
              {profile.premium && (
                <View style={styles.premiumBadge}>
                  <Ionicons name="star" size={10} color="#FFD60A" />
                  <Text style={styles.premiumText}>PREMIUM</Text>
                </View>
              )}
            </View>
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
              <Text style={[styles.locationText, { color: colors.textSecondary }]}>
                {profile.location}  ·  {profile.distance} away
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* About */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>ABOUT</Text>
            <Text style={[styles.aboutText, { color: colors.text }]}>{profile.about}</Text>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Details grid */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>DETAILS</Text>
            <View style={styles.detailGrid}>
              {DETAIL_ROWS.map((row) => (
                <DetailChip key={row.label} {...row} colors={colors} />
              ))}
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Interests */}
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

          {/* Looking for */}
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

          {/* Location map placeholder */}
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
                {profile.location}  ·  {profile.distance} away
              </Text>
            </Squircle>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Report / Block */}
          <View style={[styles.section, { gap: 8 }]}>
            <Pressable style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
              <View style={styles.dangerRow}>
                <Ionicons name="flag-outline" size={16} color={colors.error} />
                <Text style={[styles.dangerText, { color: colors.error }]}>Report {profile.name}</Text>
              </View>
            </Pressable>
            <Pressable style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
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
