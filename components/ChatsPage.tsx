import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Image,
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface Conversation {
  partner_id: string;
  partner_name: string;
  partner_image: string | null;
  room_id: string;
  last_message: { content: string; sender_id: string; created_at: string } | null;
  unread_count: number;
  is_online: boolean;
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
  const [convs,  setConvs]    = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);

  function fetchConvs() {
    if (!token) return;
    apiFetch<{ conversations: Conversation[] }>('/chat/conversations', { token })
      .then(r => setConvs(r.conversations))
      .catch(() => {});
  }

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    apiFetch<{ conversations: Conversation[] }>('/chat/conversations', { token })
      .then(r => setConvs(r.conversations))
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
                content: payload.content,
                sender_id: payload.sender_id,
                created_at: payload.created_at ?? new Date().toISOString(),
              };
              conv.unread_count = (conv.unread_count ?? 0) + 1;
              updated.splice(idx, 1);
              return [conv, ...updated];
            });
          } else if (payload.type === 'presence') {
            setConvs(prev =>
              prev.map(c =>
                c.partner_id === payload.user_id
                  ? { ...c, is_online: payload.online }
                  : c
              )
            );
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

      {/* New Matches row */}
      {!search && convs.length > 0 && (
        <View style={{ marginBottom: 24 }}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary, paddingHorizontal: 16, marginBottom: 14 }]}>
            NEW MATCHES
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }}>
            {convs.map(m => (
              <Pressable
                key={m.partner_id}
                onPress={() => router.push({ pathname: '/chat', params: { partnerId: m.partner_id, name: m.partner_name, image: m.partner_image ?? '', online: m.is_online ? 'true' : 'false' } })}
                style={({ pressed }) => [{ alignItems: 'center', gap: 7 }, pressed && { opacity: 0.75 }]}
              >
                <View style={styles.matchRingWrap}>
                  <View style={[styles.matchRing, { borderColor: colors.text }]}>
                    {m.partner_image
                      ? <Image source={{ uri: m.partner_image }} style={styles.matchAvatar} />
                      : <View style={[styles.matchAvatar, { backgroundColor: colors.surface2 }]} />
                    }
                  </View>
                  {m.is_online && (
                    <View style={[styles.matchDot, { backgroundColor: colors.bg }]}>
                      <View style={styles.matchDotInner} />
                    </View>
                  )}
                </View>
                <Text style={[styles.matchName, { color: colors.text }]}>{m.partner_name}</Text>
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
          <Squircle
            style={styles.convGroup}
            cornerRadius={22} cornerSmoothing={1}
            fillColor={colors.surface}
            strokeColor={colors.border}
            strokeWidth={StyleSheet.hairlineWidth}
          >
            {filtered.map((c, i) => {
              const preview   = c.last_message?.content ?? 'Say hi! 👋';
              const isMyMsg   = c.last_message?.sender_id === myId;
              const timeStr   = c.last_message ? _relativeTime(c.last_message.created_at) : '';
              const hasUnread = c.unread_count > 0;
              return (
                <View key={c.partner_id}>
                  <Pressable
                    onPress={() => router.push({ pathname: '/chat', params: { partnerId: c.partner_id, name: c.partner_name, image: c.partner_image ?? '', online: c.is_online ? 'true' : 'false' } })}
                    style={({ pressed }) => [styles.convRow, pressed && { backgroundColor: colors.surface2 }]}
                  >
                    <View style={styles.avatarWrap}>
                      {c.partner_image
                        ? <Image source={{ uri: c.partner_image }} style={styles.avatar} />
                        : <View style={[styles.avatar, { backgroundColor: colors.surface2 }]} />
                      }
                      {c.is_online && <View style={[styles.onlineDot, { borderColor: colors.surface, backgroundColor: '#22c55e' }]} />}
                    </View>
                    <View style={{ flex: 1, gap: 3 }}>
                      <View style={styles.topRow}>
                        <Text style={[styles.convName, { color: colors.text }]}>{c.partner_name}</Text>
                        <Text style={[styles.convTime, { color: hasUnread ? colors.text : colors.textSecondary, fontFamily: hasUnread ? 'ProductSans-Bold' : 'ProductSans-Regular' }]}>
                          {timeStr}
                        </Text>
                      </View>
                      <Text
                        style={[styles.convPreview, { color: hasUnread ? colors.text : colors.textSecondary, fontFamily: hasUnread ? 'ProductSans-Medium' : 'ProductSans-Regular' }]}
                        numberOfLines={1}
                      >
                        {isMyMsg ? `You: ${preview}` : preview}
                      </Text>
                    </View>
                    {hasUnread && (
                      <Squircle style={styles.unreadBadge} cornerRadius={20} cornerSmoothing={1} fillColor={colors.text}>
                        <Text style={[styles.unreadText, { color: colors.bg }]}>{c.unread_count}</Text>
                      </Squircle>
                    )}
                  </Pressable>
                  {i < filtered.length - 1 && (
                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  )}
                </View>
              );
            })}

            {hasNoMatches && (
              <View style={{ alignItems: 'center', padding: 32, gap: 8 }}>
                <Ionicons name="chatbubble-outline" size={28} color={colors.textTertiary} />
                <Text style={[styles.convPreview, { color: colors.textSecondary, textAlign: 'center' }]}>
                  Match with someone to start chatting!
                </Text>
              </View>
            )}
            {!hasNoMatches && filtered.length === 0 && (
              <View style={{ alignItems: 'center', padding: 32, gap: 8 }}>
                <Ionicons name="search-outline" size={28} color={colors.textTertiary} />
                <Text style={[styles.convPreview, { color: colors.textSecondary, textAlign: 'center' }]}>
                  No conversations found
                </Text>
              </View>
            )}
          </Squircle>
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
  convRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 14 },
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
