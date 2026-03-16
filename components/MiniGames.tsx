/**
 * MiniGames.tsx
 *
 * All 6 in-chat mini-games for the dating app:
 *   1. Would You Rather (WYR)
 *   2. Compatibility Quiz
 *   3. Never Have I Ever (NHI)
 *   4. Hot Takes
 *   5. Build a Date
 *   6. Emoji Story
 *
 * Architecture: purely message-driven. Every game move is a WebSocket message
 * with a msg_type like "game_wyr", "game_quiz" etc. and a `metadata` JSON blob
 * carrying all game state. No extra backend tables needed.
 *
 * Exports:
 *   GAME_MSG_TYPES   — set of all game msg_types for detection
 *   GameBubble       — renders any game message in the chat list
 *   GamesPanel       — bottom-sheet for picking + sending a game move
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Squircle from '@/components/ui/Squircle';
import { apiFetch } from '@/constants/api';

const { width: W } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GameMsg {
  id: string;
  text: string;
  from: 'me' | 'them';
  time: string;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
  isGame: true;
  gameMsgType: string;   // e.g. "game_wyr"
  gameExtra: Record<string, any>;
}

export const GAME_MSG_TYPES = new Set([
  'game_wyr', 'game_quiz', 'game_nhi', 'game_hot', 'game_date', 'game_emoji',
]);

// ─── Game metadata ────────────────────────────────────────────────────────────

interface GameMeta {
  id: string;
  label: string;
  emoji: string;
  accent: string;
  bg: string;
  tagline: string;
  desc: string;
}

export const GAMES: GameMeta[] = [
  {
    id: 'cards',
    label: 'Question Cards',
    emoji: '🃏',
    accent: '#f8fafc',
    bg: '#0f172a',
    tagline: 'Deep, fun & spicy prompts',
    desc: 'Send a curated question card',
  },
  {
    id: 'truth_or_dare',
    label: 'Truth or Dare',
    emoji: '🎲',
    accent: '#a78bfa',
    bg: '#1a0533',
    tagline: 'The classic game',
    desc: 'Truth questions or wild dares',
  },
  {
    id: 'game_wyr',
    label: 'Would You Rather',
    emoji: '🤷',
    accent: '#8b5cf6',
    bg: '#1e1040',
    tagline: 'Pick one — no regrets',
    desc: 'Send a dilemma, they pick a side',
  },
  {
    id: 'game_nhi',
    label: 'Never Have I Ever',
    emoji: '🍹',
    accent: '#f59e0b',
    bg: '#1c1200',
    tagline: 'Confess or bluff',
    desc: 'Classic confessions game',
  },
  {
    id: 'game_hot',
    label: 'Hot Takes',
    emoji: '🔥',
    accent: '#ef4444',
    bg: '#1f0505',
    tagline: 'Agree or fight about it',
    desc: 'Bold opinions, instant reactions',
  },
  {
    id: 'game_quiz',
    label: 'Compatibility Quiz',
    emoji: '💘',
    accent: '#ec4899',
    bg: '#1f0512',
    tagline: 'How well do you match?',
    desc: '5 questions, reveal your score',
  },
  {
    id: 'game_date',
    label: 'Build a Date',
    emoji: '🗓️',
    accent: '#10b981',
    bg: '#001810',
    tagline: 'Plan your perfect date',
    desc: 'Pick together step by step',
  },
  {
    id: 'game_emoji',
    label: 'Emoji Story',
    emoji: '😂',
    accent: '#06b6d4',
    bg: '#00141a',
    tagline: 'Tell a story in emojis',
    desc: '3 emojis each, 5 rounds',
  },
];

function gameMeta(type: string): GameMeta {
  return GAMES.find(g => g.id === type) ?? GAMES[0];
}

// ─── MsgTicks (re-exported for use here) ─────────────────────────────────────

function MsgTicks({ status }: { status?: string }) {
  if (!status || status === 'sending') return null;
  const color = status === 'read' ? '#60a5fa' : 'rgba(255,255,255,0.45)';
  if (status === 'sent') return <Ionicons name="checkmark" size={12} color={color} />;
  return <Ionicons name="checkmark-done" size={12} color={color} />;
}

// ─── Panel slide helper ───────────────────────────────────────────────────────

function useSlidePanel(onClose: () => void) {
  const slideY = useRef(new Animated.Value(800)).current;
  useEffect(() => {
    Animated.spring(slideY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 230 }).start();
  }, []);
  const dismiss = (cb?: () => void) =>
    Animated.timing(slideY, { toValue: 800, duration: 200, useNativeDriver: true }).start(cb ? cb : onClose);
  return { slideY, dismiss };
}

// ─── BubbleAvatar ─────────────────────────────────────────────────────────────

function BubbleAvatar({ uri, size = 28 }: { uri?: string; size?: number }) {
  if (!uri) return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name="person" size={size * 0.5} color="#888" />
    </View>
  );
  return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" />;
}

// ─────────────────────────────────────────────────────────────────────────────
// GAME BUBBLE — renders any game message in the chat list
// ─────────────────────────────────────────────────────────────────────────────

export function GameBubble({
  msg, colors, myId, partnerId, partnerName, messages,
  myAvatar, partnerAvatar, isLastInGroup,
  onRespond,
}: {
  msg: GameMsg;
  colors: any;
  myId: string;
  partnerId: string;
  partnerName: string;
  messages: GameMsg[];
  myAvatar?: string;
  partnerAvatar?: string;
  isLastInGroup?: boolean;
  onRespond: (msg: GameMsg) => void;
}) {
  const isMe  = msg.from === 'me';
  const meta  = gameMeta(msg.gameMsgType);
  const extra = msg.gameExtra ?? {};

  const avatarSlot = (
    <View style={{ width: 36, alignItems: isMe ? 'flex-end' : 'flex-start', justifyContent: 'flex-end', paddingBottom: 2 }}>
      {isLastInGroup && <BubbleAvatar uri={isMe ? myAvatar : partnerAvatar} size={28} />}
    </View>
  );

  // ── Would You Rather ────────────────────────────────────────────────────────
  if (msg.gameMsgType === 'game_wyr') {
    return <WyrBubble msg={msg} colors={colors} isMe={isMe} meta={meta} extra={extra} avatarSlot={avatarSlot} onRespond={onRespond} messages={messages} />;
  }

  // ── Never Have I Ever ────────────────────────────────────────────────────────
  if (msg.gameMsgType === 'game_nhi') {
    return <NhiBubble msg={msg} colors={colors} isMe={isMe} meta={meta} extra={extra} avatarSlot={avatarSlot} onRespond={onRespond} messages={messages} />;
  }

  // ── Hot Takes ────────────────────────────────────────────────────────────────
  if (msg.gameMsgType === 'game_hot') {
    return <HotBubble msg={msg} colors={colors} isMe={isMe} meta={meta} extra={extra} avatarSlot={avatarSlot} onRespond={onRespond} messages={messages} />;
  }

  // ── Compatibility Quiz ───────────────────────────────────────────────────────
  if (msg.gameMsgType === 'game_quiz') {
    return <QuizBubble msg={msg} colors={colors} isMe={isMe} meta={meta} extra={extra} avatarSlot={avatarSlot} onRespond={onRespond} messages={messages} />;
  }

  // ── Build a Date ─────────────────────────────────────────────────────────────
  if (msg.gameMsgType === 'game_date') {
    return <DateBubble msg={msg} colors={colors} isMe={isMe} meta={meta} extra={extra} avatarSlot={avatarSlot} onRespond={onRespond} messages={messages} />;
  }

  // ── Emoji Story ──────────────────────────────────────────────────────────────
  if (msg.gameMsgType === 'game_emoji') {
    return <EmojiBubble msg={msg} colors={colors} isMe={isMe} meta={meta} extra={extra} avatarSlot={avatarSlot} onRespond={onRespond} messages={messages} />;
  }

  return null;
}

// ─── Shared: Game card wrapper ────────────────────────────────────────────────

function GameCard({ meta, children, isMe, avatarSlot, style }: {
  meta: GameMeta; children: React.ReactNode; isMe: boolean;
  avatarSlot: React.ReactNode; style?: any;
}) {
  return (
    <View style={[gStyles.row, isMe ? gStyles.rowMe : gStyles.rowThem]}>
      {!isMe && avatarSlot}
      <Squircle
        style={[gStyles.card, style]}
        cornerRadius={22} cornerSmoothing={1}
        fillColor={meta.bg}
      >
        {/* Game type badge */}
        <View style={[gStyles.badge, { backgroundColor: `${meta.accent}22` }]}>
          <Text style={{ fontSize: 12, fontFamily: 'ProductSans-Regular' }}>{meta.emoji}</Text>
          <Text style={[gStyles.badgeText, { color: meta.accent }]}>{meta.label}</Text>
        </View>
        {children}
      </Squircle>
      {isMe && avatarSlot}
    </View>
  );
}

