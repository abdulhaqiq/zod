import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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
}

// ─── Mock match profile (replace with real API data) ─────────────────────────

const MATCH_PROFILE = {
  name: 'Sophia',
  age: 25,
  height: "5'4\"",
  lookingFor: 'Something serious',
  sharedInterests: ['Travel', 'Books', 'Photography'],
  interests: ['Travel', 'Books', 'Photography', 'Yoga', 'Coffee'],
  religion: 'Christian',
  starSign: 'Leo',
  aiSummary: 'Sophia loves exploring new countries and is an avid reader. You two share a passion for travel and books — great conversation starters!',
};

const SHARED_EMOJIS: Record<string, string> = {
  Travel: '✈️', Books: '📚', Photography: '📸', Yoga: '🧘', Coffee: '☕',
  Music: '🎵', Art: '🎨', Gaming: '🎮', Food: '🍕', Fitness: '💪',
  Hiking: '🥾', Movies: '🎬', Nature: '🌿', Cycling: '🚴',
};

// ─── AI content tailored to shared interests ──────────────────────────────────

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

const STARTER_CARDS = [
  { emoji: '✈️', question: "Best country you've ever visited?", tag: 'Travel' },
  { emoji: '📚', question: "Last book you couldn't put down?", tag: 'Books' },
  { emoji: '📸', question: "What's your favourite thing to photograph?", tag: 'Photography' },
  { emoji: '🔮', question: "What's top of your bucket list?", tag: 'Bucket list' },
  { emoji: '🌅', question: 'Morning person or night owl?', tag: 'Lifestyle' },
  { emoji: '🍕', question: 'Pizza or tacos — which one wins?', tag: 'Food' },
];

