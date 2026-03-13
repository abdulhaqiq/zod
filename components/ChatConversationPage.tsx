import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Squircle from '@/components/ui/Squircle';
import { apiFetch, WS_V1 } from '@/constants/api';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';

const { width: W } = Dimensions.get('window');
const CARD_W = W - 72;
const CARD_GAP = 12;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Msg {
  id: string;
  text: string;
  from: 'me' | 'them';
  time: string;
  isCard?: boolean;
  isAnswer?: boolean;
  answerTo?: string;
}

interface ApiMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  msg_type: string;
  metadata: Record<string, string> | null;
  is_read: boolean;
  created_at: string;
}

// ─── Question card data ───────────────────────────────────────────────────────

type CardCategory = 'All' | 'Deep' | 'Fun' | 'Would You Rather';

interface StarterCard {
  emoji: string;
  question: string;
  tag: string;
  category: CardCategory;
  color: string;    // gradient start
  colorEnd: string; // gradient end (used as solid tint for bg)
}

const ALL_CARDS: StarterCard[] = [
  // Deep
  { emoji: '🌊', question: "What's something you changed your mind about recently?", tag: 'Deep', category: 'Deep', color: '#1e3a5f', colorEnd: '#0f2d4a' },
  { emoji: '🔮', question: "What's a dream you haven't told many people about?", tag: 'Deep', category: 'Deep', color: '#2d1b4e', colorEnd: '#1e0f3a' },
  { emoji: '🌙', question: "What does your perfect Sunday look like?", tag: 'Lifestyle', category: 'Deep', color: '#1a2a3a', colorEnd: '#0d1a27' },
  { emoji: '💫', question: "What's one thing you wish you knew earlier in life?", tag: 'Deep', category: 'Deep', color: '#1f2d1f', colorEnd: '#122012' },

  // Fun
  { emoji: '✈️', question: "Best country you've ever visited?", tag: 'Travel', category: 'Fun', color: '#1a3a2a', colorEnd: '#0d2a1a' },
  { emoji: '📚', question: "Last book you couldn't put down?", tag: 'Books', category: 'Fun', color: '#3a2a1a', colorEnd: '#2a1a0d' },
  { emoji: '📸', question: "What's your favourite thing to photograph?", tag: 'Photography', category: 'Fun', color: '#3a1a1a', colorEnd: '#2a0d0d' },
  { emoji: '🍕', question: "Pizza or tacos — which one wins?", tag: 'Food', category: 'Fun', color: '#3a1a2a', colorEnd: '#2a0d1a' },
  { emoji: '🎵', question: "What's the last song you had on repeat?", tag: 'Music', category: 'Fun', color: '#1a1a3a', colorEnd: '#0d0d2a' },
  { emoji: '🌅', question: "Morning person or night owl?", tag: 'Lifestyle', category: 'Fun', color: '#3a2a10', colorEnd: '#2a1a08' },

  // Would You Rather
  { emoji: '🤔', question: "Live in the mountains or by the ocean?", tag: 'Would You Rather', category: 'Would You Rather', color: '#1a2a3a', colorEnd: '#0f1e2d' },
  { emoji: '⚡', question: "Be able to fly or be invisible?", tag: 'Would You Rather', category: 'Would You Rather', color: '#2a1a3a', colorEnd: '#1e0f2d' },
  { emoji: '🌍', question: "Travel everywhere or know every language?", tag: 'Would You Rather', category: 'Would You Rather', color: '#1a3a1a', colorEnd: '#0f2d0f' },
  { emoji: '⏰', question: "Go back in time or skip 10 years into the future?", tag: 'Would You Rather', category: 'Would You Rather', color: '#3a1a10', colorEnd: '#2d0f08' },
];

const CATEGORIES: CardCategory[] = ['All', 'Deep', 'Fun', 'Would You Rather'];

const CATEGORY_ACCENT: Record<CardCategory, string> = {
  All: '#7c3aed',
  Deep: '#3b82f6',
  Fun: '#f59e0b',
  'Would You Rather': '#ec4899',
};

// ─── Match profile (passed via route params — filled from API as needed) ──────

const PLACEHOLDER_PROFILE = {
  sharedInterests: ['Travel', 'Books', 'Photography'],
  aiSummary: 'You matched! Start a conversation to learn more about each other.',
};

const SHARED_EMOJIS: Record<string, string> = {
  Travel: '✈️', Books: '📚', Photography: '📸', Yoga: '🧘', Coffee: '☕',
  Music: '🎵', Art: '🎨', Gaming: '🎮', Food: '🍕', Fitness: '💪',
  Hiking: '🥾', Movies: '🎬', Nature: '🌿', Cycling: '🚴',
};