// ─── Shared: already-responded check ─────────────────────────────────────────

function hasResponse(messages: GameMsg[], inviteId: string, responseType: string): GameMsg | undefined {
  return messages.find(m => m.gameMsgType === responseType && m.gameExtra?.inviteId === inviteId);
}

// ─── 1. Would You Rather ─────────────────────────────────────────────────────

function WyrBubble({ msg, colors, isMe, meta, extra, avatarSlot, onRespond, messages }: any) {
  const phase = extra.phase as string; // 'invite' | 'answer'

  if (phase === 'answer') {
    const choice = extra.choice as string;
    const optA   = extra.optA as string;
    const optB   = extra.optB as string;
    return (
      <GameCard meta={meta} isMe={isMe} avatarSlot={avatarSlot}>
        <Text style={gStyles.subLabel}>{isMe ? 'You chose' : `${extra.senderName ?? 'They'} chose`}</Text>
        <View style={[gStyles.wyrPickedRow]}>
          <Squircle style={[gStyles.wyrOption, choice === 'A' ? { } : { opacity: 0.35 }]}
            cornerRadius={14} cornerSmoothing={1} fillColor={choice === 'A' ? `${meta.accent}30` : 'rgba(255,255,255,0.05)'}>
            <Text style={[gStyles.wyrOptionLabel, choice === 'A' && { color: meta.accent }]}>A</Text>
            <Text style={[gStyles.wyrOptionText, { color: '#fff' }]}>{optA}</Text>
            {choice === 'A' && <Ionicons name="checkmark-circle" size={16} color={meta.accent} style={{ marginTop: 4 }} />}
          </Squircle>
        <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 16, fontFamily: 'ProductSans-Black', alignSelf: 'center' }}>or</Text>
          <Squircle style={[gStyles.wyrOption, choice === 'B' ? {} : { opacity: 0.35 }]}
            cornerRadius={14} cornerSmoothing={1} fillColor={choice === 'B' ? `${meta.accent}30` : 'rgba(255,255,255,0.05)'}>
            <Text style={[gStyles.wyrOptionLabel, choice === 'B' && { color: meta.accent }]}>B</Text>
            <Text style={[gStyles.wyrOptionText, { color: '#fff' }]}>{optB}</Text>
            {choice === 'B' && <Ionicons name="checkmark-circle" size={16} color={meta.accent} style={{ marginTop: 4 }} />}
          </Squircle>
        </View>
        <FooterRow msg={msg} isMe={isMe} />
      </GameCard>
    );
  }

  // Invite phase
  const optA  = extra.optA as string;
  const optB  = extra.optB as string;
  const reply = hasResponse(messages, msg.id, 'game_wyr');
  // Also check if the receiver already responded via gameExtra (in-place update)
  const inPlaceChoice = extra.choice as string | undefined;
  const chosenA = reply?.gameExtra?.choice === 'A' || inPlaceChoice === 'A';
  const chosenB = reply?.gameExtra?.choice === 'B' || inPlaceChoice === 'B';
  const answered = chosenA || chosenB;

  return (
    <GameCard meta={meta} isMe={isMe} avatarSlot={avatarSlot}>
      <Text style={gStyles.cardQuestion}>Would you rather…</Text>
      <View style={gStyles.wyrPickedRow}>
        <Pressable
          onPress={() => { if (!isMe && !answered) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onRespond({ ...msg, gameExtra: { ...extra, choice: 'A', phase: 'answer', inviteId: msg.id } }); } }}
          style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.8 : 1 }]}
          disabled={isMe || answered}
        >
          <Squircle style={[gStyles.wyrOption, chosenA && { borderWidth: 0 }]}
            cornerRadius={14} cornerSmoothing={1}
            fillColor={chosenA ? `${meta.accent}35` : 'rgba(255,255,255,0.06)'}>
            <Text style={[gStyles.wyrOptionLabel, chosenA && { color: meta.accent }]}>A</Text>
            <Text style={[gStyles.wyrOptionText, !answered && { color: '#fff' }, answered && !chosenA && { opacity: 0.4, color: '#fff' }]}>{optA}</Text>
            {chosenA && <Ionicons name="checkmark-circle" size={16} color={meta.accent} style={{ marginTop: 4 }} />}
          </Squircle>
        </Pressable>
        <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 16, fontFamily: 'ProductSans-Black', alignSelf: 'center' }}>or</Text>
        <Pressable
          onPress={() => { if (!isMe && !answered) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onRespond({ ...msg, gameExtra: { ...extra, choice: 'B', phase: 'answer', inviteId: msg.id } }); } }}
          style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.8 : 1 }]}
          disabled={isMe || answered}
        >
          <Squircle style={[gStyles.wyrOption, chosenB && { borderWidth: 0 }]}
            cornerRadius={14} cornerSmoothing={1}
            fillColor={chosenB ? `${meta.accent}35` : 'rgba(255,255,255,0.06)'}>
            <Text style={[gStyles.wyrOptionLabel, chosenB && { color: meta.accent }]}>B</Text>
            <Text style={[gStyles.wyrOptionText, !answered && { color: '#fff' }, answered && !chosenB && { opacity: 0.4, color: '#fff' }]}>{optB}</Text>
            {chosenB && <Ionicons name="checkmark-circle" size={16} color={meta.accent} style={{ marginTop: 4 }} />}
          </Squircle>
        </Pressable>
      </View>
      {answered && (
        <View style={gStyles.answeredRow}>
          <Ionicons name="checkmark-circle" size={13} color="#4ade80" />
          <Text style={gStyles.answeredText}>{isMe ? 'They answered!' : 'Answered!'}</Text>
        </View>
      )}
      <FooterRow msg={msg} isMe={isMe} />
    </GameCard>
  );
}

// ─── 2. Never Have I Ever ─────────────────────────────────────────────────────

