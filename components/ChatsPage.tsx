import { navPush, navReplace } from '@/utils/nav';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Squircle from '@/components/ui/Squircle';
import { apiFetch, WS_V1 } from '@/constants/api';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';

// ─── Session-level caches ─────────────────────────────────────────────────────
let _convsCache: Conversation[]  = [];
let _newMatchesCache: NewMatch[] = [];
let _convsHasMore                = false;

export function bustConvsCache() {
  _convsCache      = [];
  _newMatchesCache = [];
  _convsHasMore    = false;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface NewMatch {
  partner_id:    string;
  partner_name:  string;
  partner_image: string | null;
  is_super:      boolean;
  matched_at:    string;
  expires_at:    string | null;
  is_online:     boolean;
}

interface Conversation {
  partner_id: string;
  partner_name: string;
  partner_image: string | null;
  room_id: string;
  last_message: { content: string; sender_id: string; created_at: string; msg_type?: string } | null;
  unread_count: number;
  is_online: boolean;
  matched_at?: string;
  is_super_match?: boolean;
  expires_at?: string | null;
}

/** Formats a raw message content + msg_type into a human-readable preview. */
function _previewText(content: string, msgType?: string): string {
  switch (msgType) {
    case 'image':        return '📷 Photo';
    case 'voice':        return '🎙️ Voice message';
    case 'call':         return '📞 Call';
    case 'card':         return '🃏 Card';
    // Truth-or-Dare
    case 'tod_invite':   return '🎲 Truth or Dare invite';
    case 'tod_accept':   return '🎲 Accepted Truth or Dare';
    case 'tod_answer':   return '🎲 Answered Truth or Dare';
    case 'tod_next':     return '🎲 Next Truth or Dare round';
    // Mini-games (new types)
    case 'game_wyr':     return '🤷 Would You Rather';
    case 'game_nhi':     return '🍹 Never Have I Ever';
    case 'game_hot':     return '🔥 Hot Takes';
    case 'game_quiz':    return '💘 Compatibility Quiz';
    case 'game_date':    return '🗓️ Build a Date';
    case 'game_emoji':   return '😂 Emoji Story';
    // Legacy types
    case 'question_cards': return '❓ Question Card';
    case 'wyr':          return '🤔 Would You Rather';
    case 'hot_takes':    return '🔥 Hot Take';
    case 'nhi':          return '🙈 Never Have I Ever';
  }

  // Anything else with a non-text type label
  if (msgType && msgType !== 'text' && msgType !== 'message') return '🎮 Game';

  if (!content) return '';
  // Fallback: detect image by URI pattern (for legacy messages without msg_type)
  if (
    content.startsWith('file://') ||
    content.startsWith('ph://') ||
    /\.(jpg|jpeg|png|webp|heic|gif)(\?|$)/i.test(content) ||
    (content.startsWith('http') && (content.includes('/chat/') || content.includes('/photos/')))
  ) {
    return '📷 Photo';
  }
  return content;
}

function _relativeTime(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function _formatExpiry(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'Expired';
  const totalMins = Math.floor(ms / 60000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h >= 1) return `${h}h ${m}m`;
  return `${m}m`;
}

/** Returns true if the match timer has been extended (conversation started). */
function _isPermanent(expiresAt?: string | null): boolean {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() - Date.now() > 7 * 24 * 3600 * 1000;
}

// ─── Animated conversation row ────────────────────────────────────────────────

function ConvRow({
  conv, isMe, preview, timeStr, hasUnread, onPress, colors,
}: {
  conv: Conversation;
  isMe: boolean;
  preview: string;
  timeStr: string;
  hasUnread: boolean;
  onPress: () => void;
  colors: any;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 30, bounciness: 0 }).start();
  const onPressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 4 }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={({ pressed }) => [
          styles.convRow,
          { backgroundColor: pressed ? colors.surface2 : colors.surface },
        ]}
      >
        <View style={styles.avatarWrap}>
          {conv.partner_image
            ? <Image source={{ uri: conv.partner_image }} style={styles.avatar} contentFit="cover" cachePolicy="memory-disk" transition={150} recyclingKey={conv.partner_image} />
            : <View style={[styles.avatar, { backgroundColor: colors.surface2 }]} />
          }
          {conv.is_online && (
            <View style={[styles.onlineDot, { borderColor: colors.surface, backgroundColor: '#22c55e' }]} />
          )}
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <View style={styles.topRow}>
            <Text style={[styles.convName, { color: colors.text }]}>{conv.partner_name}</Text>
            <Text style={[styles.convTime, {
              color: hasUnread ? colors.text : colors.textSecondary,
              fontFamily: hasUnread ? 'ProductSans-Bold' : 'ProductSans-Regular',
            }]}>
              {timeStr}
            </Text>
          </View>
          <Text
            style={[styles.convPreview, {
              color: hasUnread ? colors.text : colors.textSecondary,
              fontFamily: hasUnread ? 'ProductSans-Medium' : 'ProductSans-Regular',
            }]}
            numberOfLines={1}
          >
            {isMe ? `You: ${preview}` : preview}
          </Text>
        </View>
        {hasUnread && (
          <Squircle style={styles.unreadBadge} cornerRadius={20} cornerSmoothing={1} fillColor={colors.text}>
            <Text style={[styles.unreadText, { color: colors.bg }]}>{conv.unread_count}</Text>
          </Squircle>
        )}
      </Pressable>
    </Animated.View>
  );
}

