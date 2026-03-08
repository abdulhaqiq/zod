import { Ionicons } from '@expo/vector-icons';
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
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Squircle from '@/components/ui/Squircle';
import { useAppTheme } from '@/context/ThemeContext';

const { width: W, height: H } = Dimensions.get('window');

// ─── Mock data ────────────────────────────────────────────────────────────────

const INITIAL_MESSAGES = [
  { id: '1', text: "Hey! I saw we both love traveling ✈️", from: 'them', time: '2:10 PM' },
  { id: '2', text: "Yes! I've been to 14 countries so far 🌍", from: 'me',   time: '2:11 PM' },
  { id: '3', text: "That's amazing! Which was your favourite?", from: 'them', time: '2:12 PM' },
];

const AI_LINES = [
  "If you were a country, I'd move there in a heartbeat 🌍",
  "Are you a map? Because I keep getting lost in your eyes 🗺️",
  "I was going to play it cool, but you make it impossible 😅",
  "My future self sent me a message — it said I had to talk to you",
  "You must be a great travel destination — everyone wants to go there 🛫",
  "Is your name Google? Because you have everything I've been searching for",
];

const STARTER_CARDS = [
  { emoji: '🌍', question: "Best country you want to visit?" },
  { emoji: '🍕', question: "Pizza or tacos — which one wins?" },
  { emoji: '🎵', question: "Last song you had on repeat?" },
  { emoji: '🔮', question: "What's top of your bucket list?" },
  { emoji: '🌅', question: "Morning person or night owl?" },
  { emoji: '📚', question: "Last book you couldn't put down?" },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface Msg {
  id: string;
  text: string;
  from: 'me' | 'them';
  time: string;
  isCard?: boolean;
}

// ─── Bubble ───────────────────────────────────────────────────────────────────

function Bubble({ msg, colors }: { msg: Msg; colors: any }) {
  const isMe = msg.from === 'me';

  if (msg.isCard) {
    // Detect the emoji at the start of the question to show big
    const emoji = STARTER_CARDS.find(c => c.question === msg.text)?.emoji ?? '❓';
    return (
      <View style={[styles.bubbleRow, isMe ? styles.bubbleRowMe : styles.bubbleRowThem]}>
        <View style={[styles.cardBubble, { backgroundColor: isMe ? colors.text : colors.surface, borderColor: colors.border }]}>
          {/* Header tag */}
          <View style={[styles.cardBubbleTag, { backgroundColor: isMe ? 'rgba(255,255,255,0.12)' : colors.surface2 }]}>
            <Ionicons name="help-circle" size={11} color={isMe ? 'rgba(255,255,255,0.55)' : colors.textSecondary} />
            <Text style={[styles.cardBubbleTagText, { color: isMe ? 'rgba(255,255,255,0.55)' : colors.textSecondary }]}>Question Card</Text>
          </View>
          {/* Emoji */}
          <Text style={styles.cardBubbleEmoji}>{emoji}</Text>
          {/* Question */}
          <Text style={[styles.cardBubbleQuestion, { color: isMe ? colors.bg : colors.text }]}>{msg.text}</Text>
          {/* Time */}
          <Text style={[styles.bubbleTime, { color: isMe ? 'rgba(255,255,255,0.35)' : colors.textTertiary, alignSelf: 'flex-end' }]}>{msg.time}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.bubbleRow, isMe ? styles.bubbleRowMe : styles.bubbleRowThem]}>
      <View style={[
        styles.bubble,
        isMe ? [styles.bubbleMe, { backgroundColor: colors.text }]
              : [styles.bubbleThem, { backgroundColor: colors.surface }],
      ]}>
        <Text style={[styles.bubbleText, { color: isMe ? colors.bg : colors.text }]}>{msg.text}</Text>
        <Text style={[styles.bubbleTime, { color: isMe ? 'rgba(255,255,255,0.4)' : colors.textTertiary }]}>{msg.time}</Text>
      </View>
    </View>
  );
}

// ─── AI Panel ─────────────────────────────────────────────────────────────────