function NhiBubble({ msg, colors, isMe, meta, extra, avatarSlot, onRespond, messages }: any) {
  const phase    = extra.phase as string;
  const statement = extra.statement as string;
  // Check in-place answer (set via game_response update)
  const inPlaceHave = typeof extra.have === 'boolean' ? extra.have : null;
  const answered = phase === 'answer' || inPlaceHave !== null;

  if (answered) {
    const have = inPlaceHave !== null ? inPlaceHave : (extra.have as boolean);
    return (
      <GameCard meta={meta} isMe={isMe} avatarSlot={avatarSlot}>
        <Text style={gStyles.subLabel}>Never have I ever…</Text>
        <Text style={gStyles.cardQuestion}>{statement}</Text>
        <View style={[gStyles.nhiResult, { backgroundColor: have ? 'rgba(251,191,36,0.15)' : 'rgba(99,102,241,0.15)' }]}>
          <Text style={{ fontSize: 24 }}>{have ? '🍹' : '😇'}</Text>
          <Text style={[gStyles.nhiResultText, { color: have ? '#fbbf24' : '#a5b4fc' }]}>
            {isMe ? (have ? 'They have!' : "They haven't") : (have ? 'You have!' : "You haven't")}
          </Text>
        </View>
        <FooterRow msg={msg} isMe={isMe} />
      </GameCard>
    );
  }

  return (
    <GameCard meta={meta} isMe={isMe} avatarSlot={avatarSlot}>
      <Text style={gStyles.subLabel}>Never have I ever…</Text>
      <Text style={gStyles.cardQuestion}>{statement}</Text>
      {!isMe ? (
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onRespond({ ...msg, gameExtra: { ...extra, have: true, phase: 'answer', inviteId: msg.id } }); }}
            style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.8 : 1 }]}
          >
            <Squircle style={gStyles.nhiBtn} cornerRadius={50} cornerSmoothing={1} fillColor="rgba(251,191,36,0.18)">
              <Text style={{ fontSize: 18 }}>🍹</Text>
              <Text style={[gStyles.nhiBtnText, { color: '#fbbf24' }]}>I have!</Text>
            </Squircle>
          </Pressable>
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onRespond({ ...msg, gameExtra: { ...extra, have: false, phase: 'answer', inviteId: msg.id } }); }}
            style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.8 : 1 }]}
          >
            <Squircle style={gStyles.nhiBtn} cornerRadius={50} cornerSmoothing={1} fillColor="rgba(99,102,241,0.18)">
              <Text style={{ fontSize: 18 }}>😇</Text>
              <Text style={[gStyles.nhiBtnText, { color: '#a5b4fc' }]}>Never!</Text>
            </Squircle>
          </Pressable>
        </View>
      ) : (
        <View style={gStyles.answeredRow}>
          <Text style={[gStyles.answeredText, { color: 'rgba(255,255,255,0.45)' }]}>Waiting for answer…</Text>
        </View>
      )}
      <FooterRow msg={msg} isMe={isMe} />
    </GameCard>
  );
}

// ─── 3. Hot Takes ────────────────────────────────────────────────────────────

const HOT_REACTIONS = ['🔥 Agree', '💀 Dead', '🧊 Nah', '🤯 Wild', '👑 Facts'];
const HOT_REACTION_COLORS: Record<string, string> = {
  '🔥 Agree': '#ef4444', '💀 Dead': '#6366f1', '🧊 Nah': '#06b6d4',
  '🤯 Wild': '#f59e0b', '👑 Facts': '#10b981',
};

function HotBubble({ msg, colors, isMe, meta, extra, avatarSlot, onRespond, messages }: any) {
  const phase    = extra.phase as string;
  const opinion  = extra.opinion as string;

  if (phase === 'answer') {
    const reaction = extra.reaction as string;
    const reactionColor = HOT_REACTION_COLORS[reaction] ?? meta.accent;
    return (
      <GameCard meta={meta} isMe={isMe} avatarSlot={avatarSlot}>
        <Text style={gStyles.subLabel}>{isMe ? 'You reacted' : `${extra.senderName ?? 'They'} reacted`}</Text>
        <Text style={gStyles.cardQuestion}>{opinion}</Text>
        <View style={[gStyles.hotReactionResult, { backgroundColor: `${reactionColor}18`, borderColor: `${reactionColor}40` }]}>
          <Text style={{ fontSize: 22 }}>{reaction.split(' ')[0]}</Text>
          <Text style={[gStyles.hotReactionText, { color: reactionColor }]}>{reaction}</Text>
        </View>
        <FooterRow msg={msg} isMe={isMe} />
      </GameCard>
    );
  }

  const reply = hasResponse(messages, msg.id, 'game_hot');
  return (
    <GameCard meta={meta} isMe={isMe} avatarSlot={avatarSlot}>
      <Text style={gStyles.subLabel}>🔥 Hot Take</Text>
      <Text style={gStyles.cardQuestion}>{opinion}</Text>
      {reply ? (
        <View style={gStyles.answeredRow}>
          <Ionicons name="checkmark-circle" size={13} color="#4ade80" />
          <Text style={gStyles.answeredText}>Reacted!</Text>
        </View>
      ) : !isMe ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
          {HOT_REACTIONS.map(r => {
            const col = HOT_REACTION_COLORS[r] ?? meta.accent;
            return (
              <Pressable key={r}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onRespond({ ...msg, gameExtra: { ...extra, reaction: r, phase: 'answer', inviteId: msg.id } }); }}
                style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}
              >
                <Squircle style={gStyles.hotReactionBtn} cornerRadius={50} cornerSmoothing={1} fillColor={`${col}18`}>
                  <Text style={{ fontSize: 14 }}>{r}</Text>
                </Squircle>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
      <FooterRow msg={msg} isMe={isMe} />
    </GameCard>
  );
}

// ─── 4. Compatibility Quiz ────────────────────────────────────────────────────

const QUIZ_QUESTIONS = [
  { q: 'Morning or night person?',        opts: ['☀️ Morning', '🌙 Night'] },
  { q: 'Beach or mountains?',             opts: ['🏖️ Beach', '⛰️ Mountains'] },
  { q: 'Homebody or social butterfly?',   opts: ['🏠 Homebody', '🦋 Social'] },
  { q: 'Plans or spontaneous?',           opts: ['📋 Plans', '⚡ Spontaneous'] },
  { q: 'Cats or dogs?',                   opts: ['🐱 Cats', '🐶 Dogs'] },
];

function QuizBubble({ msg, colors, isMe, meta, extra, avatarSlot, onRespond, messages }: any) {
  const phase     = extra.phase as string;    // 'invite' | 'answers' | 'result'
  const qIdx      = (extra.questionIdx as number) ?? 0;
  const myAnswers = (extra.myAnswers as string[]) ?? [];

  // ── Result phase ──
  if (phase === 'result') {
    const aAnswers = extra.aAnswers as string[];
    const bAnswers = extra.bAnswers as string[];
    const matches  = aAnswers.filter((a, i) => a === bAnswers[i]).length;
    const pct      = Math.round((matches / QUIZ_QUESTIONS.length) * 100);
    const emoji    = pct >= 80 ? '💘' : pct >= 60 ? '💕' : pct >= 40 ? '😊' : '🤔';
    return (
      <GameCard meta={meta} isMe={isMe} avatarSlot={avatarSlot} style={{ alignItems: 'center' }}>
        <Text style={{ fontSize: 48, textAlign: 'center', marginVertical: 8 }}>{emoji}</Text>
        <Text style={[gStyles.cardQuestion, { textAlign: 'center', fontSize: 22 }]}>{pct}% Compatible</Text>
        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontFamily: 'ProductSans-Regular', textAlign: 'center', marginTop: 4 }}>
          You matched on {matches} of {QUIZ_QUESTIONS.length} questions
        </Text>
        <View style={{ width: '100%', marginTop: 12, gap: 6 }}>
          {QUIZ_QUESTIONS.map((q, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons
                name={aAnswers[i] === bAnswers[i] ? 'heart' : 'close-circle'}
                size={14}
                color={aAnswers[i] === bAnswers[i] ? '#4ade80' : 'rgba(255,255,255,0.3)'}
              />
              <Text style={{ flex: 1, fontSize: 11, color: 'rgba(255,255,255,0.6)', fontFamily: 'ProductSans-Regular' }} numberOfLines={1}>
                {q.q}
              </Text>
            </View>
          ))}
        </View>
        <FooterRow msg={msg} isMe={isMe} />
      </GameCard>
    );
  }

  // ── Answer phase ─── (receiver answering step by step)
  if (phase === 'answers' && !isMe) {
    const currentQ = QUIZ_QUESTIONS[myAnswers.length];
    if (!currentQ) return null;
    return (
      <GameCard meta={meta} isMe={isMe} avatarSlot={avatarSlot}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={gStyles.subLabel}>Question {myAnswers.length + 1} / {QUIZ_QUESTIONS.length}</Text>
          <View style={[gStyles.quizProgress]}>
            {QUIZ_QUESTIONS.map((_, i) => (
              <View key={i} style={[gStyles.quizDot, { backgroundColor: i < myAnswers.length ? meta.accent : 'rgba(255,255,255,0.2)' }]} />
            ))}
          </View>
        </View>
        <Text style={gStyles.cardQuestion}>{currentQ.q}</Text>
        <View style={{ gap: 8, marginTop: 4 }}>
          {currentQ.opts.map(opt => (
            <Pressable
              key={opt}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                const newAnswers = [...myAnswers, opt];
                if (newAnswers.length === QUIZ_QUESTIONS.length) {
                  onRespond({ ...msg, gameExtra: { ...extra, phase: 'result', inviteId: msg.id, bAnswers: newAnswers } });
                } else {
                  onRespond({ ...msg, gameExtra: { ...extra, phase: 'answers', inviteId: msg.id, myAnswers: newAnswers }, _localOnly: true });
                }
              }}
              style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
            >
              <Squircle style={gStyles.quizOption} cornerRadius={14} cornerSmoothing={1}
                fillColor={`${meta.accent}15`} strokeColor={`${meta.accent}35`} strokeWidth={1}>
                <Text style={{ color: '#fff', fontFamily: 'ProductSans-Bold', fontSize: 14 }}>{opt}</Text>
              </Squircle>
            </Pressable>
          ))}
        </View>
        <FooterRow msg={msg} isMe={isMe} />
      </GameCard>
    );
  }

  // ── Invite phase ──
  const reply = hasResponse(messages, msg.id, 'game_quiz');
  return (
    <GameCard meta={meta} isMe={isMe} avatarSlot={avatarSlot}>
      <Text style={gStyles.cardQuestion}>Compatibility Quiz 💘</Text>
      <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, fontFamily: 'ProductSans-Regular', marginBottom: 8 }}>
        {QUIZ_QUESTIONS.length} quick questions — let's see how well we match
      </Text>
      {reply ? (
        <View style={gStyles.answeredRow}>
          <Ionicons name="checkmark-circle" size={13} color="#4ade80" />
          <Text style={gStyles.answeredText}>Quiz started!</Text>
        </View>
      ) : !isMe ? (
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onRespond({ ...msg, gameExtra: { ...extra, phase: 'answers', inviteId: msg.id, myAnswers: [] } }); }}
          style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
        >
          <Squircle style={gStyles.startBtn} cornerRadius={50} cornerSmoothing={1} fillColor={meta.accent}>
            <Text style={gStyles.startBtnText}>Start Quiz ✨</Text>
          </Squircle>
        </Pressable>
      ) : null}
      <FooterRow msg={msg} isMe={isMe} />
    </GameCard>
  );
}

