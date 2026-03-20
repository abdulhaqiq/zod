import { navPush, navReplace } from '@/utils/nav';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
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

// ─── Session-level conversation cache ────────────────────────────────────────
// Persists across tab navigation so the list re-renders instantly on revisit.
// Cleared by bustConvsCache() whenever a fresh pull is needed.
let _convsCache: Conversation[] | null = null;

export function bustConvsCache() {
  _convsCache = null;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Conversation {
  partner_id: string;
  partner_name: string;
  partner_image: string | null;
  room_id: string;
  last_message: { content: string; sender_id: string; created_at: string; msg_type?: string } | null;
  unread_count: number;
  is_online: boolean;
}

/** Formats a raw message content + msg_type into a human-readable preview. */
function _previewText(content: string, msgType?: string): string {
  // Use msg_type first (most reliable)
  if (msgType === 'image') return '📷 Photo';
  if (msgType && msgType !== 'text' && msgType !== 'message') {
    // Game / tod / mini-game messages
    if (msgType.startsWith('tod_')) return '🎯 Truth or Dare';
    if (msgType === 'question_cards') return '❓ Question Card';
    if (msgType === 'wyr') return '🤔 Would You Rather';
    if (msgType === 'hot_takes') return '🔥 Hot Take';
    if (msgType === 'nhi') return '🙈 Never Have I Ever';
    return '🎮 Game';
  }

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
            ? <Image source={{ uri: conv.partner_image }} style={styles.avatar} contentFit="cover" cachePolicy="memory-disk" transition={150} />
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

  const [search, setSearch]   = useState('');
  // Seed state from cache so the list appears instantly on revisit
  const [convs,  setConvs]    = useState<Conversation[]>(_convsCache ?? []);
  const [loading, setLoading] = useState(_convsCache === null);
  const wsRef = useRef<WebSocket | null>(null);

  function fetchConvs() {
    if (!token) return;
    apiFetch<{ conversations: Conversation[] }>('/chat/conversations', { token })
      .then(r => { _convsCache = r.conversations; setConvs(r.conversations); })
      .catch(() => {});
  }

  useEffect(() => {
    if (!token) return;
    // If we already have cached data show it immediately, then refresh silently
    if (_convsCache) {
      setConvs(_convsCache);
      setLoading(false);
      // Background refresh to pick up new conversations / message previews
      apiFetch<{ conversations: Conversation[] }>('/chat/conversations', { token })
        .then(r => { _convsCache = r.conversations; setConvs(r.conversations); })
        .catch(() => {});
      return;
    }
    setLoading(true);
    apiFetch<{ conversations: Conversation[] }>('/chat/conversations', { token })
      .then(r => { _convsCache = r.conversations; setConvs(r.conversations); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

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
            // Update last_message and bump to top for matching room
            setConvs(prev => {
              const idx = prev.findIndex(
                c => c.room_id === payload.room_id || c.partner_id === payload.sender_id
              );
              if (idx === -1) {
                // Unknown conversation — re-fetch to get it
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
              conv.unread_count = (conv.unread_count ?? 0) + 1;
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

  const myId     = profile?.id ?? '';
  const filtered = search.trim()
    ? convs.filter(c => c.partner_name.toLowerCase().includes(search.toLowerCase()))
    : convs;

  const hasNoMatches = !loading && convs.length === 0;

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
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

      {/* New Messages row — only show partners who sent unread messages */}
      {!search && convs.filter(c => c.unread_count > 0 && c.last_message?.sender_id !== myId).length > 0 && (
        <View style={{ marginBottom: 24 }}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary, paddingHorizontal: 16, marginBottom: 14 }]}>
            NEW MESSAGES
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }}>
            {convs.filter(c => c.unread_count > 0 && c.last_message?.sender_id !== myId).map(m => (
              <Pressable
                key={m.partner_id}
                onPress={() => navPush({ pathname: '/chat', params: { partnerId: m.partner_id, name: m.partner_name, image: m.partner_image ?? '', online: m.is_online ? 'true' : 'false' } })}
                style={({ pressed }) => [{ alignItems: 'center', gap: 7 }, pressed && { opacity: 0.75 }]}
              >
                <View style={styles.matchRingWrap}>
                  <View style={[styles.matchRing, { borderColor: '#6366f1' }]}>
                    {m.partner_image
                      ? <Image source={{ uri: m.partner_image }} style={styles.matchAvatar} contentFit="cover" cachePolicy="memory-disk" transition={150} />
                      : <View style={[styles.matchAvatar, { backgroundColor: colors.surface2 }]} />
                    }
                  </View>
                  {/* Unread badge */}
                  <View style={{ position: 'absolute', top: 0, right: 0, backgroundColor: '#6366f1', borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: colors.bg }}>
                    <Text style={{ color: '#fff', fontSize: 10, fontFamily: 'ProductSans-Bold' }}>{m.unread_count > 9 ? '9+' : m.unread_count}</Text>
                  </View>
                  {m.is_online && (
                    <View style={[styles.matchDot, { backgroundColor: colors.bg, bottom: 0, right: 0, top: undefined }]}>
                      <View style={styles.matchDotInner} />
                    </View>
                  )}
                </View>
                <Text style={[styles.matchName, { color: colors.text }]} numberOfLines={1}>{m.partner_name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Loading shimmer */}
      {loading && (
        <View style={{ gap: 0 }}>
          {[1, 2, 3].map(i => <ShimmerRow key={i} />)}
        </View>
      )}

      {/* Messages list */}
      {!loading && (
        <View style={{ paddingHorizontal: 16 }}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginBottom: 12 }]}>MESSAGES</Text>

          {hasNoMatches && (
            <Squircle style={styles.convGroup} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={StyleSheet.hairlineWidth}>
              <View style={{ alignItems: 'center', padding: 32, gap: 8 }}>
                <Ionicons name="chatbubble-outline" size={28} color={colors.textTertiary} />
                <Text style={[styles.convPreview, { color: colors.textSecondary, textAlign: 'center' }]}>
                  Match with someone to start chatting!
                </Text>
              </View>
            </Squircle>
          )}

          {!hasNoMatches && filtered.length === 0 && (
            <Squircle style={styles.convGroup} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={StyleSheet.hairlineWidth}>
              <View style={{ alignItems: 'center', padding: 32, gap: 8 }}>
                <Ionicons name="search-outline" size={28} color={colors.textTertiary} />
                <Text style={[styles.convPreview, { color: colors.textSecondary, textAlign: 'center' }]}>
                  No conversations found
                </Text>
              </View>
            </Squircle>
          )}

          <View style={{ gap: 10 }}>
            {filtered.map((c) => {
              const rawContent = c.last_message?.content ?? '';
              const msgType    = c.last_message?.msg_type;
              const preview    = (rawContent || msgType) ? _previewText(rawContent, msgType) : 'Say hi! 👋';
              const isMyMsg    = c.last_message?.sender_id === myId;
              const timeStr    = c.last_message ? _relativeTime(c.last_message.created_at) : '';
              const hasUnread  = c.unread_count > 0;
              return (
                <Squircle
                  key={c.partner_id}
                  cornerRadius={22} cornerSmoothing={1}
                  fillColor={colors.surface}
                  strokeColor={colors.border}
                  strokeWidth={StyleSheet.hairlineWidth}
                  style={{ overflow: 'hidden' }}
                >
                  <ConvRow
                    conv={c}
                    isMe={isMyMsg}
                    preview={preview}
                    timeStr={timeStr}
                    hasUnread={hasUnread}
                    colors={colors}
                    onPress={() => navPush({ pathname: '/chat', params: { partnerId: c.partner_id, name: c.partner_name, image: c.partner_image ?? '', online: c.is_online ? 'true' : 'false' } })}
                  />
                </Squircle>
              );
            })}
          </View>
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
