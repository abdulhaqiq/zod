import { navPush, navReplace } from '@/utils/nav';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { API_V1 } from '@/constants/api';
import { useAuth } from '@/context/AuthContext';

const { width: W } = Dimensions.get('window');
const CARD_W  = W / 2 - 24;
const FEAT_W  = W - 56;

const FILTERS = ['All', 'Tonight', 'Weekend', 'Coffee', 'Nightlife', 'Outdoors', 'Pro'];

// ─── Types ────────────────────────────────────────────────────────────────────

type FeaturedItem = {
  id: string; title: string; sub: string; image: string;
  members: number; tag: string; pro: boolean; going: string[];
};
type QuickMeetItem = { id: string; emoji: string; title: string; sub: string; members: number };
type TrendingItem  = { id: string; emoji: string; title: string; members: number; hot: boolean; pro: boolean; image: string };
type CategoryItem  = { id: string; emoji: string; title: string; sub: string; members: number; pro: boolean; image: string };

type ExploreFeed = {
  city: string;
  featured: FeaturedItem[];
  quick_meets: QuickMeetItem[];
  trending: TrendingItem[];
  categories: CategoryItem[];
};

// ─── Going avatars ────────────────────────────────────────────────────────────

function GoingAvatars({ uris, total }: { uris: string[]; total: number }) {
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
  item: FeaturedItem; colors: any; joined: boolean; onJoin: () => void;
}) {
  return (
    <View style={styles.featWrap}>
      <ImageBackground
        source={{ uri: item.image }}
        style={styles.featCard}
        imageStyle={{ borderRadius: 22 }}
      >
        <View style={styles.featOverlay}>
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
          <View style={styles.featBottom}>
            <GoingAvatars uris={item.going} total={item.members} />
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

function QuickMeetPill({ item, colors }: { item: QuickMeetItem; colors: any }) {
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

function TrendingCard({ item, colors, onPress }: { item: TrendingItem; colors: any; onPress: () => void }) {
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

function CategoryCard({ item, colors, onPress }: { item: CategoryItem; colors: any; onPress: () => void }) {
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

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ExplorePage({ colors, insets }: { colors: any; insets: any }) {
  const router = useRouter();
  const { profile, token } = useAuth();
  const isPro = profile?.subscription_tier && profile.subscription_tier !== 'free';

  const [activeFilter, setActiveFilter] = useState('All');
  const [joinedMap, setJoinedMap] = useState<Record<string, boolean>>({});
  const [featIdx, setFeatIdx] = useState(0);

  const [feed, setFeed] = useState<ExploreFeed | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch(`${API_V1}/explore/feed`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => setFeed(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const handleJoin = (id: string, pro: boolean) => {
    if (pro && !isPro) { navPush('/subscription'); return; }
    setJoinedMap(p => ({ ...p, [id]: !p[id] }));
  };

  const handleProPress = (pro: boolean) => {
    if (pro && !isPro) navPush('/subscription');
  };

  const featured   = feed?.featured   ?? [];
  const quickMeets = feed?.quick_meets ?? [];
  const trending   = feed?.trending   ?? [];
  const categories = feed?.categories ?? [];
  const cityLabel  = feed?.city ?? profile?.city ?? 'Nearby';

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 60, 80) }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Page heading, search, filters, loading, featured & quick meets ──
      <View style={styles.pageHeader}>
        <View>
          <Text style={[styles.pageTitle, { color: colors.text }]}>Explore</Text>
          <Text style={[styles.pageSub, { color: colors.textSecondary }]}>Discover experiences near you</Text>
        </View>
        <Squircle cornerRadius={14} cornerSmoothing={1} fillColor={colors.surface} style={styles.locationChip}>
          <Ionicons name="location-outline" size={13} color={colors.text} />
          <Text style={[styles.locationText, { color: colors.text }]}>{cityLabel}</Text>
        </Squircle>
      </View>
      <Pressable>
        <Squircle cornerRadius={16} cornerSmoothing={1} fillColor={colors.surface} strokeColor="rgba(128,128,128,0.25)" strokeWidth={1.5} style={styles.searchBar}>
          <Ionicons name="search-outline" size={16} color={colors.textSecondary} />
          <Text style={[styles.searchHint, { color: colors.textSecondary }]}>Search events, vibes, people…</Text>
          <Squircle cornerRadius={10} cornerSmoothing={1} fillColor={colors.bg} style={styles.filterIcon}>
            <Ionicons name="options-outline" size={14} color={colors.text} />
          </Squircle>
        </Squircle>
      </Pressable>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
        {FILTERS.map(f => {
          const isActive = activeFilter === f;
          return (
            <Pressable key={f} onPress={() => setActiveFilter(f)}>
              <Squircle cornerRadius={14} cornerSmoothing={1} fillColor={isActive ? colors.text : colors.surface} strokeColor={isActive ? colors.text : 'rgba(128,128,128,0.32)'} strokeWidth={1.5} style={styles.filterChip}>
                {f === 'Pro' && <Ionicons name="star" size={11} color={isActive ? colors.bg : '#f9c74f'} style={{ marginRight: 3 }} />}
                <Text style={[styles.filterLabel, { color: isActive ? colors.bg : colors.textSecondary }]}>{f}</Text>
              </Squircle>
            </Pressable>
          );
        })}
      </ScrollView>
      {loading && (
        <View style={{ alignItems: 'center', marginTop: 40 }}>
          <ActivityIndicator color={colors.text} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading experiences…</Text>
        </View>
      )}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Happening Now</Text>
        <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>Real experiences, real people</Text>
      </View>
      {featured.length > 0 ? (
        <>
          <FlatList data={featured} keyExtractor={i => i.id} horizontal snapToInterval={FEAT_W + 12} snapToAlignment="start" decelerationRate="fast" showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }} onMomentumScrollEnd={e => setFeatIdx(Math.round(e.nativeEvent.contentOffset.x / (FEAT_W + 12)))} renderItem={({ item }) => (<FeaturedCard item={item} colors={colors} joined={!!joinedMap[item.id]} onJoin={() => handleJoin(item.id, item.pro)} />)} />
          <View style={styles.dotsRow}>{featured.map((_, i) => (<View key={i} style={[styles.dot, { backgroundColor: i === featIdx ? colors.text : colors.border, width: i === featIdx ? 16 : 6 }]} />))}</View>
        </>
      ) : (
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No events in your city yet.</Text>
      )}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Meets</Text>
        <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>Spontaneous plans nearby</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow}>
        {quickMeets.map(item => (<QuickMeetPill key={item.id} item={item} colors={colors} />))}
      </ScrollView>
      ────────────────────────────────────────────────────────────────────────── */}

      {!loading && (
        <>
          {/* ── Trending Vibes ──────────────────────────────────────────────── */}
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
            {trending.map(item => (
              <TrendingCard key={item.id} item={item} colors={colors} onPress={() => handleProPress(item.pro)} />
            ))}
          </ScrollView>

          {/* ── Pro banner ──────────────────────────────────────────────────── */}
          {!isPro && (
            <Pressable onPress={() => navPush('/subscription')} style={{ paddingHorizontal: 16, marginTop: 20 }}>
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
            {categories.map(item => (
              <CategoryCard key={item.id} item={item} colors={colors} onPress={() => handleProPress(item.pro)} />
            ))}
          </View>
        </>
      )}
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

  searchBar:        { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 14, paddingHorizontal: 14, paddingVertical: 12 },
  searchHint:       { flex: 1, fontSize: 13, fontFamily: 'ProductSans-Regular' },
  filterIcon:       { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },

  filtersRow:       { paddingHorizontal: 16, gap: 8, marginTop: 12, paddingBottom: 2 },
  filterChip:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8 },
  filterLabel:      { fontSize: 13, fontFamily: 'ProductSans-Medium' },

  loadingText:      { fontSize: 13, fontFamily: 'ProductSans-Regular', marginTop: 8 },
  emptyText:        { fontSize: 13, fontFamily: 'ProductSans-Regular', textAlign: 'center', marginVertical: 16, paddingHorizontal: 16 },

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