// ─── 5. Build a Date ─────────────────────────────────────────────────────────

const DATE_STEPS = [
  { q: 'What kind of place?',     opts: ['☕ Cosy café', '🍽️ Fancy dinner', '🌿 Nature picnic', '🎭 Show/event'] },
  { q: 'Best time?',              opts: ['🌅 Morning', '☀️ Afternoon', '🌇 Sunset', '🌙 Night'] },
  { q: 'What vibe?',              opts: ['😌 Chill & easy', '🎉 Fun & lively', '🧠 Deep talks', '🔥 Adventurous'] },
  { q: 'How long?',               opts: ['⚡ Quick hour', '🕐 2–3 hours', '🌟 All day', '🚀 Weekend trip'] },
  { q: 'End the night with?',     opts: ['🍦 Dessert', '🎬 Movie', '🚶 Long walk', '🌃 Rooftop drinks'] },
];

function DateBubble({ msg, colors, isMe, meta, extra, avatarSlot, onRespond, messages }: any) {
  const phase    = extra.phase as string;
  const aPicks   = Array.isArray(extra.aPicks) && extra.aPicks.length > 0 ? (extra.aPicks as string[]) : null;
  const bPicks   = (extra.bPicks   as string[]) ?? [];
  const hasAPicks = aPicks !== null;

  if (phase === 'result') {
    return (
      <GameCard meta={meta} isMe={isMe} avatarSlot={avatarSlot}>
        <Text style={[gStyles.cardQuestion, { fontSize: 16 }]}>✨ Your Perfect Date</Text>
        <View style={{ gap: 8, marginTop: 8 }}>
          {DATE_STEPS.map((step, i) => {
            const aPick = aPicks?.[i];
            const bPick = bPicks[i];
            const same  = aPick && bPick && aPick === bPick;
            return (
              <View key={i} style={[gStyles.dateResultRow, { backgroundColor: same ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.06)' }]}>
                <Ionicons name={same ? 'heart' : 'checkmark-circle'} size={14} color={same ? '#4ade80' : meta.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontFamily: 'ProductSans-Regular' }}>{step.q}</Text>
                  {hasAPicks && aPick && bPick ? (
                    same
                      ? <Text style={{ fontSize: 13, color: '#4ade80', fontFamily: 'ProductSans-Bold' }}>{aPick} 💚</Text>
                      : <Text style={{ fontSize: 13, color: '#fff', fontFamily: 'ProductSans-Bold' }}>
                          <Text style={{ color: meta.accent, fontFamily: 'ProductSans-Bold' }}>{aPick}</Text>
                          <Text style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'ProductSans-Regular' }}> vs </Text>
                          <Text style={{ color: '#a78bfa', fontFamily: 'ProductSans-Bold' }}>{bPick}</Text>
                        </Text>
                  ) : (
                    <Text style={{ fontSize: 13, color: meta.accent, fontFamily: 'ProductSans-Bold' }}>
                      {bPick ?? aPick ?? '—'}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
        <FooterRow msg={msg} isMe={isMe} />
      </GameCard>
    );
  }

  if (phase === 'picking' && !isMe) {
    const stepIdx = bPicks.length;
    const step    = DATE_STEPS[stepIdx];
    if (!step) return null;
    return (
      <GameCard meta={meta} isMe={isMe} avatarSlot={avatarSlot}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={gStyles.subLabel}>Step {stepIdx + 1} / {DATE_STEPS.length}</Text>
          <View style={gStyles.quizProgress}>
            {DATE_STEPS.map((_, i) => (
              <View key={i} style={[gStyles.quizDot, { backgroundColor: i <= stepIdx ? meta.accent : 'rgba(255,255,255,0.2)' }]} />
            ))}
          </View>
        </View>
        <Text style={gStyles.cardQuestion}>{step.q}</Text>
        <View style={{ gap: 8, marginTop: 4 }}>
          {step.opts.map(opt => {
            const aChoice = aPicks?.[stepIdx];
            const isAChoice = aChoice === opt;
            return (
              <Pressable
                key={opt}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  const newPicks = [...bPicks, opt];
                  if (newPicks.length === DATE_STEPS.length) {
                    onRespond({ ...msg, gameExtra: { ...extra, phase: 'result', bPicks: newPicks, inviteId: msg.id } });
                  } else {
                    onRespond({ ...msg, gameExtra: { ...extra, phase: 'picking', bPicks: newPicks, inviteId: msg.id }, _localOnly: true });
                  }
                }}
                style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
              >
                <Squircle style={gStyles.quizOption}
                  cornerRadius={14} cornerSmoothing={1}
                  fillColor={isAChoice ? `${meta.accent}30` : `${meta.accent}10`}
                  strokeColor={isAChoice ? meta.accent : `${meta.accent}30`}
                  strokeWidth={1.5}>
                  <Text style={{ color: isAChoice ? meta.accent : '#fff', fontFamily: isAChoice ? 'ProductSans-Black' : 'ProductSans-Bold', fontSize: 14, flex: 1 }}>{opt}</Text>
                  {isAChoice && (
                    <Ionicons name="heart" size={13} color={meta.accent} />
                  )}
                </Squircle>
              </Pressable>
            );
          })}
        </View>
        <FooterRow msg={msg} isMe={isMe} />
      </GameCard>
    );
  }

  const inPlacePicking = phase === 'picking' && isMe;
  const replied = phase === 'result' || (extra.bPicks && (extra.bPicks as string[]).length === DATE_STEPS.length);

  return (
    <GameCard meta={meta} isMe={isMe} avatarSlot={avatarSlot}>
      <Text style={gStyles.cardQuestion}>Build a Date 🗓️</Text>

      {/* Sender's own picks summary */}
      {hasAPicks && aPicks && aPicks.length > 0 && (
        <View style={{ gap: 6 }}>
          {aPicks.map((pick: string, i: number) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="checkmark-circle" size={13} color={meta.accent} />
              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontFamily: 'ProductSans-Regular', flex: 1 }}>
                {DATE_STEPS[i]?.q}:{' '}
                <Text style={{ color: meta.accent, fontFamily: 'ProductSans-Bold' }}>{pick}</Text>
              </Text>
            </View>
          ))}
        </View>
      )}

      {inPlacePicking || replied ? (
        <View style={gStyles.answeredRow}>
          <Ionicons name={replied ? 'heart' : 'time-outline'} size={13} color={replied ? '#4ade80' : 'rgba(255,255,255,0.4)'} />
          <Text style={[gStyles.answeredText, !replied && { color: 'rgba(255,255,255,0.4)' }]}>
            {replied ? 'Both planned! View results below ✨' : 'They\'re picking their choices…'}
          </Text>
        </View>
      ) : !isMe ? (
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onRespond({ ...msg, gameExtra: { ...extra, phase: 'picking', bPicks: [], inviteId: msg.id } }); }}
          style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
        >
          <Squircle style={gStyles.startBtn} cornerRadius={50} cornerSmoothing={1} fillColor={meta.accent}>
            <Text style={gStyles.startBtnText}>Let's Plan! 🗓️</Text>
          </Squircle>
        </Pressable>
      ) : (
        <View style={gStyles.answeredRow}>
          <Text style={[gStyles.answeredText, { color: 'rgba(255,255,255,0.4)' }]}>Waiting for them to start…</Text>
        </View>
      )}
      <FooterRow msg={msg} isMe={isMe} />
    </GameCard>
  );
}

