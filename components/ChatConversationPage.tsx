import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Keyboard,
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
  // sending → sent (echoed back) → delivered (partner has ws open) → read
  status?: 'sending' | 'sent' | 'delivered' | 'read';
  // Truth or Dare game messages
  isTod?: boolean;
  todMsgType?: 'tod_invite' | 'tod_accept' | 'tod_answer' | 'tod_next';
  todExtra?: Record<string, any>;
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

// ─── Card types (from DB) ─────────────────────────────────────────────────────

interface DbCard {
  id: string;
  game: string;       // "question" | "truth_or_dare"
  category: string;   // "Deep" | "Fun" | "Would You Rather" | "Truth" | "Dare"
  tag: string;
  emoji: string;
  question: string;
  color: string;
  sort_order: number;
}

const CATEGORY_ACCENT: Record<string, string> = {
  All: '#6366f1',
  Deep: '#3b82f6',
  Fun: '#f59e0b',
  'Would You Rather': '#ec4899',
  Truth: '#6366f1',
  Dare: '#ef4444',
};

const GAME_META: Record<string, { label: string; emoji: string; accent: string; desc: string }> = {
  question:      { label: 'Question Cards', emoji: '❓', accent: '#6366f1', desc: 'Deep, fun & thought-provoking' },
  truth_or_dare: { label: 'Truth or Dare',  emoji: '🎲', accent: '#ef4444', desc: 'Spicy dares & honest truths' },
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

// ─── Message status ticks ─────────────────────────────────────────────────────

function MsgTicks({ status }: { status?: Msg['status'] }) {
  if (!status || status === 'sending') {
    // Single grey clock icon — sending
    return <Ionicons name="time-outline" size={10} color="rgba(0,0,0,0.28)" style={{ marginLeft: 2 }} />;
  }
  if (status === 'sent') {
    // Single grey tick — sent but not yet delivered
    return <Ionicons name="checkmark" size={11} color="rgba(0,0,0,0.28)" style={{ marginLeft: 2 }} />;
  }
  if (status === 'delivered') {
    // Double grey ticks — delivered but not read
    return (
      <View style={{ flexDirection: 'row', marginLeft: 2 }}>
        <Ionicons name="checkmark" size={11} color="rgba(0,0,0,0.28)" style={{ marginRight: -5 }} />
        <Ionicons name="checkmark" size={11} color="rgba(0,0,0,0.28)" />
      </View>
    );
  }
  // Double white/blue ticks — read
  return (
    <View style={{ flexDirection: 'row', marginLeft: 2 }}>
      <Ionicons name="checkmark" size={11} color="#4fc3f7" style={{ marginRight: -5 }} />
      <Ionicons name="checkmark" size={11} color="#4fc3f7" />
    </View>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

// Hardcoded bubble colors — same in both themes for consistency
const BUBBLE_ME_BG   = '#FFFFFF';   // white for sent
const BUBBLE_ME_TEXT = '#000000';   // black text on white
const BUBBLE_THEM_TEXT_DARK  = '#ffffff';
const BUBBLE_THEM_TEXT_LIGHT = '#000000';

// Category accent colors + emojis (matches backend CATEGORY_COLORS)
const CAT_ACCENT: Record<string, string> = {
  Spicy: '#ef4444', Romantic: '#ec4899', Fun: '#f59e0b', Deep: '#6366f1',
  Truth: '#6366f1', Dare: '#ef4444',
  Deep2: '#3b82f6', 'Would You Rather': '#ec4899',
};
const CAT_EMOJI: Record<string, string> = {
  Spicy: '🌶️', Romantic: '💕', Fun: '😂', Deep: '🌊',
  Truth: '🤔', Dare: '🔥', 'Would You Rather': '🤷',
};
const CAT_BG: Record<string, string> = {
  Spicy: '#450a0a', Romantic: '#500724', Fun: '#451a03', Deep: '#1e1b4b',
  Truth: '#1e1b4b', Dare: '#450a0a', 'Would You Rather': '#500724',
};

// ─── Avatar ───────────────────────────────────────────────────────────────────

function BubbleAvatar({ uri, size = 28 }: { uri?: string; size?: number }) {
  if (!uri) {
    return (
      <View style={{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: '#333', alignItems: 'center', justifyContent: 'center',
      }}>
        <Ionicons name="person" size={size * 0.5} color="#888" />
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      contentFit="cover"
    />
  );
}

function Bubble({ msg, colors, onAnswer, answeredCards, myAvatar, partnerAvatar, isLastInGroup }: {
  msg: Msg; colors: any;
  onAnswer?: (q: string) => void;
  answeredCards?: Set<string>;
  myAvatar?: string;
  partnerAvatar?: string;
  isLastInGroup?: boolean;
}) {
  const isMe     = msg.from === 'me';
  const isDark   = colors.bg === '#000000' || colors.bg === '#0a0a0a' || colors.bg === '#111' || colors.bg?.length > 0 && parseInt(colors.bg.slice(1), 16) < 0x888888;
  const themText = isDark ? BUBBLE_THEM_TEXT_DARK : BUBBLE_THEM_TEXT_LIGHT;
  const avatarUri = isMe ? myAvatar : partnerAvatar;

  // avatar spacer — always reserve 36px so bubbles line up even when avatar hidden
  const avatarSlot = (
    <View style={{ width: 36, alignItems: isMe ? 'flex-end' : 'flex-start', justifyContent: 'flex-end', paddingBottom: 2 }}>
      {isLastInGroup && <BubbleAvatar uri={avatarUri} size={28} />}
    </View>
  );

  if (msg.isAnswer && msg.answerTo) {
    const bubble = (
      <Squircle
        style={[
          styles.answerBubble,
          isMe
            ? { maxWidth: W * 0.72 }
            : { maxWidth: W * 0.72 },
        ]}
        cornerRadius={20} cornerSmoothing={1}
        fillColor={isMe ? BUBBLE_ME_BG : colors.surface}
        strokeColor={isMe ? 'transparent' : colors.border}
        strokeWidth={StyleSheet.hairlineWidth}
      >
        <View style={[styles.answerContext, {
          backgroundColor: isMe ? 'rgba(0,0,0,0.06)' : colors.surface2,
          borderLeftColor: isMe ? 'rgba(0,0,0,0.25)' : '#7c3aed',
        }]}>
          <Text style={[styles.answerContextText, { color: isMe ? 'rgba(0,0,0,0.5)' : colors.textSecondary }]} numberOfLines={2}>
            {msg.answerTo}
          </Text>
        </View>
        <View style={styles.bubbleTextRow}>
          <Text style={[styles.bubbleText, { color: isMe ? BUBBLE_ME_TEXT : themText, flexShrink: 1 }]}>{msg.text}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 1 }}>
            <Text style={[styles.bubbleTimeInline, { color: isMe ? 'rgba(0,0,0,0.38)' : colors.textTertiary }]}>{msg.time}</Text>
            {isMe && <MsgTicks status={msg.status} />}
          </View>
        </View>
      </Squircle>
    );

    return (
      <View style={[styles.bubbleRow, isMe ? styles.bubbleRowMe : styles.bubbleRowThem]}>
        {!isMe && avatarSlot}
        {bubble}
        {isMe && avatarSlot}
      </View>
    );
  }

  if (msg.isCard) {
    // Pick category info from message metadata (sent when card was created)
    const meta      = (msg as any).todExtra ?? (msg as any).cardMeta ?? {};
    const category  = meta.category as string | undefined;
    const accent    = category ? (CAT_ACCENT[category] ?? '#6366f1') : '#6366f1';
    const cardBg    = category ? (CAT_BG[category]    ?? '#1a1a2e') : '#1a1a2e';
    const catEmoji  = category ? (CAT_EMOJI[category] ?? '❓') : '❓';
    const isAnswered = answeredCards?.has(msg.text) ?? false;

    const bubble = (
      <Squircle
        style={[styles.cardBubble, isMe ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }]}
        cornerRadius={22} cornerSmoothing={1}
        fillColor={cardBg}
      >
        {/* Sender label */}
        <Text style={{ fontSize: 11, fontFamily: 'ProductSans-Bold', color: 'rgba(255,255,255,0.45)', marginBottom: 2 }}>
          {isMe ? 'You sent a card' : 'Question card'}
        </Text>
        {/* Tag */}
        <View style={[styles.cardTag, { backgroundColor: `${accent}30` }]}>
          <Text style={{ fontSize: 12 }}>{catEmoji}</Text>
          <Text style={[styles.cardTagText, { color: accent }]}>{category ?? 'Question'}</Text>
        </View>
        <Text style={styles.cardBubbleEmoji}>❓</Text>
        <Text style={[styles.cardBubbleQuestion, { color: '#fff' }]}>{msg.text}</Text>
        <View style={[styles.cardBubbleFooter, { borderTopColor: 'rgba(255,255,255,0.12)' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Text style={[styles.bubbleTimeInline, { color: 'rgba(255,255,255,0.4)' }]}>{msg.time}</Text>
            {isMe && <MsgTicks status={msg.status} />}
          </View>
          {!isMe && (
            isAnswered ? (
              <View style={styles.answeredBadge}>
                <Ionicons name="checkmark" size={11} color="rgba(255,255,255,0.55)" />
                <Text style={styles.answeredBadgeText}>Answered</Text>
              </View>
            ) : onAnswer ? (
              <Pressable
                onPress={() => onAnswer(msg.text)}
                style={({ pressed }) => [styles.answerBtn, { backgroundColor: `${accent}25`, opacity: pressed ? 0.7 : 1 }]}
              >
                <Ionicons name="pencil" size={11} color={accent} />
                <Text style={[styles.answerBtnText, { color: accent }]}>Answer</Text>
              </Pressable>
            ) : null
          )}
        </View>
      </Squircle>
    );

    return (
      <View style={[styles.bubbleRow, isMe ? styles.bubbleRowMe : styles.bubbleRowThem]}>
        {!isMe && avatarSlot}
        {bubble}
        {isMe && avatarSlot}
      </View>
    );
  }

  // Standard text bubble
  const bubble = (
    <Squircle
      style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}
      cornerRadius={22} cornerSmoothing={1}
      fillColor={isMe ? BUBBLE_ME_BG : colors.surface}
    >
      <View style={styles.bubbleTextRow}>
        <Text style={[styles.bubbleText, { color: isMe ? BUBBLE_ME_TEXT : themText, flexShrink: 1 }]}>
          {msg.text}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 1 }}>
          <Text style={[styles.bubbleTimeInline, { color: isMe ? 'rgba(0,0,0,0.38)' : colors.textTertiary }]}>
            {msg.time}
          </Text>
          {isMe && <MsgTicks status={msg.status} />}
        </View>
      </View>
    </Squircle>
  );

  return (
    <View style={[styles.bubbleRow, isMe ? styles.bubbleRowMe : styles.bubbleRowThem]}>
      {!isMe && avatarSlot}
      {bubble}
      {isMe && avatarSlot}
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

// ─── Gamified Cards Panel (fetches from DB) ───────────────────────────────────

const XP_PER_CARD = 20;
const LEVEL_THRESHOLDS = [0, 60, 140, 260, 420];
const LEVEL_NAMES = ['Stranger', 'Curious', 'Connected', 'Intimate', 'Soulmates'];

function getLevelInfo(xp: number) {
  let level = 0;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) { level = i; break; }
  }
  const nextThreshold = LEVEL_THRESHOLDS[level + 1] ?? LEVEL_THRESHOLDS[level];
  const prevThreshold = LEVEL_THRESHOLDS[level];
  const progress = nextThreshold > prevThreshold
    ? (xp - prevThreshold) / (nextThreshold - prevThreshold)
    : 1;
  return { level, name: LEVEL_NAMES[level], progress: Math.min(progress, 1) };
}

function StarterCardsPanel({ colors, onSend, onClose, onTodInvite, totalSent = 0, token }: {
  colors: any;
  onSend: (q: string) => void;
  onClose: () => void;
  onTodInvite?: () => void;
  totalSent?: number;
  token?: string;
}) {
  const slideY    = useRef(new Animated.Value(500)).current;
  const scrollRef = useRef<ScrollView>(null);
  const xpAnim    = useRef(new Animated.Value(0)).current;

  // "picker" = game selection screen; "cards" = browsing cards
  const [screen, setScreen] = useState<'picker' | 'cards'>('picker');
  const [activeGame,     setActiveGame]     = useState<string>('question');
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [categories,     setCategories]     = useState<string[]>([]);
  const [cards,          setCards]          = useState<DbCard[]>([]);
  const [loadingCats,    setLoadingCats]    = useState(false);
  const [loadingCards,   setLoadingCards]   = useState(false);
  const [activeIdx,      setActiveIdx]      = useState(0);
  const [sessionSent,    setSessionSent]    = useState(0);

  const xp       = (totalSent + sessionSent) * XP_PER_CARD;
  const lvlInfo  = getLevelInfo(xp);

  useEffect(() => {
    Animated.spring(slideY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 260 }).start();
  }, []);

  useEffect(() => {
    Animated.timing(xpAnim, {
      toValue: lvlInfo.progress,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [sessionSent, totalSent]);

  // Fetch categories when game changes
  useEffect(() => {
    if (!token || screen !== 'cards') return;
    setLoadingCats(true);
    setCategories([]);
    setCards([]);
    setActiveCategory('');
    apiFetch<string[]>(`/cards/${activeGame}`, { token })
      .then(cats => {
        setCategories(cats);
        if (cats.length > 0) {
          setActiveCategory(cats[0]);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingCats(false));
  }, [activeGame, screen, token]);

  // Fetch cards when category changes
  useEffect(() => {
    if (!token || !activeCategory) return;
    setLoadingCards(true);
    setCards([]);
    setActiveIdx(0);
    scrollRef.current?.scrollTo({ x: 0, animated: false });
    apiFetch<DbCard[]>(`/cards/${activeGame}/${encodeURIComponent(activeCategory)}`, { token })
      .then(setCards)
      .catch(() => {})
      .finally(() => setLoadingCards(false));
  }, [activeGame, activeCategory, token]);

  const dismiss = (cb?: () => void) =>
    Animated.timing(slideY, { toValue: 500, duration: 220, useNativeDriver: true }).start(cb);

  const handleScroll = (e: any) => {
    const x = e.nativeEvent.contentOffset.x;
    setActiveIdx(Math.max(0, Math.min(Math.round(x / (CARD_W + CARD_GAP)), cards.length - 1)));
  };

  const handleSend = () => {
    if (!cards[activeIdx]) return;
    setSessionSent(s => s + 1);
    dismiss(() => onSend(cards[activeIdx].question));
  };

  const accentColor = activeCategory ? (CATEGORY_ACCENT[activeCategory] ?? '#6366f1') : '#6366f1';
  const gameMeta    = GAME_META[activeGame] ?? GAME_META.question;

  const xpBarWidth = xpAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

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
            <Squircle style={styles.panelIcon} cornerRadius={12} cornerSmoothing={1} fillColor={colors.surface2}>
              <Ionicons name="layers" size={16} color={colors.text} />
            </Squircle>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[styles.panelTitle, { color: colors.text }]}>
                  {screen === 'picker' ? 'Games' : gameMeta.label}
                </Text>
                {screen === 'cards' && (
                  <View style={[styles.streakBadge, { backgroundColor: `${accentColor}22`, borderColor: `${accentColor}40`, borderWidth: 1 }]}>
                    <Text style={[styles.streakText, { color: accentColor }]}>
                      {(totalSent + sessionSent) > 0 ? `🃏 ${totalSent + sessionSent} sent` : '🃏 Start playing'}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.panelSub, { color: colors.textSecondary }]}>
                {screen === 'picker' ? 'Choose a game to play' : gameMeta.desc}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {screen === 'cards' && (
                <Pressable onPress={() => setScreen('picker')} hitSlop={12}>
                  <Squircle style={styles.panelCloseBtn} cornerRadius={10} cornerSmoothing={1} fillColor={colors.surface2}>
                    <Ionicons name="arrow-back" size={16} color={colors.text} />
                  </Squircle>
                </Pressable>
              )}
              <Pressable onPress={() => dismiss(onClose)} hitSlop={12}>
                <Squircle style={styles.panelCloseBtn} cornerRadius={10} cornerSmoothing={1} fillColor={colors.surface2}>
                  <Ionicons name="close" size={16} color={colors.text} />
                </Squircle>
              </Pressable>
            </View>
          </View>

          {/* ── GAME PICKER SCREEN ── */}
          {screen === 'picker' && (
            <View style={{ paddingHorizontal: 16, paddingBottom: 32, gap: 12 }}>
              {Object.entries(GAME_META).map(([gameKey, meta]) => (
                <Pressable
                  key={gameKey}
                  onPress={() => {
                    if (gameKey === 'truth_or_dare') {
                      // T&D is an interactive game — invite partner instead of browse cards
                      dismiss(() => { onClose(); onTodInvite?.(); });
                    } else {
                      setActiveGame(gameKey);
                      setScreen('cards');
                    }
                  }}
                  style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
                >
                  <Squircle
                    style={styles.gameCard}
                    cornerRadius={22} cornerSmoothing={1}
                    fillColor={colors.surface}
                    strokeColor={colors.border}
                    strokeWidth={StyleSheet.hairlineWidth}
                  >
                    <View style={[styles.gameCardIcon, { backgroundColor: `${meta.accent}20` }]}>
                      <Text style={{ fontSize: 28 }}>{meta.emoji}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.gameCardTitle, { color: colors.text }]}>{meta.label}</Text>
                      <Text style={[styles.gameCardDesc, { color: colors.textSecondary }]}>
                        {gameKey === 'truth_or_dare' ? 'Invite your match to play live' : meta.desc}
                      </Text>
                    </View>
                    <View style={[styles.gameCardArrow, { backgroundColor: `${meta.accent}18` }]}>
                      <Ionicons name={gameKey === 'truth_or_dare' ? 'game-controller' : 'chevron-forward'} size={18} color={meta.accent} />
                    </View>
                  </Squircle>
                </Pressable>
              ))}
            </View>
          )}

          {/* ── CARDS SCREEN ── */}
          {screen === 'cards' && (
            <>
              {/* XP / Level Bar */}
              <View style={{ paddingHorizontal: 16, marginBottom: 12, gap: 5 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 11, fontFamily: 'ProductSans-Bold', color: accentColor }}>
                      {lvlInfo.name.toUpperCase()}
                    </Text>
                    <View style={[styles.streakBadge, { backgroundColor: `${accentColor}18` }]}>
                      <Text style={[styles.streakText, { color: accentColor }]}>Lv {lvlInfo.level + 1}</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 10, fontFamily: 'ProductSans-Regular', color: colors.textSecondary }}>
                    {xp} XP
                  </Text>
                </View>
                <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.surface2, overflow: 'hidden' }}>
                  <Animated.View style={{
                    height: 4, borderRadius: 2,
                    backgroundColor: accentColor,
                    width: xpBarWidth,
                  }} />
                </View>
              </View>

              {/* Category tabs */}
              {loadingCats ? (
                <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
                  <ActivityIndicator size="small" color={accentColor} />
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.categoryTabs}
                >
                  {categories.map(cat => {
                    const isActive = cat === activeCategory;
                    const accent = CATEGORY_ACCENT[cat] ?? accentColor;
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
                          {cat === 'Truth' ? '🤔 Truth' : cat === 'Dare' ? '🔥 Dare' : cat}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}

              {/* Card carousel */}
              {loadingCards ? (
                <View style={{ height: 220, alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator size="large" color={accentColor} />
                </View>
              ) : (
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
                  {cards.map((card, i) => {
                    const isActive = i === activeIdx;
                    const tagColor = CATEGORY_ACCENT[card.tag] ?? CATEGORY_ACCENT[card.category] ?? accentColor;
                    return (
                      <Pressable
                        key={card.id}
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
                          style={[styles.deckCard, { width: CARD_W, opacity: isActive ? 1 : 0.55 }]}
                          cornerRadius={28} cornerSmoothing={1}
                          fillColor={isActive ? card.color : colors.surface}
                          strokeColor={isActive ? 'transparent' : colors.border}
                          strokeWidth={StyleSheet.hairlineWidth}
                        >
                          {/* Category pill */}
                          <View style={[styles.deckCardTag, {
                            backgroundColor: isActive ? `${tagColor}35` : colors.surface2,
                          }]}>
                            <View style={[styles.cardTagDot, {
                              backgroundColor: isActive ? tagColor : colors.textSecondary,
                            }]} />
                            <Text style={[styles.deckCardTagText, {
                              color: isActive ? tagColor : colors.textSecondary,
                            }]}>
                              {card.tag}
                            </Text>
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
              )}

              {/* Dots */}
              {cards.length > 0 && (
                <View style={styles.deckDots}>
                  {cards.map((_, i) => (
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
              )}

              {/* Send CTA */}
              <View style={styles.deckCta}>
                <Pressable onPress={handleSend} disabled={cards.length === 0} style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1, flex: 1 }]}>
                  <Squircle
                    style={styles.deckSendBtn} cornerRadius={50} cornerSmoothing={1}
                    fillColor={cards.length === 0 ? colors.surface2 : accentColor}
                  >
                    <Ionicons name="send" size={15} color="#fff" />
                    <Text style={[styles.deckSendBtnText, { color: '#fff' }]}>
                      {activeCategory === 'Dare' ? '🔥 Send Dare'
                        : activeCategory === 'Truth' ? '🤔 Send Truth'
                        : 'Send this card'}
                    </Text>
                  </Squircle>
                </Pressable>
              </View>
            </>
          )}
        </Pressable>
      </Animated.View>
    </Pressable>
  );
}

// ─── Truth or Dare — interactive game bubbles ────────────────────────────────

const TOD_TRUTH_COLOR  = '#1e1b4b'; // dark indigo
const TOD_DARE_COLOR   = '#450a0a'; // dark red
const TOD_INVITE_COLOR = '#0f0f1e';

const TOD_CATEGORIES = ['Spicy', 'Romantic', 'Fun', 'Deep'];
const TOD_CAT_ACCENT: Record<string, string> = {
  Spicy: '#ef4444', Romantic: '#ec4899', Fun: '#f59e0b', Deep: '#6366f1',
};
const TOD_CAT_EMOJI: Record<string, string> = {
  Spicy: '🌶️', Romantic: '💕', Fun: '😂', Deep: '🌊',
};

function TodBubble({ msg, colors, myId, onJoin, onAnswer, onSendTurn, messages, myAvatar, partnerAvatar, isLastInGroup }: {
  msg: Msg;
  colors: any;
  myId: string;
  onJoin: (msgId: string) => void;
  onAnswer: (msg: Msg) => void;
  onSendTurn: () => void;
  messages: Msg[];
  myAvatar?: string;
  partnerAvatar?: string;
  isLastInGroup?: boolean;
}) {
  const isMe  = msg.from === 'me';
  const extra = msg.todExtra ?? {};

  const avatarSlot = (
    <View style={{ width: 36, alignItems: isMe ? 'flex-end' : 'flex-start', justifyContent: 'flex-end', paddingBottom: 2 }}>
      {isLastInGroup && <BubbleAvatar uri={isMe ? myAvatar : partnerAvatar} size={28} />}
    </View>
  );

  // ── Invite bubble ─────────────────────────────────────────────────────────
  if (msg.todMsgType === 'tod_invite') {
    const accepted = messages.some(m => m.todMsgType === 'tod_accept' && m.todExtra?.inviteId === msg.id);
    return (
      <View style={[styles.bubbleRow, isMe ? styles.bubbleRowMe : styles.bubbleRowThem]}>
        {!isMe && avatarSlot}
        <Squircle
          style={styles.todInviteBubble}
          cornerRadius={24} cornerSmoothing={1}
          fillColor={TOD_INVITE_COLOR}
        >
          <Text style={styles.todInviteEmoji}>🎲</Text>
          <Text style={styles.todInviteTitle}>Truth or Dare</Text>
          <Text style={styles.todInviteSub}>
            {isMe ? 'You invited to play' : `${extra.senderName ?? 'They'} wants to play!`}
          </Text>
          {!isMe && !accepted && (
            <Pressable onPress={() => onJoin(msg.id)} style={({ pressed }) => [styles.todJoinBtn, { opacity: pressed ? 0.8 : 1 }]}>
              <Text style={styles.todJoinBtnText}>Join Game 🎮</Text>
            </Pressable>
          )}
          {accepted && (
            <View style={styles.todAcceptedBadge}>
              <Ionicons name="checkmark-circle" size={13} color="#4ade80" />
              <Text style={styles.todAcceptedText}>Game started!</Text>
            </View>
          )}
          <Text style={[styles.bubbleTimeInline, { color: 'rgba(255,255,255,0.35)', marginTop: 6 }]}>{msg.time}</Text>
        </Squircle>
        {isMe && avatarSlot}
      </View>
    );
  }

  // ── Accept / system events ─────────────────────────────────────────────────
  if (msg.todMsgType === 'tod_accept') {
    return (
      <View style={[styles.bubbleRow, { justifyContent: 'center' }]}>
        <Squircle style={styles.todSystemBubble} cornerRadius={50} cornerSmoothing={1} fillColor={colors.surface2}>
          <Text style={{ fontSize: 14 }}>🎲</Text>
          <Text style={[styles.todSystemText, { color: colors.textSecondary }]}>
            {isMe ? 'You joined! Send them a card first.' : 'Game on! Your partner will send first.'}
          </Text>
        </Squircle>
      </View>
    );
  }

  // ── Turn card: the sender chose truth/dare + picked a card ────────────────
  if (msg.todMsgType === 'tod_next') {
    const choice   = extra.choice   as 'truth' | 'dare' | undefined;
    const question = extra.question as string   | undefined;
    const emoji    = extra.emoji    as string   | undefined;
    const category = extra.category as string   | undefined;
    const bgColor  = choice === 'truth' ? TOD_TRUTH_COLOR : TOD_DARE_COLOR;
    const accent   = choice === 'truth' ? '#818cf8' : '#f87171';

    const answered = messages.some(m => m.todMsgType === 'tod_answer' && m.todExtra?.turnMsgId === msg.id);

    return (
      <View style={[styles.bubbleRow, isMe ? styles.bubbleRowMe : styles.bubbleRowThem]}>
        {!isMe && avatarSlot}
        <Squircle
          style={[styles.todTurnCard, isMe ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }]}
          cornerRadius={22} cornerSmoothing={1}
          fillColor={bgColor}
        >
          {/* Header row */}
          <View style={styles.todTurnHeader}>
            <Squircle style={styles.todChoicePill} cornerRadius={50} cornerSmoothing={1}
              fillColor={`${accent}25`}>
              <Text style={[styles.todChoicePillText, { color: accent }]}>
                {choice === 'truth' ? '🤔 Truth' : '🔥 Dare'}
              </Text>
            </Squircle>
            {category && (
              <Squircle style={[styles.todChoicePill, { marginLeft: 6 }]} cornerRadius={50} cornerSmoothing={1}
                fillColor="rgba(255,255,255,0.08)">
                <Text style={[styles.todChoicePillText, { color: 'rgba(255,255,255,0.7)' }]}>
                  {TOD_CAT_EMOJI[category] ?? ''} {category}
                </Text>
              </Squircle>
            )}
            <View style={{ flex: 1 }} />
            <Text style={[styles.bubbleTimeInline, { color: 'rgba(255,255,255,0.35)' }]}>{msg.time}</Text>
          </View>

          <Text style={styles.todTurnName}>
            {isMe ? 'You sent' : `From ${extra.senderName ?? 'them'}`}
          </Text>

          {emoji && <Text style={{ fontSize: 34, textAlign: 'center', marginVertical: 6 }}>{emoji}</Text>}
          {question
            ? <Text style={styles.todTurnQuestion}>{question}</Text>
            : <Text style={[styles.todTurnQuestion, { opacity: 0.4, fontStyle: 'italic' }]}>Card hidden…</Text>}

          {answered ? (
            <View style={styles.todAnsweredRow}>
              <Ionicons name="checkmark-circle" size={14} color="#4ade80" />
              <Text style={styles.todAnsweredText}>Answered</Text>
            </View>
          ) : !isMe && question ? (
            <Pressable onPress={() => onAnswer(msg)} style={({ pressed }) => [styles.todAnswerBtn, { opacity: pressed ? 0.8 : 1, backgroundColor: `${accent}22`, borderColor: `${accent}50` }]}>
              <Text style={[styles.todAnswerBtnText, { color: accent }]}>
                {choice === 'truth' ? 'Answer Truth' : 'Complete Dare'}
              </Text>
            </Pressable>
          ) : null}
        </Squircle>
        {isMe && avatarSlot}
      </View>
    );
  }

  // ── Answer bubble ─────────────────────────────────────────────────────────
  if (msg.todMsgType === 'tod_answer') {
    const choice  = extra.choice as 'truth' | 'dare' | undefined;
    const bgColor = choice === 'truth' ? TOD_TRUTH_COLOR : TOD_DARE_COLOR;
    const accent  = choice === 'truth' ? '#818cf8' : '#f87171';

    const isLastAnswer = messages.filter(m => m.todMsgType === 'tod_answer').slice(-1)[0]?.id === msg.id;

    return (
      <>
        <View style={[styles.bubbleRow, isMe ? styles.bubbleRowMe : styles.bubbleRowThem]}>
          {!isMe && avatarSlot}
          <Squircle
            style={[styles.todAnswerBubble, isMe ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }]}
            cornerRadius={22} cornerSmoothing={1}
            fillColor={bgColor}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Text style={{ fontSize: 13 }}>{choice === 'truth' ? '🤔' : '🔥'}</Text>
              <Text style={[styles.todAnswerLabel, { color: accent }]}>
                {choice === 'truth' ? 'Truth answer' : 'Dare completed'}
              </Text>
            </View>
            {extra.question && (
              <Text style={styles.todAnswerQuestion} numberOfLines={2}>{extra.question}</Text>
            )}
            <Text style={styles.todAnswerText}>{msg.text}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2, marginTop: 4 }}>
              <Text style={[styles.bubbleTimeInline, { color: 'rgba(255,255,255,0.35)' }]}>{msg.time}</Text>
              {isMe && <MsgTicks status={msg.status} />}
            </View>
          </Squircle>
          {isMe && avatarSlot}
        </View>
        {!isMe && isLastAnswer && (
          <View style={[styles.bubbleRow, { justifyContent: 'center', marginTop: 4 }]}>
            <Pressable onPress={onSendTurn} style={({ pressed }) => [styles.todNudgeBtn, { backgroundColor: colors.surface2, opacity: pressed ? 0.85 : 1 }]}>
              <Text style={{ fontSize: 14 }}>🎲</Text>
              <Text style={[styles.todNudgeText, { color: colors.text }]}>Now send them a card!</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
            </Pressable>
          </View>
        )}
      </>
    );
  }

  return null;
}

// ─── Truth or Dare — Send Card Panel (full redesign) ─────────────────────────
//
// Flow: pick Truth/Dare → pick source (Template | Custom | AI) → preview → send
//

function TodPickPanel({
  colors, token, myId, myName, partnerId, partnerName,
  chatMessages, onSendCard, onClose,
}: {
  colors: any;
  token?: string;
  myId: string;
  myName: string;
  partnerId: string;
  partnerName: string;
  chatMessages: Msg[];
  onSendCard: (choice: 'truth' | 'dare', question: string, emoji: string, color: string, category: string) => void;
  onClose: () => void;
}) {
  const slideY = useRef(new Animated.Value(700)).current;

  // step: 'choice' → 'source' → 'template_cat' → 'template_cards' → 'custom' → 'ai' → 'preview'
  const [step,     setStep]     = useState<'choice' | 'source' | 'template_cat' | 'template_cards' | 'custom' | 'ai' | 'preview'>('choice');
  const [choice,   setChoice]   = useState<'truth' | 'dare' | null>(null);
  const [category, setCategory] = useState<string>('');
  const [cards,    setCards]    = useState<DbCard[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  // Final card state
  const [cardQuestion, setCardQuestion] = useState('');
  const [cardEmoji,    setCardEmoji]    = useState('🎲');
  const [cardColor,    setCardColor]    = useState('#1e1b4b');
  const [customText,   setCustomText]   = useState('');

  useEffect(() => {
    Animated.spring(slideY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 230 }).start();
  }, []);

  const dismiss = (cb?: () => void) =>
    Animated.timing(slideY, { toValue: 700, duration: 220, useNativeDriver: true }).start(cb);

  const bgForChoice = (c: 'truth' | 'dare' | null) =>
    c === 'truth' ? TOD_TRUTH_COLOR : c === 'dare' ? TOD_DARE_COLOR : '#1e1b4b';

  // ── Fetch template cards ──────────────────────────────────────────────────
  const fetchTemplateCards = async (cat: string) => {
    if (!token || !choice) return;
    setLoading(true);
    try {
      const fetched = await apiFetch<DbCard[]>(
        `/cards/truth_or_dare/${choice === 'truth' ? 'Truth' : 'Dare'}`,
        { token }
      );
      setCards(fetched);
    } catch {}
    setLoading(false);
    setStep('template_cards');
  };

  // ── AI generation ─────────────────────────────────────────────────────────
  const generateAiCard = async () => {
    if (!token || !choice) return;
    setAiLoading(true);
    try {
      const context = chatMessages
        .filter(m => !m.isCard && !m.isTod)
        .slice(-12)
        .map(m => m.text);
      const result = await apiFetch<{ question: string; emoji: string; color: string }>(
        `/cards/generate`,
        {
          token,
          method: 'POST',
          body: JSON.stringify({ choice, category: category || 'Fun', chat_context: context }),
        }
      );
      setCardQuestion(result.question);
      setCardEmoji(result.emoji);
      setCardColor(result.color);
      setStep('preview');
    } catch {
      // Fallback — just go to custom
      setStep('custom');
    }
    setAiLoading(false);
  };

  const selectTemplateCard = (c: DbCard) => {
    setCardQuestion(c.question);
    setCardEmoji(c.emoji);
    setCardColor(c.color);
    setCategory(c.category);
    setStep('preview');
  };

  const confirmCustom = () => {
    if (!customText.trim()) return;
    setCardQuestion(customText.trim());
    setCardEmoji(choice === 'truth' ? '🤔' : '🔥');
    setCardColor(bgForChoice(choice));
    setStep('preview');
  };

  const handleSend = () => {
    if (!choice || !cardQuestion) return;
    dismiss(() => onSendCard(choice, cardQuestion, cardEmoji, cardColor, category || (choice === 'truth' ? 'Truth' : 'Dare')));
  };

  const headerTitle = () => {
    if (step === 'choice')        return 'Send a Card';
    if (step === 'source')        return choice === 'truth' ? '🤔 Truth Card' : '🔥 Dare Card';
    if (step === 'template_cat')  return 'Pick Category';
    if (step === 'template_cards') return 'Pick a Card';
    if (step === 'custom')        return 'Write Your Own';
    if (step === 'ai')            return 'AI Generate';
    if (step === 'preview')       return 'Preview';
    return 'Truth or Dare';
  };

  const goBack = () => {
    if (step === 'source')         setStep('choice');
    else if (step === 'template_cat')   setStep('source');
    else if (step === 'template_cards') setStep('template_cat');
    else if (step === 'custom')    setStep('source');
    else if (step === 'ai')        setStep('source');
    else if (step === 'preview')   setStep('source');
    else dismiss(onClose);
  };

  return (
    <Pressable style={StyleSheet.absoluteFill} onPress={() => dismiss(onClose)}>
      <Animated.View style={[
        styles.panel,
        { backgroundColor: colors.bg, borderTopColor: colors.border, transform: [{ translateY: slideY }] },
      ]}>
        <Pressable>
          <View style={[styles.panelHandle, { backgroundColor: colors.border }]} />

          {/* Header */}
          <View style={styles.panelHeader}>
            <Pressable onPress={goBack} hitSlop={12}>
              <Squircle style={styles.panelCloseBtn} cornerRadius={10} cornerSmoothing={1} fillColor={colors.surface2}>
                <Ionicons name={step === 'choice' ? 'close' : 'arrow-back'} size={16} color={colors.text} />
              </Squircle>
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={[styles.panelTitle, { color: colors.text, textAlign: 'center' }]}>{headerTitle()}</Text>
            </View>
            <View style={{ width: 32 }} />
          </View>

          {/* ── STEP: choice ── */}
          {step === 'choice' && (
            <View style={{ paddingHorizontal: 20, paddingBottom: 40, gap: 14 }}>
              <Pressable
                onPress={() => { setChoice('truth'); setStep('source'); }}
                style={({ pressed }) => [styles.todPickBtn, { backgroundColor: TOD_TRUTH_COLOR, opacity: pressed ? 0.85 : 1 }]}
              >
                <Text style={styles.todPickEmoji}>🤔</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.todPickTitle}>Truth</Text>
                  <Text style={styles.todPickSub}>Ask {partnerName} an honest question</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.5)" />
              </Pressable>
              <Pressable
                onPress={() => { setChoice('dare'); setStep('source'); }}
                style={({ pressed }) => [styles.todPickBtn, { backgroundColor: TOD_DARE_COLOR, opacity: pressed ? 0.85 : 1 }]}
              >
                <Text style={styles.todPickEmoji}>🔥</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.todPickTitle}>Dare</Text>
                  <Text style={styles.todPickSub}>Challenge {partnerName} to something spicy</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.5)" />
              </Pressable>
            </View>
          )}

          {/* ── STEP: source ── */}
          {step === 'source' && (
            <View style={{ paddingHorizontal: 20, paddingBottom: 40, gap: 12 }}>
              {/* AI card */}
              <Pressable
                onPress={() => { setStep('ai'); generateAiCard(); }}
                style={({ pressed }) => [styles.todSourceBtn, { borderColor: '#6366f1', opacity: pressed ? 0.85 : 1 }]}
              >
                <View style={[styles.todSourceIcon, { backgroundColor: '#1e1b4b' }]}>
                  <Ionicons name="sparkles" size={22} color="#a5b4fc" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.todSourceTitle, { color: colors.text }]}>AI Generated</Text>
                  <Text style={[styles.todSourceSub, { color: colors.textSecondary }]}>Personalised from your chat history</Text>
                </View>
                <View style={[styles.todSourceBadge, { backgroundColor: '#312e81' }]}>
                  <Text style={{ fontSize: 10, color: '#a5b4fc', fontFamily: 'ProductSans-Bold' }}>SMART</Text>
                </View>
              </Pressable>

              {/* Template */}
              <Pressable
                onPress={() => setStep('template_cat')}
                style={({ pressed }) => [styles.todSourceBtn, { borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}
              >
                <View style={[styles.todSourceIcon, { backgroundColor: colors.surface2 }]}>
                  <Ionicons name="grid" size={22} color={colors.text} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.todSourceTitle, { color: colors.text }]}>Template Cards</Text>
                  <Text style={[styles.todSourceSub, { color: colors.textSecondary }]}>Browse by category</Text>
                </View>
              </Pressable>

              {/* Custom */}
              <Pressable
                onPress={() => setStep('custom')}
                style={({ pressed }) => [styles.todSourceBtn, { borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}
              >
                <View style={[styles.todSourceIcon, { backgroundColor: colors.surface2 }]}>
                  <Ionicons name="create" size={22} color={colors.text} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.todSourceTitle, { color: colors.text }]}>Write My Own</Text>
                  <Text style={[styles.todSourceSub, { color: colors.textSecondary }]}>Custom question or dare</Text>
                </View>
              </Pressable>
            </View>
          )}

          {/* ── STEP: template_cat ── */}
          {step === 'template_cat' && (
            <View style={{ paddingHorizontal: 20, paddingBottom: 40, gap: 12 }}>
              {TOD_CATEGORIES.map(cat => (
                <Pressable
                  key={cat}
                  onPress={() => { setCategory(cat); fetchTemplateCards(cat); }}
                  style={({ pressed }) => [styles.todCatBtn, { borderColor: TOD_CAT_ACCENT[cat], opacity: pressed ? 0.85 : 1 }]}
                >
                  <Text style={{ fontSize: 24 }}>{TOD_CAT_EMOJI[cat]}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.todSourceTitle, { color: colors.text }]}>{cat}</Text>
                    <Text style={[styles.todSourceSub, { color: colors.textSecondary }]}>
                      {cat === 'Spicy' ? 'Bold & daring' : cat === 'Romantic' ? 'Sweet & intimate' : cat === 'Fun' ? 'Lighthearted laughs' : 'Thoughtful & deep'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={TOD_CAT_ACCENT[cat]} />
                </Pressable>
              ))}
            </View>
          )}

          {/* ── STEP: template_cards ── */}
          {step === 'template_cards' && (
            <View style={{ paddingBottom: 28 }}>
              {loading ? (
                <View style={{ height: 180, alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator size="large" color={choice === 'truth' ? '#6366f1' : '#ef4444'} />
                </View>
              ) : (
                <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
                  {cards.map(c => (
                    <Pressable
                      key={c.id}
                      onPress={() => selectTemplateCard(c)}
                      style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
                    >
                      <View style={[styles.todTemplateCard, { backgroundColor: c.color }]}>
                        <Text style={{ fontSize: 24, marginBottom: 6 }}>{c.emoji}</Text>
                        <Text style={styles.todTemplateCardText}>{c.question}</Text>
                        <View style={{ position: 'absolute', top: 12, right: 12 }}>
                          <Ionicons name="chevron-forward-circle" size={20} color="rgba(255,255,255,0.4)" />
                        </View>
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>
          )}

          {/* ── STEP: custom ── */}
          {step === 'custom' && (
            <View style={{ paddingHorizontal: 20, paddingBottom: 40, gap: 16 }}>
              <View style={[styles.todCardPreview, { backgroundColor: bgForChoice(choice), minHeight: 60 }]}>
                <View style={[styles.todChoicePill, {
                  backgroundColor: choice === 'truth' ? 'rgba(99,102,241,0.35)' : 'rgba(239,68,68,0.35)',
                  alignSelf: 'flex-start', marginBottom: 8,
                }]}>
                  <Text style={styles.todChoicePillText}>{choice === 'truth' ? '🤔 Truth' : '🔥 Dare'}</Text>
                </View>
                <Text style={[styles.todCardPreviewQuestion, { opacity: customText ? 1 : 0.4, fontStyle: customText ? 'normal' : 'italic' }]}>
                  {customText || `Write your ${choice}…`}
                </Text>
              </View>

              <Squircle style={styles.todAnswerInput} cornerRadius={16} cornerSmoothing={1}
                fillColor={colors.surface} strokeColor={colors.border} strokeWidth={StyleSheet.hairlineWidth}>
                <TextInput
                  style={[{ flex: 1, color: colors.text, fontSize: 15, fontFamily: 'ProductSans-Regular', padding: 14 }]}
                  placeholder={choice === 'dare' ? "Type your dare challenge…" : "Type your truth question…"}
                  placeholderTextColor={colors.placeholder}
                  value={customText}
                  onChangeText={setCustomText}
                  multiline
                  maxLength={300}
                  autoFocus
                />
              </Squircle>

              <Pressable
                onPress={confirmCustom}
                disabled={!customText.trim()}
                style={({ pressed }) => [styles.todRevealBtn, {
                  backgroundColor: bgForChoice(choice),
                  opacity: !customText.trim() ? 0.5 : pressed ? 0.8 : 1,
                }]}
              >
                <Text style={styles.todRevealBtnText}>Preview Card</Text>
                <Ionicons name="arrow-forward" size={16} color="#fff" />
              </Pressable>
            </View>
          )}

          {/* ── STEP: ai loading ── */}
          {step === 'ai' && (
            <View style={{ height: 200, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
              <ActivityIndicator size="large" color={choice === 'truth' ? '#6366f1' : '#ef4444'} />
              <Text style={[styles.panelSub, { color: colors.textSecondary }]}>Generating your card…</Text>
            </View>
          )}

          {/* ── STEP: preview ── */}
          {step === 'preview' && (
            <View style={{ paddingHorizontal: 20, paddingBottom: 40, gap: 16 }}>
              <View style={[styles.todCardPreview, { backgroundColor: cardColor }]}>
                <View style={[styles.todChoicePill, {
                  backgroundColor: choice === 'truth' ? 'rgba(99,102,241,0.35)' : 'rgba(239,68,68,0.35)',
                  alignSelf: 'flex-start', marginBottom: 8,
                }]}>
                  <Text style={styles.todChoicePillText}>{choice === 'truth' ? '🤔 Truth' : '🔥 Dare'}</Text>
                </View>
                <Text style={{ fontSize: 40, textAlign: 'center', marginVertical: 8 }}>{cardEmoji}</Text>
                <Text style={styles.todCardPreviewQuestion}>{cardQuestion}</Text>
              </View>

              <Pressable
                onPress={handleSend}
                style={({ pressed }) => [styles.todRevealBtn, {
                  backgroundColor: bgForChoice(choice),
                  opacity: pressed ? 0.8 : 1,
                }]}
              >
                <Ionicons name="send" size={16} color="#fff" />
                <Text style={styles.todRevealBtnText}>
                  Send {choice === 'truth' ? 'Truth' : 'Dare'} to {partnerName}
                </Text>
              </Pressable>

              <Pressable onPress={() => setStep('source')} style={{ alignItems: 'center' }}>
                <Text style={[styles.todSourceSub, { color: colors.textSecondary }]}>Pick a different card</Text>
              </Pressable>
            </View>
          )}
        </Pressable>
      </Animated.View>
    </Pressable>
  );
}

// ─── Truth or Dare — Answer Panel ────────────────────────────────────────────

function TodAnswerPanel({ colors, turnMsg, onSubmit, onClose }: {
  colors: any;
  turnMsg: Msg;
  onSubmit: (answer: string) => void;
  onClose: () => void;
}) {
  const slideY    = useRef(new Animated.Value(700)).current;
  const [text, setText] = useState('');
  const extra   = turnMsg.todExtra ?? {};
  const choice  = extra.choice   as 'truth' | 'dare' | undefined;
  const question = extra.question as string | undefined;
  const bgColor  = choice === 'truth' ? TOD_TRUTH_COLOR : TOD_DARE_COLOR;

  useEffect(() => {
    Animated.spring(slideY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 230 }).start();
  }, []);

  const dismiss = (cb?: () => void) =>
    Animated.timing(slideY, { toValue: 700, duration: 220, useNativeDriver: true }).start(cb);

  const handleSubmit = () => {
    if (!text.trim()) return;
    dismiss(() => onSubmit(text.trim()));
  };

  return (
    <Pressable style={StyleSheet.absoluteFill} onPress={() => dismiss(onClose)}>
      <Animated.View style={[
        styles.panel,
        { backgroundColor: colors.bg, borderTopColor: colors.border, transform: [{ translateY: slideY }] },
      ]}>
        <Pressable>
          <View style={[styles.panelHandle, { backgroundColor: colors.border }]} />
          <View style={styles.panelHeader}>
            <Pressable onPress={() => dismiss(onClose)} hitSlop={12}>
              <Squircle style={styles.panelCloseBtn} cornerRadius={10} cornerSmoothing={1} fillColor={colors.surface2}>
                <Ionicons name="close" size={16} color={colors.text} />
              </Squircle>
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={[styles.panelTitle, { color: colors.text, textAlign: 'center' }]}>
                {choice === 'dare' ? '🔥 Complete Dare' : '🤔 Answer Truth'}
              </Text>
            </View>
            <View style={{ width: 32 }} />
          </View>

          <View style={{ paddingHorizontal: 20, paddingBottom: 40, gap: 16 }}>
            {/* Card preview */}
            <View style={[styles.todCardPreview, { backgroundColor: bgColor }]}>
              <View style={[styles.todChoicePill, {
                backgroundColor: choice === 'truth' ? 'rgba(99,102,241,0.35)' : 'rgba(239,68,68,0.35)',
                alignSelf: 'flex-start', marginBottom: 8,
              }]}>
                <Text style={styles.todChoicePillText}>{choice === 'truth' ? '🤔 Truth' : '🔥 Dare'}</Text>
              </View>
              {extra.emoji && <Text style={{ fontSize: 36, textAlign: 'center', marginBottom: 6 }}>{extra.emoji}</Text>}
              <Text style={styles.todCardPreviewQuestion}>{question ?? ''}</Text>
            </View>

            {/* Answer input */}
            <Squircle style={styles.todAnswerInput} cornerRadius={16} cornerSmoothing={1}
              fillColor={colors.surface} strokeColor={colors.border} strokeWidth={StyleSheet.hairlineWidth}>
              <TextInput
                style={[{ flex: 1, color: colors.text, fontSize: 15, fontFamily: 'ProductSans-Regular', padding: 14 }]}
                placeholder={choice === 'dare' ? "Describe what you did…" : "Your honest answer…"}
                placeholderTextColor={colors.placeholder}
                value={text}
                onChangeText={setText}
                multiline
                maxLength={500}
                autoFocus
              />
            </Squircle>

            <Pressable
              onPress={handleSubmit}
              disabled={!text.trim()}
              style={({ pressed }) => [styles.todRevealBtn, {
                backgroundColor: bgColor,
                opacity: !text.trim() ? 0.5 : pressed ? 0.8 : 1,
              }]}
            >
              <Ionicons name="send" size={16} color="#fff" />
              <Text style={styles.todRevealBtnText}>Send Answer</Text>
            </Pressable>
          </View>
        </Pressable>
      </Animated.View>
    </Pressable>
  );
}

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
  const [isOnline, setIsOnline] = useState(online);

  // ── Truth or Dare game state ──────────────────────────────────────────────
  // showTodPicker: open the "send a card" panel (sender flow)
  const [showTodPicker,  setShowTodPicker]  = useState(false);
  // todAnswerMsg: the turn message the receiver is answering
  const [todAnswerMsg,   setTodAnswerMsg]   = useState<Msg | null>(null);
  const scrollRef       = useRef<ScrollView>(null);
  const wsRef           = useRef<WebSocket | null>(null);
  const safeSendRef     = useRef<((raw: string) => void) | null>(null);
  const notifyWsRef     = useRef<WebSocket | null>(null);
  // Tracks the last optimistic message ID so we can replace it with the real echo
  const pendingOptIdRef = useRef<string | null>(null);
  // Global dedup set — prevents chat WS + notify WS both adding the same message
  const seenMsgIdsRef   = useRef<Set<string>>(new Set());
  const myId      = profile?.id ?? '';

  // ── Convert API message to local Msg ──────────────────────────────────────
  const apiMsgToMsg = useCallback((m: ApiMessage): Msg => {
    const isTodMsg = m.msg_type?.startsWith('tod_');
    return {
      id:      m.id,
      text:    m.content,
      from:    m.sender_id === myId ? 'me' : 'them',
      time:    _formatTime(m.created_at),
      isCard:  m.msg_type === 'card',
      isAnswer: m.msg_type === 'answer',
      answerTo: m.metadata?.answerTo,
      status:  m.sender_id === myId ? (m.is_read ? 'read' : 'delivered') : undefined,
      isTod:    isTodMsg,
      todMsgType: isTodMsg ? (m.msg_type as Msg['todMsgType']) : undefined,
      todExtra:   (m.metadata as Record<string, any>) ?? undefined,
    };
  }, [myId]);

  // ── Load message history ──────────────────────────────────────────────────
  useEffect(() => {
    if (!token || !partnerId) { setLoadingHistory(false); return; }
    apiFetch<{ messages: ApiMessage[] }>(`/chat/${partnerId}/messages`, { token })
      .then(r => {
        const msgs = r.messages.map(apiMsgToMsg);
        // Seed the dedup set so WS events don't re-add history messages
        seenMsgIdsRef.current = new Set(msgs.map(m => m.id));
        setMessages(msgs);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100);
      })
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, [token, partnerId]);

  // ── WebSocket connection ──────────────────────────────────────────────────
  useEffect(() => {
    if (!token || !partnerId) return;

    let disposed = false;

    // Queue for messages sent before onopen fires
    const pendingQueue: string[] = [];

    const ws = new WebSocket(`${WS_V1}/ws/chat/${partnerId}?token=${token}`);

    const safeSend = (raw: string) => {
      if (disposed) return;
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(raw);
      } else {
        pendingQueue.push(raw);
      }
    };

    // Expose safeSend via ref so sendMessage always calls the current socket's sender
    wsRef.current = ws;
    safeSendRef.current = safeSend;

    ws.onopen = () => {
      if (disposed) { ws.close(); return; }
      // Flush queued messages
      while (pendingQueue.length > 0) {
        ws.send(pendingQueue.shift()!);
      }
      ws.send(JSON.stringify({ type: 'read' }));
    };

    ws.onmessage = (e) => {
      if (disposed) return;
      try {
        const payload = JSON.parse(e.data);
        if (payload.type === 'message') {
          const m: ApiMessage = payload;
          const msg = apiMsgToMsg({ ...m, content: payload.content });
          setMessages(prev => {
            const pendingId = pendingOptIdRef.current;
            if (pendingId && msg.from === 'me') {
              pendingOptIdRef.current = null;
              seenMsgIdsRef.current.add(msg.id);
              // Echo back = confirmed sent; mark as 'sent'
              return prev.map(x => x.id === pendingId ? { ...msg, status: 'sent' } : x);
            }
            if (seenMsgIdsRef.current.has(msg.id)) return prev;
            seenMsgIdsRef.current.add(msg.id);
            return [...prev, msg];
          });
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
          ws.send(JSON.stringify({ type: 'read' }));
        } else if (payload.type === 'read') {
          // Partner has read our messages — mark all my sent messages as 'read'
          setMessages(prev =>
            prev.map(m => m.from === 'me' && m.status !== 'read' ? { ...m, status: 'read' } : m)
          );
        } else if (payload.type === 'typing') {
          setIsPartnerTyping(Boolean(payload.is_typing));
          if (payload.is_typing) setTimeout(() => setIsPartnerTyping(false), 3000);
        } else if (payload.type === 'presence' && payload.user_id === partnerId) {
          setIsOnline(Boolean(payload.online));
        }
      } catch {}
    };

    ws.onerror = () => {};
    ws.onclose = () => {
      if (!disposed) wsRef.current = null;
    };

    return () => {
      disposed = true;
      safeSendRef.current = null;
      ws.close();
      wsRef.current = null;
    };
  }, [token, partnerId]);

  // ── Notify WebSocket — receives new_message & presence events ────────────
  useEffect(() => {
    if (!token || !partnerId) return;

    const nws = new WebSocket(`${WS_V1}/ws/notify?token=${token}`);
    notifyWsRef.current = nws;

    nws.onopen = () => {
      // Ask backend for current presence of the partner right away
      nws.send(JSON.stringify({ type: 'presence_query', user_id: partnerId }));
    };

    nws.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.type === 'new_message' && payload.sender_id === partnerId) {
          const m: ApiMessage = {
            id:          payload.id,
            sender_id:   payload.sender_id,
            receiver_id: payload.receiver_id,
            content:     payload.content,
            msg_type:    payload.msg_type,
            metadata:    payload.metadata,
            is_read:     payload.is_read,
            created_at:  payload.created_at,
          };
          const msg = apiMsgToMsg(m);
          setMessages(prev => {
            // Dedup — chat WS may have already added this
            if (seenMsgIdsRef.current.has(msg.id)) return prev;
            seenMsgIdsRef.current.add(msg.id);
            return [...prev, msg];
          });
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
          safeSendRef.current?.(JSON.stringify({ type: 'read' }));
        } else if (payload.type === 'presence' && payload.user_id === partnerId) {
          setIsOnline(Boolean(payload.online));
        } else if (payload.type === 'presence_status' && payload.user_id === partnerId) {
          setIsOnline(Boolean(payload.online));
        }
      } catch {}
    };

    nws.onerror = () => {};
    nws.onclose = () => { notifyWsRef.current = null; };

    return () => {
      nws.close();
      notifyWsRef.current = null;
    };
  }, [token, partnerId]);

  // ── Typing indicator ──────────────────────────────────────────────────────
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleTextChange = (val: string) => {
    setText(val);
    if (!safeSendRef.current) return;
    safeSendRef.current(JSON.stringify({ type: 'typing', is_typing: true }));
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      safeSendRef.current?.(JSON.stringify({ type: 'typing', is_typing: false }));
    }, 2000);
  };

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = (txt: string, opts?: { isCard?: boolean; isAnswer?: boolean; answerTo?: string }) => {
    if (!txt.trim()) return;

    const msgType  = opts?.isCard ? 'card' : opts?.isAnswer ? 'answer' : 'text';
    const metadata = opts?.answerTo ? { answerTo: opts.answerTo } : null;

    // Optimistic UI update
    const optimisticId = `opt-${Date.now()}`;
    const optimistic: Msg = {
      id:       optimisticId,
      text:     txt.trim(),
      from:     'me',
      time:     nowTime(),
      isCard:   opts?.isCard,
      isAnswer: opts?.isAnswer,
      answerTo: opts?.answerTo,
      status:   'sending',
    };
    pendingOptIdRef.current = optimisticId;
    setMessages(prev => [...prev, optimistic]);
    setText('');
    setAnsweringCard(null);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);

    // Send via WebSocket (queuing if not yet open), fall back to REST only if no WS at all
    const payload = JSON.stringify({ type: 'message', content: txt.trim(), msg_type: msgType, metadata });
    if (safeSendRef.current) {
      safeSendRef.current(payload);
    } else if (token && partnerId) {
      apiFetch<ApiMessage>(`/chat/${partnerId}/messages`, {
        token,
        method: 'POST',
        body: JSON.stringify({ content: txt.trim(), msg_type: msgType, metadata }),
      }).then(saved => {
        const real = apiMsgToMsg(saved);
        seenMsgIdsRef.current.add(real.id);
        setMessages(prev => prev.map(x => x.id === optimisticId ? { ...real, status: 'sent' } : x));
        pendingOptIdRef.current = null;
      }).catch(() => { pendingOptIdRef.current = null; });
    }
  };

  const handleSend = () => {
    if (answeringCard) {
      sendMessage(text, { isAnswer: true, answerTo: answeringCard });
    } else {
      sendMessage(text);
    }
  };

  // ── Truth or Dare game helpers ────────────────────────────────────────────

  const sendTodMessage = (wsType: string, content: string, extra: Record<string, any>) => {
    const payload = JSON.stringify({ type: wsType, content, extra });
    if (safeSendRef.current) {
      safeSendRef.current(payload);
    }
    const optId = `opt-tod-${Date.now()}`;
    const optMsg: Msg = {
      id: optId,
      text: content,
      from: 'me',
      time: nowTime(),
      status: 'sending',
      isTod: true,
      todMsgType: wsType as Msg['todMsgType'],
      todExtra: { ...extra, sender_id: myId, senderName: profile?.full_name ?? 'Me' },
    };
    pendingOptIdRef.current = optId;
    setMessages(prev => [...prev, optMsg]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  };

  // Invite partner to play
  const handleTodInvite = () => {
    Keyboard.dismiss();
    setShowCards(false);
    sendTodMessage('tod_invite', '🎲 Truth or Dare — want to play?', {
      senderName: profile?.full_name ?? 'Me',
    });
  };

  // Partner accepts the invite — opens the sender panel for them
  const handleTodJoin = (inviteMsgId: string) => {
    sendTodMessage('tod_accept', '🎮 Game on!', { inviteId: inviteMsgId });
    setTimeout(() => { setShowTodPicker(true); Keyboard.dismiss(); }, 350);
  };

  // Sender chose their card — broadcast it so both players see the question
  const handleTodSendCard = (
    choice: 'truth' | 'dare',
    question: string,
    emoji: string,
    color: string,
    category: string,
  ) => {
    sendTodMessage('tod_next', question, {
      choice,
      question,
      emoji,
      color,
      category,
      senderName: profile?.full_name ?? 'Me',
    });
  };

  // Receiver answers a turn card
  const handleTodAnswer = (answer: string) => {
    if (!todAnswerMsg) return;
    const extra = todAnswerMsg.todExtra ?? {};
    sendTodMessage('tod_answer', answer, {
      turnMsgId: todAnswerMsg.id,
      question:  extra.question ?? '',
      emoji:     extra.emoji    ?? '',
      choice:    extra.choice   ?? 'truth',
    });
    setTodAnswerMsg(null);
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
            {isOnline && <View style={[styles.onlineDot, { borderColor: colors.bg }]} />}
          </View>
          <View>
            <Text style={[styles.headerName, { color: colors.text }]}>{name}</Text>
            <Text style={[styles.headerStatus, { color: isOnline ? '#22c55e' : colors.textSecondary }]}>
              {isOnline ? 'Active now' : 'Offline'}
            </Text>
          </View>
        </Pressable>

        <View style={styles.headerActions}>
          {/* Profile Insights button */}
          <Pressable hitSlop={8} onPress={() => { Keyboard.dismiss(); setShowInsight(true); setShowAi(false); setShowCards(false); }}
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

          {messages.map((msg, idx) => {
            const nextMsg = messages[idx + 1];
            // Show avatar only on the last message in a consecutive group from same sender
            const isLastInGroup = !nextMsg || nextMsg.from !== msg.from;
            const myAvatar    = profile?.photos?.[0] ?? undefined;
            const partnerAvatar = image || undefined;

            if (msg.isTod) {
              return (
                <TodBubble
                  key={msg.id}
                  msg={msg}
                  colors={colors}
                  myId={myId}
                  onJoin={handleTodJoin}
                  onAnswer={(m) => { setTodAnswerMsg(m); Keyboard.dismiss(); }}
                  onSendTurn={() => { setShowTodPicker(true); Keyboard.dismiss(); }}
                  messages={messages}
                  myAvatar={myAvatar}
                  partnerAvatar={partnerAvatar}
                  isLastInGroup={isLastInGroup}
                />
              );
            }
            return (
              <Bubble
                key={msg.id}
                msg={msg}
                colors={colors}
                answeredCards={new Set(messages.filter(m => m.isAnswer && m.answerTo).map(m => m.answerTo!))}
                onAnswer={(q) => {
                  setAnsweringCard(q);
                  setShowCards(false);
                  setShowAi(false);
                }}
                myAvatar={myAvatar}
                partnerAvatar={partnerAvatar}
                isLastInGroup={isLastInGroup}
              />
            );
          })}

          {/* Typing indicator */}
          {isPartnerTyping && (
            <View style={[styles.bubbleRow, styles.bubbleRowThem]}>
              <View style={{ width: 36 }} />
              <Squircle
                style={[styles.bubble, styles.bubbleThem]}
                cornerRadius={22} cornerSmoothing={1}
                fillColor={colors.surface}
              >
                <Text style={{ color: colors.textSecondary, fontSize: 18, paddingHorizontal: 2, paddingVertical: 3 }}>• • •</Text>
              </Squircle>
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
              onPress={() => { Keyboard.dismiss(); setShowCards(true); setShowAi(false); setAnsweringCard(null); }}
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
                onPress={() => { Keyboard.dismiss(); setShowAi(true); setShowCards(false); }}
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
          onTodInvite={handleTodInvite}
          totalSent={messages.filter(m => m.from === 'me' && m.isCard).length}
          token={token ?? undefined}
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

      {/* ── Truth or Dare — Send Card panel (sender flow) ── */}
      {showTodPicker && (
        <TodPickPanel
          colors={colors}
          token={token ?? undefined}
          myId={myId}
          myName={profile?.full_name ?? 'Me'}
          partnerId={partnerId}
          partnerName={name}
          chatMessages={messages}
          onSendCard={handleTodSendCard}
          onClose={() => setShowTodPicker(false)}
        />
      )}

      {/* ── Truth or Dare — Answer panel (receiver flow) ── */}
      {todAnswerMsg !== null && (
        <TodAnswerPanel
          colors={colors}
          turnMsg={todAnswerMsg}
          onSubmit={handleTodAnswer}
          onClose={() => setTodAnswerMsg(null)}
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
  bubbleRow:        { flexDirection: 'row', marginVertical: 2, alignItems: 'flex-end' },
  bubbleRowMe:      { justifyContent: 'flex-end', paddingLeft: 8 },
  bubbleRowThem:    { justifyContent: 'flex-start', paddingRight: 8 },
  bubble:           { maxWidth: W * 0.68, alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 9, paddingBottom: 7 },
  bubbleMe:         {},
  bubbleThem:       {},
  bubbleTextRow:    { flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap', gap: 6 },
  bubbleText:       { fontSize: 15, fontFamily: 'ProductSans-Regular', lineHeight: 21 },
  bubbleTimeInline: { fontSize: 10, fontFamily: 'ProductSans-Regular', marginBottom: 1, flexShrink: 0 },

  // Card bubble
  cardBubble:         { width: W * 0.68, padding: 14, gap: 8 },
  cardTag:            { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20 },
  cardTagDot:         { width: 5, height: 5, borderRadius: 2.5 },
  cardTagText:        { fontSize: 10, fontFamily: 'ProductSans-Bold', letterSpacing: 0.2 },
  cardBubbleEmoji:    { fontSize: 32, textAlign: 'center' },
  cardBubbleQuestion: { fontSize: 14, fontFamily: 'ProductSans-Black', lineHeight: 20, color: '#fff' },
  cardBubbleFooter:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, marginTop: 2 },
  answerBtn:          { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  answerBtnText:      { fontSize: 11, fontFamily: 'ProductSans-Bold' },
  answeredBadge:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5 },
  answeredBadgeText:  { fontSize: 11, fontFamily: 'ProductSans-Regular', color: 'rgba(255,255,255,0.5)' },

  // Answer bubble (reply context)
  answerBubble:      { maxWidth: W * 0.68, alignSelf: 'flex-start', paddingHorizontal: 12, paddingTop: 10, paddingBottom: 7, gap: 6 },
  answerContext:     { borderLeftWidth: 2.5, paddingLeft: 8, paddingVertical: 3, marginBottom: 2 },
  answerContextText: { fontSize: 12, fontFamily: 'ProductSans-Regular', lineHeight: 16 },

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

  // Game picker cards
  gameCard:      { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  gameCardIcon:  { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  gameCardTitle: { fontSize: 16, fontFamily: 'ProductSans-Black', marginBottom: 3 },
  gameCardDesc:  { fontSize: 12, fontFamily: 'ProductSans-Regular' },
  gameCardArrow: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

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

  // ── Truth or Dare styles ──────────────────────────────────────────────────
  todInviteBubble:   { padding: 18, alignItems: 'center', minWidth: 220, maxWidth: W * 0.72 },
  todInviteEmoji:    { fontSize: 40, marginBottom: 6 },
  todInviteTitle:    { fontSize: 18, fontFamily: 'ProductSans-Black', color: '#fff', marginBottom: 4 },
  todInviteSub:      { fontSize: 13, fontFamily: 'ProductSans-Regular', color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginBottom: 14 },
  todJoinBtn:        { backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 50, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  todJoinBtnText:    { fontSize: 15, fontFamily: 'ProductSans-Black', color: '#fff' },
  todAcceptedBadge:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  todAcceptedText:   { fontSize: 12, fontFamily: 'ProductSans-Bold', color: '#4ade80' },
  todSystemBubble:   { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  todSystemText:     { fontSize: 12, fontFamily: 'ProductSans-Medium' },
  todTurnCard:       { padding: 18, width: W * 0.72 },
  todTurnHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 },
  todChoicePill:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4 },
  todChoicePillText: { fontSize: 12, fontFamily: 'ProductSans-Bold' },
  todTurnName:       { fontSize: 13, fontFamily: 'ProductSans-Bold', color: 'rgba(255,255,255,0.5)', marginBottom: 8 },
  todTurnQuestion:   { fontSize: 16, fontFamily: 'ProductSans-Black', color: '#fff', lineHeight: 23, marginBottom: 14 },
  todAnsweredRow:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  todAnsweredText:   { fontSize: 12, fontFamily: 'ProductSans-Bold', color: '#4ade80' },
  todAnswerBtn:      { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 50, alignSelf: 'flex-start', borderWidth: 1 },
  todAnswerBtnText:  { fontSize: 13, fontFamily: 'ProductSans-Black' },
  todAnswerBubble:   { padding: 14, maxWidth: W * 0.68 },
  todAnswerLabel:    { fontSize: 11, fontFamily: 'ProductSans-Bold', letterSpacing: 0.5 },
  todAnswerQuestion: { fontSize: 11, fontFamily: 'ProductSans-Regular', color: 'rgba(255,255,255,0.5)', marginBottom: 6, fontStyle: 'italic' },
  todAnswerText:     { fontSize: 14, fontFamily: 'ProductSans-Medium', color: '#fff', lineHeight: 20 },

  // TodPickPanel
  todPickBtn:          { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: 20 },
  todPickEmoji:        { fontSize: 32 },
  todPickTitle:        { fontSize: 17, fontFamily: 'ProductSans-Black', color: '#fff', marginBottom: 3 },
  todPickSub:          { fontSize: 12, fontFamily: 'ProductSans-Regular', color: 'rgba(255,255,255,0.6)' },
  todCardPreview:      { borderRadius: 20, padding: 20, alignItems: 'center', minHeight: 150, justifyContent: 'center' },
  todCardPreviewQuestion: { fontSize: 16, fontFamily: 'ProductSans-Black', color: '#fff', textAlign: 'center', lineHeight: 23 },
  todRevealBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15, borderRadius: 50 },
  todRevealBtnText:    { fontSize: 15, fontFamily: 'ProductSans-Black', color: '#fff' },
  todAnswerInput:      { height: 110 },

  // Source selection
  todSourceBtn:        { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 18, borderWidth: 1 },
  todSourceIcon:       { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  todSourceTitle:      { fontSize: 15, fontFamily: 'ProductSans-Black', marginBottom: 2 },
  todSourceSub:        { fontSize: 12, fontFamily: 'ProductSans-Regular' },
  todSourceBadge:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  todCatBtn:           { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 18, borderWidth: 1.5 },
  todTemplateCard:     { borderRadius: 18, padding: 18, marginBottom: 2 },
  todTemplateCardText: { fontSize: 15, fontFamily: 'ProductSans-Black', color: '#fff', lineHeight: 22 },
  todNudgeBtn:         { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 50 },
  todNudgeText:        { fontSize: 13, fontFamily: 'ProductSans-Bold' },
});