const INITIAL_MESSAGES: Msg[] = [
  { id: '1', text: "Hey! I saw we both love traveling ✈️", from: 'them', time: '2:10 PM' },
  { id: '2', text: "Yes! I've been to 14 countries so far 🌍", from: 'me',   time: '2:11 PM' },
  { id: '3', text: "That's amazing! Which was your favourite?", from: 'them', time: '2:12 PM' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const nowTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// ─── AI Profile Insight Card (top of chat) ────────────────────────────────────

function AiInsightCard({ colors, onDismiss }: { colors: any; onDismiss: () => void }) {
  const [expanded, setExpanded] = useState(true);
  const anim = useRef(new Animated.Value(1)).current;

  const toggle = () => {
    Animated.timing(anim, { toValue: expanded ? 0 : 1, duration: 220, useNativeDriver: false }).start();
    setExpanded(v => !v);
  };

  const maxH = anim.interpolate({ inputRange: [0, 1], outputRange: [52, 320] });

  return (
    <Animated.View style={[styles.insightCard, { backgroundColor: colors.surface, borderColor: colors.border, maxHeight: maxH }]}>
      {/* Header row */}
      <Pressable onPress={toggle} style={styles.insightHeader}>
        <View style={styles.insightHeaderLeft}>
          <Squircle style={styles.insightIcon} cornerRadius={10} cornerSmoothing={1} fillColor="#7c3aed">
            <Ionicons name="sparkles" size={13} color="#fff" />
          </Squircle>
          <Text style={[styles.insightTitle, { color: colors.text }]}>Zod AI · Profile Insights</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable onPress={onDismiss} hitSlop={10}>
            <Ionicons name="close" size={16} color={colors.textTertiary} />
          </Pressable>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={15} color={colors.textSecondary} />
        </View>
      </Pressable>

      {/* Body */}
      <View style={styles.insightBody}>
        {/* AI summary */}
        <Squircle style={styles.insightSummaryBox} cornerRadius={14} cornerSmoothing={1} fillColor={colors.surface2}>
          <Text style={[styles.insightSummary, { color: colors.text }]}>
            {MATCH_PROFILE.aiSummary}
          </Text>
        </Squircle>

        {/* Shared interests */}
        <View style={styles.insightSection}>
          <Text style={[styles.insightSectionLabel, { color: colors.textSecondary }]}>You both love</Text>
          <View style={styles.insightChips}>
            {MATCH_PROFILE.sharedInterests.map(interest => (
              <View key={interest} style={[styles.insightChip, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                <Text style={styles.insightChipEmoji}>{SHARED_EMOJIS[interest] ?? '⭐'}</Text>
                <Text style={[styles.insightChipText, { color: colors.text }]}>{interest}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Profile highlights */}
        <View style={styles.insightSection}>
          <Text style={[styles.insightSectionLabel, { color: colors.textSecondary }]}>
            {MATCH_PROFILE.name}'s highlights
          </Text>
          <View style={styles.insightHighlights}>
            {[
              { icon: 'resize-outline',  val: MATCH_PROFILE.height },
              { icon: 'heart-outline',   val: MATCH_PROFILE.lookingFor },
              { icon: 'star-outline',    val: MATCH_PROFILE.starSign },
              { icon: 'book-outline',    val: MATCH_PROFILE.religion },
            ].map(h => (
              <View key={h.val} style={[styles.insightHighlight, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                <Ionicons name={h.icon as any} size={12} color={colors.textSecondary} />
                <Text style={[styles.insightHighlightText, { color: colors.text }]}>{h.val}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Footer tip */}
        <Text style={[styles.insightTip, { color: colors.textTertiary }]}>
          💡 Tap ❓ for question cards or ✨ for AI pickup lines
        </Text>
      </View>
    </Animated.View>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function Bubble({ msg, colors }: { msg: Msg; colors: any }) {
  const isMe = msg.from === 'me';

  if (msg.isCard) {
    const card = STARTER_CARDS.find(c => c.question === msg.text);
    const emoji = card?.emoji ?? '❓';
    const tag   = card?.tag   ?? 'Question';
    return (
      <View style={[styles.bubbleRow, isMe ? styles.bubbleRowMe : styles.bubbleRowThem]}>
        <View style={[
          styles.cardBubble,
          { backgroundColor: isMe ? colors.text : colors.surface, borderColor: colors.border },
        ]}>
          <View style={[styles.cardTag, { backgroundColor: isMe ? 'rgba(255,255,255,0.12)' : colors.surface2 }]}>
            <Ionicons name="help-circle" size={10} color={isMe ? 'rgba(255,255,255,0.5)' : colors.textSecondary} />
            <Text style={[styles.cardTagText, { color: isMe ? 'rgba(255,255,255,0.5)' : colors.textSecondary }]}>
              {tag}
            </Text>
          </View>
          <Text style={styles.cardBubbleEmoji}>{emoji}</Text>
          <Text style={[styles.cardBubbleQuestion, { color: isMe ? colors.bg : colors.text }]}>{msg.text}</Text>
          <Text style={[styles.bubbleTime, { color: isMe ? 'rgba(255,255,255,0.35)' : colors.textTertiary, alignSelf: 'flex-end' }]}>
            {msg.time}
          </Text>
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

// ─── Question Cards Panel ─────────────────────────────────────────────────────

function StarterCardsPanel({ colors, onSend, onClose }: {
  colors: any;
  onSend: (q: string) => void;
  onClose: () => void;
}) {
  const slideY    = useRef(new Animated.Value(480)).current;
  const scrollRef = useRef<ScrollView>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    Animated.spring(slideY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 260 }).start();
  }, []);

  const dismiss = (cb?: () => void) =>
    Animated.timing(slideY, { toValue: 480, duration: 220, useNativeDriver: true }).start(cb);

  const handleScroll = (e: any) => {
    const x = e.nativeEvent.contentOffset.x;
    setActiveIdx(Math.max(0, Math.min(Math.round(x / (CARD_W + CARD_GAP)), STARTER_CARDS.length - 1)));
  };

  const handleSend = () => dismiss(() => onSend(STARTER_CARDS[activeIdx].question));

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
              <Ionicons name="help-circle" size={16} color={colors.text} />
            </Squircle>
            <View style={{ flex: 1 }}>
              <Text style={[styles.panelTitle, { color: colors.text }]}>Question Cards</Text>
              <Text style={[styles.panelSub, { color: colors.textSecondary }]}>
                Swipe to explore · tap active card to send
              </Text>
            </View>
            <Pressable onPress={() => dismiss(onClose)} hitSlop={12}>
              <Squircle style={styles.panelCloseBtn} cornerRadius={10} cornerSmoothing={1} fillColor={colors.surface2}>
                <Ionicons name="close" size={16} color={colors.text} />
              </Squircle>
            </Pressable>
          </View>

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
            {STARTER_CARDS.map((card, i) => {
              const isActive = i === activeIdx;
              return (
                <Pressable
                  key={i}
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
                    style={[styles.deckCard, { width: CARD_W }]}
                    cornerRadius={28} cornerSmoothing={1}
                    fillColor={isActive ? colors.text : colors.surface}
                    strokeColor={isActive ? 'transparent' : colors.border}
                    strokeWidth={StyleSheet.hairlineWidth}
                  >
                    {/* Tag pill */}
                    <View style={[styles.deckCardTag, {
                      backgroundColor: isActive ? 'rgba(255,255,255,0.12)' : colors.surface2,
                    }]}>
                      <Text style={[styles.deckCardTagText, {
                        color: isActive ? 'rgba(255,255,255,0.55)' : colors.textSecondary,
                      }]}>{card.tag}</Text>
                    </View>

                    <Text style={styles.deckCardEmoji}>{card.emoji}</Text>
                    <Text style={[styles.deckCardQuestion, { color: isActive ? colors.bg : colors.text }]}>
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
            {STARTER_CARDS.map((_, i) => (
              <Pressable
                key={i}
                onPress={() => { scrollRef.current?.scrollTo({ x: i * (CARD_W + CARD_GAP), animated: true }); setActiveIdx(i); }}
              >
                <View style={[styles.deckDot, {
                  backgroundColor: i === activeIdx ? colors.text : colors.surface2,
                  width: i === activeIdx ? 20 : 6,
                }]} />
              </Pressable>
            ))}
          </View>

          {/* CTA */}
          <View style={styles.deckCta}>
            <Pressable onPress={handleSend} style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1, flex: 1 }]}>
              <Squircle style={styles.deckSendBtn} cornerRadius={50} cornerSmoothing={1} fillColor={colors.text}>
                <Ionicons name="send" size={15} color={colors.bg} />
                <Text style={[styles.deckSendBtnText, { color: colors.bg }]}>Send this card</Text>
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
  const params  = useLocalSearchParams<{ name?: string; image?: string; online?: string }>();

  const name   = params.name  ?? 'Sophia';
  const image  = params.image ?? 'https://randomuser.me/api/portraits/women/44.jpg';
  const online = params.online !== 'false';

  const [messages,    setMessages]    = useState<Msg[]>(INITIAL_MESSAGES);
  const [text,        setText]        = useState('');
  const [showAi,      setShowAi]      = useState(false);
  const [showCards,   setShowCards]   = useState(false);
  const [showInsight, setShowInsight] = useState(true);
  const scrollRef = useRef<ScrollView>(null);

  const sendMessage = (txt: string, isCard = false) => {
    if (!txt.trim()) return;
    const msg: Msg = { id: Date.now().toString(), text: txt.trim(), from: 'me', time: nowTime(), isCard };
    setMessages(prev => [...prev, msg]);
    setText('');
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    if (isCard) {
      setTimeout(() => {
        const replies = [
          "Oh great question! 🤔", "Hmm let me think about that...",
          "Love this game! My answer is...", "That's such a fun one!",
        ];
        const reply: Msg = {
          id: (Date.now() + 1).toString(),
          text: replies[Math.floor(Math.random() * replies.length)],
          from: 'them', time: nowTime(),
        };
        setMessages(prev => [...prev, reply]);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      }, 1500);
    }
  };

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 80);
  }, []);

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
          {/* AI Insight card */}
          {showInsight && (
            <AiInsightCard colors={colors} onDismiss={() => setShowInsight(false)} />
          )}

          {/* Date separator */}
          <View style={styles.dateSep}>
            <View style={[styles.dateLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dateText, { color: colors.textTertiary }]}>Today</Text>
            <View style={[styles.dateLine, { backgroundColor: colors.border }]} />
          </View>

          {messages.map(msg => <Bubble key={msg.id} msg={msg} colors={colors} />)}
        </ScrollView>

        {/* ── Input bar ── */}
        <View style={[
          styles.inputBar,
          { borderTopColor: colors.border, backgroundColor: colors.bg, paddingBottom: insets.bottom + 8 },
        ]}>
          {/* Question cards button */}
          <Pressable
            onPress={() => { setShowCards(true); setShowAi(false); }}
            hitSlop={8}
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}
          >
            <Squircle
              style={styles.inputSideBtn} cornerRadius={14} cornerSmoothing={1}
              fillColor={showCards ? colors.text : colors.surface2}
            >
              <Ionicons name="help-circle" size={20} color={showCards ? colors.bg : colors.text} />
            </Squircle>
          </Pressable>

          {/* Text input */}
          <Squircle
            style={styles.inputWrap} cornerRadius={22} cornerSmoothing={1}
            fillColor={colors.surface} strokeColor={colors.border} strokeWidth={StyleSheet.hairlineWidth}
          >
            <TextInput
              style={[styles.inputField, { color: colors.text }]}
              placeholder="Message…"
              placeholderTextColor={colors.placeholder}
              value={text}
              onChangeText={setText}
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
            onPress={() => sendMessage(text)}
            hitSlop={8}
            disabled={!text.trim()}
            style={({ pressed }) => [pressed && { opacity: 0.7 }]}
          >
            <Squircle
              style={styles.inputSideBtn} cornerRadius={14} cornerSmoothing={1}
              fillColor={text.trim() ? colors.text : colors.surface2}
            >
              <Ionicons
                name={text.trim() ? 'send' : 'mic'}
                size={18}
                color={text.trim() ? colors.bg : colors.text}
              />
            </Squircle>
          </Pressable>
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
          onSend={q => { sendMessage(q, true); setShowCards(false); }}
          onClose={() => setShowCards(false)}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header:           { paddingHorizontal: 12, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  headerCenter:     { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatarWrap: { position: 'relative' },
  headerAvatar:     { width: 42, height: 42, borderRadius: 21 },
  onlineDot:        { position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: '#22c55e', borderWidth: 2 },
  headerName:       { fontSize: 16, fontFamily: 'ProductSans-Black' },
  headerStatus:     { fontSize: 12, fontFamily: 'ProductSans-Regular', marginTop: 1 },
  headerActions:    { flexDirection: 'row', gap: 8 },
  headerBtn:        { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },

  // Messages
  messageList:  { paddingHorizontal: 14, paddingTop: 14, gap: 5 },
  dateSep:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 10 },
  dateLine:     { flex: 1, height: StyleSheet.hairlineWidth },
  dateText:     { fontSize: 11, fontFamily: 'ProductSans-Regular' },

  // AI Insight card
  insightCard:      { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', marginBottom: 12 },
  insightHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  insightHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  insightIcon:      { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  insightTitle:     { fontSize: 13, fontFamily: 'ProductSans-Bold' },
  insightBody:      { paddingHorizontal: 14, paddingBottom: 16, gap: 14 },
  insightSummaryBox: { padding: 12 },
  insightSummary:   { fontSize: 13, fontFamily: 'ProductSans-Regular', lineHeight: 20 },
  insightSection:   { gap: 8 },
  insightSectionLabel: { fontSize: 11, fontFamily: 'ProductSans-Bold', letterSpacing: 0.5, textTransform: 'uppercase' },
  insightChips:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  insightChip:      { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 50, borderWidth: StyleSheet.hairlineWidth },
  insightChipEmoji: { fontSize: 14 },
  insightChipText:  { fontSize: 12, fontFamily: 'ProductSans-Medium' },
  insightHighlights: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  insightHighlight:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 50, borderWidth: StyleSheet.hairlineWidth },
  insightHighlightText: { fontSize: 12, fontFamily: 'ProductSans-Regular' },
  insightTip:       { fontSize: 11, fontFamily: 'ProductSans-Regular', textAlign: 'center' },

  // Bubbles
  bubbleRow:            { flexDirection: 'row', marginVertical: 1 },
  bubbleRowMe:          { justifyContent: 'flex-end' },
  bubbleRowThem:        { justifyContent: 'flex-start' },
  bubble:               { maxWidth: W * 0.72, paddingHorizontal: 14, paddingVertical: 10, gap: 4 },
  bubbleMe:             { borderRadius: 20, borderBottomRightRadius: 4 },
  bubbleThem:           { borderRadius: 20, borderBottomLeftRadius: 4 },
  bubbleText:           { fontSize: 15, fontFamily: 'ProductSans-Regular', lineHeight: 22 },
  bubbleTime:           { fontSize: 10, fontFamily: 'ProductSans-Regular' },
  // Card bubble
  cardBubble:           { width: W * 0.64, borderRadius: 22, borderBottomRightRadius: 4, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 8 },
  cardTag:              { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  cardTagText:          { fontSize: 10, fontFamily: 'ProductSans-Bold' },
  cardBubbleEmoji:      { fontSize: 28, textAlign: 'center' },
  cardBubbleQuestion:   { fontSize: 14, fontFamily: 'ProductSans-Bold', lineHeight: 20 },

  // Input bar
  inputBar:     { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  inputSideBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  inputWrap:    { flex: 1, flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 14, paddingVertical: 10, gap: 8, minHeight: 44, maxHeight: 120 },
  inputField:   { flex: 1, fontSize: 15, fontFamily: 'ProductSans-Regular', maxHeight: 100 },
  aiInlineBtn:  { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end' },

  // Panels (shared)
  panel:        { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopWidth: StyleSheet.hairlineWidth, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 24, shadowOffset: { width: 0, height: -4 }, elevation: 22 },
  panelHandle:  { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  panelHeader:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 14, paddingTop: 6 },
  panelIcon:    { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  panelTitle:   { fontSize: 16, fontFamily: 'ProductSans-Black' },
  panelSub:     { fontSize: 12, fontFamily: 'ProductSans-Regular', marginTop: 1 },
  panelCloseBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },

  // AI lines
  aiLinesList:  { paddingHorizontal: 14, paddingBottom: 28, gap: 7 },
  aiLineItem:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 13 },
  aiLineText:   { flex: 1, fontSize: 14, fontFamily: 'ProductSans-Regular', lineHeight: 20 },
  aiLineUse:    { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },

  // Card deck
  deckScroll:        { paddingLeft: 20, paddingRight: 20, gap: CARD_GAP, alignItems: 'flex-start' },
  deckCard:          { height: 220, padding: 20, justifyContent: 'space-between', overflow: 'hidden' },
  deckCardTag:       { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  deckCardTagText:   { fontSize: 10, fontFamily: 'ProductSans-Bold', letterSpacing: 0.3 },
  deckCardEmoji:     { fontSize: 48, textAlign: 'center', marginVertical: 4 },
  deckCardQuestion:  { fontSize: 17, fontFamily: 'ProductSans-Black', lineHeight: 24, textAlign: 'center' },
  deckCardHint:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, marginTop: 2 },
  deckCardHintText:  { fontSize: 11, fontFamily: 'ProductSans-Medium', color: 'rgba(255,255,255,0.55)' },
  deckDots:          { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 14 },
  deckDot:           { height: 6, borderRadius: 3 },
  deckCta:           { flexDirection: 'row', paddingHorizontal: 20, paddingBottom: 28 },
  deckSendBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  deckSendBtnText:   { fontSize: 15, fontFamily: 'ProductSans-Black' },
});