// ─── 6. Emoji Story ───────────────────────────────────────────────────────────

const EMOJI_PALETTE = [
  '😂','😍','🔥','💀','🥹','😭','🤯','😱','🥲','😎',
  '❤️','💔','✨','💥','🎉','👀','🫠','🤌','💅','🙈',
  '🐶','🐱','🦋','🌈','🍕','🍑','🍆','🌙','⚡','🫶',
  '🎭','🎪','🚀','🏖️','🎸','🧠','💎','🌊','🦄','👾',
];

function EmojiBubble({ msg, colors, isMe, meta, extra, avatarSlot, onRespond }: any) {
  const [picked,  setPicked]  = useState<string[]>([]);
  const [showPad, setShowPad] = useState(false);
  const rounds    = (extra.rounds as string[]) ?? [];
  const maxRounds = 10;
  const isDone    = rounds.length >= maxRounds;
  const myTurnIndex = isMe ? 0 : 1;
  const isMyTurn  = !isDone && rounds.length % 2 === myTurnIndex;
  const currentRound = Math.min(Math.floor(rounds.length / 2) + 1, 5);
  const MAX_PICK = 3;

  const handleTap = (emoji: string) => {
    if (picked.length >= MAX_PICK) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPicked(prev => [...prev, emoji]);
  };

  const handleRemoveLast = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPicked(prev => prev.slice(0, -1));
  };

  const handleSendEmoji = () => {
    const val = picked.join('');
    if (!val) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newRounds = [...rounds, val];
    onRespond({ ...msg, gameExtra: { ...extra, rounds: newRounds, phase: newRounds.length >= maxRounds ? 'done' : 'invite', inviteId: msg.id } });
    setPicked([]);
    setShowPad(false);
  };

  return (
    <GameCard meta={meta} isMe={isMe} avatarSlot={avatarSlot}>

      {/* Round + progress */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={gStyles.subLabel}>{isDone ? 'Story complete!' : `Round ${currentRound} / 5`}</Text>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <View key={i} style={{
              width: 7, height: 7, borderRadius: 4,
              backgroundColor:
                rounds.length >= (i + 1) * 2 ? meta.accent
                : rounds.length >= i * 2 + 1  ? `${meta.accent}55`
                : 'rgba(255,255,255,0.15)',
            }} />
          ))}
        </View>
      </View>

      {/* Story chips — horizontal flowing wrap */}
      {rounds.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {rounds.map((r: string, i: number) => {
            const byMe = isMe ? i % 2 === 0 : i % 2 === 1;
            return (
              <View key={i} style={{
                backgroundColor: byMe ? `${meta.accent}28` : 'rgba(255,255,255,0.09)',
                borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6,
              }}>
                <Text style={{ fontSize: 20 }}>{r}</Text>
              </View>
            );
          })}
          {!isDone && (
            <View style={{
              borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6,
              borderWidth: 1, borderColor: `${meta.accent}30`, borderStyle: 'dashed',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ fontSize: 16, opacity: 0.22, fontFamily: 'ProductSans-Regular' }}>＋</Text>
            </View>
          )}
        </View>
      )}

      {/* Empty state — only when no rounds yet */}
      {rounds.length === 0 && !isMyTurn && (
        <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, fontFamily: 'ProductSans-Regular' }}>
          Waiting for them to start the story…
        </Text>
      )}

      {/* Emoji picker input row */}
      {isMyTurn && (
        <View style={{ gap: 8 }}>
          {/* Tray row — picked emojis + open pad + send */}
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            {/* Picked preview / tap to open pad */}
            <Pressable
              onPress={() => setShowPad(p => !p)}
              style={{ flex: 1 }}
            >
              <Squircle
                style={{ height: 44, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                cornerRadius={22} cornerSmoothing={1}
                fillColor="rgba(255,255,255,0.07)"
                strokeColor={showPad ? meta.accent : `${meta.accent}45`}
                strokeWidth={showPad ? 1.5 : 1}
              >
                {picked.length === 0 ? (
                  <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', fontFamily: 'ProductSans-Regular', flex: 1 }}>
                    {rounds.length === 0 ? 'Pick 3 emojis…' : 'Add 3 emojis…'}
                  </Text>
                ) : (
                  <Text style={{ fontSize: 22, letterSpacing: 2, flex: 1 }}>{picked.join('')}</Text>
                )}
                {/* Slot dots */}
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  {Array.from({ length: MAX_PICK }).map((_, i) => (
                    <View key={i} style={{
                      width: 7, height: 7, borderRadius: 4,
                      backgroundColor: i < picked.length ? meta.accent : 'rgba(255,255,255,0.18)',
                    }} />
                  ))}
                </View>
              </Squircle>
            </Pressable>

            {/* Backspace */}
            {picked.length > 0 && (
              <Pressable onPress={handleRemoveLast} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
                <View style={{
                  width: 44, height: 44, borderRadius: 22,
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name="backspace-outline" size={18} color="rgba(255,255,255,0.6)" />
                </View>
              </Pressable>
            )}

            {/* Send */}
            <Pressable onPress={handleSendEmoji} disabled={picked.length === 0}
              style={({ pressed }) => [{ opacity: picked.length === 0 ? 0.3 : pressed ? 0.7 : 1 }]}>
              <View style={{
                width: 44, height: 44, borderRadius: 22,
                backgroundColor: meta.accent, alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="arrow-up" size={17} color="#fff" />
              </View>
            </Pressable>
          </View>

          {/* Emoji pad */}
          {showPad && (
            <View style={{
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderRadius: 18, padding: 10,
              flexDirection: 'row', flexWrap: 'wrap', gap: 4,
            }}>
              {EMOJI_PALETTE.map(emoji => (
                <Pressable
                  key={emoji}
                  onPress={() => handleTap(emoji)}
                  disabled={picked.length >= MAX_PICK}
                  style={({ pressed }) => [{
                    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
                    borderRadius: 12, opacity: pressed ? 0.5 : picked.length >= MAX_PICK ? 0.35 : 1,
                    backgroundColor: 'rgba(255,255,255,0.04)',
                  }]}
                >
                  <Text style={{ fontSize: 24 }}>{emoji}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Waiting / done state */}
      {!isMyTurn && !isDone && (
        <View style={gStyles.answeredRow}>
          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: `${meta.accent}70` }} />
          <Text style={[gStyles.answeredText, { color: 'rgba(255,255,255,0.4)' }]}>
            Waiting for {isMe ? 'them' : 'you'}…
          </Text>
        </View>
      )}
      {isDone && (
        <View style={[gStyles.answeredRow, { justifyContent: 'center' }]}>
          <Text style={{ fontSize: 18 }}>🎉</Text>
          <Text style={gStyles.answeredText}>Story complete!</Text>
        </View>
      )}

      <FooterRow msg={msg} isMe={isMe} />
    </GameCard>
  );
}

// ─── Shared footer (time + ticks) ─────────────────────────────────────────────

function FooterRow({ msg, isMe }: { msg: GameMsg; isMe: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 3, marginTop: 8 }}>
      <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: 'ProductSans-Regular' }}>{msg.time}</Text>
      {isMe && <MsgTicks status={msg.status} />}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GAMES PANEL — bottom-sheet picker + per-game send flow
// ─────────────────────────────────────────────────────────────────────────────

export function GamesPanel({
  colors, partnerName, onSend, onClose, onCards, onTod,
}: {
  colors: any;
  partnerName: string;
  onSend: (gameMsgType: string, content: string, extra: Record<string, any>) => void;
  onClose: () => void;
  onCards?: () => void;
  onTod?: () => void;
}) {
  const { slideY, dismiss } = useSlidePanel(onClose);
  const [selectedGame, setSelectedGame] = useState<GameMeta | null>(null);

  const handleSelectGame = (g: GameMeta) => {
    if (g.id === 'cards') {
      dismiss(() => { onClose(); onCards?.(); });
      return;
    }
    if (g.id === 'truth_or_dare') {
      dismiss(() => { onClose(); onTod?.(); });
      return;
    }
    setSelectedGame(g);
  };

  return (
    <Pressable style={StyleSheet.absoluteFill} onPress={() => dismiss(onClose)}>
      <Animated.View style={[gStyles.panel, { backgroundColor: colors.bg, borderTopColor: colors.border, transform: [{ translateY: slideY }] }]}>
        <Pressable>
          <View style={[gStyles.handle, { backgroundColor: colors.border }]} />

          {/* Header */}
          <View style={gStyles.panelHeader}>
            {selectedGame ? (
              <Pressable onPress={() => setSelectedGame(null)} hitSlop={12}>
                <Squircle style={gStyles.closeBtn} cornerRadius={10} cornerSmoothing={1} fillColor={colors.surface2}>
                  <Ionicons name="arrow-back" size={16} color={colors.text} />
                </Squircle>
              </Pressable>
            ) : (
              <View style={[gStyles.panelIconBox, { backgroundColor: '#111' }]}>
                <Text style={{ fontSize: 18 }}>🎮</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={[gStyles.panelTitle, { color: colors.text }]}>
                {selectedGame ? selectedGame.label : 'Games'}
              </Text>
              <Text style={[gStyles.panelSub, { color: colors.textSecondary }]}>
                {selectedGame ? selectedGame.tagline : `Play with ${partnerName}`}
              </Text>
            </View>
            <Pressable onPress={() => dismiss(onClose)} hitSlop={12}>
              <Squircle style={gStyles.closeBtn} cornerRadius={10} cornerSmoothing={1} fillColor={colors.surface2}>
                <Ionicons name="close" size={16} color={colors.text} />
              </Squircle>
            </Pressable>
          </View>

          {/* Game picker grid */}
          {!selectedGame && (
            <ScrollView style={{ maxHeight: 520 }} showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 36, gap: 10 }}>
              {GAMES.map((g, idx) => (
                <Pressable key={g.id} onPress={() => handleSelectGame(g)} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}>
                  <Squircle style={[gStyles.gamePickerCard, { borderColor: `${g.accent}35` }]}
                    cornerRadius={20} cornerSmoothing={1}
                    fillColor={g.bg} strokeColor={`${g.accent}30`} strokeWidth={1}>
                    <View style={[gStyles.gamePickerIcon, { backgroundColor: `${g.accent}18` }]}>
                      <Text style={{ fontSize: 26 }}>{g.emoji}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[gStyles.gamePickerLabel, { color: '#fff' }]}>{g.label}</Text>
                      <Text style={[gStyles.gamePickerDesc, { color: 'rgba(255,255,255,0.5)' }]}>{g.desc}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={`${g.accent}80`} />
                  </Squircle>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {/* Per-game send form */}
          {selectedGame && (
            <GameSendForm
              game={selectedGame}
              colors={colors}
              partnerName={partnerName}
              onSend={(extra) => {
                dismiss(() => onSend(selectedGame.id, extra.content ?? `🎮 ${selectedGame.label}`, extra));
              }}
            />
          )}
        </Pressable>
      </Animated.View>
    </Pressable>
  );
}

// ─── Per-game send forms ──────────────────────────────────────────────────────

function GameSendForm({ game, colors, partnerName, onSend }: {
  game: GameMeta; colors: any; partnerName: string;
  onSend: (extra: Record<string, any>) => void;
}) {
  if (game.id === 'game_wyr') return <WyrSendForm game={game} colors={colors} onSend={onSend} />;
  if (game.id === 'game_nhi') return <NhiSendForm game={game} colors={colors} onSend={onSend} />;
  if (game.id === 'game_hot') return <HotSendForm game={game} colors={colors} onSend={onSend} />;
  if (game.id === 'game_quiz') return <QuizInviteForm game={game} colors={colors} partnerName={partnerName} onSend={onSend} />;
  if (game.id === 'game_date') return <DateInviteForm game={game} colors={colors} partnerName={partnerName} onSend={onSend} />;
  if (game.id === 'game_emoji') return <EmojiInviteForm game={game} colors={colors} partnerName={partnerName} onSend={onSend} />;
  return null;
}

// WYR send form
const WYR_TEMPLATES = [
  { a: 'Travel the world alone', b: 'Stay home with someone you love' },
  { a: 'Never use your phone again', b: 'Never watch TV again' },
  { a: 'Be rich and unknown', b: 'Be famous and broke' },
  { a: 'Always be 10 min late', b: 'Always be 20 min early' },
  { a: 'Live in the city forever', b: 'Live in nature forever' },
];

function WyrSendForm({ game, colors, onSend }: any) {
  const [optA, setOptA] = useState('');
  const [optB, setOptB] = useState('');
  const [step, setStep]  = useState<'template' | 'custom'>('template');

  if (step === 'template') {
    return (
      <View style={{ paddingHorizontal: 16, paddingBottom: 36, gap: 12 }}>
        <Text style={[gStyles.formLabel, { color: colors.textSecondary }]}>Pick a template or write your own</Text>
        <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {WYR_TEMPLATES.map((t, i) => (
            <Pressable key={i} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onSend({ optA: t.a, optB: t.b, phase: 'invite', content: `🤷 WYR: ${t.a} or ${t.b}?` }); }}
              style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}>
              <Squircle style={gStyles.templateRow} cornerRadius={16} cornerSmoothing={1}
                fillColor={game.bg} strokeColor={`${game.accent}30`} strokeWidth={1}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, color: game.accent, fontFamily: 'ProductSans-Bold', marginBottom: 3 }}>A</Text>
                  <Text style={{ color: '#fff', fontFamily: 'ProductSans-Regular', fontSize: 13 }}>{t.a}</Text>
                </View>
                <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, fontFamily: 'ProductSans-Black' }}>or</Text>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 12, color: game.accent, fontFamily: 'ProductSans-Bold', marginBottom: 3 }}>B</Text>
                  <Text style={{ color: '#fff', fontFamily: 'ProductSans-Regular', fontSize: 13, textAlign: 'right' }}>{t.b}</Text>
                </View>
              </Squircle>
            </Pressable>
          ))}
        </ScrollView>
        <Pressable onPress={() => setStep('custom')} style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}>
          <Squircle style={gStyles.outlineBtn} cornerRadius={50} cornerSmoothing={1}
            fillColor="transparent" strokeColor={colors.border} strokeWidth={1.5}>
            <Ionicons name="create" size={15} color={colors.textSecondary} />
            <Text style={[gStyles.outlineBtnText, { color: colors.textSecondary }]}>Write my own</Text>
          </Squircle>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 36, gap: 12 }}>
      <Text style={[gStyles.formLabel, { color: colors.textSecondary }]}>Option A</Text>
      <Squircle style={gStyles.formInput} cornerRadius={16} cornerSmoothing={1}
        fillColor={colors.surface} strokeColor={colors.border} strokeWidth={StyleSheet.hairlineWidth}>
        <TextInput value={optA} onChangeText={setOptA} placeholder="e.g. Be invisible"
          placeholderTextColor={colors.placeholder}
          style={{ color: colors.text, fontSize: 14, fontFamily: 'ProductSans-Regular', flex: 1, padding: 14 }} />
      </Squircle>
      <Text style={[gStyles.formLabel, { color: colors.textSecondary }]}>Option B</Text>
      <Squircle style={gStyles.formInput} cornerRadius={16} cornerSmoothing={1}
        fillColor={colors.surface} strokeColor={colors.border} strokeWidth={StyleSheet.hairlineWidth}>
        <TextInput value={optB} onChangeText={setOptB} placeholder="e.g. Be able to fly"
          placeholderTextColor={colors.placeholder}
          style={{ color: colors.text, fontSize: 14, fontFamily: 'ProductSans-Regular', flex: 1, padding: 14 }} />
      </Squircle>
      <Pressable
        onPress={() => { if (optA.trim() && optB.trim()) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onSend({ optA: optA.trim(), optB: optB.trim(), phase: 'invite', content: `🤷 WYR: ${optA.trim()} or ${optB.trim()}?` }); } }}
        disabled={!optA.trim() || !optB.trim()}
        style={({ pressed }) => [{ opacity: !optA.trim() || !optB.trim() ? 0.5 : pressed ? 0.8 : 1 }]}
      >
        <Squircle style={gStyles.sendBtn} cornerRadius={50} cornerSmoothing={1} fillColor={game.accent}>
          <Ionicons name="send" size={15} color="#fff" />
          <Text style={gStyles.sendBtnText}>Send Dilemma</Text>
        </Squircle>
      </Pressable>
    </View>
  );
}