// ─── Shimmer placeholder ──────────────────────────────────────────────────────

function ShimmerRow() {
  const { colors } = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, marginBottom: 16 }}>
      <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surface }} />
      <View style={{ flex: 1, gap: 8 }}>
        <View style={{ width: '60%', height: 14, borderRadius: 6, backgroundColor: colors.surface }} />
        <View style={{ width: '80%', height: 12, borderRadius: 6, backgroundColor: colors.surface }} />
      </View>
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ChatsPage({ insets, token }: { insets: any; token: string | null }) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { profile } = useAuth();

  const [search,           setSearch]         = useState('');
  // convs holds ALL non-expired matches (with + without messages) — paginated
  const [convs,            setConvs]          = useState<Conversation[]>(_convsCache);
  const [convPage,         setConvPage]       = useState(0);
  const [convHasMore,      setConvHasMore]    = useState(_convsHasMore);
  const [convLoadingMore,  setConvLoadingMore]= useState(false);
  const [loading,          setLoading]        = useState(_convsCache.length === 0);
  const [, setTick]                           = useState(0);
  const convLoadingRef = useRef(false);

  // New matches (no messages) — from dedicated endpoint for horizontal strip pagination
  const [newMatches,    setNewMatches]    = useState<NewMatch[]>(_newMatchesCache);
  const [nmPage,        setNmPage]        = useState(0);
  const [nmHasMore,     setNmHasMore]     = useState(false);
  const [nmLoadingMore, setNmLoadingMore] = useState(false);
  const nmLoadingRef = useRef(false);

  const wsRef = useRef<WebSocket | null>(null);

  // Tick every 30s to refresh countdown timers
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // ── Paginated fetch for new matches horizontal strip ──────────────────────
  // Uses the dedicated /chat/matches/new endpoint (separate pagination from convs)
  const fetchNewMatchPage = useCallback(async (page: number, append: boolean) => {
    if (!token || nmLoadingRef.current) return;
    nmLoadingRef.current = true;
    if (append) setNmLoadingMore(true);
    try {
      const res = await apiFetch<{ matches: NewMatch[]; total: number; has_more: boolean }>(
        `/chat/matches/new?page=${page}&limit=10`, { token }
      );
      setNewMatches(prev => {
        const next = append ? [...prev, ...res.matches] : res.matches;
        _newMatchesCache = next;
        return next;
      });
      setNmPage(page);
      setNmHasMore(res.has_more);
    } catch { /* ignore */ }
    finally {
      nmLoadingRef.current = false;
      if (append) setNmLoadingMore(false);
    }
  }, [token]);

  // ── Paginated fetch for all conversations (includes new matches too) ───────
  const fetchConvPage = useCallback(async (page: number, append: boolean) => {
    if (!token || convLoadingRef.current) return;
    convLoadingRef.current = true;
    if (append) setConvLoadingMore(true);
    else if (page === 0) setLoading(true);
    try {
      const res = await apiFetch<{ conversations: Conversation[]; total: number; has_more: boolean }>(
        `/chat/conversations?page=${page}&limit=10`, { token }
      );
      setConvs(prev => {
        const next = append ? [...prev, ...res.conversations] : res.conversations;
        _convsCache   = next;
        _convsHasMore = res.has_more;
        return next;
      });
      setConvPage(page);
      setConvHasMore(res.has_more);
    } catch { /* ignore */ }
    finally {
      convLoadingRef.current = false;
      if (append) setConvLoadingMore(false);
      else if (page === 0) setLoading(false);
    }
  }, [token]);

  function fetchConvs() {
    if (!token) return;
    fetchConvPage(0, false);
  }

  useEffect(() => {
    if (!token) return;
    // Load new matches strip
    if (_newMatchesCache.length > 0) setNewMatches(_newMatchesCache);
    fetchNewMatchPage(0, false);
    // Load all conversations (includes new matches without messages)
    if (_convsCache.length > 0) {
      setConvs(_convsCache);
      setLoading(false);
      fetchConvPage(0, false);
    } else {
      fetchConvPage(0, false);
    }
  }, [token]);

  // Re-fetch when screen comes back into focus (e.g. returning from chat)
  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      fetchNewMatchPage(0, false);
      fetchConvPage(0, false);
    }, [token, fetchNewMatchPage, fetchConvPage])
  );

  // Detect scroll near bottom → load next conversations page
  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!convHasMore || convLoadingMore || convLoadingRef.current) return;
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const distanceFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height;
    if (distanceFromBottom < 200) {
      fetchConvPage(convPage + 1, true);
    }
  }, [convHasMore, convLoadingMore, convPage, fetchConvPage]);

  // ── notify WebSocket: update list on new_message or presence ──────────────
  useEffect(() => {
    if (!token) return;
    let disposed = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      if (disposed) return;
      const ws = new WebSocket(`${WS_V1}/ws/notify?token=${token}`);
      wsRef.current = ws;

      ws.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.type === 'new_message') {
            const myId = profile?.id ?? '';

            // Work out which side is the partner in this conversation
            const partnerId = payload.sender_id === myId
              ? payload.receiver_id
              : payload.sender_id;

            // ── Remove partner from new matches (they now have a message) ──
            setNewMatches(prev => {
              const next = prev.filter(m => m.partner_id !== partnerId);
              _newMatchesCache = next;
              return next;
            });

            // ── Update conversations list ──────────────────────────────────
            setConvs(prev => {
              const idx = prev.findIndex(c =>
                c.room_id    === payload.room_id ||
                c.partner_id === payload.sender_id ||
                c.partner_id === payload.receiver_id
              );
              if (idx === -1) {
                // Brand new conversation not yet in list — refresh
                fetchConvs();
                return prev;
              }
              const updated = [...prev];
              const conv = { ...updated[idx] };
              conv.last_message = {
                content:    payload.content,
                sender_id:  payload.sender_id,
                created_at: payload.created_at ?? new Date().toISOString(),
                msg_type:   payload.msg_type,
              };
              if (payload.sender_id !== myId) {
                conv.unread_count = (conv.unread_count ?? 0) + 1;
              }
              // Bubble to top
              updated.splice(idx, 1);
              const next = [conv, ...updated];
              _convsCache = next;
              return next;
            });
          } else if (payload.type === 'presence') {
            setConvs(prev => {
              const next = prev.map(c =>
                c.partner_id === payload.user_id
                  ? { ...c, is_online: payload.online }
                  : c
              );
              _convsCache = next;
              return next;
            });
          }
        } catch {}
      };

      ws.onclose = () => {
        if (!disposed) {
          retryTimer = setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [token]);

  const myId = profile?.id ?? '';

  const searchQ = search.trim().toLowerCase();

  // Filtered new matches (for search)
  const filteredNewMatches = searchQ
    ? newMatches.filter(m => m.partner_name.toLowerCase().includes(searchQ))
    : newMatches;

  // Active conversations: at least one message exchanged → list
  const activeConvs = convs.filter(c => {
    if (!c.last_message) return false;
    if (searchQ) return c.partner_name.toLowerCase().includes(searchQ);
    return true;
  });

  // When searching, include new matches in flat list too
  const searchConvMatches = searchQ
    ? convs.filter(c => !c.last_message && c.partner_name.toLowerCase().includes(searchQ))
    : [];

  const hasNoContent = !loading && newMatches.length === 0 && convs.length === 0;
  const hasNoActive  = !loading && activeConvs.length === 0 && searchConvMatches.length === 0;

  const openChatFromMatch = (m: NewMatch) =>
    navPush({ pathname: '/chat', params: {
      partnerId: m.partner_id,
      name:      m.partner_name,
      image:     m.partner_image ?? '',
      online:    m.is_online ? 'true' : 'false',
      expiresAt: m.expires_at ?? '',
      isSuper:   m.is_super ? 'true' : 'false',
    } });

  const openChat = (c: Conversation) =>
    navPush({ pathname: '/chat', params: {
      partnerId: c.partner_id,
      name: c.partner_name,
      image: c.partner_image ?? '',
      online: c.is_online ? 'true' : 'false',
      expiresAt: c.expires_at ?? '',
      isSuper: c.is_super_match ? 'true' : 'false',
    } });

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      onScroll={handleScroll}
      scrollEventThrottle={200}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.pageTitle, { color: colors.text }]}>Chats</Text>
      </View>

      {/* Search */}
      <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
        <Squircle
          style={styles.searchBar}
          cornerRadius={16} cornerSmoothing={1}
          fillColor={colors.surface}
          strokeColor={colors.border}
          strokeWidth={StyleSheet.hairlineWidth}
        >
          <Ionicons name="search-outline" size={16} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search conversations…"
            placeholderTextColor={colors.placeholder}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            selectionColor={colors.text}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
            </Pressable>
          )}
        </Squircle>
      </View>

      {/* ── New Matches circles (paginated horizontal FlatList) ────────────── */}
      {!searchQ && newMatches.length > 0 && (
        <View style={{ marginBottom: 28 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 14 }}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
              NEW MATCHES
            </Text>
            <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>
              {newMatches.length}{nmHasMore ? '+' : ''}
            </Text>
          </View>
          <FlatList
            horizontal
            data={filteredNewMatches}
            keyExtractor={m => m.partner_id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 14, paddingHorizontal: 16 }}
            onEndReachedThreshold={0.4}
            onEndReached={() => {
              if (nmHasMore && !nmLoadingMore) {
                fetchNewMatchPage(nmPage + 1, true);
              }
            }}
            ListFooterComponent={nmLoadingMore ? (
              <View style={{ justifyContent: 'center', alignItems: 'center', width: 50, paddingBottom: 8 }}>
                <ActivityIndicator size="small" color={colors.textSecondary} />
              </View>
            ) : null}
            renderItem={({ item: m }) => {
              const isSuper   = m.is_super;
              const permanent = _isPermanent(m.expires_at);
              const timerStr  = (!permanent && m.expires_at) ? _formatExpiry(m.expires_at) : null;
              const ringColor = isSuper ? '#F59E0B' : '#6366f1';
              return (
                <Pressable
                  onPress={() => openChatFromMatch(m)}
                  style={({ pressed }) => [{ alignItems: 'center', gap: 5, maxWidth: 72 }, pressed && { opacity: 0.75 }]}
                >
                  <View style={styles.matchRingWrap}>
                    <View style={[styles.matchRing, { borderColor: ringColor }]}>
                      {m.partner_image
                        ? <Image source={{ uri: m.partner_image }} style={styles.matchAvatar} contentFit="cover" cachePolicy="memory-disk" transition={150} recyclingKey={m.partner_image} />
                        : <View style={[styles.matchAvatar, { backgroundColor: colors.surface2 }]} />
                      }
                    </View>
                    {isSuper ? (
                      <View style={{ position: 'absolute', top: 0, right: 0, backgroundColor: '#F59E0B', borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: colors.bg }}>
                        <Ionicons name="star" size={9} color="#fff" />
                      </View>
                    ) : (
                      <View style={{ position: 'absolute', top: 0, right: 0, backgroundColor: '#6366f1', borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: colors.bg }}>
                        <Text style={{ color: '#fff', fontSize: 9, fontFamily: 'ProductSans-Bold' }}>NEW</Text>
                      </View>
                    )}
                    {m.is_online && (
                      <View style={[styles.matchDot, { backgroundColor: colors.bg, bottom: 0, right: 0, top: undefined }]}>
                        <View style={styles.matchDotInner} />
                      </View>
                    )}
                  </View>
                  <Text style={[styles.matchName, { color: isSuper ? '#F59E0B' : colors.text }]} numberOfLines={1}>
                    {m.partner_name.split(' ')[0]}
                  </Text>
                  {timerStr && (
                    <Text style={{ fontSize: 10, fontFamily: 'ProductSans-Medium', color: isSuper ? '#F59E0B' : '#6366f1', textAlign: 'center' }}>
                      {timerStr}
                    </Text>
                  )}
                </Pressable>
              );
            }}
          />
        </View>
      )}

      {/* Loading shimmer */}
      {loading && (
        <View style={{ gap: 0 }}>
          {[1, 2, 3].map(i => <ShimmerRow key={i} />)}
        </View>
      )}

      {/* ── Messages list (conversations with at least one message) ─────────── */}
      {!loading && (
        <View style={{ paddingHorizontal: 16 }}>
          {/* Only show the MESSAGES label when there are active convs */}
          {(activeConvs.length > 0 || searchConvMatches.length > 0) && (
            <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginBottom: 12 }]}>MESSAGES</Text>
          )}

          {/* Completely empty — no matches at all */}
          {hasNoContent && (
            <Squircle style={styles.convGroup} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={StyleSheet.hairlineWidth}>
              <View style={{ alignItems: 'center', padding: 32, gap: 8 }}>
                <Ionicons name="chatbubble-outline" size={28} color={colors.textTertiary} />
                <Text style={[styles.convPreview, { color: colors.textSecondary, textAlign: 'center' }]}>
                  Match with someone to start chatting!
                </Text>
              </View>
            </Squircle>
          )}

          {/* Search returned nothing */}
          {searchQ && activeConvs.length === 0 && searchConvMatches.length === 0 && filteredNewMatches.length === 0 && (
            <Squircle style={styles.convGroup} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={StyleSheet.hairlineWidth}>
              <View style={{ alignItems: 'center', padding: 32, gap: 8 }}>
                <Ionicons name="search-outline" size={28} color={colors.textTertiary} />
                <Text style={[styles.convPreview, { color: colors.textSecondary, textAlign: 'center' }]}>
                  No conversations found
                </Text>
              </View>
            </Squircle>
          )}

          {/* New matches that match the search query (flat, no circles while searching) */}
          <View style={{ gap: 10 }}>
            {searchConvMatches.map((c) => (
              <Squircle
                key={c.partner_id}
                cornerRadius={22} cornerSmoothing={1}
                fillColor={colors.surface}
                strokeColor={'#6366f1'}
                strokeWidth={1.5}
                style={{ overflow: 'hidden' }}
              >
                <ConvRow
                  conv={c}
                  isMe={false}
                  preview="Say hi! 👋"
                  timeStr=""
                  hasUnread={false}
                  colors={colors}
                  onPress={() => openChat(c)}
                />
              </Squircle>
            ))}
          </View>

          {/* Active conversations (have messages) */}
          <View style={{ gap: 10, marginTop: searchConvMatches.length > 0 ? 10 : 0, marginBottom: convLoadingMore ? 0 : 4 }}>
            {activeConvs.map((c) => {
              const rawContent  = c.last_message?.content ?? '';
              const msgType     = c.last_message?.msg_type;
              const preview     = _previewText(rawContent, msgType);
              const isMyMsg     = c.last_message?.sender_id === myId;
              const permanent   = _isPermanent(c.expires_at);
              const timerStr    = (!permanent && c.expires_at) ? _formatExpiry(c.expires_at) : null;
              const timeStr     = timerStr ? `⏱ ${timerStr}` : _relativeTime(c.last_message!.created_at);
              const hasUnread   = c.unread_count > 0;
              const isSuper     = !!c.is_super_match;
              const borderColor = isSuper ? '#F59E0B' : timerStr ? '#6366f1' : colors.border;
              const borderW     = isSuper || timerStr ? 1.5 : StyleSheet.hairlineWidth;
              return (
                <Squircle
                  key={c.partner_id}
                  cornerRadius={22} cornerSmoothing={1}
                  fillColor={colors.surface}
                  strokeColor={borderColor}
                  strokeWidth={borderW}
                  style={{ overflow: 'hidden' }}
                >
                  <ConvRow
                    conv={c}
                    isMe={isMyMsg}
                    preview={preview}
                    timeStr={timeStr}
                    hasUnread={hasUnread}
                    colors={colors}
                    onPress={() => openChat(c)}
                  />
                </Squircle>
              );
            })}
          </View>

          {/* Load-more spinner */}
          {convLoadingMore && (
            <View style={{ alignItems: 'center', paddingVertical: 16 }}>
              <ActivityIndicator size="small" color={colors.textSecondary} />
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16 },
  pageTitle:     { fontSize: 28, fontFamily: 'ProductSans-Black' },

  searchBar:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 44 },
  searchInput:   { flex: 1, fontSize: 15, fontFamily: 'ProductSans-Regular' },

  sectionLabel:  { fontSize: 10, fontFamily: 'ProductSans-Bold', letterSpacing: 1.5 },

  matchRingWrap: { position: 'relative' },
  matchRing:     { width: 66, height: 66, borderRadius: 33, borderWidth: 2, padding: 2 },
  matchAvatar:   { width: 58, height: 58, borderRadius: 29 },
  matchDot:      { position: 'absolute', bottom: 0, right: 0, width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  matchDotInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#22c55e' },
  matchName:     { fontSize: 12, fontFamily: 'ProductSans-Medium', textAlign: 'center' },

  convGroup:     { overflow: 'hidden' },
  convRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 22 },
  avatarWrap:    { position: 'relative' },
  avatar:        { width: 52, height: 52, borderRadius: 26 },
  onlineDot:     { position: 'absolute', bottom: 1, right: 1, width: 13, height: 13, borderRadius: 7, borderWidth: 2 },
  topRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  convName:      { fontSize: 15, fontFamily: 'ProductSans-Bold' },
  convTime:      { fontSize: 12 },
  convPreview:   { fontSize: 13 },
  divider:       { height: StyleSheet.hairlineWidth, marginLeft: 78 },
  unreadBadge:   { minWidth: 22, height: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  unreadText:    { fontSize: 11, fontFamily: 'ProductSans-Black' },
});