function AiPanel({ colors, onSelect, onClose }: { colors: any; onSelect: (t: string) => void; onClose: () => void }) {
  const slideY = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    Animated.spring(slideY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 260 }).start();
  }, []);

  const dismiss = (cb?: () => void) => {
    Animated.timing(slideY, { toValue: 300, duration: 200, useNativeDriver: true }).start(cb);
  };

  return (
    <Pressable style={StyleSheet.absoluteFill} onPress={() => dismiss(onClose)}>
      <Animated.View style={[styles.aiPanel, { backgroundColor: colors.surface, borderTopColor: colors.border }, { transform: [{ translateY: slideY }] }]}>
        <Pressable>
          <View style={styles.aiPanelHandle} />
          <View style={styles.aiPanelHeader}>
            <Squircle style={styles.aiPanelIcon} cornerRadius={12} cornerSmoothing={1} fillColor={colors.surface2}>
              <Ionicons name="sparkles" size={15} color={colors.text} />
            </Squircle>
            <View style={{ flex: 1 }}>
              <Text style={[styles.aiPanelTitle, { color: colors.text }]}>AI Pickup Lines</Text>
              <Text style={[styles.aiPanelSub, { color: colors.textSecondary }]}>Tap one to insert it</Text>
            </View>
            <Pressable onPress={() => dismiss(onClose)} hitSlop={10}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
          <View style={styles.aiLinesList}>
            {AI_LINES.map((line, i) => (
              <Pressable
                key={i}
                onPress={() => { dismiss(() => onSelect(line)); }}
                style={({ pressed }) => [pressed && { opacity: 0.7 }]}
              >
                <Squircle
                  style={styles.aiLineItem}
                  cornerRadius={16}
                  cornerSmoothing={1}
                  fillColor={colors.surface2}
                  strokeColor={colors.border}
                  strokeWidth={StyleSheet.hairlineWidth}
                >
                  <Text style={[styles.aiLineText, { color: colors.text }]}>{line}</Text>
                  <Ionicons name="arrow-up-circle-outline" size={18} color={colors.textSecondary} />
                </Squircle>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Animated.View>
    </Pressable>
  );
}

// ─── Starter Cards Panel — game-style deck carousel ──────────────────────────

const CARD_W  = W - 80;   // card width with side peek
const CARD_GAP = 14;

function StarterCardsPanel({ colors, onSend, onClose }: { colors: any; onSend: (q: string) => void; onClose: () => void }) {
  const slideY    = useRef(new Animated.Value(460)).current;
  const scrollRef = useRef<ScrollView>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    Animated.spring(slideY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 260 }).start();
  }, []);

  const dismiss = (cb?: () => void) => {
    Animated.timing(slideY, { toValue: 460, duration: 220, useNativeDriver: true }).start(cb);
  };

  const handleScroll = (e: any) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / (CARD_W + CARD_GAP));
    setActiveIdx(Math.max(0, Math.min(idx, STARTER_CARDS.length - 1)));
  };

  const handleSend = () => {
    dismiss(() => onSend(STARTER_CARDS[activeIdx].question));
  };

  return (
    <Pressable style={StyleSheet.absoluteFill} onPress={() => dismiss(onClose)}>
      <Animated.View
        style={[styles.aiPanel, { backgroundColor: colors.bg, borderTopColor: colors.border }, { transform: [{ translateY: slideY }] }]}
      >
        {/* Stop backdrop taps from closing */}
        <Pressable>

          {/* Handle */}
          <View style={styles.aiPanelHandle} />

          {/* Header */}
          <View style={styles.cardDeckHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.aiPanelTitle, { color: colors.text }]}>Question Cards</Text>
              <Text style={[styles.aiPanelSub, { color: colors.textSecondary }]}>Swipe to explore · tap to send</Text>
            </View>
            <Pressable onPress={() => dismiss(onClose)} hitSlop={12}>
              <Squircle style={styles.cardDeckClose} cornerRadius={12} cornerSmoothing={1} fillColor={colors.surface2}>
                <Ionicons name="close" size={18} color={colors.text} />
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
                    cornerRadius={28}
                    cornerSmoothing={1}
                    fillColor={isActive ? colors.text : colors.surface}
                    strokeColor={isActive ? 'transparent' : colors.border}
                    strokeWidth={StyleSheet.hairlineWidth}
                  >
                    {/* Card number */}
                    <Text style={[styles.deckCardNum, { color: isActive ? colors.bg : colors.textTertiary }]}>
                      {String(i + 1).padStart(2, '0')} / {String(STARTER_CARDS.length).padStart(2, '0')}
                    </Text>

                    {/* Emoji */}
                    <Text style={styles.deckCardEmoji}>{card.emoji}</Text>

                    {/* Question */}
                    <Text style={[styles.deckCardQuestion, { color: isActive ? colors.bg : colors.text }]}>
                      {card.question}
                    </Text>

                    {/* Send hint (active card only) */}
                    {isActive && (
                      <View style={[styles.deckCardHint, { borderTopColor: 'rgba(255,255,255,0.15)' }]}>
                        <Ionicons name="send" size={13} color="rgba(255,255,255,0.6)" />
                        <Text style={styles.deckCardHintText}>Tap card to send</Text>
                      </View>
                    )}
                  </Squircle>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Dot indicators */}
          <View style={styles.deckDots}>
            {STARTER_CARDS.map((_, i) => (
              <Pressable key={i} onPress={() => { scrollRef.current?.scrollTo({ x: i * (CARD_W + CARD_GAP), animated: true }); setActiveIdx(i); }}>
                <View style={[
                  styles.deckDot,
                  { backgroundColor: i === activeIdx ? colors.text : colors.surface2, width: i === activeIdx ? 20 : 6 },
                ]} />
              </Pressable>
            ))}
          </View>

          {/* Send button */}
          <View style={styles.deckCta}>
            <Pressable onPress={handleSend} style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1, flex: 1 }]}>
              <Squircle style={styles.deckSendBtn} cornerRadius={50} cornerSmoothing={1} fillColor={colors.text}>
                <Ionicons name="send" size={16} color={colors.bg} />
                <Text style={[styles.deckSendBtnText, { color: colors.bg }]}>Send this card</Text>
              </Squircle>
            </Pressable>
          </View>

        </Pressable>
      </Animated.View>
    </Pressable>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ChatConversationPage() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const params  = useLocalSearchParams<{ name?: string; image?: string; online?: string }>();

  const name   = params.name   ?? 'Sophia';
  const image  = params.image  ?? 'https://randomuser.me/api/portraits/women/44.jpg';
  const online = params.online !== 'false';

  const [messages,    setMessages]    = useState<Msg[]>(INITIAL_MESSAGES);
  const [text,        setText]        = useState('');
  const [showAi,      setShowAi]      = useState(false);
  const [showCards,   setShowCards]   = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const now = () => {
    const d = new Date();
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const sendMessage = (txt: string, isCard = false) => {
    if (!txt.trim()) return;
    const msg: Msg = { id: Date.now().toString(), text: txt.trim(), from: 'me', time: now(), isCard };
    setMessages(prev => [...prev, msg]);
    setText('');
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    // Simulate a reply after a short delay
    if (isCard) {
      setTimeout(() => {
        const replies = [
          "Oh great question! 🤔",
          "Hmm let me think about that...",
          "Love this game! My answer is...",
          "That's such a fun one!",
        ];
        const reply: Msg = {
          id: (Date.now() + 1).toString(),
          text: replies[Math.floor(Math.random() * replies.length)],
          from: 'them',
          time: now(),
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
      <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.border, backgroundColor: colors.bg }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>

        <Pressable style={styles.headerCenter} onPress={() => {}} hitSlop={6}>
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
          <Pressable
            onPress={() => Alert.alert('Voice Call', `Calling ${name}…`)}
            hitSlop={8}
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}
          >
            <Squircle style={styles.headerBtn} cornerRadius={14} cornerSmoothing={1} fillColor={colors.surface2}>
              <Ionicons name="call" size={18} color={colors.text} />
            </Squircle>
          </Pressable>
          <Pressable
            onPress={() => Alert.alert('Video Call', `Starting video call with ${name}…`)}
            hitSlop={8}
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}
          >
            <Squircle style={styles.headerBtn} cornerRadius={14} cornerSmoothing={1} fillColor={colors.surface2}>
              <Ionicons name="videocam" size={18} color={colors.text} />
            </Squircle>
          </Pressable>
        </View>
      </View>

      {/* ── Messages ── */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
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

          {messages.map(msg => <Bubble key={msg.id} msg={msg} colors={colors} />)}
        </ScrollView>

        {/* ── Input bar ── */}
        <View style={[styles.inputBar, { borderTopColor: colors.border, backgroundColor: colors.bg, paddingBottom: insets.bottom + 8 }]}>
          {/* Attachment */}
          <Pressable
            onPress={() => { setShowCards(true); setShowAi(false); }}
            hitSlop={8}
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}
          >
            <Squircle style={styles.inputSideBtn} cornerRadius={14} cornerSmoothing={1} fillColor={showCards ? colors.text : colors.surface2}>
              <Ionicons name="help-circle" size={20} color={showCards ? colors.bg : colors.text} />
            </Squircle>
          </Pressable>

          {/* Text input */}
          <Squircle
            style={styles.inputWrap}
            cornerRadius={22}
            cornerSmoothing={1}
            fillColor={colors.surface}
            strokeColor={colors.border}
            strokeWidth={StyleSheet.hairlineWidth}
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
              returnKeyType="default"
            />
            {/* AI sparkles */}
            <Pressable
              onPress={() => { setShowAi(true); setShowCards(false); }}
              hitSlop={8}
              style={({ pressed }) => [pressed && { opacity: 0.6 }]}
            >
              <Squircle style={styles.aiInlineBtn} cornerRadius={12} cornerSmoothing={1} fillColor={showAi ? colors.text : colors.surface2}>
                <Ionicons name="sparkles" size={14} color={showAi ? colors.bg : colors.text} />
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
              style={styles.inputSideBtn}
              cornerRadius={14}
              cornerSmoothing={1}
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
  header:         { paddingHorizontal: 12, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  headerCenter:   { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatarWrap: { position: 'relative' },
  headerAvatar:   { width: 42, height: 42, borderRadius: 21 },
  onlineDot:      { position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: '#22c55e', borderWidth: 2 },
  headerName:     { fontSize: 16, fontFamily: 'ProductSans-Black' },
  headerStatus:   { fontSize: 12, fontFamily: 'ProductSans-Regular', marginTop: 1 },
  headerActions:  { flexDirection: 'row', gap: 8 },
  headerBtn:      { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },

  // Messages
  messageList:    { paddingHorizontal: 14, paddingTop: 16, gap: 6 },
  dateSep:        { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  dateLine:       { flex: 1, height: StyleSheet.hairlineWidth },
  dateText:       { fontSize: 11, fontFamily: 'ProductSans-Regular' },

  // Bubbles
  bubbleRow:          { flexDirection: 'row', marginVertical: 2 },
  bubbleRowMe:        { justifyContent: 'flex-end' },
  bubbleRowThem:      { justifyContent: 'flex-start' },
  bubble:             { maxWidth: W * 0.72, paddingHorizontal: 14, paddingVertical: 10, gap: 4 },
  bubbleMe:           { borderRadius: 20, borderBottomRightRadius: 5 },
  bubbleThem:         { borderRadius: 20, borderBottomLeftRadius: 5 },
  bubbleText:         { fontSize: 15, fontFamily: 'ProductSans-Regular', lineHeight: 22 },
  bubbleTime:         { fontSize: 10, fontFamily: 'ProductSans-Regular', alignSelf: 'flex-end' },
  // Card bubble (in chat)
  cardBubble:         { width: W * 0.64, borderRadius: 22, borderBottomRightRadius: 5, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 8 },
  cardBubbleTag:      { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  cardBubbleTagText:  { fontSize: 10, fontFamily: 'ProductSans-Bold' },
  cardBubbleEmoji:    { fontSize: 30, textAlign: 'center' },
  cardBubbleQuestion: { fontSize: 14, fontFamily: 'ProductSans-Bold', lineHeight: 20 },

  // Input bar
  inputBar:       { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  inputSideBtn:   { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  inputWrap:      { flex: 1, flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 14, paddingVertical: 10, gap: 8, minHeight: 44, maxHeight: 120 },
  inputField:     { flex: 1, fontSize: 15, fontFamily: 'ProductSans-Regular', maxHeight: 100 },
  aiInlineBtn:    { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end' },

  // Panels (AI + Cards)
  aiPanel:        { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopWidth: StyleSheet.hairlineWidth, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: -4 }, elevation: 20 },
  aiPanelHandle:  { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(128,128,128,0.35)', alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  aiPanelHeader:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  aiPanelIcon:    { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  aiPanelTitle:   { fontSize: 16, fontFamily: 'ProductSans-Black' },
  aiPanelSub:     { fontSize: 12, fontFamily: 'ProductSans-Regular', marginTop: 1 },
  aiLinesList:    { paddingHorizontal: 14, paddingBottom: 28, gap: 8 },
  aiLineItem:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 13 },
  aiLineText:     { flex: 1, fontSize: 14, fontFamily: 'ProductSans-Regular', lineHeight: 20 },

  // Game card deck
  cardDeckHeader:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16 },
  cardDeckClose:    { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  deckScroll:       { paddingLeft: 20, paddingRight: 20, gap: CARD_GAP, alignItems: 'flex-start' },
  deckCard:         { height: 230, padding: 22, justifyContent: 'space-between', overflow: 'hidden' },
  deckCardNum:      { fontSize: 11, fontFamily: 'ProductSans-Bold', letterSpacing: 1 },
  deckCardEmoji:    { fontSize: 52, textAlign: 'center', marginVertical: 8 },
  deckCardQuestion: { fontSize: 18, fontFamily: 'ProductSans-Black', lineHeight: 26, textAlign: 'center' },
  deckCardHint:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, marginTop: 4 },
  deckCardHintText: { fontSize: 12, fontFamily: 'ProductSans-Medium', color: 'rgba(255,255,255,0.55)' },
  deckDots:         { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 16 },
  deckDot:          { height: 6, borderRadius: 3 },
  deckCta:          { flexDirection: 'row', paddingHorizontal: 20, paddingBottom: 28 },
  deckSendBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  deckSendBtnText:  { fontSize: 15, fontFamily: 'ProductSans-Black' },
});