// NHI send form
const NHI_TEMPLATES = [
  'Never have I ever stayed up all night talking to someone',
  'Never have I ever texted the wrong person something embarrassing',
  'Never have I ever laughed so hard I cried',
  'Never have I ever eaten an entire pizza alone',
  'Never have I ever called someone by the wrong name on a date',
  'Never have I ever stalked someone\'s social media for hours',
];

function NhiSendForm({ game, colors, onSend }: any) {
  const [custom, setCustom] = useState('');
  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 36, gap: 10 }}>
      <Text style={[gStyles.formLabel, { color: colors.textSecondary }]}>Tap to send, or write your own</Text>
      <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {NHI_TEMPLATES.map((t, i) => (
          <Pressable key={i} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onSend({ statement: t, phase: 'invite', content: `🍹 Never have I ever: ${t}` }); }}
            style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}>
            <Squircle style={gStyles.templateRow} cornerRadius={16} cornerSmoothing={1}
              fillColor={game.bg} strokeColor={`${game.accent}30`} strokeWidth={1}>
              <Text style={{ color: '#fff', fontFamily: 'ProductSans-Regular', fontSize: 13, flex: 1 }}>{t}</Text>
              <Ionicons name="send" size={14} color={`${game.accent}80`} />
            </Squircle>
          </Pressable>
        ))}
      </ScrollView>
      <Squircle style={[gStyles.formInput, { height: 52 }]} cornerRadius={16} cornerSmoothing={1}
        fillColor={colors.surface} strokeColor={colors.border} strokeWidth={StyleSheet.hairlineWidth}>
        <TextInput value={custom} onChangeText={setCustom} placeholder="Write your own…"
          placeholderTextColor={colors.placeholder}
          style={{ color: colors.text, fontSize: 14, fontFamily: 'ProductSans-Regular', flex: 1, padding: 14 }}
          onSubmitEditing={() => { if (custom.trim()) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onSend({ statement: custom.trim(), phase: 'invite', content: `🍹 Never have I ever: ${custom.trim()}` }); } }}
          returnKeyType="send"
        />
      </Squircle>
    </View>
  );
}

