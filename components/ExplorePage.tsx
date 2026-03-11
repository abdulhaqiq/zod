import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Dimensions,
  FlatList,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Squircle from '@/components/ui/Squircle';
import { useAuth } from '@/context/AuthContext';

const { width: W } = Dimensions.get('window');
const CARD_W  = W / 2 - 24;
const FEAT_W  = W - 56;

// ─── Mock data ────────────────────────────────────────────────────────────────

const FILTERS = ['All', 'Tonight', 'Weekend', 'Coffee', 'Nightlife', 'Outdoors', 'Pro'];

const FEATURED = [
  {
    id: 'f1', title: 'Saturday Night Out',
    sub: 'Locals hitting the best bars & rooftops',
    image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80',
    members: 142, tag: 'Tonight', pro: false,
    going: ['https://randomuser.me/api/portraits/women/44.jpg','https://randomuser.me/api/portraits/men/32.jpg','https://randomuser.me/api/portraits/women/68.jpg'],
  },
  {
    id: 'f2', title: 'Morning Coffee Walks',
    sub: 'Casual meets at local cafes — no pressure',
    image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80',
    members: 89, tag: 'Tomorrow', pro: false,
    going: ['https://randomuser.me/api/portraits/men/11.jpg','https://randomuser.me/api/portraits/women/25.jpg'],
  },
  {
    id: 'f3', title: 'Rooftop Sunrise Yoga',
    sub: 'Weekend sunrise session with amazing views',
    image: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&q=80',
    members: 38, tag: 'Sunday 6AM', pro: true,
    going: ['https://randomuser.me/api/portraits/women/72.jpg','https://randomuser.me/api/portraits/men/55.jpg','https://randomuser.me/api/portraits/women/38.jpg'],
  },
  {
    id: 'f4', title: 'Street Food Market',
    sub: 'Group dinner at the downtown night market',
    image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80',
    members: 204, tag: 'Saturday', pro: false,
    going: ['https://randomuser.me/api/portraits/men/22.jpg','https://randomuser.me/api/portraits/women/55.jpg'],
  },
];

const QUICK_MEETS = [
  { id: 'q1', emoji: '☕', title: 'Coffee', sub: 'Spontaneous meet', color: '#3e2723', members: 12 },
  { id: 'q2', emoji: '🚶', title: 'Walk', sub: 'Explore the city', color: '#1b5e20', members: 7 },
  { id: 'q3', emoji: '🍕', title: 'Grab food', sub: 'Lunch or dinner', color: '#bf360c', members: 19 },
  { id: 'q4', emoji: '🎮', title: 'Game night', sub: 'Board or video', color: '#1a237e', members: 5 },
  { id: 'q5', emoji: '🎬', title: 'Movie', sub: 'Cinema or streaming', color: '#4a148c', members: 8 },
  { id: 'q6', emoji: '🏃', title: 'Run', sub: 'Morning jog', color: '#e65100', members: 14 },
];