function _formatTime(isoStr: string): string {
  return new Date(isoStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const AI_LINES = [
  `If travel were a language, we'd be fluent ✈️`,
  `I've been to 14 countries and none of them were as interesting as this conversation`,
  `Are you a great book? Because I can't stop thinking about your story 📚`,
  `I was going to play it cool, but your profile made that impossible 😅`,
  `My future self sent me a note — it said I had to talk to you`,
  `You must be a great destination — everyone wants to go there 🌍`,
  `Is your name Google Maps? Because you've got everything I've been searching for`,
  `They say the best adventures are unplanned — like meeting you 🛫`,
];

const nowTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// ─── AI Profile Insight Card — bottom-sheet modal ─────────────────────────────

function AiInsightPanel({ colors, name, onClose, matchSummary }: { colors: any; name: string; onClose: () => void; matchSummary?: string }) {
  const slideY = useRef(new Animated.Value(500)).current;

  useEffect(() => {
    Animated.spring(slideY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 260 }).start();
  }, []);

  const dismiss = (cb?: () => void) =>
    Animated.timing(slideY, { toValue: 500, duration: 220, useNativeDriver: true }).start(cb);

  return (
    <Pressable style={StyleSheet.absoluteFill} onPress={() => dismiss(onClose)}>
      <Animated.View
        style={[styles.panel, {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          transform: [{ translateY: slideY }],
        }]}
      >
        <Pressable>
          <View style={[styles.panelHandle, { backgroundColor: colors.border }]} />

          {/* Header */}
          <View style={styles.panelHeader}>
            <Squircle style={styles.panelIcon} cornerRadius={12} cornerSmoothing={1} fillColor="#7c3aed">
              <Ionicons name="sparkles" size={15} color="#fff" />
            </Squircle>
            <View style={{ flex: 1 }}>
              <Text style={[styles.panelTitle, { color: colors.text }]}>Profile Insights</Text>
              <Text style={[styles.panelSub, { color: colors.textSecondary }]}>Powered by Zod AI</Text>
            </View>
            <Pressable onPress={() => dismiss(onClose)} hitSlop={12}>
              <Squircle style={styles.panelCloseBtn} cornerRadius={10} cornerSmoothing={1} fillColor={colors.surface2}>
                <Ionicons name="close" size={16} color={colors.text} />
              </Squircle>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
            {/* AI summary */}
            <View style={{ paddingHorizontal: 16, gap: 16, paddingBottom: 28 }}>
              <Squircle style={styles.insightSummaryBox} cornerRadius={16} cornerSmoothing={1} fillColor={colors.surface2}>
                <Text style={[styles.insightSummary, { color: colors.text }]}>
                  {matchSummary ?? PLACEHOLDER_PROFILE.aiSummary}
                </Text>
              </Squircle>

              {/* Shared interests placeholder */}
              <View style={styles.insightSection}>
                <Text style={[styles.insightSectionLabel, { color: colors.textSecondary }]}>YOU MATCHED!</Text>
                <View style={styles.insightChips}>
                  {PLACEHOLDER_PROFILE.sharedInterests.map(interest => (
                    <View key={interest} style={[styles.insightChip, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                      <Text style={styles.insightChipEmoji}>{SHARED_EMOJIS[interest] ?? '⭐'}</Text>
                      <Text style={[styles.insightChipText, { color: colors.text }]}>{interest}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Conversation tip */}
              <View style={[styles.insightTipBox, { backgroundColor: 'rgba(124,58,237,0.12)', borderColor: 'rgba(124,58,237,0.25)' }]}>
                <Ionicons name="bulb-outline" size={14} color="#a78bfa" />
                <Text style={[styles.insightTipText, { color: '#a78bfa' }]}>
                  Tap ❓ to send a question card and ✨ for AI-crafted openers
                </Text>
              </View>
            </View>
          </ScrollView>
        </Pressable>
      </Animated.View>
    </Pressable>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function Bubble({ msg, colors, onAnswer }: { msg: Msg; colors: any; onAnswer?: (q: string) => void }) {
  const isMe = msg.from === 'me';

  if (msg.isAnswer && msg.answerTo) {
    return (
      <View style={[styles.bubbleRow, isMe ? styles.bubbleRowMe : styles.bubbleRowThem]}>
        <View style={[
          styles.answerBubble,
          isMe
            ? { backgroundColor: colors.text, borderColor: 'transparent' }
            : { backgroundColor: colors.surface, borderColor: colors.border },
        ]}>
          <View style={[styles.answerContext, {
            backgroundColor: isMe ? 'rgba(255,255,255,0.12)' : colors.surface2,
            borderLeftColor: isMe ? 'rgba(255,255,255,0.4)' : '#7c3aed',
          }]}>
            <Ionicons name="return-down-forward" size={10} color={isMe ? 'rgba(255,255,255,0.5)' : '#7c3aed'} />
            <Text style={[styles.answerContextText, { color: isMe ? 'rgba(255,255,255,0.55)' : colors.textSecondary }]} numberOfLines={1}>
              {msg.answerTo}
            </Text>
          </View>
          <Text style={[styles.bubbleText, { color: isMe ? colors.bg : colors.text }]}>{msg.text}</Text>
          <Text style={[styles.bubbleTime, { color: isMe ? 'rgba(255,255,255,0.38)' : colors.textTertiary }]}>{msg.time}</Text>
        </View>
      </View>
    );
  }

  if (msg.isCard) {
    const card = ALL_CARDS.find(c => c.question === msg.text);
    const emoji = card?.emoji ?? '❓';
    const tag   = card?.tag   ?? 'Question';
    const accent = card ? CATEGORY_ACCENT[card.category] : '#7c3aed';
    const cardBg = card?.color ?? (isMe ? '#1a1a1a' : colors.surface);

    return (
      <View style={[styles.bubbleRow, isMe ? styles.bubbleRowMe : styles.bubbleRowThem]}>
        <View style={[styles.cardBubble, { backgroundColor: cardBg, borderColor: 'transparent' }]}>
          {/* Tag */}
          <View style={[styles.cardTag, { backgroundColor: `${accent}30` }]}>
            <View style={[styles.cardTagDot, { backgroundColor: accent }]} />
            <Text style={[styles.cardTagText, { color: accent }]}>{tag}</Text>
          </View>

          <Text style={styles.cardBubbleEmoji}>{emoji}</Text>
          <Text style={[styles.cardBubbleQuestion, { color: '#fff' }]}>{msg.text}</Text>

          <View style={[styles.cardBubbleFooter, { borderTopColor: 'rgba(255,255,255,0.12)' }]}>
            <Text style={[styles.bubbleTime, { color: 'rgba(255,255,255,0.4)' }]}>{msg.time}</Text>
            {/* Answer button only for received cards */}
            {!isMe && onAnswer && (
              <Pressable
                onPress={() => onAnswer(msg.text)}
                style={({ pressed }) => [styles.answerBtn, { backgroundColor: `${accent}25`, opacity: pressed ? 0.7 : 1 }]}
              >
                <Ionicons name="pencil" size={11} color={accent} />
                <Text style={[styles.answerBtnText, { color: accent }]}>Answer</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.bubbleRow, isMe ? styles.bubbleRowMe : styles.bubbleRowThem]}>
      <View style={[
        styles.bubble,
        isMe
          ? [styles.bubbleMe, { backgroundColor: colors.text }]
          : [styles.bubbleThem, { backgroundColor: colors.surface }],
      ]}>
        <Text style={[styles.bubbleText, { color: isMe ? colors.bg : colors.text }]}>{msg.text}</Text>
        <Text style={[styles.bubbleTime, { color: isMe ? 'rgba(255,255,255,0.38)' : colors.textTertiary }]}>
          {msg.time}
        </Text>
      </View>
    </View>
  );
}

// ─── AI Pickup Lines Panel ────────────────────────────────────────────────────

function AiPanel({ colors, matchName, onSelect, onClose }: {
  colors: any; matchName: string;
  onSelect: (t: string) => void; onClose: () => void;
}) {
  const slideY = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    Animated.spring(slideY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 260 }).start();
  }, []);

  const dismiss = (cb?: () => void) =>
    Animated.timing(slideY, { toValue: 400, duration: 200, useNativeDriver: true }).start(cb);

  return (
    <Pressable style={StyleSheet.absoluteFill} onPress={() => dismiss(onClose)}>
      <Animated.View style={[
        styles.panel,
        { backgroundColor: colors.surface, borderTopColor: colors.border },
        { transform: [{ translateY: slideY }] },
      ]}>
        <Pressable>
          <View style={[styles.panelHandle, { backgroundColor: colors.border }]} />
          <View style={styles.panelHeader}>
            <Squircle style={styles.panelIcon} cornerRadius={12} cornerSmoothing={1} fillColor="#7c3aed">
              <Ionicons name="sparkles" size={15} color="#fff" />
            </Squircle>
            <View style={{ flex: 1 }}>
              <Text style={[styles.panelTitle, { color: colors.text }]}>AI Pickup Lines</Text>
              <Text style={[styles.panelSub, { color: colors.textSecondary }]}>
                Tailored for {matchName} · tap to insert
              </Text>
            </View>
            <Pressable onPress={() => dismiss(onClose)} hitSlop={10}>
              <Squircle style={styles.panelCloseBtn} cornerRadius={10} cornerSmoothing={1} fillColor={colors.surface2}>
                <Ionicons name="close" size={16} color={colors.text} />
              </Squircle>
            </Pressable>
          </View>

          <View style={styles.aiLinesList}>
            {AI_LINES.map((line, i) => (
              <Pressable key={i} onPress={() => dismiss(() => onSelect(line))}
                style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
                <Squircle
                  style={styles.aiLineItem}
                  cornerRadius={16} cornerSmoothing={1}
                  fillColor={colors.surface2} strokeColor={colors.border}
                  strokeWidth={StyleSheet.hairlineWidth}
                >
                  <Text style={[styles.aiLineText, { color: colors.text }]}>{line}</Text>
                  <View style={[styles.aiLineUse, { backgroundColor: colors.surface }]}>
                    <Ionicons name="arrow-up" size={12} color={colors.textSecondary} />
                  </View>
                </Squircle>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Animated.View>
    </Pressable>
  );
}

// ─── Gamified Question Cards Panel ───────────────────────────────────────────

function StarterCardsPanel({ colors, onSend, onClose }: {
  colors: any;
  onSend: (q: string) => void;
  onClose: () => void;
}) {
  const slideY    = useRef(new Animated.Value(500)).current;
  const scrollRef = useRef<ScrollView>(null);
  const [activeIdx,   setActiveIdx]   = useState(0);
  const [activeCategory, setActiveCategory] = useState<CardCategory>('All');
  const [streak, setStreak] = useState(0);

  const filtered = activeCategory === 'All' ? ALL_CARDS : ALL_CARDS.filter(c => c.category === activeCategory);

  useEffect(() => {
    setActiveIdx(0);
    scrollRef.current?.scrollTo({ x: 0, animated: false });
  }, [activeCategory]);

  useEffect(() => {
    Animated.spring(slideY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 260 }).start();
  }, []);

  const dismiss = (cb?: () => void) =>
    Animated.timing(slideY, { toValue: 500, duration: 220, useNativeDriver: true }).start(cb);

  const handleScroll = (e: any) => {
    const x = e.nativeEvent.contentOffset.x;
    setActiveIdx(Math.max(0, Math.min(Math.round(x / (CARD_W + CARD_GAP)), filtered.length - 1)));
  };

  const handleSend = () => {
    setStreak(s => s + 1);
    dismiss(() => onSend(filtered[activeIdx].question));
  };

  const accentColor = CATEGORY_ACCENT[activeCategory];

  return (
    <Pressable style={StyleSheet.absoluteFill} onPress={() => dismiss(onClose)}>
      <Animated.View style={[
        styles.panel,
        { backgroundColor: colors.bg, borderTopColor: colors.border },
        { transform: [{ translateY: slideY }] },
      ]}>
        <Pressable>
          <View style={[styles.panelHandle, { backgroundColor: colors.border }]} />

          {/* Header */}
          <View style={styles.panelHeader}>
            <Squircle style={styles.panelIcon} cornerRadius={12} cornerSmoothing={1} fillColor={accentColor}>
              <Ionicons name="layers" size={16} color="#fff" />
            </Squircle>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[styles.panelTitle, { color: colors.text }]}>Question Cards</Text>
                {streak > 0 && (
                  <View style={[styles.streakBadge, { backgroundColor: '#f59e0b22' }]}>
                    <Text style={styles.streakText}>🔥 {streak}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.panelSub, { color: colors.textSecondary }]}>Swipe · tap active card to send</Text>
            </View>
            <Pressable onPress={() => dismiss(onClose)} hitSlop={12}>
              <Squircle style={styles.panelCloseBtn} cornerRadius={10} cornerSmoothing={1} fillColor={colors.surface2}>
                <Ionicons name="close" size={16} color={colors.text} />
              </Squircle>
            </Pressable>
          </View>

          {/* Category tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryTabs}
          >
            {CATEGORIES.map(cat => {
              const isActive = cat === activeCategory;
              const accent = CATEGORY_ACCENT[cat];
              return (
                <Pressable
                  key={cat}
                  onPress={() => setActiveCategory(cat)}
                  style={[
                    styles.categoryTab,
                    isActive
                      ? { backgroundColor: accent }
                      : { backgroundColor: colors.surface2 },
                  ]}
                >
                  <Text style={[styles.categoryTabText, { color: isActive ? '#fff' : colors.textSecondary }]}>
                    {cat}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Card carousel */}
          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={CARD_W + CARD_GAP}
            decelerationRate="fast"
            contentContainerStyle={styles.deckScroll}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
            {filtered.map((card, i) => {
              const isActive = i === activeIdx;
              return (
                <Pressable
                  key={`${card.question}-${i}`}
                  onPress={() => {
                    if (!isActive) {
                      scrollRef.current?.scrollTo({ x: i * (CARD_W + CARD_GAP), animated: true });
                      setActiveIdx(i);
                    } else {
                      handleSend();
                    }
                  }}
                  style={({ pressed }) => [{ opacity: pressed ? 0.88 : 1 }]}
                >
                  <Squircle
                    style={[styles.deckCard, { width: CARD_W, opacity: isActive ? 1 : 0.6 }]}
                    cornerRadius={28} cornerSmoothing={1}
                    fillColor={isActive ? card.color : colors.surface}
                    strokeColor={isActive ? 'transparent' : colors.border}
                    strokeWidth={StyleSheet.hairlineWidth}
                  >
                    {/* Category pill */}
                    <View style={[styles.deckCardTag, {
                      backgroundColor: isActive
                        ? `${CATEGORY_ACCENT[card.category]}35`
                        : colors.surface2,
                    }]}>
                      <View style={[styles.cardTagDot, {
                        backgroundColor: isActive ? CATEGORY_ACCENT[card.category] : colors.textSecondary,
                      }]} />
                      <Text style={[styles.deckCardTagText, {
                        color: isActive ? CATEGORY_ACCENT[card.category] : colors.textSecondary,
                      }]}>{card.tag}</Text>
                    </View>

                    <Text style={styles.deckCardEmoji}>{card.emoji}</Text>
                    <Text style={[styles.deckCardQuestion, { color: isActive ? '#fff' : colors.text }]}>
                      {card.question}
                    </Text>

                    {isActive && (
                      <View style={[styles.deckCardHint, { borderTopColor: 'rgba(255,255,255,0.15)' }]}>
                        <Ionicons name="send" size={12} color="rgba(255,255,255,0.55)" />
                        <Text style={styles.deckCardHintText}>Tap to send</Text>
                      </View>
                    )}
                  </Squircle>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Dots */}
          <View style={styles.deckDots}>
            {filtered.map((_, i) => (
              <Pressable
                key={i}
                onPress={() => {
                  scrollRef.current?.scrollTo({ x: i * (CARD_W + CARD_GAP), animated: true });
                  setActiveIdx(i);
                }}
              >
                <View style={[styles.deckDot, {
                  backgroundColor: i === activeIdx ? accentColor : colors.surface2,
                  width: i === activeIdx ? 20 : 6,
                }]} />
              </Pressable>
            ))}
          </View>

          {/* Send CTA */}
          <View style={styles.deckCta}>
            <Pressable onPress={handleSend} style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1, flex: 1 }]}>
              <Squircle
                style={styles.deckSendBtn} cornerRadius={50} cornerSmoothing={1}
                fillColor={accentColor}
              >
                <Ionicons name="send" size={15} color="#fff" />
                <Text style={[styles.deckSendBtnText, { color: '#fff' }]}>Send this card</Text>
              </Squircle>
            </Pressable>
          </View>
        </Pressable>
      </Animated.View>
    </Pressable>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ChatConversationPage() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { token, profile } = useAuth();
  const params  = useLocalSearchParams<{ partnerId?: string; name?: string; image?: string; online?: string }>();

  const partnerId = params.partnerId ?? '';
  const name      = params.name   ?? 'Match';
  const image     = params.image  ?? '';
  const online    = params.online !== 'false';

  const [messages,      setMessages]      = useState<Msg[]>([]);
  const [text,          setText]          = useState('');
  const [showAi,        setShowAi]        = useState(false);
  const [showCards,     setShowCards]     = useState(false);
  const [showInsight,   setShowInsight]   = useState(false);
  const [answeringCard, setAnsweringCard] = useState<string | null>(null);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [loadingHistory,  setLoadingHistory]  = useState(true);
  const scrollRef = useRef<ScrollView>(null);
  const wsRef     = useRef<WebSocket | null>(null);
  const myId      = profile?.id ?? '';

  // ── Convert API message to local Msg ──────────────────────────────────────
  const apiMsgToMsg = useCallback((m: ApiMessage): Msg => ({
    id:      m.id,
    text:    m.content,
    from:    m.sender_id === myId ? 'me' : 'them',
    time:    _formatTime(m.created_at),
    isCard:  m.msg_type === 'card',
    isAnswer: m.msg_type === 'answer',
    answerTo: m.metadata?.answerTo,
  }), [myId]);

  // ── Load message history ──────────────────────────────────────────────────
  useEffect(() => {
    if (!token || !partnerId) { setLoadingHistory(false); return; }
    apiFetch<{ messages: ApiMessage[] }>(`/chat/${partnerId}/messages`, { token })
      .then(r => {
        setMessages(r.messages.map(apiMsgToMsg));
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100);
      })
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, [token, partnerId]);

  // ── WebSocket connection ──────────────────────────────────────────────────
  useEffect(() => {
    if (!token || !partnerId) return;

    const ws = new WebSocket(`${WS_V1}/ws/chat/${partnerId}?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      // Send read receipt when conversation opens
      ws.send(JSON.stringify({ type: 'read' }));
    };

    ws.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.type === 'message') {
          const m: ApiMessage = payload;
          const msg = apiMsgToMsg({ ...m, content: payload.content });
          setMessages(prev => {
            // Avoid duplicates (REST send already added the optimistic message)
            if (prev.find(x => x.id === msg.id)) return prev;
            return [...prev, msg];
          });
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
          // Mark as read immediately
          ws.send(JSON.stringify({ type: 'read' }));
        } else if (payload.type === 'typing') {
          setIsPartnerTyping(Boolean(payload.is_typing));
          if (payload.is_typing) {
            setTimeout(() => setIsPartnerTyping(false), 3000);
          }
        }
      } catch {}
    };

    ws.onerror = () => {};
    ws.onclose = () => { wsRef.current = null; };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [token, partnerId]);

  // ── Typing indicator ──────────────────────────────────────────────────────
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleTextChange = (val: string) => {
    setText(val);
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'typing', is_typing: true }));
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        ws.send(JSON.stringify({ type: 'typing', is_typing: false }));
      }, 2000);
    }
  };

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = (txt: string, opts?: { isCard?: boolean; isAnswer?: boolean; answerTo?: string }) => {
    if (!txt.trim()) return;

    const msgType  = opts?.isCard ? 'card' : opts?.isAnswer ? 'answer' : 'text';
    const metadata = opts?.answerTo ? { answerTo: opts.answerTo } : null;

    // Optimistic UI update
    const optimistic: Msg = {
      id:       `opt-${Date.now()}`,
      text:     txt.trim(),
      from:     'me',
      time:     nowTime(),
      isCard:   opts?.isCard,
      isAnswer: opts?.isAnswer,
      answerTo: opts?.answerTo,
    };
    setMessages(prev => [...prev, optimistic]);
    setText('');
    setAnsweringCard(null);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);

    // Send via WebSocket if connected, otherwise fall back to REST
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'message', content: txt.trim(), msg_type: msgType, metadata }));
    } else if (token && partnerId) {
      apiFetch(`/chat/${partnerId}/messages`, {
        token,
        method: 'POST',
        body: JSON.stringify({ content: txt.trim(), msg_type: msgType, metadata }),
      }).catch(() => {});
    }
  };

  const handleSend = () => {
    if (answeringCard) {
      sendMessage(text, { isAnswer: true, answerTo: answeringCard });
    } else {
      sendMessage(text);
    }
  };

  useEffect(() => {
    if (!loadingHistory) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 80);
    }
  }, [loadingHistory]);

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>

      {/* ── Header ── */}
      <View style={[
        styles.header,
        { paddingTop: insets.top + 8, borderBottomColor: colors.border, backgroundColor: colors.bg },
      ]}>
        <Pressable onPress={() => router.back()} hitSlop={10}
          style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>

        <Pressable style={styles.headerCenter} hitSlop={4}>
          <View style={styles.headerAvatarWrap}>
            <Image source={{ uri: image }} style={styles.headerAvatar} contentFit="cover" />
            {online && <View style={[styles.onlineDot, { borderColor: colors.bg }]} />}
          </View>
          <View>
            <Text style={[styles.headerName, { color: colors.text }]}>{name}</Text>
            <Text style={[styles.headerStatus, { color: online ? '#22c55e' : colors.textSecondary }]}>
              {online ? 'Active now' : 'Offline'}
            </Text>
          </View>
        </Pressable>

        <View style={styles.headerActions}>
          {/* Profile Insights button */}
          <Pressable hitSlop={8} onPress={() => { setShowInsight(true); setShowAi(false); setShowCards(false); }}
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
            <Squircle
              style={styles.headerBtn} cornerRadius={14} cornerSmoothing={1}
              fillColor={showInsight ? '#7c3aed' : colors.surface2}
            >
              <Ionicons name="sparkles" size={16} color={showInsight ? '#fff' : colors.text} />
            </Squircle>
          </Pressable>
          <Pressable hitSlop={8} onPress={() => Alert.alert('Voice Call', `Calling ${name}…`)}
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
            <Squircle style={styles.headerBtn} cornerRadius={14} cornerSmoothing={1} fillColor={colors.surface2}>
              <Ionicons name="call" size={17} color={colors.text} />
            </Squircle>
          </Pressable>
          <Pressable hitSlop={8} onPress={() => Alert.alert('Video Call', `Starting video call with ${name}…`)}
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
            <Squircle style={styles.headerBtn} cornerRadius={14} cornerSmoothing={1} fillColor={colors.surface2}>
              <Ionicons name="videocam" size={17} color={colors.text} />
            </Squircle>
          </Pressable>
        </View>
      </View>

      {/* ── Messages ── */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={[styles.messageList, { paddingBottom: 16 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Date separator */}
          <View style={styles.dateSep}>
            <View style={[styles.dateLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dateText, { color: colors.textTertiary }]}>Today</Text>
            <View style={[styles.dateLine, { backgroundColor: colors.border }]} />
          </View>

          {loadingHistory && (
            <View style={{ alignItems: 'center', padding: 24 }}>
              <Text style={{ color: colors.textSecondary, fontFamily: 'ProductSans-Regular', fontSize: 13 }}>Loading messages…</Text>
            </View>
          )}

          {messages.map(msg => (
            <Bubble
              key={msg.id}
              msg={msg}
              colors={colors}
              onAnswer={(q) => {
                setAnsweringCard(q);
                setShowCards(false);
                setShowAi(false);
              }}
            />
          ))}

          {/* Typing indicator */}
          {isPartnerTyping && (
            <View style={[styles.bubbleRow, styles.bubbleRowThem]}>
              <View style={[styles.bubble, styles.bubbleThem, { backgroundColor: colors.surface, paddingHorizontal: 16, paddingVertical: 12 }]}>
                <Text style={{ color: colors.textSecondary, fontSize: 18 }}>• • •</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* ── Input bar ── */}
        <View style={[
          styles.inputBar,
          { borderTopColor: colors.border, backgroundColor: colors.bg, paddingBottom: insets.bottom + 8 },
        ]}>
          {/* Answering context strip */}
          {answeringCard && (
            <View style={[styles.answerStrip, { backgroundColor: colors.surface2, borderColor: 'rgba(124,58,237,0.3)' }]}>
              <Ionicons name="return-down-forward" size={13} color="#a78bfa" />
              <Text style={[styles.answerStripText, { color: colors.textSecondary }]} numberOfLines={1}>
                {answeringCard}
              </Text>
              <Pressable onPress={() => setAnsweringCard(null)} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
              </Pressable>
            </View>
          )}

          <View style={styles.inputRow}>
            {/* Question cards button */}
            <Pressable
              onPress={() => { setShowCards(true); setShowAi(false); setAnsweringCard(null); }}
              hitSlop={8}
              style={({ pressed }) => [pressed && { opacity: 0.6 }]}
            >
              <Squircle
                style={styles.inputSideBtn} cornerRadius={14} cornerSmoothing={1}
                fillColor={showCards ? colors.text : colors.surface2}
              >
                <Ionicons name="layers" size={20} color={showCards ? colors.bg : colors.text} />
              </Squircle>
            </Pressable>

            {/* Text input */}
            <Squircle
              style={styles.inputWrap} cornerRadius={22} cornerSmoothing={1}
              fillColor={colors.surface} strokeColor={colors.border} strokeWidth={StyleSheet.hairlineWidth}
            >
              <TextInput
                style={[styles.inputField, { color: colors.text }]}
                placeholder={answeringCard ? 'Your answer…' : 'Message…'}
                placeholderTextColor={colors.placeholder}
                value={text}
                onChangeText={handleTextChange}
                multiline
                maxLength={500}
                selectionColor={colors.text}
              />
              {/* AI sparkles */}
              <Pressable
                onPress={() => { setShowAi(true); setShowCards(false); }}
                hitSlop={8}
                style={({ pressed }) => [pressed && { opacity: 0.6 }]}
              >
                <Squircle
                  style={styles.aiInlineBtn} cornerRadius={12} cornerSmoothing={1}
                  fillColor={showAi ? '#7c3aed' : colors.surface2}
                >
                  <Ionicons name="sparkles" size={13} color={showAi ? '#fff' : colors.text} />
                </Squircle>
              </Pressable>
            </Squircle>

            {/* Send / mic */}
            <Pressable
              onPress={handleSend}
              hitSlop={8}
              disabled={!text.trim()}
              style={({ pressed }) => [pressed && { opacity: 0.7 }]}
            >
              <Squircle
                style={styles.inputSideBtn} cornerRadius={14} cornerSmoothing={1}
                fillColor={text.trim() ? (answeringCard ? '#7c3aed' : colors.text) : colors.surface2}
              >
                <Ionicons
                  name={text.trim() ? 'send' : 'mic'}
                  size={18}
                  color={text.trim() ? (answeringCard ? '#fff' : colors.bg) : colors.text}
                />
              </Squircle>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* ── AI Pickup Lines panel ── */}
      {showAi && (
        <AiPanel
          colors={colors}
          matchName={name}
          onSelect={line => { setText(line); setShowAi(false); }}
          onClose={() => setShowAi(false)}
        />
      )}

      {/* ── Starter Cards panel ── */}
      {showCards && (
        <StarterCardsPanel
          colors={colors}
          onSend={q => { sendMessage(q, { isCard: true }); setShowCards(false); }}
          onClose={() => setShowCards(false)}
        />
      )}

      {/* ── Profile Insights panel ── */}
      {showInsight && (
        <AiInsightPanel
          colors={colors}
          name={name}
          onClose={() => setShowInsight(false)}
          matchSummary={undefined}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header:            { paddingHorizontal: 12, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  headerCenter:      { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatarWrap:  { position: 'relative' },
  headerAvatar:      { width: 42, height: 42, borderRadius: 21 },
  onlineDot:         { position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: '#22c55e', borderWidth: 2 },
  headerName:        { fontSize: 16, fontFamily: 'ProductSans-Black' },
  headerStatus:      { fontSize: 12, fontFamily: 'ProductSans-Regular', marginTop: 1 },
  headerActions:     { flexDirection: 'row', gap: 8 },
  headerBtn:         { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },

  // Messages
  messageList:  { paddingHorizontal: 14, paddingTop: 14, gap: 5 },
  dateSep:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 10 },
  dateLine:     { flex: 1, height: StyleSheet.hairlineWidth },
  dateText:     { fontSize: 11, fontFamily: 'ProductSans-Regular' },

  // Bubbles
  bubbleRow:     { flexDirection: 'row', marginVertical: 1 },
  bubbleRowMe:   { justifyContent: 'flex-end' },
  bubbleRowThem: { justifyContent: 'flex-start' },
  bubble:        { maxWidth: W * 0.72, paddingHorizontal: 14, paddingVertical: 10, gap: 4 },
  bubbleMe:      { borderRadius: 20, borderBottomRightRadius: 4 },
  bubbleThem:    { borderRadius: 20, borderBottomLeftRadius: 4 },
  bubbleText:    { fontSize: 15, fontFamily: 'ProductSans-Regular', lineHeight: 22 },
  bubbleTime:    { fontSize: 10, fontFamily: 'ProductSans-Regular' },

  // Card bubble
  cardBubble:         { width: W * 0.68, borderRadius: 22, padding: 14, gap: 8 },
  cardTag:            { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20 },
  cardTagDot:         { width: 5, height: 5, borderRadius: 2.5 },
  cardTagText:        { fontSize: 10, fontFamily: 'ProductSans-Bold', letterSpacing: 0.2 },
  cardBubbleEmoji:    { fontSize: 32, textAlign: 'center' },
  cardBubbleQuestion: { fontSize: 14, fontFamily: 'ProductSans-Black', lineHeight: 20 },
  cardBubbleFooter:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, marginTop: 2 },
  answerBtn:          { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  answerBtnText:      { fontSize: 11, fontFamily: 'ProductSans-Bold' },

  // Answer bubble
  answerBubble:      { maxWidth: W * 0.72, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 6 },
  answerContext:     { flexDirection: 'row', alignItems: 'center', gap: 6, borderLeftWidth: 2, paddingLeft: 8, paddingVertical: 2 },
  answerContextText: { flex: 1, fontSize: 11, fontFamily: 'ProductSans-Regular' },

  // Input bar
  inputBar:     { borderTopWidth: StyleSheet.hairlineWidth },
  answerStrip:  { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderLeftWidth: 3 },
  answerStripText: { flex: 1, fontSize: 12, fontFamily: 'ProductSans-Regular' },
  inputRow:     { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingTop: 10 },
  inputSideBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  inputWrap:    { flex: 1, flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 14, paddingVertical: 10, gap: 8, minHeight: 44, maxHeight: 120 },
  inputField:   { flex: 1, fontSize: 15, fontFamily: 'ProductSans-Regular', maxHeight: 100 },
  aiInlineBtn:  { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end' },

  // Panels (shared)
  panel:        { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopWidth: StyleSheet.hairlineWidth, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 28, shadowOffset: { width: 0, height: -4 }, elevation: 22 },
  panelHandle:  { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  panelHeader:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 14, paddingTop: 6 },
  panelIcon:    { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  panelTitle:   { fontSize: 16, fontFamily: 'ProductSans-Black' },
  panelSub:     { fontSize: 12, fontFamily: 'ProductSans-Regular', marginTop: 1 },
  panelCloseBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },

  // AI lines
  aiLinesList: { paddingHorizontal: 14, paddingBottom: 28, gap: 7 },
  aiLineItem:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 13 },
  aiLineText:  { flex: 1, fontSize: 14, fontFamily: 'ProductSans-Regular', lineHeight: 20 },
  aiLineUse:   { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },

  // Insight panel
  insightSummaryBox:    { padding: 14 },
  insightSummary:       { fontSize: 14, fontFamily: 'ProductSans-Regular', lineHeight: 22 },
  insightSection:       { gap: 10 },
  insightSectionLabel:  { fontSize: 11, fontFamily: 'ProductSans-Bold', letterSpacing: 1 },
  insightChips:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  insightChip:          { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 50, borderWidth: StyleSheet.hairlineWidth },
  insightChipEmoji:     { fontSize: 14 },
  insightChipText:      { fontSize: 12, fontFamily: 'ProductSans-Medium' },
  insightHighlights:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  insightHighlight:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 50, borderWidth: StyleSheet.hairlineWidth },
  insightHighlightText: { fontSize: 12, fontFamily: 'ProductSans-Regular' },
  insightTipBox:        { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  insightTipText:       { flex: 1, fontSize: 12, fontFamily: 'ProductSans-Regular', lineHeight: 18 },

  // Category tabs
  categoryTabs:    { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  categoryTab:     { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  categoryTabText: { fontSize: 12, fontFamily: 'ProductSans-Bold' },

  // Streak badge
  streakBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  streakText:  { fontSize: 12, fontFamily: 'ProductSans-Bold', color: '#f59e0b' },

  // Card deck
  deckScroll:       { paddingLeft: 20, paddingRight: 20, gap: CARD_GAP, alignItems: 'flex-start' },
  deckCard:         { height: 220, padding: 20, justifyContent: 'space-between', overflow: 'hidden' },
  deckCardTag:      { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  deckCardTagText:  { fontSize: 10, fontFamily: 'ProductSans-Bold', letterSpacing: 0.3 },
  deckCardEmoji:    { fontSize: 48, textAlign: 'center', marginVertical: 4 },
  deckCardQuestion: { fontSize: 17, fontFamily: 'ProductSans-Black', lineHeight: 24, textAlign: 'center' },
  deckCardHint:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, marginTop: 2 },
  deckCardHintText: { fontSize: 11, fontFamily: 'ProductSans-Medium', color: 'rgba(255,255,255,0.55)' },
  deckDots:         { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 12 },
  deckDot:          { height: 6, borderRadius: 3 },
  deckCta:          { flexDirection: 'row', paddingHorizontal: 20, paddingBottom: 28 },
  deckSendBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  deckSendBtnText:  { fontSize: 15, fontFamily: 'ProductSans-Black' },
});