// Hot Takes send form
const HOT_TEMPLATES = [
  'Pineapple on pizza is actually good',
  'Morning people are just showing off',
  'Long distance relationships never really work',
  'Social media has ruined dating',
  'Being single is better than settling',
  'Online dating is the best way to meet someone now',
];

function HotSendForm({ game, colors, onSend }: any) {
  const [custom, setCustom] = useState('');
  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 36, gap: 10 }}>
      <Text style={[gStyles.formLabel, { color: colors.textSecondary }]}>Drop a hot take</Text>
      <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {HOT_TEMPLATES.map((t, i) => (
          <Pressable key={i} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onSend({ opinion: t, phase: 'invite', content: `🔥 Hot take: ${t}` }); }}
            style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}>
            <Squircle style={gStyles.templateRow} cornerRadius={16} cornerSmoothing={1}
              fillColor={game.bg} strokeColor={`${game.accent}30`} strokeWidth={1}>
              <Text style={{ color: '#fff', fontFamily: 'ProductSans-Regular', fontSize: 13, flex: 1 }}>{t}</Text>
              <Ionicons name="flame" size={14} color={`${game.accent}80`} />
            </Squircle>
          </Pressable>
        ))}
      </ScrollView>
      <Squircle style={[gStyles.formInput, { height: 52 }]} cornerRadius={16} cornerSmoothing={1}
        fillColor={colors.surface} strokeColor={colors.border} strokeWidth={StyleSheet.hairlineWidth}>
        <TextInput value={custom} onChangeText={setCustom} placeholder="Your hot take…"
          placeholderTextColor={colors.placeholder}
          style={{ color: colors.text, fontSize: 14, fontFamily: 'ProductSans-Regular', flex: 1, padding: 14 }}
          onSubmitEditing={() => { if (custom.trim()) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onSend({ opinion: custom.trim(), phase: 'invite', content: `🔥 Hot take: ${custom.trim()}` }); } }}
          returnKeyType="send"
        />
      </Squircle>
    </View>
  );
}