const TRENDING = [
  { id: 't1', emoji: '🌙', title: 'Night Life',   members: 340, hot: true,  pro: false, image: 'https://images.unsplash.com/photo-1566737236500-c8ac43014a67?w=400&q=80' },
  { id: 't2', emoji: '🎵', title: 'Live Music',   members: 258, hot: true,  pro: false, image: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=400&q=80' },
  { id: 't3', emoji: '🏃', title: 'Run Club',     members: 289, hot: false, pro: false, image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&q=80' },
  { id: 't4', emoji: '🎭', title: 'Arts & Culture', members: 76, hot: false, pro: true,  image: 'https://images.unsplash.com/photo-1536924940846-227afb31e2a5?w=400&q=80' },
  { id: 't5', emoji: '🌿', title: 'Wellness',     members: 113, hot: false, pro: false, image: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400&q=80' },
];

const CATEGORIES = [
  { id: 'c1', emoji: '🤝', title: 'Friend Groups', sub: 'Meet people, not just dates', members: 123, pro: false, image: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=600&q=80' },
  { id: 'c2', emoji: '📚', title: 'Study & Work',  sub: 'Co-work sessions & bookclubs', members: 55, pro: true,  image: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=600&q=80' },
  { id: 'c3', emoji: '☕', title: 'Coffee Dates',  sub: 'Casual meets at cosy cafes',  members: 198, pro: false, image: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=600&q=80' },
  { id: 'c4', emoji: '🎮', title: 'Gaming & Tech', sub: 'LAN parties & hackathons',    members: 91,  pro: true,  image: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=600&q=80' },
  { id: 'c5', emoji: '🍜', title: 'Food & Dining', sub: 'Group dinners & food markets', members: 164, pro: false, image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&q=80' },
  { id: 'c6', emoji: '🌍', title: 'Travel Mates',  sub: 'Find travel buddies',          members: 87,  pro: true,  image: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=600&q=80' },
];

// ─── Going avatars ────────────────────────────────────────────────────────────

function GoingAvatars({ uris, total, colors }: { uris: string[]; total: number; colors: any }) {
  return (
    <View style={styles.goingRow}>
      {uris.slice(0, 3).map((uri, i) => (
        <View key={i} style={[styles.goingAvatar, { marginLeft: i > 0 ? -10 : 0, borderColor: 'rgba(0,0,0,0.3)' }]}>
          <ImageBackground source={{ uri }} style={styles.goingAvatarImg} imageStyle={{ borderRadius: 14 }} />
        </View>
      ))}
      <View style={[styles.goingCount, { backgroundColor: 'rgba(0,0,0,0.45)' }]}>
        <Text style={styles.goingCountText}>{total} going</Text>
      </View>
    </View>
  );
}

// ─── Featured card ────────────────────────────────────────────────────────────

function FeaturedCard({ item, colors, joined, onJoin }: {
  item: typeof FEATURED[0]; colors: any; joined: boolean; onJoin: () => void;
}) {
  return (
    <View style={styles.featWrap}>
      <ImageBackground
        source={{ uri: item.image }}
        style={styles.featCard}
        imageStyle={{ borderRadius: 22 }}
      >
        {/* gradient-like dark overlay */}
        <View style={styles.featOverlay}>
          {/* Top row */}
          <View style={styles.featTopRow}>
            <Squircle cornerRadius={12} cornerSmoothing={1} fillColor="rgba(255,255,255,0.18)" style={styles.tagSquircle}>
              {item.pro && <Ionicons name="star" size={9} color="#f9c74f" style={{ marginRight: 3 }} />}
              <Text style={styles.tagText}>{item.tag}</Text>
            </Squircle>
            <Squircle cornerRadius={12} cornerSmoothing={1} fillColor="rgba(0,0,0,0.42)" style={styles.tagSquircle}>
              <Ionicons name="people" size={11} color="#fff" />
              <Text style={styles.tagText}> {item.members}</Text>
            </Squircle>
          </View>

          {/* Bottom */}
          <View style={styles.featBottom}>
            <GoingAvatars uris={item.going} total={item.members} colors={colors} />
            <Text style={styles.featTitle}>{item.title}</Text>
            <Text style={styles.featSub} numberOfLines={1}>{item.sub}</Text>
            <Pressable onPress={onJoin}>
              <Squircle
                cornerRadius={16} cornerSmoothing={1}
                fillColor={joined ? 'rgba(255,255,255,0.22)' : '#ffffff'}
                style={styles.joinSquircle}
              >
                <Ionicons name={joined ? 'checkmark' : item.pro ? 'lock-closed' : 'add'} size={14} color={joined ? '#fff' : '#000'} />
                <Text style={[styles.joinTxt, { color: joined ? '#fff' : '#000' }]}>
                  {joined ? 'Joined' : item.pro ? 'Pro only' : 'Join'}
                </Text>
              </Squircle>
            </Pressable>
          </View>
        </View>
      </ImageBackground>
    </View>
  );
}

// ─── Quick meet pill ──────────────────────────────────────────────────────────

function QuickMeetPill({ item, colors }: { item: typeof QUICK_MEETS[0]; colors: any }) {
  return (
    <Pressable style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}>
      <Squircle cornerRadius={18} cornerSmoothing={1} fillColor={colors.surface} style={styles.quickPill}>
        <Text style={styles.quickEmoji}>{item.emoji}</Text>
        <View>
          <Text style={[styles.quickTitle, { color: colors.text }]}>{item.title}</Text>
          <Text style={[styles.quickSub, { color: colors.textSecondary }]}>{item.members} nearby</Text>
        </View>
      </Squircle>
    </Pressable>
  );
}

// ─── Trending strip card ──────────────────────────────────────────────────────

function TrendingCard({ item, colors, onPress }: { item: typeof TRENDING[0]; colors: any; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.82 : 1 }]}>
      <View style={styles.trendCard}>
        <ImageBackground
          source={{ uri: item.image }}
          style={styles.trendImage}
          imageStyle={{ borderRadius: 18 }}
        >
          <View style={styles.trendOverlay}>
            {item.hot && (
              <Squircle cornerRadius={10} cornerSmoothing={1} fillColor="rgba(255,80,0,0.85)" style={styles.hotBadge}>
                <Text style={styles.hotText}>🔥 Hot</Text>
              </Squircle>
            )}
            {item.pro && (
              <Squircle cornerRadius={10} cornerSmoothing={1} fillColor="rgba(0,0,0,0.5)" style={styles.hotBadge}>
                <Ionicons name="star" size={10} color="#f9c74f" />
              </Squircle>
            )}
            <Text style={styles.trendEmoji}>{item.emoji}</Text>
            <Text style={styles.trendTitle}>{item.title}</Text>
            <Text style={styles.trendCount}>{item.members} joined</Text>
          </View>
        </ImageBackground>
      </View>
    </Pressable>
  );
}

// ─── Category card ────────────────────────────────────────────────────────────

function CategoryCard({ item, colors, onPress }: { item: typeof CATEGORIES[0]; colors: any; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.catCard, { opacity: pressed ? 0.82 : 1 }]}>
      <ImageBackground
        source={{ uri: item.image }}
        style={styles.catImage}
        imageStyle={{ borderRadius: 20 }}
      >
        <View style={styles.catOverlay}>
          {item.pro && (
            <View style={styles.catProBadge}>
              <Squircle cornerRadius={10} cornerSmoothing={1} fillColor="rgba(0,0,0,0.5)" style={styles.proBadgeSquircle}>
                <Ionicons name="star" size={9} color="#f9c74f" />
                <Text style={styles.proBadgeText}>Pro</Text>
              </Squircle>
            </View>
          )}
          <Text style={styles.catEmoji}>{item.emoji}</Text>
          <Text style={styles.catTitle}>{item.title}</Text>
          <Text style={styles.catSub} numberOfLines={1}>{item.sub}</Text>
          <View style={styles.catMeta}>
            <Ionicons name="people-outline" size={11} color="rgba(255,255,255,0.8)" />
            <Text style={styles.catMetaText}>{item.members}</Text>
          </View>
        </View>
      </ImageBackground>
    </Pressable>
  );
}

// ─── Stats row ────────────────────────────────────────────────────────────────

function StatsRow({ colors }: { colors: any }) {
  const stats = [
    { icon: 'radio-button-on' as const, label: '284 active now', color: '#4caf50' },
    { icon: 'location'         as const, label: '12 events nearby', color: colors.text },
    { icon: 'time-outline'     as const, label: '3 tonight',       color: '#ff9800' },
  ];
  return (
    <View style={styles.statsRow}>
      {stats.map((s, i) => (
        <Squircle key={i} cornerRadius={12} cornerSmoothing={1} fillColor={colors.surface} style={styles.statChip}>
          <Ionicons name={s.icon} size={12} color={s.color} />
          <Text style={[styles.statText, { color: colors.text }]}>{s.label}</Text>
        </Squircle>
      ))}
    </View>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ExplorePage({ colors, insets }: { colors: any; insets: any }) {
  const router = useRouter();
  const { profile } = useAuth();
  const isPro = profile?.subscription_tier && profile.subscription_tier !== 'free';

  const [activeFilter, setActiveFilter] = useState('All');
  const [joinedMap, setJoinedMap] = useState<Record<string, boolean>>({});
  const [featIdx, setFeatIdx] = useState(0);

  const handleJoin = (id: string, pro: boolean) => {
    if (pro && !isPro) { router.push('/subscription'); return; }
    setJoinedMap(p => ({ ...p, [id]: !p[id] }));
  };

  const handleProPress = (pro: boolean) => {
    if (pro && !isPro) router.push('/subscription');
  };

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 60, 80) }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Page heading ────────────────────────────────────────────────── */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={[styles.pageTitle, { color: colors.text }]}>Explore</Text>
          <Text style={[styles.pageSub, { color: colors.textSecondary }]}>Discover experiences near you</Text>
        </View>
        <Squircle cornerRadius={14} cornerSmoothing={1} fillColor={colors.surface} style={styles.locationChip}>
          <Ionicons name="location-outline" size={13} color={colors.text} />
          <Text style={[styles.locationText, { color: colors.text }]}>
            {profile?.city ?? 'Nearby'}
          </Text>
        </Squircle>
      </View>

      {/* ── Stats ───────────────────────────────────────────────────────── */}
      <StatsRow colors={colors} />

      {/* ── Search ──────────────────────────────────────────────────────── */}
      <Pressable>
        <Squircle cornerRadius={16} cornerSmoothing={1} fillColor={colors.surface} style={styles.searchBar}>
          <Ionicons name="search-outline" size={16} color={colors.textSecondary} />
          <Text style={[styles.searchHint, { color: colors.textSecondary }]}>Search events, vibes, people…</Text>
          <Squircle cornerRadius={10} cornerSmoothing={1} fillColor={colors.bg} style={styles.filterIcon}>
            <Ionicons name="options-outline" size={14} color={colors.text} />
          </Squircle>
        </Squircle>
      </Pressable>

      {/* ── Filter chips ────────────────────────────────────────────────── */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersRow}
      >
        {FILTERS.map(f => (
          <Pressable key={f} onPress={() => setActiveFilter(f)}>
            <Squircle
              cornerRadius={14} cornerSmoothing={1}
              fillColor={activeFilter === f ? colors.text : colors.surface}
              style={styles.filterChip}
            >
              {f === 'Pro' && <Ionicons name="star" size={11} color={activeFilter === f ? colors.bg : '#f9c74f'} style={{ marginRight: 3 }} />}
              <Text style={[styles.filterLabel, { color: activeFilter === f ? colors.bg : colors.textSecondary }]}>
                {f}
              </Text>
            </Squircle>
          </Pressable>
        ))}
      </ScrollView>

      {/* ── Featured carousel ───────────────────────────────────────────── */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Happening Now</Text>
        <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>Real experiences, real people</Text>
      </View>
      <FlatList
        data={FEATURED}
        keyExtractor={i => i.id}
        horizontal
        snapToInterval={FEAT_W + 12}
        snapToAlignment="start"
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
        onMomentumScrollEnd={e => setFeatIdx(Math.round(e.nativeEvent.contentOffset.x / (FEAT_W + 12)))}
        renderItem={({ item }) => (
          <FeaturedCard
            item={item} colors={colors}
            joined={!!joinedMap[item.id]}
            onJoin={() => handleJoin(item.id, item.pro)}
          />
        )}
      />
      {/* dots */}
      <View style={styles.dotsRow}>
        {FEATURED.map((_, i) => (
          <View key={i} style={[styles.dot, { backgroundColor: i === featIdx ? colors.text : colors.border, width: i === featIdx ? 16 : 6 }]} />
        ))}
      </View>

      {/* ── Quick meets ─────────────────────────────────────────────────── */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Meets</Text>
        <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>Spontaneous plans nearby</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow}>
        {QUICK_MEETS.map(item => (
          <QuickMeetPill key={item.id} item={item} colors={colors} />
        ))}
      </ScrollView>

      {/* ── Trending ────────────────────────────────────────────────────── */}
      <View style={[styles.sectionHeader, styles.sectionHeaderRow]}>
        <View>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Trending Vibes</Text>
          <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>Popular in your area</Text>
        </View>
        <Pressable>
          <Text style={[styles.seeAll, { color: colors.textSecondary }]}>See all</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trendRow}>
        {TRENDING.map(item => (
          <TrendingCard key={item.id} item={item} colors={colors} onPress={() => handleProPress(item.pro)} />
        ))}
      </ScrollView>

      {/* ── Pro banner ──────────────────────────────────────────────────── */}
      {!isPro && (
        <Pressable onPress={() => router.push('/subscription')} style={{ paddingHorizontal: 16, marginTop: 20 }}>
          <Squircle cornerRadius={20} cornerSmoothing={1} fillColor={colors.text} style={styles.proBanner}>
            <View style={styles.proBannerLeft}>
              <Squircle cornerRadius={14} cornerSmoothing={1} fillColor="rgba(255,255,255,0.15)" style={styles.proBannerIcon}>
                <Ionicons name="star" size={20} color="#f9c74f" />
              </Squircle>
              <View>
                <Text style={[styles.proBannerTitle, { color: colors.bg }]}>Unlock Zod Pro</Text>
                <Text style={[styles.proBannerSub, { color: colors.bg, opacity: 0.65 }]}>
                  Access all events & exclusive experiences
                </Text>
              </View>
            </View>
            <Squircle cornerRadius={12} cornerSmoothing={1} fillColor="rgba(255,255,255,0.15)" style={styles.proBannerArrow}>
              <Ionicons name="arrow-forward" size={16} color={colors.bg} />
            </Squircle>
          </Squircle>
        </Pressable>
      )}

      {/* ── Browse all ──────────────────────────────────────────────────── */}
      <View style={[styles.sectionHeader, styles.sectionHeaderRow]}>
        <View>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>All Experiences</Text>
          <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>Explore every category</Text>
        </View>
      </View>
      <View style={styles.catGrid}>
        {CATEGORIES.map(item => (
          <CategoryCard key={item.id} item={item} colors={colors} onPress={() => handleProPress(item.pro)} />
        ))}
      </View>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  pageHeader:       { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 },
  pageTitle:        { fontSize: 26, fontFamily: 'ProductSans-Bold' },
  pageSub:          { fontSize: 13, fontFamily: 'ProductSans-Regular', marginTop: 1 },
  locationChip:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 7 },
  locationText:     { fontSize: 12, fontFamily: 'ProductSans-Medium' },

  statsRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, marginTop: 12 },
  statChip:         { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6 },
  statText:         { fontSize: 11, fontFamily: 'ProductSans-Medium' },

  searchBar:        { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 14, paddingHorizontal: 14, paddingVertical: 12 },
  searchHint:       { flex: 1, fontSize: 13, fontFamily: 'ProductSans-Regular' },
  filterIcon:       { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },

  filtersRow:       { paddingHorizontal: 16, gap: 8, marginTop: 12, paddingBottom: 2 },
  filterChip:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8 },
  filterLabel:      { fontSize: 13, fontFamily: 'ProductSans-Medium' },

  sectionHeader:    { paddingHorizontal: 16, marginTop: 22, marginBottom: 12 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  sectionTitle:     { fontSize: 18, fontFamily: 'ProductSans-Bold' },
  sectionSub:       { fontSize: 12, fontFamily: 'ProductSans-Regular', marginTop: 2 },
  seeAll:           { fontSize: 13, fontFamily: 'ProductSans-Medium', paddingBottom: 2 },

  // Featured
  featWrap:         { width: FEAT_W },
  featCard:         { width: FEAT_W, height: 230, borderRadius: 22, overflow: 'hidden' },
  featOverlay:      { flex: 1, justifyContent: 'space-between', padding: 14, backgroundColor: 'rgba(0,0,0,0.32)', borderRadius: 22 },
  featTopRow:       { flexDirection: 'row', justifyContent: 'space-between' },
  tagSquircle:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5 },
  tagText:          { color: '#fff', fontSize: 11, fontFamily: 'ProductSans-Bold' },
  featBottom:       { gap: 3 },
  featTitle:        { color: '#fff', fontSize: 20, fontFamily: 'ProductSans-Bold' },
  featSub:          { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontFamily: 'ProductSans-Regular' },
  joinSquircle:     { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 8, marginTop: 8 },
  joinTxt:          { fontSize: 13, fontFamily: 'ProductSans-Bold' },

  goingRow:         { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  goingAvatar:      { width: 28, height: 28, borderRadius: 14, overflow: 'hidden', borderWidth: 1.5 },
  goingAvatarImg:   { width: '100%', height: '100%' },
  goingCount:       { marginLeft: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  goingCountText:   { color: '#fff', fontSize: 11, fontFamily: 'ProductSans-Medium' },

  dotsRow:          { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 10 },
  dot:              { height: 6, borderRadius: 3 },

  // Quick meets
  quickRow:         { paddingHorizontal: 16, gap: 10 },
  quickPill:        { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  quickEmoji:       { fontSize: 22 },
  quickTitle:       { fontSize: 13, fontFamily: 'ProductSans-Bold' },
  quickSub:         { fontSize: 11, fontFamily: 'ProductSans-Regular', marginTop: 1 },

  // Trending
  trendRow:         { paddingHorizontal: 16, gap: 10 },
  trendCard:        { width: 140 },
  trendImage:       { width: 140, height: 180, borderRadius: 18, overflow: 'hidden' },
  trendOverlay:     { flex: 1, padding: 12, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.38)', borderRadius: 18 },
  hotBadge:         { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 4 },
  hotText:          { color: '#fff', fontSize: 10, fontFamily: 'ProductSans-Bold' },
  trendEmoji:       { fontSize: 24, marginBottom: 4 },
  trendTitle:       { color: '#fff', fontSize: 14, fontFamily: 'ProductSans-Bold' },
  trendCount:       { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontFamily: 'ProductSans-Regular', marginTop: 2 },

  // Pro banner
  proBanner:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16 },
  proBannerLeft:    { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  proBannerIcon:    { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  proBannerTitle:   { fontSize: 15, fontFamily: 'ProductSans-Bold' },
  proBannerSub:     { fontSize: 12, fontFamily: 'ProductSans-Regular', marginTop: 2 },
  proBannerArrow:   { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },

  // Category grid
  catGrid:          { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 12 },
  catCard:          { width: CARD_W },
  catImage:         { width: '100%', height: CARD_W * 1.2, borderRadius: 20, overflow: 'hidden' },
  catOverlay:       { flex: 1, padding: 12, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.42)', borderRadius: 20, position: 'relative' },
  catProBadge:      { position: 'absolute', top: 10, right: 10 },
  proBadgeSquircle: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 4 },
  proBadgeText:     { color: '#f9c74f', fontSize: 10, fontFamily: 'ProductSans-Bold' },
  catEmoji:         { fontSize: 26, marginBottom: 4 },
  catTitle:         { color: '#fff', fontSize: 14, fontFamily: 'ProductSans-Bold' },
  catSub:           { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontFamily: 'ProductSans-Regular', marginTop: 2 },
  catMeta:          { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  catMetaText:      { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontFamily: 'ProductSans-Regular' },
});