// Quiz / Date / Emoji — simple invite forms (the real interaction happens in the bubble)
function QuizInviteForm({ game, colors, partnerName, onSend }: any) {
  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 40, gap: 14 }}>
      <Squircle style={[gStyles.invitePreview, { backgroundColor: game.bg }]} cornerRadius={22} cornerSmoothing={1} fillColor={game.bg}>
        <Text style={{ fontSize: 40, textAlign: 'center', marginBottom: 8 }}>💘</Text>
        <Text style={{ color: '#fff', fontFamily: 'ProductSans-Black', fontSize: 18, textAlign: 'center', marginBottom: 6 }}>
          Compatibility Quiz
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontFamily: 'ProductSans-Regular', textAlign: 'center' }}>
          5 questions to reveal how well you and {partnerName} match
        </Text>
      </Squircle>
      <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onSend({ phase: 'invite', aAnswers: [], content: '💘 Compatibility Quiz — let\'s see how we match!' }); }}
        style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}>
        <Squircle style={gStyles.sendBtn} cornerRadius={50} cornerSmoothing={1} fillColor={game.accent}>
          <Text style={gStyles.sendBtnText}>Send Quiz Invite 💘</Text>
        </Squircle>
      </Pressable>
    </View>
  );
}

function DateInviteForm({ game, colors, partnerName, onSend }: any) {
  const [picks, setPicks] = useState<string[]>([]);
  const step = DATE_STEPS[picks.length];

  if (!step) {
    return (
      <View style={{ paddingHorizontal: 16, paddingBottom: 40, gap: 14 }}>
        <Text style={{ color: colors.text, fontFamily: 'ProductSans-Black', fontSize: 16, textAlign: 'center' }}>Your picks 🎉</Text>
        {picks.map((p, i) => (
          <Text key={i} style={{ color: colors.textSecondary, fontFamily: 'ProductSans-Regular', fontSize: 13 }}>
            {DATE_STEPS[i].q}: <Text style={{ color: game.accent, fontFamily: 'ProductSans-Bold' }}>{p}</Text>
          </Text>
        ))}
        <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onSend({ phase: 'invite', aPicks: picks, bPicks: [], content: `🗓️ Let's build our perfect date!` }); }}
          style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}>
          <Squircle style={gStyles.sendBtn} cornerRadius={50} cornerSmoothing={1} fillColor={game.accent}>
            <Text style={gStyles.sendBtnText}>Send to {partnerName} 🗓️</Text>
          </Squircle>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 40, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={[gStyles.formLabel, { color: colors.textSecondary }]}>Step {picks.length + 1} / {DATE_STEPS.length}</Text>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {DATE_STEPS.map((_, i) => (
            <View key={i} style={[gStyles.quizDot, { backgroundColor: i < picks.length ? game.accent : colors.surface2 }]} />
          ))}
        </View>
      </View>
      <Text style={[gStyles.cardQuestion, { color: colors.text }]}>{step.q}</Text>
      <View style={{ gap: 8 }}>
        {step.opts.map(opt => (
          <Pressable key={opt} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setPicks([...picks, opt]); }} style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}>
            <Squircle style={gStyles.quizOption} cornerRadius={14} cornerSmoothing={1}
              fillColor={`${game.accent}15`} strokeColor={`${game.accent}35`} strokeWidth={1}>
              <Text style={{ color: colors.text, fontFamily: 'ProductSans-Bold', fontSize: 14 }}>{opt}</Text>
            </Squircle>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function EmojiInviteForm({ game, colors, partnerName, onSend }: any) {
  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 40, gap: 14 }}>
      <Squircle style={[gStyles.invitePreview]} cornerRadius={22} cornerSmoothing={1} fillColor={game.bg}>
        <Text style={{ fontSize: 40, textAlign: 'center', marginBottom: 8 }}>😂</Text>
        <Text style={{ color: '#fff', fontFamily: 'ProductSans-Black', fontSize: 18, textAlign: 'center', marginBottom: 6 }}>Emoji Story</Text>
        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontFamily: 'ProductSans-Regular', textAlign: 'center' }}>
          Take turns adding 3 emojis each to build a wild story together!
        </Text>
      </Squircle>
      <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onSend({ phase: 'invite', rounds: [], content: '😂 Emoji Story — add your emojis!' }); }}
        style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}>
        <Squircle style={gStyles.sendBtn} cornerRadius={50} cornerSmoothing={1} fillColor={game.accent}>
          <Text style={gStyles.sendBtnText}>Start Story 😂</Text>
        </Squircle>
      </Pressable>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const gStyles = StyleSheet.create({
  // Bubble rows
  row:        { flexDirection: 'row', marginVertical: 3, alignItems: 'flex-end' },
  rowMe:      { justifyContent: 'flex-end', paddingLeft: 8 },
  rowThem:    { justifyContent: 'flex-start', paddingRight: 8 },
  card:       { width: W * 0.82, padding: 14, gap: 10 },

  badge:      { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 50, marginBottom: 2 },
  badgeText:  { fontSize: 11, fontFamily: 'ProductSans-Bold', letterSpacing: 0.3 },

  subLabel:   { fontSize: 10, fontFamily: 'ProductSans-Bold', color: 'rgba(255,255,255,0.45)', letterSpacing: 0.5 },
  cardQuestion: { fontSize: 15, fontFamily: 'ProductSans-Black', color: '#fff', lineHeight: 22 },

  // WYR
  wyrPickedRow:    { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  wyrOption:       { flex: 1, padding: 12, gap: 6, alignItems: 'flex-start' },
  wyrOptionLabel:  { fontSize: 10, fontFamily: 'ProductSans-Bold', color: 'rgba(255,255,255,0.45)', letterSpacing: 0.5 },
  wyrOptionText:   { fontSize: 13, fontFamily: 'ProductSans-Bold', textAlign: 'left', lineHeight: 18, color: '#ffffff' },

  // NHI
  nhiResult:     { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, padding: 12, marginTop: 4 },
  nhiResultText: { fontSize: 15, fontFamily: 'ProductSans-Black', color: '#ffffff' },
  nhiBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  nhiBtnText:    { fontSize: 14, fontFamily: 'ProductSans-Black', color: '#ffffff' },

  // Hot
  hotReactionBtn:    { paddingHorizontal: 14, paddingVertical: 8 },
  hotReactionResult: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 10, borderWidth: 1, marginTop: 4 },
  hotReactionText:   { fontSize: 15, fontFamily: 'ProductSans-Black', color: '#ffffff' },

  // Quiz / Date
  quizProgress: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  quizDot:      { width: 6, height: 6, borderRadius: 3 },
  quizOption:   { paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },

  // Date
  dateResultRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12 },

  // Emoji
  emojiStory: { gap: 6 },
  emojiChip:  { alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, minWidth: 44 },

  // Shared
  answeredRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  answeredText: { fontSize: 12, fontFamily: 'ProductSans-Bold', color: '#4ade80' },
  startBtn:     { paddingVertical: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  startBtnText: { fontSize: 14, fontFamily: 'ProductSans-Black', color: '#fff' },

  // Panel
  panel:        { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopWidth: StyleSheet.hairlineWidth, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 28, shadowOffset: { width: 0, height: -4 }, elevation: 24 },
  handle:       { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  panelHeader:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 14, paddingTop: 6 },
  panelIconBox: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  panelTitle:   { fontSize: 16, fontFamily: 'ProductSans-Black' },
  panelSub:     { fontSize: 12, fontFamily: 'ProductSans-Regular', marginTop: 1 },
  closeBtn:     { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },

  // Game picker
  gamePickerCard:  { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  gamePickerIcon:  { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  gamePickerLabel: { fontSize: 15, fontFamily: 'ProductSans-Black', marginBottom: 2 },
  gamePickerDesc:  { fontSize: 12, fontFamily: 'ProductSans-Regular' },

  // Send forms
  formLabel:    { fontSize: 11, fontFamily: 'ProductSans-Bold', letterSpacing: 0.8, textTransform: 'uppercase' },
  formInput:    { height: 52 },
  templateRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  sendBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15 },
  sendBtnText:  { fontSize: 15, fontFamily: 'ProductSans-Black', color: '#fff' },
  outlineBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13 },
  outlineBtnText: { fontSize: 14, fontFamily: 'ProductSans-Bold' },
  invitePreview: { padding: 24, alignItems: 'center' },
});
