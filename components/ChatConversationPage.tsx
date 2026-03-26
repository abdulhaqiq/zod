import { navPush, navReplace } from '@/utils/nav';
import { checkContent } from '@/utils/contentFilter';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import * as MediaLibrary from 'expo-media-library';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  RecordingPresets,
  createAudioPlayer,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as Linking from 'expo-linking';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system/legacy';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Squircle from '@/components/ui/Squircle';
import { apiFetch, API_V1, WS_V1 } from '@/constants/api';
import { takePendingGame } from '@/constants/gameQueue';
import { useAuth } from '@/context/AuthContext';
import { useCall } from '@/context/CallContext';
import { useAppTheme } from '@/context/ThemeContext';
import { GAME_MSG_TYPES, GameBubble } from '@/components/MiniGames';
import type { GameMsg } from '@/components/MiniGames';
import {
  loadCache,
  setCache,
  appendToCache,
  prependToCache,
  patchCacheMessage,
  removeCacheMessage,
  getLatestCachedTime,
  getOldestCachedTime,
  evictCache,
  type CachedMsg,
} from '@/utils/messageCache';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: W, height: SCREEN_H } = Dimensions.get('window');
const CARD_W  = W - 72;
const CARD_GAP = 12;
const H_PHOTO = Math.round(W * 1.2);

// ─── Types ────────────────────────────────────────────────────────────────────

interface MsgReaction { emoji: string; user_id: string; created_at: string; }

interface Msg {
  id: string;
  text: string;
  from: 'me' | 'them';
  time: string;
  rawTime?: string;   // ISO 8601 — pagination cursor
  isCard?: boolean;
  isAnswer?: boolean;
  answerTo?: string;
  replyToId?: string;
  // sending → sent (echoed back) → delivered (partner has ws open) → read
  status?: 'sending' | 'sent' | 'delivered' | 'read';
  // Truth or Dare game messages
  isTod?: boolean;
  todMsgType?: 'tod_invite' | 'tod_accept' | 'tod_answer' | 'tod_next' | 'tod_choice' | 'tod_skip';
  todExtra?: Record<string, any>;
  // Mini-games
  isGame?: boolean;
  gameMsgType?: string;
  gameExtra?: Record<string, any>;
  // Image messages
  imageUrl?: string;
  // Voice messages
  audioUrl?: string;
  audioDuration?: number;
  // Audio/Video call messages
  isCall?: boolean;
  callType?: 'missed' | 'ended' | 'declined';
  callKind?: 'audio' | 'video';
  callDuration?: number;
  // Reactions + edit
  reactions?: MsgReaction[];
  editedAt?: string;
  readAt?: string;
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

function lightenHex(hex: string, amount: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const nr = Math.round(r + (255 - r) * amount);
  const ng = Math.round(g + (255 - g) * amount);
  const nb = Math.round(b + (255 - b) * amount);
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}

const CATEGORY_ACCENT: Record<string, string> = {
  Deep:              '#818cf8',
  Fun:               '#fbbf24',
  Romantic:          '#f472b6',
  Spicy:             '#f87171',
  'Would You Rather':'#a78bfa',
  Dreams:            '#22d3ee',
  Curious:           '#34d399',
  Random:            '#94a3b8',
  Truth:             '#818cf8',
  Dare:              '#f87171',
};

const CATEGORY_EMOJI: Record<string, string> = {
  Deep:              '🌊',
  Fun:               '😂',
  Romantic:          '💕',
  Spicy:             '🌶️',
  'Would You Rather':'🤔',
  Dreams:            '🌟',
  Curious:           '🧠',
  Random:            '🎭',
  Truth:             '🤔',
  Dare:              '🔥',
};

const CATEGORY_COLOR: Record<string, string> = {
  Deep:              '#1e1b4b',
  Fun:               '#3a2800',
  Romantic:          '#3d0a28',
  Spicy:             '#3d0c0c',
  'Would You Rather':'#2d1a5e',
  Dreams:            '#003040',
  Curious:           '#0d2e1a',
  Random:            '#1a2535',
  Truth:             '#312e81',
  Dare:              '#7f1d1d',
};

const GAME_META: Record<string, { label: string; emoji: string; accent: string; desc: string }> = {
  question:      { label: 'Question Cards', emoji: '🃏', accent: '#818cf8', desc: 'Deep, fun & thought-provoking' },
  truth_or_dare: { label: 'Truth or Dare',  emoji: '🎲', accent: '#f87171', desc: 'Spicy dares & honest truths' },
};

// ─── Fallback question cards (used when DB has no rows yet) ──────────────────

function _card(
  category: string, tag: string, emoji: string, question: string, n: number,
): DbCard {
  return {
    id: `local-${category}-${n}`,
    game: 'question',
    category,
    tag,
    emoji,
    question,
    color: CATEGORY_COLOR[category] ?? '#1e1b4b',
    sort_order: n,
  };
}

const FALLBACK_CARDS: DbCard[] = [
  // ── Deep ──────────────────────────────────────────────────────────────────
  _card('Deep','Deep','🌀',"What's one belief you've held for years that you recently started questioning?",0),
  _card('Deep','Deep','🎵',"If your life had a theme song right now, what would it be and why?",1),
  _card('Deep','Deep','💔',"What's the hardest thing you've ever had to forgive someone for?",2),
  _card('Deep','Deep','⏳',"If you could relive one moment in your life, which would it be?",3),
  _card('Deep','Deep','🌠',"What's something you want to accomplish before you die that most people would never guess?",4),
  _card('Deep','Deep','🏡',"What does 'home' mean to you?",5),
  _card('Deep','Deep','🪞',"If you could talk to your 16-year-old self for 5 minutes, what would you say?",6),
  _card('Deep','Deep','🌑',"What's one secret fear you've never told anyone?",7),
  _card('Deep','Deep','🎲',"What's the biggest risk you've ever taken — was it worth it?",8),
  _card('Deep','Deep','✨',"At what point in your life did you feel most alive?",9),
  _card('Deep','Deep','🦋',"What would you do differently if you knew nobody would judge you?",10),
  _card('Deep','Deep','❤️',"How do you know when you're in love?",11),
  _card('Deep','Deep','⚡',"What's something that scares you but excites you at the same time?",12),
  _card('Deep','Deep','🌱',"What does growing up mean to you — and have you?",13),
  _card('Deep','Deep','💡',"What's the most important lesson love has taught you?",14),

  // ── Fun ───────────────────────────────────────────────────────────────────
  _card('Fun','Fun','🍕',"If you were a pizza topping, what would you be and why?",0),
  _card('Fun','Fun','😳',"What's the most embarrassing thing that happened to you in public?",1),
  _card('Fun','Fun','🔍',"What's the strangest thing you've Googled in the last week?",2),
  _card('Fun','Fun','⭐',"If you could swap lives with a celebrity for a day, who and why?",3),
  _card('Fun','Fun','🤹',"What's your most useless talent?",4),
  _card('Fun','Fun','🐾',"If your pet could talk, what would be their biggest complaint about you?",5),
  _card('Fun','Fun','🍜',"What's the weirdest thing you've ever eaten?",6),
  _card('Fun','Fun','📱',"What's the funniest autocorrect fail you've had?",7),
  _card('Fun','Fun','🏝️',"If you were stranded on a desert island with only 3 apps, which would you pick?",8),
  _card('Fun','Fun','🎤',"What's your go-to karaoke song?",9),
  _card('Fun','Fun','📺',"If you had to star in a reality TV show, which one?",10),
  _card('Fun','Fun','🏆',"What's the most ridiculous argument you've ever won?",11),
  _card('Fun','Fun','👽',"If aliens visited Earth, what would you be embarrassed to explain to them?",12),
  _card('Fun','Fun','😂',"If you were a meme, which one would you be?",13),
  _card('Fun','Fun','🛒',"What's the most random thing you've ever impulse-bought?",14),

  // ── Romantic ──────────────────────────────────────────────────────────────
  _card('Romantic','Romantic','🕯️',"What's your idea of the perfect date?",0),
  _card('Romantic','Romantic','💌',"What small gesture makes you feel most loved?",1),
  _card('Romantic','Romantic','👀',"Do you believe in love at first sight?",2),
  _card('Romantic','Romantic','🎶',"What song instantly puts you in a romantic mood?",3),
  _card('Romantic','Romantic','🎁',"What's the most thoughtful thing someone has ever done for you?",4),
  _card('Romantic','Romantic','🧭',"Would you rather have deep conversations or spontaneous adventures?",5),
  _card('Romantic','Romantic','💬',"What's the most meaningful compliment you've ever received?",6),
  _card('Romantic','Romantic','🌹',"What quality do you look for first in a partner?",7),
  _card('Romantic','Romantic','☔',"What's something you'd want to do together on a rainy Sunday?",8),
  _card('Romantic','Romantic','💞',"How do you show love — words, actions, or something else?",9),
  _card('Romantic','Romantic','🌅',"What's one experience you want to share with someone special?",10),
  _card('Romantic','Romantic','☀️',"What would your dream morning look like with someone you love?",11),
  _card('Romantic','Romantic','🗼',"What's the most romantic city you've ever visited?",12),
  _card('Romantic','Romantic','💑',"What's your version of a perfect weekend together?",13),
  _card('Romantic','Romantic','🎀',"What's one thing you'd do to surprise the person you love?",14),

  // ── Spicy ─────────────────────────────────────────────────────────────────
  _card('Spicy','Spicy','🔥',"What's one rule you love to break?",0),
  _card('Spicy','Spicy','😏',"What's the boldest thing you've done to get someone's attention?",1),
  _card('Spicy','Spicy','🤫',"Have you ever done something and immediately thought 'I can never tell anyone this'?",2),
  _card('Spicy','Spicy','📲',"Have you ever sent a text to the wrong person — what was it?",3),
  _card('Spicy','Spicy','⚡',"What's the most spontaneous thing you've ever done?",4),
  _card('Spicy','Spicy','😅',"Have you ever lied to get out of a date?",5),
  _card('Spicy','Spicy','👀',"What do you find attractive that you'd never admit out loud?",6),
  _card('Spicy','Spicy','😬',"What's the worst date you've ever been on?",7),
  _card('Spicy','Spicy','😤',"What's your biggest pet peeve in dating?",8),
  _card('Spicy','Spicy','🕵️',"Have you ever stalked someone's social media before a first date?",9),
  _card('Spicy','Spicy','🙊',"What's one thing you'd never tell someone on a first date?",10),
  _card('Spicy','Spicy','🎭',"What's the most creative excuse you've ever made?",11),
  _card('Spicy','Spicy','🚫',"What's your biggest turn-off that others find surprising?",12),
  _card('Spicy','Spicy','💅',"What's the pettiest thing you've done after a breakup?",13),
  _card('Spicy','Spicy','🙈',"What's your most 'oops' moment on a date?",14),

  // ── Would You Rather ──────────────────────────────────────────────────────
  _card('Would You Rather','WYR','💀',"Would you rather know the date you'll die or how you'll die?",0),
  _card('Would You Rather','WYR','🧠',"Would you rather have perfect memory or the ability to forget painful things?",1),
  _card('Would You Rather','WYR','⏱️',"Would you rather travel 100 years into the past or 100 years into the future?",2),
  _card('Would You Rather','WYR','📵',"Would you rather lose your phone or your wallet?",3),
  _card('Would You Rather','WYR','🤍',"Would you rather have one true love or 10 great friendships?",4),
  _card('Would You Rather','WYR','🎬',"Would you rather only speak in song lyrics or movie quotes?",5),
  _card('Would You Rather','WYR','🔮',"Would you rather read minds or be invisible?",6),
  _card('Would You Rather','WYR','🌆',"Would you rather live in a big city or the countryside?",7),
  _card('Would You Rather','WYR','☕',"Would you rather have no internet for a month or no coffee?",8),
  _card('Would You Rather','WYR','🎸',"Would you rather know all languages or play every instrument?",9),
  _card('Would You Rather','WYR','🚀',"Would you rather explore the ocean or outer space?",10),
  _card('Would You Rather','WYR','⏸️',"Would you rather have a rewind button or a pause button for your life?",11),
  _card('Would You Rather','WYR','🍽️',"Would you rather eat your favourite meal every day or never eat it again?",12),
  _card('Would You Rather','WYR','🏛️',"Would you rather be famous now but forgotten, or unknown now but remembered forever?",13),
  _card('Would You Rather','WYR','😴',"Would you rather have a photographic memory or only need 4 hours of sleep?",14),

  // ── Dreams ────────────────────────────────────────────────────────────────
  _card('Dreams','Dreams','🌟',"What does your dream life look like in 10 years?",0),
  _card('Dreams','Dreams','💸',"If money were no object, how would you spend your days?",1),
  _card('Dreams','Dreams','🌍',"What's one country you'd drop everything to live in?",2),
  _card('Dreams','Dreams','🎨',"What's something you've always wanted to create?",3),
  _card('Dreams','Dreams','⚡',"If you could master any skill overnight, what would it be?",4),
  _card('Dreams','Dreams','🗺️',"What's the most adventurous thing on your bucket list?",5),
  _card('Dreams','Dreams','🦸',"If you could wake up tomorrow with one new ability, what would it be?",6),
  _card('Dreams','Dreams','🏆',"What does success really look like to you?",7),
  _card('Dreams','Dreams','📝',"If you were to write a book, what would it be about?",8),
  _card('Dreams','Dreams','🌐',"What's one problem in the world you'd fix if you could?",9),
  _card('Dreams','Dreams','🕊️',"What legacy do you want to leave behind?",10),
  _card('Dreams','Dreams','💡',"What's one thing you'd do if you knew you couldn't fail?",11),
  _card('Dreams','Dreams','🤝',"If you could collaborate with anyone alive, who would it be?",12),
  _card('Dreams','Dreams','⚖️',"What would 'enough' look like in your life?",13),
  _card('Dreams','Dreams','🔭',"Where do you see yourself in 5 years — personally, not professionally?",14),

  // ── Curious ───────────────────────────────────────────────────────────────
  _card('Curious','Curious','🔬',"What's a topic you could talk about for hours without getting bored?",0),
  _card('Curious','Curious','🏛️',"If you could have dinner with any historical figure, who and why?",1),
  _card('Curious','Curious','🌌',"What do you think happens after we die?",2),
  _card('Curious','Curious','💬',"What's the best piece of advice you've ever received?",3),
  _card('Curious','Curious','📚',"What book or movie completely changed how you see the world?",4),
  _card('Curious','Curious','🙃',"What's something most people get wrong about you?",5),
  _card('Curious','Curious','🕵️',"What's a conspiracy theory you lowkey believe?",6),
  _card('Curious','Curious','💡',"What's the most fascinating thing you learned this year?",7),
  _card('Curious','Curious','🎓',"If you could go back and study anything, what would it be?",8),
  _card('Curious','Curious','🔄',"What habit has changed your life the most?",9),
  _card('Curious','Curious','🤯',"What do you know a lot about that surprises people?",10),
  _card('Curious','Curious','🤖',"What's one thing technology will change in the next 10 years?",11),
  _card('Curious','Curious','🧩',"What's the hardest concept you've ever had to wrap your head around?",12),
  _card('Curious','Curious','🔓',"What's one thing you unlearned as an adult?",13),
  _card('Curious','Curious','🚿',"What's your favourite shower thought?",14),

  // ── Random ────────────────────────────────────────────────────────────────
  _card('Random','Random','🦸',"If you could have any superpower but only on Tuesdays, what would it be?",0),
  _card('Random','Random','🎬',"What would your theme song be if your life were a movie?",1),
  _card('Random','Random','⛅',"If your personality were a weather pattern, what would it be?",2),
  _card('Random','Random','🤹',"What's the most random skill you have that nobody knows about?",3),
  _card('Random','Random','🎯',"If you were a board game, which one would you be?",4),
  _card('Random','Random','⭐',"If your pet wrote a Yelp review of you, what would it say?",5),
  _card('Random','Random','🧠',"What's the most random fact you know?",6),
  _card('Random','Random','🍳',"If you were a kitchen appliance, which would you be?",7),
  _card('Random','Random','🌀',"What fictional universe would you most want to live in?",8),
  _card('Random','Random','🌶️',"What's your hot take on something completely trivial?",9),
  _card('Random','Random','🍹',"If you were a cocktail, what would be in it?",10),
  _card('Random','Random','🦊',"What animal best represents your current mood?",11),
  _card('Random','Random','🎵',"If your morning routine were a genre of music, what would it be?",12),
  _card('Random','Random','🚩',"What's your strangest deal-breaker?",13),
  _card('Random','Random','💫',"What's the most niche thing you're weirdly passionate about?",14),
];

const FALLBACK_CATEGORIES = ['Deep', 'Fun', 'Romantic', 'Spicy', 'Would You Rather', 'Dreams', 'Curious', 'Random'];

function getFallbackCards(game: string, category: string): DbCard[] {
  return FALLBACK_CARDS.filter(c => c.game === game && c.category === category);
}

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

// AI_LINES kept as fallback only — live data comes from backend
const AI_LINES_FALLBACK = [
  `If travel were a language, we'd be fluent ✈️`,
  `I've been to 14 countries and none of them were as interesting as this conversation`,
  `Are you a great book? Because I can't stop thinking about your story 📚`,
  `I was going to play it cool, but your profile made that impossible 😅`,
  `My future self sent me a note — it said I had to talk to you`,
  `You must be a great destination — everyone wants to go there 🌍`,
  `Is your name Google Maps? Because you've got everything I've been searching for`,
  `They say the best adventures are unplanned — like meeting you 🛫`,
];

interface PickupCategoryMeta {
  category: string;
  emoji: string;
  color: string;
  desc: string;
  has_db_content: boolean;
}

interface PickupLineItem {
  id: string;
  category: string;
  line: string;
  emoji: string;
  sort_order: number;
}

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

// ─── Chat image with error fallback ──────────────────────────────────────────

function ChatImage({ uri, size }: { uri: string; size: number }) {
  const [errored, setErrored] = React.useState(false);

  // Reset whenever uri changes (optimistic file:// → CDN https:// after upload)
  React.useEffect(() => { setErrored(false); }, [uri]);

  if (errored) {
    return (
      <View style={{
        width: size, height: 72, borderRadius: 12,
        backgroundColor: '#1e1e1e',
        alignItems: 'center', justifyContent: 'center',
        flexDirection: 'row', gap: 8, paddingHorizontal: 16,
      }}>
        <Ionicons name="image-outline" size={18} color="#555" />
        <Text style={{ color: '#555', fontSize: 12, fontFamily: 'ProductSans-Regular' }}>
          Image unavailable
        </Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: 12, backgroundColor: '#1e1e1e' }}
      contentFit="cover"
      cachePolicy="memory-disk"
      transition={{ duration: 250, effect: 'cross-dissolve' }}
      recyclingKey={uri}
      onError={() => setErrored(true)}
    />
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

// Hardcoded bubble colors — same in both themes for consistency
const BUBBLE_ME_BG   = '#FFFFFF';   // white for sent
const BUBBLE_ME_TEXT = '#000000';   // black text on white
const BUBBLE_THEM_TEXT_DARK  = '#ffffff';
const BUBBLE_THEM_TEXT_LIGHT = '#000000';

// Category accent colors + emojis (matches backend CATEGORY_COLORS)
// Card bubble accent/emoji/bg — reuse the shared CATEGORY_* maps defined above
// (aliased here so bubble rendering stays readable)
const CAT_ACCENT = CATEGORY_ACCENT;
const CAT_EMOJI  = CATEGORY_EMOJI;
const CAT_BG     = CATEGORY_COLOR;

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
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#2a2a2a' }}
      contentFit="cover"
      cachePolicy="memory-disk"
      transition={{ duration: 200, effect: 'cross-dissolve' }}
      recyclingKey={uri}
    />
  );
}

// ─── MsgRow: layout tracker + jump-to-reply flash highlight ─────────────────

function MsgRow({
  id, highlightedId, msgLayoutsRef, children,
}: {
  id: string;
  highlightedId: string | null;
  msgLayoutsRef: React.MutableRefObject<Record<string, number>>;
  children: React.ReactNode;
}) {
  const flashAnim = useRef(new Animated.Value(0)).current;
  const isHighlighted = highlightedId === id;

  useEffect(() => {
    if (!isHighlighted) return;
    // Pop in quickly then fade out
    flashAnim.setValue(0);
    Animated.sequence([
      Animated.timing(flashAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.timing(flashAnim, { toValue: 0, duration: 900, delay: 300, useNativeDriver: true }),
    ]).start();
  }, [isHighlighted]);

  return (
    <View
      onLayout={e => { if (id) msgLayoutsRef.current[id] = e.nativeEvent.layout.y; }}
      style={{ position: 'relative' }}
    >
      {children}
      {/* Transparent overlay that flashes purple when this message is jumped to */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(124,58,237,0.18)',
          borderRadius: 16,
          opacity: flashAnim,
        }}
      />
    </View>
  );
}

// ─── Swipeable row (WhatsApp-style swipe-to-reply) ───────────────────────────
//
// Key design:
//  • onMoveShouldSetPanResponderCapture (top-down/capture phase) steals ANY
//    horizontal drag from inner Pressables — this is what makes VoiceBubble
//    (and any bubble with interactive children) work.
//  • onTouchStart on the wrapper View records t0 BEFORE the responder system
//    so we can detect "held too long → long-press intent, skip swipe".
//  • gestureEnabled=false on the screen means no iOS back-swipe competition.
// ─────────────────────────────────────────────────────────────────────────────

const SWIPE_CAP     = 70;
const REPLY_TRIGGER = 38;
const HOLD_MS       = 180;   // ms held before drag → treated as long-press, not swipe
const START_PX      = 4;     // min px in reply direction before animation begins

let _openAnim: Animated.Value | null = null;

// direction='right' → partner msg, drag right to reply
// direction='left'  → my msg,      drag left  to reply
function SwipeableRow({ onReply, direction = 'right', children }: {
  onReply?: () => void;
  direction?: 'left' | 'right';
  children: React.ReactNode;
}) {
  const tx       = useRef(new Animated.Value(0)).current;
  const active   = useRef(false);
  const notified = useRef(false);
  const t0       = useRef(0);  // set by onTouchStart (raw event, before responders)
  const isLeft   = direction === 'left';

  const reset = () => {
    active.current   = false;
    notified.current = false;
    Animated.spring(tx, { toValue: 0, useNativeDriver: true, tension: 200, friction: 18 }).start();
  };

  const iconOpacity = tx.interpolate({
    inputRange:  isLeft ? [-SWIPE_CAP, -20, 0] : [0, 20, SWIPE_CAP],
    outputRange: [1, 0.3, 0],
    extrapolate: 'clamp',
  });
  const iconScale = tx.interpolate({
    inputRange:  isLeft ? [-SWIPE_CAP, -REPLY_TRIGGER, 0] : [0, REPLY_TRIGGER, SWIPE_CAP],
    outputRange: [1.2, 1.0, 0.4],
    extrapolate: 'clamp',
  });

  // Helper: should we claim this gesture state?
  const _shouldClaim = (gs: { dx: number; dy: number }) => {
    if (Date.now() - t0.current > HOLD_MS) return false;       // held too long
    if (Math.abs(gs.dy) >= Math.abs(gs.dx) * 0.8) return false; // too vertical
    if (isLeft)  return gs.dx < -START_PX;
    return gs.dx > START_PX;
  };

  const pan = useRef(PanResponder.create({
    // Don't claim on touch-start — let inner Pressables handle taps normally.
    onStartShouldSetPanResponder:        () => false,
    onStartShouldSetPanResponderCapture: () => false,

    // ── Capture phase (top-down): fires BEFORE inner Pressables ──────────────
    // This is the key for VoiceBubble — steals the gesture from play/speed
    // buttons the moment a horizontal swipe is detected.
    onMoveShouldSetPanResponderCapture: (_, gs) => _shouldClaim(gs),

    // ── Bubble phase (bottom-up): fallback when no inner view claimed ─────────
    onMoveShouldSetPanResponder: (_, gs) => _shouldClaim(gs),

    onPanResponderGrant: () => {
      if (_openAnim && _openAnim !== tx) {
        Animated.spring(_openAnim, { toValue: 0, useNativeDriver: true, tension: 200, friction: 18 }).start();
      }
      _openAnim      = tx;
      active.current = true;   // already confirmed horizontal when granted via move
      notified.current = false;
    },

    onPanResponderMove: (_, gs) => {
      if (!active.current) return;
      if (isLeft && gs.dx < 0) {
        tx.setValue(Math.max(gs.dx * 0.7, -SWIPE_CAP));
        if (!notified.current && gs.dx < -REPLY_TRIGGER) {
          notified.current = true;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      } else if (!isLeft && gs.dx > 0) {
        tx.setValue(Math.min(gs.dx * 0.7, SWIPE_CAP));
        if (!notified.current && gs.dx > REPLY_TRIGGER) {
          notified.current = true;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }
    },

    onPanResponderRelease: (_, gs) => {
      const fired = isLeft ? gs.dx < -REPLY_TRIGGER : gs.dx > REPLY_TRIGGER;
      if (fired && active.current && onReply) onReply();
      _openAnim = null;
      reset();
    },

    onPanResponderTerminate: () => { _openAnim = null; reset(); },

    // While actively swiping never yield; otherwise let long-press Pressables win.
    onPanResponderTerminationRequest: () => !active.current,
  })).current;

  return (
    // onTouchStart is a raw event — fires before the responder system, so t0 is
    // always set accurately even when a Pressable child claims the gesture first.
    <View
      style={{ position: 'relative' }}
      onTouchStart={() => { t0.current = Date.now(); }}
    >
      {/* Reply icon — appears on the exposed side as the bubble slides */}
      <Animated.View style={[
        { position: 'absolute', top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', width: 36 },
        isLeft ? { right: 6 } : { left: 36 },
        { opacity: iconOpacity, transform: [{ scale: iconScale }] },
      ]}>
        <Ionicons name="return-down-forward-outline" size={22} color="#7c3aed" />
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX: tx }] }} {...pan.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

// ─── Voice caches (module-level, persist for the app session) ────────────────

const _audioUriCache    = new Map<string, string>();         // cdnUrl → localFileUri (memory)
const _audioDownloading = new Map<string, Promise<string>>(); // in-flight dedup
const _transcriptCache  = new Map<string, string>();         // cdnUrl → transcript text

// Permanent storage — not cleared by iOS like cacheDirectory
const VOICE_CACHE_DIR      = (FileSystem.documentDirectory ?? '') + 'voice_cache/';
const TRANSCRIPT_CACHE_FILE = (FileSystem.documentDirectory ?? '') + 'transcript_cache.json';

// ── Transcript disk persistence ───────────────────────────────────────────────
let _transcriptCacheLoaded = false;
async function ensureTranscriptCacheLoaded(): Promise<void> {
  if (_transcriptCacheLoaded) return;
  _transcriptCacheLoaded = true;
  try {
    const info = await FileSystem.getInfoAsync(TRANSCRIPT_CACHE_FILE);
    if (!info.exists) return;
    const raw  = await FileSystem.readAsStringAsync(TRANSCRIPT_CACHE_FILE);
    const data: Record<string, string> = JSON.parse(raw);
    for (const [k, v] of Object.entries(data)) _transcriptCache.set(k, v);
  } catch {}
}
async function persistTranscriptCache(): Promise<void> {
  try {
    const obj: Record<string, string> = {};
    _transcriptCache.forEach((v, k) => { obj[k] = v; });
    await FileSystem.writeAsStringAsync(TRANSCRIPT_CACHE_FILE, JSON.stringify(obj));
  } catch {}
}

async function getLocalAudioUri(cdnUrl: string): Promise<string> {
  // Local file URIs (own optimistic messages before CDN upload) — play directly
  if (!cdnUrl || cdnUrl.startsWith('file://')) return cdnUrl;

  // Memory hit — already resolved this session
  const memCached = _audioUriCache.get(cdnUrl);
  if (memCached) return memCached;

  // Deduplicate concurrent callers for the same URL
  const inflight = _audioDownloading.get(cdnUrl);
  if (inflight) return inflight;

  const work = (async (): Promise<string> => {
    try {
      await FileSystem.makeDirectoryAsync(VOICE_CACHE_DIR, { intermediates: true }).catch(() => {});

      const rawName = cdnUrl.split('?')[0].split('/').pop() ?? 'audio';
      const fileName = rawName.includes('.') ? rawName : rawName + '.m4a';
      const localPath = VOICE_CACHE_DIR + fileName;

      // Already on disk from a previous session — no re-download
      const info = await FileSystem.getInfoAsync(localPath);
      if (info.exists) {
        _audioUriCache.set(cdnUrl, localPath);
        return localPath;
      }

      const { uri } = await FileSystem.downloadAsync(cdnUrl, localPath);
      _audioUriCache.set(cdnUrl, uri);
      return uri;
    } catch {
      // Network/permission error — fall back to streaming from CDN
      return cdnUrl;
    } finally {
      _audioDownloading.delete(cdnUrl);
    }
  })();

  _audioDownloading.set(cdnUrl, work);
  return work;
}

// ─── VoiceBubble ─────────────────────────────────────────────────────────────

function VoiceBubble({ msg, colors, onLongPress }: { msg: Msg; colors: any; onLongPress?: () => void }) {
  const isMe       = msg.from === 'me';
  const bgColor    = isMe ? BUBBLE_ME_BG   : colors.surface;
  const fgColor    = isMe ? BUBBLE_ME_TEXT : colors.text;
  const mutedColor = isMe ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.5)';
  const pillBg     = isMe ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.18)';

  const { token } = useAuth();

  const soundRef   = useRef<any>(null);
  const subsRef    = useRef<any[]>([]);
  // Resolved local file path — set as soon as download completes
  const localUriRef = useRef<string | null>(
    msg.audioUrl?.startsWith('file://') ? msg.audioUrl : null
  );

  const [pStatus, setPStatus] = useState<{
    isLoaded: boolean; currentTime: number; duration: number; didJustFinish: boolean;
  }>({ isLoaded: false, currentTime: 0, duration: 0, didJustFinish: false });

  const [playing,      setPlaying]      = useState(false);
  const [speed,        setSpeed]        = useState<1 | 1.5 | 2>(1);
  const [transcribing, setTranscribing] = useState(false);
  const [transcript,   setTranscript]   = useState<string | null>(null);
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!transcribing) { shimmerAnim.stopAnimation(); shimmerAnim.setValue(0); return; }
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  }, [transcribing]);

  // expo-audio status — currentTime/duration already in seconds
  const onPlaybackStatus = useCallback((s: any) => {
    setPStatus({
      isLoaded: true,
      currentTime: s.currentTime ?? 0,
      duration: s.duration ?? 0,
      didJustFinish: false,
    });
  }, []);

  // ── Download the file to disk as soon as the bubble appears ─────────────────
  // Only downloads once (getLocalAudioUri deduplicates & checks disk cache).
  // No AudioPlayer is created here — players are expensive; we create one on tap.
  useEffect(() => {
    if (!msg.audioUrl || msg.audioUrl.startsWith('file://')) return;
    let cancelled = false;
    getLocalAudioUri(msg.audioUrl).then(uri => {
      if (!cancelled) localUriRef.current = uri;
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [msg.audioUrl]);

  // ── Tear down the player when the bubble unmounts ────────────────────────────
  useEffect(() => {
    return () => {
      subsRef.current.forEach(s => s.remove());
      subsRef.current = [];
      soundRef.current?.remove();
      soundRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (pStatus.didJustFinish) {
      setPlaying(false);
      soundRef.current?.seekTo(0);
    }
  }, [pStatus.didJustFinish]);

  const totalSec = msg.audioDuration ?? 0;
  const pos     = pStatus.duration > 0 ? pStatus.currentTime / pStatus.duration : 0;
  const elapsed = pStatus.currentTime;

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const fullStop = () => {
    setPlaying(false);
    soundRef.current?.pause();
    soundRef.current?.seekTo(0);
  };

  const toggle = async () => {
    if (playing) {
      setPlaying(false);
      soundRef.current?.pause();
      return;
    }
    // Ensure the audio session is in playback mode (not recording mode)
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    try {
      // Player already exists from a previous tap — just resume
      if (soundRef.current) {
        setPlaying(true);
        soundRef.current.playbackRate = speed;
        soundRef.current.play();
        return;
      }
      // First tap — use cached local file if download finished, otherwise await it
      if (!msg.audioUrl) return;
      setPlaying(true);
      const uri = localUriRef.current ?? await getLocalAudioUri(msg.audioUrl);
      localUriRef.current = uri; // cache for next time
      const player = createAudioPlayer({ uri });
      subsRef.current = [
        player.addListener('playbackStatusUpdate', onPlaybackStatus),
        player.addListener('playToEnd', () =>
          setPStatus(prev => ({ ...prev, didJustFinish: true }))
        ),
      ];
      soundRef.current = player;
      player.playbackRate = speed;
      player.play();
    } catch {
      setPlaying(false);
    }
  };

  const cycleSpeed = () => {
    const next: 1 | 1.5 | 2 = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(next);
    if (soundRef.current) soundRef.current.playbackRate = next;
  };

  const handleTranscribe = async () => {
    if (transcribing || !msg.audioUrl) return;
    // Tap again to toggle off the shown transcript
    if (transcript) { setTranscript(null); return; }

    // Load disk cache on first tap (lazy) then check memory cache
    await ensureTranscriptCacheLoaded();
    const cached = _transcriptCache.get(msg.audioUrl);
    if (cached) { setTranscript(cached); return; }

    setTranscribing(true);
    try {
      const localUri = await getLocalAudioUri(msg.audioUrl).catch(() => null);
      let text = '';

      if (localUri) {
        const form = new FormData();
        form.append('file', { uri: localUri, name: 'recording.m4a', type: 'audio/m4a' } as any);
        const res = await fetch(`${API_V1}/upload/transcribe`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
        const data = await res.json();
        text = data.text?.trim() ?? '';
      } else {
        const res = await fetch(`${API_V1}/upload/transcribe-url`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: msg.audioUrl }),
        });
        const data = await res.json();
        text = data.text?.trim() ?? '';
      }

      const result = text || '(no speech detected)';
      _transcriptCache.set(msg.audioUrl, result);
      setTranscript(result);
      persistTranscriptCache(); // fire-and-forget — write to disk in background
    } catch {
      Alert.alert('Transcription failed', 'Could not transcribe voice message.');
    } finally {
      setTranscribing(false);
    }
  };

  // 32 deterministic bars seeded from audioUrl — unique waveform per message
  const BARS = useMemo(() => {
    const seed = msg.audioUrl ?? msg.id ?? 'default';
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) & 0xffffffff;
    return Array.from({ length: 32 }, (_, i) => {
      h = (h * 1664525 + 1013904223) & 0xffffffff;
      const base     = Math.abs(h) / 0x7fffffff;
      const envelope = 0.6 + 0.4 * Math.sin((i / 31) * Math.PI);
      return 0.1 + base * 0.9 * envelope;
    });
  }, [msg.audioUrl, msg.id]);

  const speedLabel = speed === 1.5 ? '1.5×' : speed === 2 ? '2×' : '1×';

  return (
    <Pressable onLongPress={onLongPress} delayLongPress={350}>
    <Squircle
      style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem, { minWidth: 240 }]}
      cornerRadius={22} cornerSmoothing={1}
      fillColor={bgColor}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 }}>

        {/* Play / Pause button */}
        <Pressable onPress={toggle} hitSlop={10}>
          <View style={{
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: isMe ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.15)',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name={playing ? 'pause' : 'play'} size={18} color={fgColor} />
          </View>
        </Pressable>

        {/* Waveform column */}
        <View style={{ flex: 1, gap: 4 }}>
          {/* Waveform bars + speed pill on same row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 0, height: 24 }}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 1.5 }}>
              {BARS.map((h, i) => {
                const filled = pos > 0 && i / BARS.length < pos;
                return (
                  <View key={i} style={{
                    width: 2.5,
                    height: Math.max(3, Math.round(h * 22)),
                    borderRadius: 1.5,
                    backgroundColor: filled
                      ? fgColor
                      : isMe ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.28)',
                  }} />
                );
              })}
            </View>
            {/* Speed pill — right of waveform */}
            <Pressable onPress={cycleSpeed} hitSlop={8} style={{ marginLeft: 8 }}>
              <View style={{
                paddingHorizontal: 5, paddingVertical: 3, borderRadius: 6,
                backgroundColor: speed !== 1 ? fgColor : pillBg,
              }}>
                <Text style={{
                  fontSize: 9, fontFamily: 'ProductSans-Bold',
                  color: speed !== 1 ? bgColor : fgColor,
                }}>
                  {speedLabel}
                </Text>
              </View>
            </Pressable>
          </View>

          {/* Time + Aa badge + timestamp */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 11, fontFamily: 'ProductSans-Regular', color: mutedColor }}>
              {playing ? fmt(elapsed) : fmt(totalSec)}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Pressable onPress={handleTranscribe} hitSlop={6} disabled={transcribing}>
                <Animated.View style={{
                  paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6,
                  backgroundColor: transcript ? fgColor : pillBg,
                  opacity: transcribing
                    ? shimmerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] })
                    : 1,
                }}>
                  <Text style={{
                    fontSize: 9, fontFamily: 'ProductSans-Bold',
                    color: transcript ? bgColor : fgColor,
                  }}>Aa</Text>
                </Animated.View>
              </Pressable>
              <Text style={{ fontSize: 10, fontFamily: 'ProductSans-Regular', color: mutedColor }}>{msg.time}</Text>
              {isMe && <MsgTicks status={msg.status} />}
            </View>
          </View>

          {/* Transcript revealed below waveform */}
          {transcript && (
            <Text style={{
              fontSize: 12, fontFamily: 'ProductSans-Regular',
              color: fgColor, marginTop: 2, lineHeight: 17,
            }}>
              {transcript}
            </Text>
          )}
        </View>
      </View>
    </Squircle>
    </Pressable>
  );
}

// ─── Reaction pill — straddles the bottom corner of a bubble (WhatsApp-style) ─
// Uses negative marginTop so the pill overlaps the bubble's bottom edge without
// any overflow-clipping issues. Aligns to the inner edge of the bubble.

function ReactionPills({ reactions, myId, from, colors }: {
  reactions: MsgReaction[];
  myId: string;
  from: 'me' | 'them';
  colors: any;
}) {
  if (!reactions || reactions.length === 0) return null;
  const grouped: Record<string, { count: number; mine: boolean }> = {};
  for (const r of reactions) {
    if (!grouped[r.emoji]) grouped[r.emoji] = { count: 0, mine: false };
    grouped[r.emoji].count++;
    if (r.user_id === myId) grouped[r.emoji].mine = true;
  }
  const entries = Object.entries(grouped);

  return (
    <View
      style={{
        // Pull up by ~half the pill height so top half overlaps the bubble edge
        marginTop: -11,
        marginBottom: 4,
        // Inner-edge alignment: 'me' bubbles are right-side → left is inner edge
        alignSelf: from === 'me' ? 'flex-start' : 'flex-end',
        marginLeft: from === 'me' ? 10 : 0,
        marginRight: from === 'them' ? 10 : 0,
        flexDirection: 'row',
        gap: 3,
        zIndex: 20,
      }}
    >
      {entries.map(([emoji, { count, mine }]) => (
        <View
          key={emoji}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            // Slightly opaque surface so the pill "pops" off the bubble
            backgroundColor: mine ? 'rgba(99,102,241,0.18)' : colors.surface,
            borderRadius: 14,
            paddingHorizontal: count > 1 ? 8 : 7,
            paddingVertical: 4,
            borderWidth: mine ? 1.2 : StyleSheet.hairlineWidth,
            borderColor: mine ? '#6366f1' : colors.border,
            gap: 3,
            // Shadow gives the "card on top of bubble" depth
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.22,
            shadowRadius: 4,
            elevation: 4,
          }}
        >
          <Text style={{ fontSize: 14 }}>{emoji}</Text>
          {count > 1 && (
            <Text style={{ fontSize: 11, fontFamily: 'ProductSans-Bold', color: mine ? '#6366f1' : colors.textSecondary }}>
              {count}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

// ─── Message long-press context menu ─────────────────────────────────────────

const QUICK_EMOJIS = ['❤️', '😂', '😮', '😢', '👍', '🔥', '🙏', '💯'];

function MsgContextMenu({ msg, myId, colors, recentEmojis, onClose, onReact, onReply, onCopy, onEdit, onSaveImage, onUnsend, onInfo, onReport }: {
  msg: Msg; myId: string; colors: any; recentEmojis: string[];
  onClose: () => void; onReact: (emoji: string) => void; onReply: () => void;
  onCopy: () => void; onEdit: () => void; onSaveImage: () => void;
  onUnsend: () => void; onInfo: () => void; onReport: () => void;
}) {
  const isMe    = msg.from === 'me';
  const hasText = (msg.text?.trim().length ?? 0) > 0 && !msg.imageUrl;
  const canEdit = isMe && hasText && !msg.isCard && !msg.isGame && !msg.isTod && !msg.audioUrl && !msg.isCall;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 180, friction: 22 }),
    ]).start();
  }, []);

  const close = (cb?: () => void) => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0, duration: 140, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 30, duration: 140, useNativeDriver: true }),
    ]).start(() => { onClose(); cb?.(); });
  };

  const emojiRow = [...new Set([...recentEmojis.slice(0, 4), ...QUICK_EMOJIS])].slice(0, 8);
  const myReactions = new Set((msg.reactions ?? []).filter(r => r.user_id === myId).map(r => r.emoji));

  // Build action list — only what's relevant for this message type
  const actions: Array<{ icon: string; label: string; danger?: boolean; onPress: () => void }> = [];
  if (msg.editedAt) {
    // "edited today at HH:MM" header is rendered separately — no action needed
  }
  actions.push({ icon: 'arrow-undo-outline', label: 'Reply', onPress: () => close(onReply) });
  if (hasText) actions.push({ icon: 'copy-outline', label: 'Copy', onPress: () => close(onCopy) });
  if (canEdit) actions.push({ icon: 'pencil-outline', label: 'Edit', onPress: () => close(onEdit) });
  if (msg.imageUrl) actions.push({ icon: 'download-outline', label: 'Save Image', onPress: () => close(onSaveImage) });
  actions.push({ icon: 'time-outline', label: 'Info', onPress: () => close(onInfo) });
  if (isMe && !msg.id.startsWith('opt-')) {
    actions.push({ icon: 'trash-outline', label: 'Delete', danger: true, onPress: () => close(onUnsend) });
  }
  if (!isMe) {
    actions.push({ icon: 'flag-outline', label: 'Report', danger: true, onPress: () => close(onReport) });
  }

  const menuBg = colors.surface;
  const divider = colors.border;

  return (
    <Modal transparent animationType="none" statusBarTranslucent onRequestClose={() => close()}>
      {/* Dim backdrop — tappable to dismiss */}
      <Pressable style={StyleSheet.absoluteFillObject} onPress={() => close()}>
        <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.5)', opacity: fadeAnim }]} />
      </Pressable>

      <Animated.View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, transform: [{ translateY: slideAnim }] }}>
        {/* Emoji reaction strip */}
        <Squircle
          style={{ marginHorizontal: 12, marginBottom: 8, overflow: 'hidden' }}
          cornerRadius={22} cornerSmoothing={1}
          fillColor={menuBg}
          strokeColor={divider} strokeWidth={StyleSheet.hairlineWidth}
        >
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 8, paddingVertical: 10, gap: 4 }}>
            {emojiRow.map(emoji => {
              const active = myReactions.has(emoji);
              return (
                <Pressable
                  key={emoji}
                  onPress={() => { onReact(emoji); close(); }}
                  style={({ pressed }) => ({
                    width: 46, height: 46, borderRadius: 23,
                    backgroundColor: active
                      ? 'rgba(99,102,241,0.2)'
                      : pressed ? colors.surface2 : 'transparent',
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: active ? 1.5 : 0, borderColor: '#6366f1',
                    transform: [{ scale: pressed ? 1.15 : 1 }],
                  })}
                >
                  <Text style={{ fontSize: 26 }}>{emoji}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Squircle>

        {/* Action list */}
        <Squircle
          style={{ marginHorizontal: 12, marginBottom: 28, overflow: 'hidden' }}
          cornerRadius={22} cornerSmoothing={1}
          fillColor={menuBg}
          strokeColor={divider} strokeWidth={StyleSheet.hairlineWidth}
        >
          {/* "Edited" header line if applicable */}
          {msg.editedAt && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: divider }}>
              <Ionicons name="create-outline" size={15} color={colors.textSecondary} />
              <Text style={{ fontSize: 13, fontFamily: 'ProductSans-Regular', color: colors.textSecondary }}>
                {`edited ${_formatTime(msg.editedAt)}`}
              </Text>
            </View>
          )}

          {actions.map((action, i) => (
            <Pressable
              key={action.label}
              onPress={action.onPress}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: 16,
                paddingVertical: 14, paddingHorizontal: 18,
                backgroundColor: pressed ? colors.surface2 : 'transparent',
                borderTopWidth: (i === 0 && !msg.editedAt) ? 0 : StyleSheet.hairlineWidth,
                borderTopColor: divider,
              })}
            >
              <Ionicons
                name={action.icon as any}
                size={20}
                color={action.danger ? '#ef4444' : colors.text}
              />
              <Text style={{
                fontSize: 16,
                fontFamily: 'ProductSans-Regular',
                color: action.danger ? '#ef4444' : colors.text,
                flex: 1,
              }}>
                {action.label}
              </Text>
            </Pressable>
          ))}
        </Squircle>
      </Animated.View>
    </Modal>
  );
}

// ─── Message info bottom sheet (uses local data only — no network call) ───────

function MsgInfoSheet({ msg, myId, colors, onClose }: {
  msg: Msg; myId: string; colors: any; onClose: () => void;
}) {
  // Use only locally available data — no API call, no hang
  const fmt = (iso: string | null | undefined) => {
    if (!iso) return null;
    const d = new Date(iso);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Today at ${time}`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ` at ${time}`;
  };

  const rows: Array<{ icon: string; label: string; value: string | null }> = [
    { icon: 'paper-plane-outline',    label: 'Sent',    value: fmt(msg.rawTime) },
    { icon: 'create-outline',         label: 'Edited',  value: msg.editedAt ? fmt(msg.editedAt) : null },
    { icon: 'checkmark-done-outline', label: 'Seen',    value: msg.status === 'read' ? (msg.readAt ? fmt(msg.readAt) : 'Yes') : 'Not yet' },
  ].filter(r => r.value !== null) as Array<{ icon: string; label: string; value: string }>;

  // Reaction summary
  const grouped: Record<string, { count: number; mine: boolean }> = {};
  for (const r of msg.reactions ?? []) {
    if (!grouped[r.emoji]) grouped[r.emoji] = { count: 0, mine: false };
    grouped[r.emoji].count++;
    if (r.user_id === myId) grouped[r.emoji].mine = true;
  }
  const reactionEntries = Object.entries(grouped);

  return (
    <Modal transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.45)' }]} onPress={onClose} />
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
        <Squircle
          style={{ margin: 12, marginBottom: 36, overflow: 'hidden' }}
          cornerRadius={26} cornerSmoothing={1}
          fillColor={colors.surface}
          strokeColor={colors.border} strokeWidth={StyleSheet.hairlineWidth}
        >
          {/* Handle */}
          <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 2 }}>
            <View style={{ width: 34, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
          </View>

          <Text style={{ fontSize: 15, fontFamily: 'ProductSans-Bold', color: colors.text, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 4 }}>
            Message Info
          </Text>

          {rows.map((row, i) => (
            <View key={row.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13, paddingHorizontal: 18, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
              <Ionicons name={row.icon as any} size={18} color={colors.textSecondary} />
              <Text style={{ fontSize: 14, fontFamily: 'ProductSans-Medium', color: colors.textSecondary, width: 52 }}>{row.label}</Text>
              <Text style={{ fontSize: 14, fontFamily: 'ProductSans-Regular', color: colors.text, flex: 1 }}>{row.value}</Text>
            </View>
          ))}

          {reactionEntries.length > 0 && (
            <View style={{ paddingHorizontal: 18, paddingTop: 12, paddingBottom: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, gap: 10 }}>
              <Text style={{ fontSize: 12, fontFamily: 'ProductSans-Bold', color: colors.textSecondary, letterSpacing: 0.8 }}>REACTIONS</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {reactionEntries.map(([emoji, { count, mine }]) => (
                  <Squircle
                    key={emoji}
                    cornerRadius={14} cornerSmoothing={1}
                    fillColor={mine ? 'rgba(99,102,241,0.15)' : colors.surface2}
                    strokeColor={mine ? '#6366f1' : 'transparent'}
                    strokeWidth={1}
                    style={{ paddingHorizontal: 12, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                  >
                    <Text style={{ fontSize: 18 }}>{emoji}</Text>
                    <Text style={{ fontSize: 13, fontFamily: 'ProductSans-Bold', color: mine ? '#6366f1' : colors.textSecondary }}>{count}</Text>
                  </Squircle>
                ))}
              </View>
            </View>
          )}
        </Squircle>
      </View>
    </Modal>
  );
}

// ─── Bubble ───────────────────────────────────────────────────────────────────

function Bubble({ msg, colors, myId, onAnswer, answeredCards, myAvatar, partnerAvatar, isLastInGroup, onReply, onJumpToReply, onUnsend, onLongPress }: {
  msg: Msg; colors: any; myId?: string;
  onAnswer?: (q: string) => void;
  answeredCards?: Set<string>;
  myAvatar?: string;
  partnerAvatar?: string;
  isLastInGroup?: boolean;
  onReply?: (msg: Msg) => void;
  onJumpToReply?: (id: string) => void;
  onUnsend?: (msg: Msg) => void;
  onLongPress?: (msg: Msg) => void;
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

  const handleLongPress = React.useCallback(() => {
    onLongPress?.(msg);
  }, [msg, onLongPress]);

  if (msg.isAnswer && msg.answerTo) {
    const bubble = (
      <Squircle
        style={[styles.answerBubble, { maxWidth: W * 0.72 }]}
        cornerRadius={20} cornerSmoothing={1}
        fillColor={isMe ? BUBBLE_ME_BG : colors.surface}
        strokeColor={isMe ? 'transparent' : colors.border}
        strokeWidth={StyleSheet.hairlineWidth}
      >
        <Pressable
          onPress={() => msg.replyToId && onJumpToReply?.(msg.replyToId)}
          style={{ opacity: 1 }}
        >
          <View style={[styles.answerContext, {
            backgroundColor: isMe ? 'rgba(0,0,0,0.06)' : colors.surface2,
            borderLeftColor: isMe ? 'rgba(0,0,0,0.25)' : '#7c3aed',
          }]}>
            <Text style={[styles.answerContextText, { color: isMe ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.55)' }]} numberOfLines={2}>
              {msg.answerTo}
            </Text>
          </View>
        </Pressable>
        <View style={styles.bubbleTextRow}>
          <Text style={[styles.bubbleText, { color: isMe ? BUBBLE_ME_TEXT : themText, flexShrink: 1 }]}>{msg.text}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 1 }}>
            <Text style={[styles.bubbleTimeInline, { color: isMe ? 'rgba(0,0,0,0.38)' : 'rgba(255,255,255,0.45)' }]}>{msg.time}</Text>
            {isMe && <MsgTicks status={msg.status} />}
          </View>
        </View>
      </Squircle>
    );

    return (
      <SwipeableRow onReply={() => onReply?.(msg)} direction={isMe ? 'left' : 'right'}>
        <View style={[styles.bubbleRow, isMe ? styles.bubbleRowMe : styles.bubbleRowThem]}>
          {!isMe && avatarSlot}
          <Pressable onLongPress={handleLongPress} delayLongPress={350}>
            <View>
              {bubble}
              <ReactionPills reactions={msg.reactions ?? []} myId={myId ?? ''} from={msg.from} colors={colors} />
            </View>
          </Pressable>
          {isMe && avatarSlot}
        </View>
      </SwipeableRow>
    );
  }

  if (msg.isCard) {
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
        <Text style={{ fontSize: 11, fontFamily: 'ProductSans-Bold', color: 'rgba(255,255,255,0.45)', marginBottom: 2 }}>
          {isMe ? 'You sent a card' : 'Question card'}
        </Text>
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
      <SwipeableRow onReply={() => onReply?.(msg)} direction={isMe ? 'left' : 'right'}>
        <View style={[styles.bubbleRow, isMe ? styles.bubbleRowMe : styles.bubbleRowThem]}>
          {!isMe && avatarSlot}
          <Pressable onLongPress={handleLongPress} delayLongPress={350}>
            <View>
              {bubble}
              <ReactionPills reactions={msg.reactions ?? []} myId={myId ?? ''} from={msg.from} colors={colors} />
            </View>
          </Pressable>
          {isMe && avatarSlot}
        </View>
      </SwipeableRow>
    );
  }

  // Standard text bubble
  const bubble = (
    <Squircle
      style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}
      cornerRadius={22} cornerSmoothing={1}
      fillColor={isMe ? BUBBLE_ME_BG : colors.surface}
    >
      {msg.imageUrl ? (
        <View style={{ gap: 6 }}>
          <ChatImage key={msg.imageUrl} uri={msg.imageUrl} size={Math.round(W * 0.55)} />
          {msg.text ? (
            <Text style={[styles.bubbleText, { color: isMe ? BUBBLE_ME_TEXT : themText }]}>{msg.text}</Text>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 1, alignSelf: 'flex-end' }}>
            <Text style={[styles.bubbleTimeInline, { color: isMe ? 'rgba(0,0,0,0.38)' : 'rgba(255,255,255,0.45)' }]}>{msg.time}</Text>
            {isMe && <MsgTicks status={msg.status} />}
          </View>
        </View>
      ) : (
        <View style={styles.bubbleTextRow}>
          <Text style={[styles.bubbleText, { color: isMe ? BUBBLE_ME_TEXT : themText, flexShrink: 1 }]}>
            {msg.text}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 1 }}>
            <Text style={[styles.bubbleTimeInline, { color: isMe ? 'rgba(0,0,0,0.38)' : 'rgba(255,255,255,0.45)' }]}>
              {msg.time}
            </Text>
            {isMe && <MsgTicks status={msg.status} />}
          </View>
        </View>
      )}
    </Squircle>
  );

  return (
    <SwipeableRow onReply={() => onReply?.(msg)} direction={isMe ? 'left' : 'right'}>
      <View style={[styles.bubbleRow, isMe ? styles.bubbleRowMe : styles.bubbleRowThem]}>
        {!isMe && avatarSlot}
        <Pressable onLongPress={handleLongPress} delayLongPress={350}>
          <View>
            {bubble}
            {msg.editedAt && (
              <Text style={{ fontSize: 10, color: colors.textTertiary, fontFamily: 'ProductSans-Regular', marginTop: 2, marginLeft: 4 }}>
                edited
              </Text>
            )}
            <ReactionPills reactions={msg.reactions ?? []} myId={myId ?? ''} from={msg.from} colors={colors} />
          </View>
        </Pressable>
        {isMe && avatarSlot}
      </View>
    </SwipeableRow>
  );
}

// ─── AI Pickup Lines Panel ────────────────────────────────────────────────────

function AiPanel({ colors, matchName, onSelect, onClose, token }: {
  colors: any; matchName: string;
  onSelect: (t: string) => void; onClose: () => void;
  token?: string;
}) {
  const slideY = useRef(new Animated.Value(600)).current;

  const [mode,           setMode]           = useState<'browse' | 'ai'>('browse');
  const [categories,     setCategories]     = useState<PickupCategoryMeta[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('Classic');
  const [lines,          setLines]          = useState<PickupLineItem[]>([]);
  const [loadingCats,    setLoadingCats]    = useState(true);
  const [loadingLines,   setLoadingLines]   = useState(false);
  const [aiLines,        setAiLines]        = useState<string[]>([]);
  const [aiLoading,      setAiLoading]      = useState(false);
  const [customPrompt,   setCustomPrompt]   = useState('');
  const [aiCategory,     setAiCategory]     = useState<string>('Classic');

  useEffect(() => {
    Animated.spring(slideY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 260 }).start();
  }, []);

  // Load categories
  useEffect(() => {
    if (!token) {
      setLoadingCats(false);
      return;
    }
    apiFetch<PickupCategoryMeta[]>('/pickup-lines/categories', { token })
      .then(cats => {
        setCategories(cats);
        if (cats.length > 0) setActiveCategory(cats[0].category);
      })
      .catch(() => {})
      .finally(() => setLoadingCats(false));
  }, [token]);

  // Load lines when category changes
  useEffect(() => {
    if (!token) {
      const fallback: PickupLineItem[] = AI_LINES_FALLBACK.map((l, i) => ({
        id: `fallback-${i}`, category: 'Classic', line: l, emoji: '✨', sort_order: i,
      }));
      setLines(fallback);
      return;
    }
    setLoadingLines(true);
    apiFetch<PickupLineItem[]>(`/pickup-lines?category=${encodeURIComponent(activeCategory)}`, { token })
      .then(setLines)
      .catch(() => {})
      .finally(() => setLoadingLines(false));
  }, [activeCategory, token]);

  const dismiss = (cb?: () => void) =>
    Animated.timing(slideY, { toValue: 600, duration: 200, useNativeDriver: true }).start(cb);

  const generateAiLines = async () => {
    setAiLoading(true);
    setAiLines([]);
    try {
      if (!token) throw new Error('no token');
      const res = await apiFetch<{ lines: string[] }>('/pickup-lines/generate', {
        token,
        method: 'POST',
        body: JSON.stringify({
          category: aiCategory,
          custom_prompt: customPrompt.trim(),
          match_name: matchName,
        }),
      });
      setAiLines(res.lines);
    } catch {
      setAiLines(AI_LINES_FALLBACK.slice(0, 5));
    } finally {
      setAiLoading(false);
    }
  };

  const AI_FALLBACK_CATS = [
    { category: 'Classic', emoji: '✨' },
    { category: 'Cheesy',  emoji: '🧀' },
    { category: 'Romantic',emoji: '💕' },
    { category: 'Funny',   emoji: '😂' },
    { category: 'Deep',    emoji: '🌊' },
    { category: 'Smooth',  emoji: '😏' },
  ];
  const displayCats = categories.length > 0 ? categories : AI_FALLBACK_CATS;

  const CategoryPills = ({ active, onSelect: onCatSelect }: { active: string; onSelect: (c: string) => void }) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.aiCategoryScroll}>
      {displayCats.map(cat => {
        const isActive = active === cat.category;
        return (
          <Pressable key={cat.category} onPress={() => onCatSelect(cat.category)}
            style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
            <Squircle
              style={styles.aiCategoryPill}
              cornerRadius={20} cornerSmoothing={1}
              fillColor={isActive ? colors.text : 'transparent'}
              strokeColor={isActive ? colors.text : colors.border}
              strokeWidth={StyleSheet.hairlineWidth}
            >
              {cat.emoji ? (
                <Text style={{ fontSize: 13 }}>{cat.emoji}</Text>
              ) : null}
              <Text style={[styles.aiCategoryPillText, { color: isActive ? colors.bg : colors.text }]}>
                {cat.category}
              </Text>
            </Squircle>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  const activeEmoji = displayCats.find(c => c.category === activeCategory)?.emoji ?? '✨';

  const LineRow = ({ text, onUse }: { text: string; onUse: () => void }) => (
    <Pressable onPress={onUse} style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}>
      <Squircle
        style={styles.aiLineItem}
        cornerRadius={18} cornerSmoothing={1}
        fillColor={colors.surface2}
        strokeColor={colors.border}
        strokeWidth={StyleSheet.hairlineWidth}
      >
        <Text style={{ fontSize: 18, marginRight: 2 }}>{activeEmoji}</Text>
        <Text style={[styles.aiLineText, { color: colors.text }]}>{text}</Text>
        <Squircle style={styles.aiLineUse} cornerRadius={13} cornerSmoothing={1} fillColor={colors.text}>
          <Ionicons name="arrow-up" size={13} color={colors.bg} />
        </Squircle>
      </Squircle>
    </Pressable>
  );

  const MAX_PANEL_H = SCREEN_H * 0.88;
  const LIST_MAX_H  = SCREEN_H * 0.55;

  return (
    <Pressable
      style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end' }]}
      onPress={() => dismiss(onClose)}
    >
      <Animated.View
        style={[
          {
            maxHeight: MAX_PANEL_H,
            backgroundColor: colors.surface,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOpacity: 0.28,
            shadowRadius: 32,
            shadowOffset: { width: 0, height: -6 },
            elevation: 24,
          },
          { transform: [{ translateY: slideY }] },
        ]}
        onStartShouldSetResponder={() => true}
      >
        {/* Handle */}
        <View style={[styles.panelHandle, { backgroundColor: colors.border }]} />

        {/* Header — compact single row */}
        <View style={styles.aiPanelHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.aiPanelTitle, { color: colors.text }]}>AI Pickup Lines</Text>
            <Text style={[styles.panelSub, { color: colors.textSecondary }]}>
              For {matchName} · tap to send
            </Text>
          </View>
          <Pressable onPress={() => dismiss(onClose)} hitSlop={10}>
            <Squircle style={styles.panelCloseBtn} cornerRadius={10} cornerSmoothing={1} fillColor={colors.surface2}>
              <Ionicons name="close" size={16} color={colors.text} />
            </Squircle>
          </Pressable>
        </View>

        {/* Mode toggle */}
        <View style={[styles.aiModeToggle, { backgroundColor: colors.surface2 }]}>
          <Pressable
            style={[styles.aiModeBtn, mode === 'browse' && { backgroundColor: colors.surface }]}
            onPress={() => setMode('browse')}
          >
            <Ionicons name="list" size={13} color={mode === 'browse' ? colors.text : colors.textSecondary} />
            <Text style={[styles.aiModeBtnText, { color: mode === 'browse' ? colors.text : colors.textSecondary }]}>
              Browse
            </Text>
          </Pressable>
          <Pressable
            style={[styles.aiModeBtn, mode === 'ai' && { backgroundColor: colors.surface }]}
            onPress={() => setMode('ai')}
          >
            <Ionicons name="sparkles" size={13} color={mode === 'ai' ? colors.text : colors.textSecondary} />
            <Text style={[styles.aiModeBtnText, { color: mode === 'ai' ? colors.text : colors.textSecondary }]}>
              AI Generate
            </Text>
          </Pressable>
        </View>

        {/* ── Browse mode ── */}
        {mode === 'browse' && (
          <>
            {!loadingCats && (
              <CategoryPills active={activeCategory} onSelect={setActiveCategory} />
            )}
            {(loadingLines || loadingCats) ? (
              <ShimmerLines colors={colors} count={5} />
            ) : (
              <ScrollView
                style={{ maxHeight: LIST_MAX_H }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.aiLinesList}
              >
                {lines.map(item => (
                  <LineRow key={item.id} text={item.line} onUse={() => dismiss(() => onSelect(item.line))} />
                ))}
              </ScrollView>
            )}
          </>
        )}

        {/* ── AI Generate mode ── */}
        {mode === 'ai' && (
          <ScrollView
            style={{ maxHeight: LIST_MAX_H }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 14 }}
          >
            <View style={{ gap: 8 }}>
              <Text style={[styles.aiGenLabel, { color: colors.textSecondary }]}>CATEGORY</Text>
              <CategoryPills active={aiCategory} onSelect={setAiCategory} />
            </View>

            <View style={{ gap: 8 }}>
              <Text style={[styles.aiGenLabel, { color: colors.textSecondary }]}>CUSTOM HINT (OPTIONAL)</Text>
              <Squircle
                style={{ paddingHorizontal: 14, paddingVertical: 12 }}
                cornerRadius={16} cornerSmoothing={1}
                fillColor={colors.surface2} strokeColor={colors.border}
                strokeWidth={StyleSheet.hairlineWidth}
              >
                <TextInput
                  style={[styles.aiGenInput, { color: colors.text }]}
                  placeholder="e.g. she loves hiking and astronomy…"
                  placeholderTextColor={colors.placeholder}
                  value={customPrompt}
                  onChangeText={setCustomPrompt}
                  multiline
                  maxLength={200}
                  selectionColor={colors.text}
                />
              </Squircle>
            </View>

            <Pressable onPress={generateAiLines} disabled={aiLoading}
              style={({ pressed }) => [pressed && { opacity: 0.8 }]}>
              <Squircle style={[styles.aiGenBtn, aiLoading && { opacity: 0.5 }]} cornerRadius={16} cornerSmoothing={1} fillColor={colors.text}>
                <Ionicons name="sparkles" size={16} color={colors.bg} />
                <Text style={[styles.aiGenBtnText, { color: colors.bg }]}>Generate Lines</Text>
              </Squircle>
            </Pressable>

            {aiLoading && <ShimmerLines colors={colors} count={3} />}
            {!aiLoading && aiLines.length > 0 && (
              <View style={{ gap: 8 }}>
                <Text style={[styles.aiGenLabel, { color: colors.textSecondary }]}>GENERATED LINES</Text>
                {aiLines.map((line, i) => (
                  <LineRow key={i} text={line} onUse={() => dismiss(() => onSelect(line))} />
                ))}
              </View>
            )}
          </ScrollView>
        )}
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

// ─── Shimmer placeholder for AI loading ────────────────────────────────────

function ShimmerRow({ colors, width = '100%' }: { colors: any; width?: number | string }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7] });

  return (
    <Animated.View style={{ opacity }}>
      <Squircle
        style={{ height: 56, width: width as any, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10 }}
        cornerRadius={16} cornerSmoothing={1}
        fillColor={colors.surface2}
      >
        {/* Icon placeholder */}
        <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: colors.border }} />
        {/* Text placeholder */}
        <View style={{ flex: 1, gap: 6 }}>
          <View style={{ height: 10, borderRadius: 5, backgroundColor: colors.border, width: '80%' }} />
          <View style={{ height: 10, borderRadius: 5, backgroundColor: colors.border, width: '55%' }} />
        </View>
        {/* Arrow placeholder */}
        <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.border }} />
      </Squircle>
    </Animated.View>
  );
}

function ShimmerLines({ colors, count = 4 }: { colors: any; count?: number }) {
  return (
    <View style={{ paddingHorizontal: 14, paddingTop: 4, paddingBottom: 28, gap: 8, flexGrow: 0 }}>
      {Array.from({ length: count }).map((_, i) => (
        <ShimmerRow key={i} colors={colors} />
      ))}
    </View>
  );
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

  // Fetch categories — fall back to hardcoded list when DB is empty
  useEffect(() => {
    if (screen !== 'cards') return;
    setLoadingCats(true);
    setCategories([]);
    setCards([]);
    setActiveCategory('');

    const applyCategories = (cats: string[]) => {
      const final = cats.length > 0 ? cats : FALLBACK_CATEGORIES;
      setCategories(final);
      setActiveCategory(final[0]);
    };

    if (token) {
      apiFetch<string[]>(`/cards/${activeGame}`, { token })
        .then(applyCategories)
        .catch(() => applyCategories([]))
        .finally(() => setLoadingCats(false));
    } else {
      applyCategories([]);
      setLoadingCats(false);
    }
  }, [activeGame, screen, token]);

  // Fetch cards — fall back to hardcoded cards when DB is empty
  useEffect(() => {
    if (!activeCategory) return;
    setLoadingCards(true);
    setCards([]);
    setActiveIdx(0);
    scrollRef.current?.scrollTo({ x: 0, animated: false });

    const applyCards = (fetched: DbCard[]) => {
      setCards(fetched.length > 0 ? fetched : getFallbackCards(activeGame, activeCategory));
    };

    if (token) {
      apiFetch<DbCard[]>(`/cards/${activeGame}/${encodeURIComponent(activeCategory)}`, { token })
        .then(applyCards)
        .catch(() => applyCards([]))
        .finally(() => setLoadingCards(false));
    } else {
      applyCards([]);
      setLoadingCards(false);
    }
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

  // Gradient bg: 3-stop visible gradient per category/game
  const GAME_BG: Record<string, string> = {
    question:      '#0d0b1f',
    truth_or_dare: '#1a0a0a',
  };
  const baseColor  = screen === 'cards'
    ? (CATEGORY_COLOR[activeCategory] ?? GAME_BG[activeGame] ?? '#0d0b1f')
    : (GAME_BG[activeGame] ?? '#0d0b1f');
  const panelBgTop    = lightenHex(baseColor, 0.42);
  const panelBgMid    = lightenHex(baseColor, 0.10);
  const panelBgBottom = '#030107';

  const xpBarWidth = xpAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Pressable style={StyleSheet.absoluteFill} onPress={() => dismiss(onClose)}>
      <Animated.View style={[
        styles.panel,
        { borderTopColor: 'transparent' },
        { transform: [{ translateY: slideY }] },
      ]}>
        {/* Gradient fill — clips to panel's rounded corners via overflow:hidden */}
        <LinearGradient
          colors={[panelBgTop, panelBgMid, panelBgBottom]}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
        />

        <Pressable>
          <View style={[styles.panelHandle, { backgroundColor: 'rgba(255,255,255,0.18)' }]} />

          {/* Header */}
          <View style={styles.panelHeader}>
            <Squircle style={styles.panelIcon} cornerRadius={12} cornerSmoothing={1} fillColor="rgba(255,255,255,0.10)">
              <Ionicons name="layers" size={16} color="#fff" />
            </Squircle>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[styles.panelTitle, { color: '#fff' }]}>
                  {screen === 'picker' ? 'Games' : gameMeta.label}
                </Text>
                {screen === 'cards' && (
                  <View style={[styles.streakBadge, { backgroundColor: `${accentColor}30`, borderColor: `${accentColor}50`, borderWidth: 1 }]}>
                    <Text style={[styles.streakText, { color: accentColor }]}>
                      {(totalSent + sessionSent) > 0 ? `🃏 ${totalSent + sessionSent} sent` : '🃏 Start playing'}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.panelSub, { color: 'rgba(255,255,255,0.55)' }]}>
                {screen === 'picker' ? 'Choose a game to play' : gameMeta.desc}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {screen === 'cards' && (
                <Pressable onPress={() => setScreen('picker')} hitSlop={12}>
                  <Squircle style={styles.panelCloseBtn} cornerRadius={10} cornerSmoothing={1} fillColor="rgba(255,255,255,0.10)">
                    <Ionicons name="arrow-back" size={16} color="#fff" />
                  </Squircle>
                </Pressable>
              )}
              <Pressable onPress={() => dismiss(onClose)} hitSlop={12}>
                <Squircle style={styles.panelCloseBtn} cornerRadius={10} cornerSmoothing={1} fillColor="rgba(255,255,255,0.10)">
                  <Ionicons name="close" size={16} color="#fff" />
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
                    fillColor="rgba(255,255,255,0.07)"
                    strokeColor="rgba(255,255,255,0.12)"
                    strokeWidth={StyleSheet.hairlineWidth}
                  >
                    <View style={[styles.gameCardIcon, { backgroundColor: `${meta.accent}30` }]}>
                      <Text style={{ fontSize: 28 }}>{meta.emoji}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.gameCardTitle, { color: '#fff' }]}>{meta.label}</Text>
                      <Text style={[styles.gameCardDesc, { color: 'rgba(255,255,255,0.55)' }]}>
                        {gameKey === 'truth_or_dare' ? 'Invite your match to play live' : meta.desc}
                      </Text>
                    </View>
                    <View style={[styles.gameCardArrow, { backgroundColor: `${meta.accent}25` }]}>
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
              <View style={{ paddingHorizontal: 16, marginBottom: 10, gap: 5 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 11, fontFamily: 'ProductSans-Bold', color: accentColor }}>
                      {lvlInfo.name.toUpperCase()}
                    </Text>
                    <View style={[styles.streakBadge, { backgroundColor: `${accentColor}30` }]}>
                      <Text style={[styles.streakText, { color: accentColor }]}>Lv {lvlInfo.level + 1}</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 10, fontFamily: 'ProductSans-Regular', color: 'rgba(255,255,255,0.45)' }}>
                    {xp} XP
                  </Text>
                </View>
                <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
                  <Animated.View style={{
                    height: 4, borderRadius: 2,
                    backgroundColor: accentColor,
                    width: xpBarWidth,
                  }} />
                </View>
              </View>

              {/* ── Category icon badges ── */}
              {loadingCats ? (
                <View style={{ alignItems: 'center', paddingVertical: 10 }}>
                  <ActivityIndicator size="small" color={accentColor} />
                </View>
              ) : (
                <View style={styles.catBadgeGrid}>
                  {categories.map(cat => {
                    const isActive  = cat === activeCategory;
                    const accent    = CATEGORY_ACCENT[cat] ?? accentColor;
                    const emoji     = CATEGORY_EMOJI[cat] ?? '❓';
                    const shortName = cat === 'Would You Rather' ? 'WYR' : cat;
                    return (
                      <Pressable
                        key={cat}
                        onPress={() => setActiveCategory(cat)}
                        style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}
                      >
                        <Squircle
                          style={[styles.catBadge, isActive && { borderWidth: 0 }]}
                          cornerRadius={16} cornerSmoothing={1}
                          fillColor={isActive ? accent : 'rgba(255,255,255,0.08)'}
                          strokeColor={isActive ? 'transparent' : 'rgba(255,255,255,0.14)'}
                          strokeWidth={1}
                        >
                          <Text style={{ fontSize: 18 }}>{emoji}</Text>
                          <Text style={[
                            styles.catBadgeLabel,
                            { color: isActive ? '#fff' : 'rgba(255,255,255,0.6)' },
                          ]}>
                            {shortName}
                          </Text>
                        </Squircle>
                      </Pressable>
                    );
                  })}
                </View>
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
                          style={[styles.deckCard, { width: CARD_W, opacity: isActive ? 1 : 0.5 }]}
                          cornerRadius={28} cornerSmoothing={1}
                          fillColor={isActive ? card.color : 'rgba(255,255,255,0.06)'}
                          strokeColor={isActive ? 'transparent' : 'rgba(255,255,255,0.12)'}
                          strokeWidth={StyleSheet.hairlineWidth}
                        >
                          {/* Category badge */}
                          <View style={[styles.deckCardTag, {
                            backgroundColor: isActive ? `${tagColor}35` : 'rgba(255,255,255,0.10)',
                          }]}>
                            <Text style={{ fontSize: 13 }}>{CATEGORY_EMOJI[card.tag] ?? CATEGORY_EMOJI[card.category] ?? '❓'}</Text>
                            <Text style={[styles.deckCardTagText, {
                              color: isActive ? tagColor : 'rgba(255,255,255,0.7)',
                            }]}>
                              {card.tag}
                            </Text>
                          </View>

                          <Text style={styles.deckCardEmoji}>{card.emoji}</Text>
                          <Text style={[styles.deckCardQuestion, { color: '#fff' }]}>
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

                  {/* ── Write your own card (always last) ── */}
                  <Pressable
                    onPress={() => {
                      const lastIdx = cards.length;
                      if (activeIdx !== lastIdx) {
                        scrollRef.current?.scrollTo({ x: lastIdx * (CARD_W + CARD_GAP), animated: true });
                        setActiveIdx(lastIdx);
                      }
                    }}
                    style={({ pressed }) => [{ opacity: pressed ? 0.88 : 1 }]}
                  >
                    <Squircle
                      style={[styles.deckCard, { width: CARD_W, opacity: activeIdx === cards.length ? 1 : 0.45, alignItems: 'center', justifyContent: 'center', gap: 14 }]}
                      cornerRadius={28} cornerSmoothing={1}
                      fillColor={activeIdx === cards.length ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.06)'}
                      strokeColor={activeIdx === cards.length ? accentColor : 'rgba(255,255,255,0.12)'}
                      strokeWidth={activeIdx === cards.length ? 2 : StyleSheet.hairlineWidth}
                    >
                      <Squircle style={{ width: 52, height: 52, alignItems: 'center', justifyContent: 'center' }} cornerRadius={16} cornerSmoothing={1} fillColor={`${accentColor}30`}>
                        <Ionicons name="create-outline" size={24} color={accentColor} />
                      </Squircle>
                      <Text style={{ fontSize: 16, fontFamily: 'ProductSans-Black', color: '#fff', textAlign: 'center' }}>
                        Write your own
                      </Text>
                      <Text style={{ fontSize: 12, fontFamily: 'ProductSans-Regular', color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 18 }}>
                        Craft a personal question just for them
                      </Text>
                      {activeIdx === cards.length && (
                        <View style={[styles.deckCardHint, { borderTopColor: 'rgba(255,255,255,0.15)', marginTop: 4 }]}>
                          <Ionicons name="send" size={12} color={accentColor} />
                          <Text style={[styles.deckCardHintText, { color: accentColor }]}>Tap send to open editor</Text>
                        </View>
                      )}
                    </Squircle>
                  </Pressable>
                </ScrollView>
              )}

              {/* Dots — include the write-your-own card */}
              {cards.length > 0 && (
                <View style={styles.deckDots}>
                  {[...cards.map((_, i) => i), cards.length].map(i => (
                    <Pressable
                      key={i}
                      onPress={() => {
                        scrollRef.current?.scrollTo({ x: i * (CARD_W + CARD_GAP), animated: true });
                        setActiveIdx(i);
                      }}
                    >
                      <View style={[styles.deckDot, {
                        backgroundColor: i === activeIdx
                          ? (i === cards.length ? accentColor : accentColor)
                          : 'rgba(255,255,255,0.20)',
                        width: i === activeIdx ? 20 : 6,
                        borderRadius: i === cards.length && i === activeIdx ? 3 : 3,
                      }]} />
                    </Pressable>
                  ))}
                </View>
              )}

              {/* Send CTA — changes when Write Your Own is active */}
              <View style={styles.deckCta}>
                {activeIdx === cards.length ? (
                  <Pressable
                    onPress={() => dismiss(() => {
                      onClose();
                      // signal parent to open custom input
                    })}
                    style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1, flex: 1 }]}
                  >
                    <Squircle style={styles.deckSendBtn} cornerRadius={50} cornerSmoothing={1} fillColor={accentColor}>
                      <Ionicons name="create-outline" size={15} color="#fff" />
                      <Text style={[styles.deckSendBtnText, { color: '#fff' }]}>Write & send your own</Text>
                    </Squircle>
                  </Pressable>
                ) : (
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
                )}
              </View>
            </>
          )}
        </Pressable>
      </Animated.View>
    </Pressable>
  );
}

// ─── Truth or Dare — interactive game bubbles ────────────────────────────────

// ─── T&D monochrome palette (grey / white / black only) ──────────────────────
const TOD_BG      = '#111111';
const TOD_SURFACE = '#1c1c1c';
const TOD_BORDER  = 'rgba(255,255,255,0.10)';
const TOD_MUTED   = 'rgba(255,255,255,0.38)';
const TOD_SUBTLE  = 'rgba(255,255,255,0.07)';

// Keep for legacy compat in any remaining refs
const TOD_TRUTH_COLOR  = TOD_BG;
const TOD_DARE_COLOR   = TOD_BG;
const TOD_INVITE_COLOR = TOD_BG;

// ─── Built-in question templates ─────────────────────────────────────────────
const TOD_TRUTH_TEMPLATES = [
  "What's something you've never told anyone you like about me?",
  "What's your biggest fear right now in life?",
  "What's the most embarrassing moment you've had in public?",
  "What's a secret you've never shared with anyone?",
  "If you could change one thing about your past, what would it be?",
  "What's the most childish thing you still do?",
  "What's your biggest insecurity and why?",
  "When was the last time you cried and what caused it?",
  "What's a controversial opinion you hold that most people disagree with?",
  "What do you genuinely wish you could tell me but haven't yet?",
  "What's the worst lie you've ever told someone you cared about?",
  "What do you find most attractive in a person — be completely honest.",
];

const TOD_DARE_TEMPLATES = [
  "Send me the last photo you took right now — no deleting first.",
  "Record a voice note telling me 3 things you genuinely like about me.",
  "Text your best friend 'I think I'm in love' and screenshot their reaction.",
  "Send me your honest first impression of me when we first matched.",
  "Share your most-played song this week.",
  "Screenshot your screen time for today and send it.",
  "Write me a 3-line poem — it can be terrible, that's fine.",
  "Do your best impression of me in a voice note.",
  "Tell me one thing you've been holding back saying to me.",
  "Send me a photo that honestly shows what you're doing right now.",
  "Rate yourself out of 10 in looks, personality, and humor — be honest.",
  "Post a story right now with no caption and show me what you posted.",
];

// ─── T&D invite bubble ────────────────────────────────────────────────────────

function TodInviteBubble({ msg, messages, isMe, extra, partnerName, avatarSlot, styles, colors, onChoice, onPickCard }: {
  msg: Msg; messages: Msg[]; isMe: boolean; extra: Record<string, any>;
  partnerName: string; avatarSlot: React.ReactNode;
  styles: any; colors: any;
  onChoice: (inviteId: string, choice: 'truth' | 'dare') => void;
  onPickCard: (choice: 'truth' | 'dare') => void;
}) {
  "use no memo";
  const [picking, setPicking] = React.useState(false);

  const choiceMsg     = messages.find(m => m.todMsgType === 'tod_choice' && m.todExtra?.inviteId === msg.id);
  // preSelectedChoice is set when the sender embeds the choice directly in the invite
  // (used in the challenge-after-answering flow to avoid optimistic-ID linking issues)
  const preSelectedChoice = extra.preSelectedChoice as 'truth' | 'dare' | undefined;
  const partnerChoice = preSelectedChoice ?? (choiceMsg?.todExtra?.choice as 'truth' | 'dare' | undefined);
  const alreadyChosen = !!partnerChoice;
  const cardSent      = messages.some(m => m.todMsgType === 'tod_next' && m.todExtra?.inviteId === msg.id);
  // Was it the sender (isMe) who pre-chose on behalf of the partner, or did the partner choose themselves?
  const senderPreChose   = isMe  && alreadyChosen && (!!preSelectedChoice || choiceMsg?.from === 'me');
  const partnerChoseOwn  = isMe  && alreadyChosen && !preSelectedChoice && choiceMsg?.from !== 'me';
  const senderChoseForMe = !isMe && alreadyChosen && (!!preSelectedChoice || choiceMsg?.from !== 'me');

  // If a newer invite exists in the conversation, this one is expired
  const isExpired = messages.some(
    m => m.todMsgType === 'tod_invite' && m.id !== msg.id && m.rawTime && msg.rawTime && m.rawTime > msg.rawTime
  );

  return (
    <View style={[styles.bubbleRow, isMe ? styles.bubbleRowMe : styles.bubbleRowThem]}>
      {!isMe && avatarSlot}
      <Squircle style={styles.todInviteBubble} cornerRadius={26} cornerSmoothing={1}
        fillColor={TOD_BG} strokeColor={TOD_BORDER} strokeWidth={1}>

        {/* ── top label row ── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Squircle style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}
            cornerRadius={10} cornerSmoothing={1} fillColor={TOD_SUBTLE}>
            <Text style={{ fontSize: 16 }}>🎲</Text>
          </Squircle>
          <Text style={{ fontSize: 13, fontFamily: 'ProductSans-Black', color: '#fff', letterSpacing: 0.3 }}>
            Truth or Dare
          </Text>
          <View style={{ flex: 1 }} />
          <Text style={[styles.bubbleTimeInline, { color: TOD_MUTED }]}>{msg.time}</Text>
        </View>

        {/* ── status line ── */}
        <Text style={{ fontSize: 14, fontFamily: 'ProductSans-Regular', color: TOD_MUTED, marginBottom: 16 }}>
          {isExpired
            ? 'A newer game was started'
            : isMe
              ? senderPreChose
                ? `You chose ${partnerChoice === 'truth' ? 'Truth' : 'Dare'} for ${partnerName}`
                : partnerChoseOwn
                  ? `${partnerName} chose ${partnerChoice === 'truth' ? 'Truth' : 'Dare'}`
                  : `Waiting for ${partnerName} to choose…`
              : senderChoseForMe
                ? `${extra.senderName ?? partnerName} picked a ${partnerChoice === 'truth' ? 'Truth' : 'Dare'} for you!`
                : `${extra.senderName ?? partnerName} invited you to play`}
        </Text>

        {/* ── EXPIRED: show quiet badge, no actions ── */}
        {isExpired && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="ban-outline" size={13} color="rgba(255,255,255,0.2)" />
            <Text style={{ fontSize: 12, fontFamily: 'ProductSans-Bold', color: 'rgba(255,255,255,0.2)' }}>
              Expired
            </Text>
          </View>
        )}

        {/* ── SENDER: choice made → pick question card ── */}
        {!isExpired && isMe && alreadyChosen && !cardSent && (
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onPickCard(partnerChoice!); }}
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
            <Squircle style={{ paddingVertical: 12, alignItems: 'center' }}
              cornerRadius={50} cornerSmoothing={1} fillColor="#fff">
              <Text style={{ fontSize: 14, fontFamily: 'ProductSans-Black', color: '#000' }}>
                {senderPreChose
                  ? (partnerChoice === 'truth' ? 'Pick a Truth for them →' : 'Pick a Dare for them →')
                  : (partnerChoice === 'truth' ? 'Send a Truth →' : 'Send a Dare →')}
              </Text>
            </Squircle>
          </Pressable>
        )}
        {!isExpired && isMe && cardSent && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="checkmark-circle" size={14} color="rgba(255,255,255,0.5)" />
            <Text style={{ fontSize: 12, fontFamily: 'ProductSans-Bold', color: TOD_MUTED }}>Question sent</Text>
          </View>
        )}
        {!isExpired && isMe && !alreadyChosen && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="time-outline" size={14} color={TOD_MUTED} />
            <Text style={{ fontSize: 12, fontFamily: 'ProductSans-Bold', color: TOD_MUTED }}>Waiting for choice…</Text>
          </View>
        )}

        {/* ── PARTNER: sender already picked a type for them → show what's coming ── */}
        {!isExpired && !isMe && senderChoseForMe && !cardSent && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Squircle style={{ paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 6 }}
              cornerRadius={50} cornerSmoothing={1} fillColor={TOD_SUBTLE} strokeColor={TOD_BORDER} strokeWidth={1}>
              <Text style={{ fontSize: 14 }}>{partnerChoice === 'truth' ? '🤔' : '🎲'}</Text>
              <Text style={{ fontSize: 12, fontFamily: 'ProductSans-Black', color: '#fff' }}>
                {partnerChoice === 'truth' ? 'Truth' : 'Dare'} incoming…
              </Text>
            </Squircle>
          </View>
        )}
        {!isExpired && !isMe && senderChoseForMe && cardSent && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="arrow-down-circle-outline" size={14} color={TOD_MUTED} />
            <Text style={{ fontSize: 12, fontFamily: 'ProductSans-Bold', color: TOD_MUTED }}>Question sent — check below</Text>
          </View>
        )}

        {/* ── PARTNER: "Let's Play" → then T / D choice ── */}
        {!isExpired && !isMe && !alreadyChosen && !picking && (
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setPicking(true); }}
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
            <Squircle style={{ paddingVertical: 12, alignItems: 'center' }}
              cornerRadius={50} cornerSmoothing={1} fillColor="#fff">
              <Text style={{ fontSize: 14, fontFamily: 'ProductSans-Black', color: '#000' }}>Let's Play →</Text>
            </Squircle>
          </Pressable>
        )}
        {!isExpired && !isMe && !alreadyChosen && picking && (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onChoice(msg.id, 'truth'); }}
              style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.75 : 1 })}>
              <Squircle style={{ paddingVertical: 14, alignItems: 'center', gap: 4 }}
                cornerRadius={16} cornerSmoothing={1}
                fillColor={TOD_SUBTLE} strokeColor="rgba(255,255,255,0.25)" strokeWidth={1}>
                <Text style={{ fontSize: 18 }}>🤔</Text>
                <Text style={{ fontSize: 13, fontFamily: 'ProductSans-Black', color: '#fff' }}>Truth</Text>
              </Squircle>
            </Pressable>
            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onChoice(msg.id, 'dare'); }}
              style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.75 : 1 })}>
              <Squircle style={{ paddingVertical: 14, alignItems: 'center', gap: 4 }}
                cornerRadius={16} cornerSmoothing={1}
                fillColor={TOD_SUBTLE} strokeColor="rgba(255,255,255,0.25)" strokeWidth={1}>
                <Text style={{ fontSize: 18 }}>🎲</Text>
                <Text style={{ fontSize: 13, fontFamily: 'ProductSans-Black', color: '#fff' }}>Dare</Text>
              </Squircle>
            </Pressable>
          </View>
        )}
        {!isMe && alreadyChosen && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="checkmark-circle" size={14} color="rgba(255,255,255,0.5)" />
            <Text style={{ fontSize: 12, fontFamily: 'ProductSans-Bold', color: TOD_MUTED }}>
              You chose {partnerChoice === 'truth' ? 'Truth' : 'Dare'} — waiting for question…
            </Text>
          </View>
        )}
      </Squircle>
      {isMe && avatarSlot}
    </View>
  );
}

const TOD_CATEGORIES = ['Spicy', 'Romantic', 'Fun', 'Deep'];
const TOD_CAT_ACCENT: Record<string, string> = {
  Spicy: '#ef4444', Romantic: '#ec4899', Fun: '#f59e0b', Deep: '#6366f1',
};
const TOD_CAT_EMOJI: Record<string, string> = {
  Spicy: '🌶️', Romantic: '💕', Fun: '😂', Deep: '🌊',
};

function TodBubble({ msg, colors, myId, partnerName, onJoin, onAnswer, onSkip, onSendTurn, onPickCard, onChoice, messages, myAvatar, partnerAvatar, isLastInGroup, skipUsed }: {
  msg: Msg;
  colors: any;
  myId: string;
  partnerName: string;
  onJoin: (msgId: string) => void;
  onAnswer: (msg: Msg) => void;
  onSkip: (msg: Msg) => void;
  onSendTurn: (choice?: 'truth' | 'dare') => void;
  onPickCard: (choice: 'truth' | 'dare') => void;
  onChoice: (inviteId: string, choice: 'truth' | 'dare') => void;
  messages: Msg[];
  myAvatar?: string;
  partnerAvatar?: string;
  isLastInGroup?: boolean;
  skipUsed: boolean;
}) {
  "use no memo";
  const isMe  = msg.from === 'me';
  const extra = msg.todExtra ?? {};

  const avatarSlot = (
    <View style={{ width: 36, alignItems: isMe ? 'flex-end' : 'flex-start', justifyContent: 'flex-end', paddingBottom: 2 }}>
      {isLastInGroup && <BubbleAvatar uri={isMe ? myAvatar : partnerAvatar} size={28} />}
    </View>
  );

  // ── Invite bubble ─────────────────────────────────────────────────────────
  if (msg.todMsgType === 'tod_invite') {
    return <TodInviteBubble
      msg={msg} messages={messages} isMe={isMe} extra={extra}
      partnerName={partnerName} avatarSlot={avatarSlot}
      styles={styles} colors={colors}
      onChoice={onChoice} onPickCard={onPickCard}
    />;
  }

  // ── System event badges (choice / skip / accept) ─────────────────────────
  if (msg.todMsgType === 'tod_choice' || msg.todMsgType === 'tod_skip' || msg.todMsgType === 'tod_accept') {
    const choice = extra.choice as 'truth' | 'dare' | undefined;
    const label = msg.todMsgType === 'tod_choice'
      ? (isMe ? `You chose ${choice === 'truth' ? 'Truth' : 'Dare'}` : `${partnerName} chose ${choice === 'truth' ? 'Truth' : 'Dare'}`)
      : msg.todMsgType === 'tod_skip'
      ? (isMe ? 'You skipped' : `${partnerName} skipped`)
      : (isMe ? 'Game started' : 'Game started');
    const icon = msg.todMsgType === 'tod_choice'
      ? (choice === 'truth' ? '🤔' : '🎲')
      : msg.todMsgType === 'tod_skip' ? '↩' : '🎲';
    return (
      <View style={[styles.bubbleRow, { justifyContent: 'center' }]}>
        <Squircle style={styles.todSystemBubble} cornerRadius={50} cornerSmoothing={1}
          fillColor={TOD_SUBTLE} strokeColor={TOD_BORDER} strokeWidth={1}>
          <Text style={{ fontSize: 12 }}>{icon}</Text>
          <Text style={[styles.todSystemText, { color: TOD_MUTED }]}>{label}</Text>
        </Squircle>
      </View>
    );
  }

  // ── Question card (tod_next) ──────────────────────────────────────────────
  if (msg.todMsgType === 'tod_next') {
    const choice   = extra.choice   as 'truth' | 'dare' | undefined;
    const question = extra.question as string   | undefined;
    const emoji    = extra.emoji    as string   | undefined;
    const answered  = messages.some(m => (m.todMsgType === 'tod_answer' || m.todMsgType === 'tod_skip') && m.todExtra?.turnMsgId === msg.id);
    const skipped   = messages.some(m => m.todMsgType === 'tod_skip' && m.todExtra?.turnMsgId === msg.id);
    const typeLabel = choice === 'truth' ? 'Truth' : 'Dare';

    return (
      <View style={[styles.bubbleRow, isMe ? styles.bubbleRowMe : styles.bubbleRowThem]}>
        {!isMe && avatarSlot}
        <Squircle
          style={[styles.todTurnCard, isMe ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }]}
          cornerRadius={24} cornerSmoothing={1}
          fillColor={TOD_BG} strokeColor={TOD_BORDER} strokeWidth={1}
        >
          {/* ── header row ── */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <Squircle style={{ paddingHorizontal: 10, paddingVertical: 4 }}
              cornerRadius={50} cornerSmoothing={1} fillColor={TOD_SUBTLE} strokeColor={TOD_BORDER} strokeWidth={1}>
              <Text style={{ fontSize: 11, fontFamily: 'ProductSans-Black', color: 'rgba(255,255,255,0.7)', letterSpacing: 0.5 }}>
                {choice === 'truth' ? '🤔 ' : '🎲 '}{typeLabel}
              </Text>
            </Squircle>
            <View style={{ flex: 1 }} />
            <Text style={[styles.bubbleTimeInline, { color: TOD_MUTED }]}>{msg.time}</Text>
          </View>

          {/* ── from label ── */}
          <Text style={{ fontSize: 11, fontFamily: 'ProductSans-Bold', color: TOD_MUTED, marginBottom: 10, letterSpacing: 0.3 }}>
            {isMe ? 'YOU SENT' : `FROM ${(extra.senderName ?? partnerName).toUpperCase()}`}
          </Text>

          {/* ── emoji + question ── */}
          {emoji && <Text style={{ fontSize: 32, textAlign: 'center', marginBottom: 10 }}>{emoji}</Text>}
          {question
            ? <Text style={styles.todTurnQuestion}>{question}</Text>
            : <Text style={[styles.todTurnQuestion, { opacity: 0.35, fontStyle: 'italic' }]}>Question hidden…</Text>}

          {/* ── action area ── */}
          {answered ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 }}>
              <Ionicons name={skipped ? 'play-skip-forward-outline' : 'checkmark-circle-outline'} size={14} color={TOD_MUTED} />
              <Text style={{ fontSize: 12, fontFamily: 'ProductSans-Bold', color: TOD_MUTED }}>
                {skipped ? 'Skipped' : 'Completed'}
              </Text>
            </View>
          ) : !isMe && question ? (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
              <Pressable
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onAnswer(msg); }}
                style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.8 : 1 })}>
                <Squircle style={{ paddingVertical: 12, alignItems: 'center' }}
                  cornerRadius={50} cornerSmoothing={1} fillColor="#fff">
                  <Text style={{ fontSize: 13, fontFamily: 'ProductSans-Black', color: '#000' }}>
                    {choice === 'truth' ? 'Answer' : 'Complete'}
                  </Text>
                </Squircle>
              </Pressable>
              {!skipUsed && (
                <Pressable
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onSkip(msg); }}
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                  <Squircle style={{ paddingVertical: 12, paddingHorizontal: 18, alignItems: 'center' }}
                    cornerRadius={50} cornerSmoothing={1}
                    fillColor={TOD_SUBTLE} strokeColor={TOD_BORDER} strokeWidth={1}>
                    <Text style={{ fontSize: 13, fontFamily: 'ProductSans-Black', color: TOD_MUTED }}>
                      Skip
                    </Text>
                  </Squircle>
                </Pressable>
              )}
            </View>
          ) : null}
        </Squircle>
        {isMe && avatarSlot}
      </View>
    );
  }

  // ── Answer bubble ─────────────────────────────────────────────────────────
  if (msg.todMsgType === 'tod_answer') {
    const choice  = extra.choice as 'truth' | 'dare' | undefined;
    const isLastAnswer = messages.filter(m => m.todMsgType === 'tod_answer').slice(-1)[0]?.id === msg.id;
    // Use array-index order so optimistic invites (no rawTime yet) also hide the challenge buttons
    const answerIdx = messages.findIndex(m => m.id === msg.id);
    const nextRoundStarted = isLastAnswer && messages.some((m, idx) =>
      m.isTod && m.todMsgType === 'tod_invite' && idx > answerIdx
    );

    return (
      <>
        <View style={[styles.bubbleRow, isMe ? styles.bubbleRowMe : styles.bubbleRowThem]}>
          {!isMe && avatarSlot}
          <Squircle
            style={[styles.todAnswerBubble, isMe ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }]}
            cornerRadius={22} cornerSmoothing={1}
            fillColor={TOD_BG} strokeColor={TOD_BORDER} strokeWidth={1}
          >
            {/* type pill */}
            <Squircle style={{ paddingHorizontal: 9, paddingVertical: 3, alignSelf: 'flex-start', marginBottom: 8 }}
              cornerRadius={50} cornerSmoothing={1} fillColor={TOD_SUBTLE} strokeColor={TOD_BORDER} strokeWidth={1}>
              <Text style={{ fontSize: 10, fontFamily: 'ProductSans-Black', color: TOD_MUTED, letterSpacing: 0.4 }}>
                {choice === 'truth' ? '🤔 TRUTH' : '🎲 DARE'}
              </Text>
            </Squircle>
            {extra.question && (
              <Text style={{ fontSize: 11, fontFamily: 'ProductSans-Regular', color: TOD_MUTED, marginBottom: 8, fontStyle: 'italic', lineHeight: 16 }} numberOfLines={2}>
                {extra.question}
              </Text>
            )}
            <Text style={styles.todAnswerText}>{msg.text}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 6 }}>
              <Text style={[styles.bubbleTimeInline, { color: TOD_MUTED }]}>{msg.time}</Text>
              {isMe && <MsgTicks status={msg.status} />}
            </View>
          </Squircle>
          {isMe && avatarSlot}
        </View>

        {/* ── Next-round challenge prompt ── */}
        {isLastAnswer && !nextRoundStarted && (
          isMe ? (
            /* Challenger side — pick what the partner should do */
            <View style={[styles.bubbleRow, styles.bubbleRowMe, { marginTop: 8 }]}>
              <Squircle style={styles.todInviteBubble} cornerRadius={26} cornerSmoothing={1}
                fillColor={TOD_BG} strokeColor={TOD_BORDER} strokeWidth={1}>

                {/* header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <Squircle style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}
                    cornerRadius={10} cornerSmoothing={1} fillColor={TOD_SUBTLE}>
                    <Text style={{ fontSize: 16 }}>🎲</Text>
                  </Squircle>
                  <Text style={{ fontSize: 13, fontFamily: 'ProductSans-Black', color: '#fff', letterSpacing: 0.3 }}>
                    Your Turn
                  </Text>
                </View>

                <Text style={{ fontSize: 13, fontFamily: 'ProductSans-Regular', color: TOD_MUTED, marginBottom: 14 }}>
                  What should {partnerName} do?
                </Text>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Pressable
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onSendTurn('truth'); }}
                    style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.75 : 1 })}>
                    <Squircle style={{ paddingVertical: 14, alignItems: 'center', gap: 4 }}
                      cornerRadius={16} cornerSmoothing={1}
                      fillColor={TOD_SUBTLE} strokeColor="rgba(255,255,255,0.25)" strokeWidth={1}>
                      <Text style={{ fontSize: 18 }}>🤔</Text>
                      <Text style={{ fontSize: 13, fontFamily: 'ProductSans-Black', color: '#fff' }}>Truth</Text>
                    </Squircle>
                  </Pressable>
                  <Pressable
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onSendTurn('dare'); }}
                    style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.75 : 1 })}>
                    <Squircle style={{ paddingVertical: 14, alignItems: 'center', gap: 4 }}
                      cornerRadius={16} cornerSmoothing={1}
                      fillColor={TOD_SUBTLE} strokeColor="rgba(255,255,255,0.25)" strokeWidth={1}>
                      <Text style={{ fontSize: 18 }}>🎲</Text>
                      <Text style={{ fontSize: 13, fontFamily: 'ProductSans-Black', color: '#fff' }}>Dare</Text>
                    </Squircle>
                  </Pressable>
                </View>
              </Squircle>
            </View>
          ) : (
            <View style={[styles.bubbleRow, { justifyContent: 'center', marginTop: 6 }]}>
              <Squircle style={styles.todSystemBubble} cornerRadius={50} cornerSmoothing={1}
                fillColor={TOD_SUBTLE} strokeColor={TOD_BORDER} strokeWidth={1}>
                <Text style={{ fontSize: 12 }}>⏳</Text>
                <Text style={[styles.todSystemText, { color: TOD_MUTED }]}>
                  {partnerName} will challenge you next…
                </Text>
              </Squircle>
            </View>
          )
        )}
      </>
    );
  }

  return null;
}

// ─── Truth or Dare — Send Card Panel ─────────────────────────────────────────
// Flow: list of built-in templates (pre-filtered by partner's choice)
//       + AI generate  + write custom  → preview → send

function TodPickPanel({
  colors, token, myId, myName, partnerId, partnerName,
  chatMessages, defaultChoice, onSendCard, onClose,
}: {
  colors: any;
  token?: string;
  myId: string;
  myName: string;
  partnerId: string;
  partnerName: string;
  chatMessages: Msg[];
  defaultChoice?: 'truth' | 'dare' | null;
  onSendCard: (choice: 'truth' | 'dare', question: string, emoji: string, color: string, category: string) => void;
  onClose: () => void;
}) {
  const slideY = useRef(new Animated.Value(700)).current;

  // step: 'choice' → 'source' → 'template_cat' → 'template_cards' → 'custom' → 'ai' → 'preview'
  const [step, setStep] = useState<'list' | 'custom' | 'ai' | 'preview'>('list');
  const [choice] = useState<'truth' | 'dare'>(defaultChoice ?? 'truth');
  const [aiLoading, setAiLoading] = useState(false);
  const [customText, setCustomText] = useState('');
  const [cardQuestion, setCardQuestion] = useState('');
  const [cardEmoji, setCardEmoji] = useState('🎲');

  useEffect(() => {
    Animated.spring(slideY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 230 }).start();
  }, []);

  const dismiss = (cb?: () => void) =>
    Animated.timing(slideY, { toValue: 700, duration: 220, useNativeDriver: true }).start(cb);

  const templates = choice === 'truth' ? TOD_TRUTH_TEMPLATES : TOD_DARE_TEMPLATES;

  const generateAiCard = async () => {
    if (!token) return;
    setAiLoading(true);
    setStep('ai');
    try {
      const context = chatMessages.filter(m => !m.isCard && !m.isTod).slice(-12).map(m => m.text);
      const result = await apiFetch<{ question: string; emoji: string; color: string }>(
        `/cards/generate`,
        { token, method: 'POST', body: JSON.stringify({ choice, category: 'Fun', chat_context: context }) }
      );
      setCardQuestion(result.question);
      setCardEmoji(result.emoji);
      setStep('preview');
    } catch {
      setStep('custom');
    }
    setAiLoading(false);
  };

  const handleSend = () => {
    dismiss(() => onSendCard(choice, cardQuestion, cardEmoji, '#111111', choice === 'truth' ? 'Truth' : 'Dare'));
  };

  const goBack = () => {
    if (step === 'preview' || step === 'custom') setStep('list');
    else if (step === 'ai') setStep('list');
    else dismiss(onClose);
  };

  return (
    <KeyboardAvoidingView
      style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end' }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      pointerEvents="box-none"
    >
      {/* backdrop — sits behind the panel; tap it to dismiss */}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => dismiss(onClose)} />

      <Animated.View style={[
        styles.panel,
        { position: 'relative', backgroundColor: '#0a0a0a', borderTopColor: 'rgba(255,255,255,0.08)', transform: [{ translateY: slideY }] },
      ]}>
        {/* inner Pressable swallows all taps so they never reach the backdrop */}
        <Pressable onPress={() => {}}>
          <View style={[styles.panelHandle, { backgroundColor: 'rgba(255,255,255,0.15)' }]} />

          {/* ── Header ── */}
          <View style={styles.panelHeader}>
            <Pressable onPress={goBack} hitSlop={12}>
              <Squircle style={styles.panelCloseBtn} cornerRadius={10} cornerSmoothing={1} fillColor={TOD_SUBTLE}>
                <Ionicons name={step === 'list' ? 'close' : 'arrow-back'} size={16} color="#fff" />
              </Squircle>
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={[styles.panelTitle, { color: '#fff', textAlign: 'center' }]}>
                {step === 'list'
                  ? (choice === 'truth' ? 'Truth Questions' : 'Dare Challenges')
                  : step === 'custom' ? 'Write Your Own'
                  : step === 'ai' ? 'AI Generate'
                  : 'Preview Card'}
              </Text>
            </View>
            <View style={{ width: 32 }} />
          </View>

          {/* ── STEP: list ── */}
          {step === 'list' && (
            <ScrollView
              style={{ maxHeight: SCREEN_H * 0.62 }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 8 }}
            >
              {/* AI Generate row */}
              <Pressable
                onPress={generateAiCard}
                style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1, marginBottom: 4 })}>
                <Squircle style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }}
                  cornerRadius={16} cornerSmoothing={1}
                  fillColor={TOD_SUBTLE} strokeColor="rgba(255,255,255,0.18)" strokeWidth={1}>
                  <Squircle style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}
                    cornerRadius={12} cornerSmoothing={1} fillColor="rgba(255,255,255,0.1)">
                    <Ionicons name="sparkles" size={18} color="#fff" />
                  </Squircle>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontFamily: 'ProductSans-Black', color: '#fff', marginBottom: 2 }}>AI Generate</Text>
                    <Text style={{ fontSize: 12, fontFamily: 'ProductSans-Regular', color: TOD_MUTED }}>Personalised from your chat</Text>
                  </View>
                  <Squircle style={{ paddingHorizontal: 8, paddingVertical: 3 }} cornerRadius={50} cornerSmoothing={1} fillColor="rgba(255,255,255,0.12)">
                    <Text style={{ fontSize: 10, fontFamily: 'ProductSans-Black', color: '#fff' }}>SMART</Text>
                  </Squircle>
                </Squircle>
              </Pressable>

              {/* Template list */}
              {templates.map((q, i) => (
                <Pressable
                  key={i}
                  onPress={() => { setCardQuestion(q); setCardEmoji(choice === 'truth' ? '🤔' : '🎲'); setStep('preview'); }}
                  style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
                  <Squircle style={{ padding: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}
                    cornerRadius={16} cornerSmoothing={1}
                    fillColor={TOD_SURFACE} strokeColor={TOD_BORDER} strokeWidth={1}>
                    <Text style={{ fontSize: 11, fontFamily: 'ProductSans-Black', color: 'rgba(255,255,255,0.25)', marginTop: 2, width: 18 }}>
                      {String(i + 1).padStart(2, '0')}
                    </Text>
                    <Text style={{ flex: 1, fontSize: 14, fontFamily: 'ProductSans-Medium', color: '#fff', lineHeight: 21 }}>{q}</Text>
                    <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.2)" style={{ marginTop: 2 }} />
                  </Squircle>
                </Pressable>
              ))}

              {/* Write custom */}
              <Pressable
                onPress={() => setStep('custom')}
                style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1, marginTop: 4 })}>
                <Squircle style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}
                  cornerRadius={16} cornerSmoothing={1}
                  fillColor={TOD_SUBTLE} strokeColor={TOD_BORDER} strokeWidth={1}>
                  <Ionicons name="create-outline" size={18} color={TOD_MUTED} />
                  <Text style={{ fontSize: 14, fontFamily: 'ProductSans-Bold', color: TOD_MUTED }}>Write my own…</Text>
                </Squircle>
              </Pressable>
            </ScrollView>
          )}

          {/* ── STEP: custom ── */}
          {step === 'custom' && (
            <View style={{ paddingHorizontal: 16, paddingBottom: 40, gap: 14 }}>
              <Squircle style={{ padding: 16 }} cornerRadius={16} cornerSmoothing={1}
                fillColor={TOD_SURFACE} strokeColor={TOD_BORDER} strokeWidth={1}>
                <Text style={{ fontSize: 10, fontFamily: 'ProductSans-Black', color: TOD_MUTED, letterSpacing: 0.5, marginBottom: 8 }}>
                  {choice === 'truth' ? 'YOUR TRUTH QUESTION' : 'YOUR DARE CHALLENGE'}
                </Text>
                <TextInput
                  style={{ color: '#fff', fontSize: 15, fontFamily: 'ProductSans-Regular', lineHeight: 22, minHeight: 80 }}
                  placeholder={choice === 'dare' ? "Write a dare challenge…" : "Write a truth question…"}
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  value={customText}
                  onChangeText={setCustomText}
                  multiline
                  maxLength={300}
                  autoFocus
                />
              </Squircle>
              <Pressable
                onPress={() => { if (customText.trim()) { setCardQuestion(customText.trim()); setCardEmoji(choice === 'truth' ? '🤔' : '🎲'); setStep('preview'); } }}
                disabled={!customText.trim()}
                style={({ pressed }) => ({ opacity: !customText.trim() ? 0.3 : pressed ? 0.8 : 1 })}>
                <Squircle style={{ paddingVertical: 14, alignItems: 'center' }}
                  cornerRadius={50} cornerSmoothing={1} fillColor="#fff">
                  <Text style={{ fontSize: 15, fontFamily: 'ProductSans-Black', color: '#000' }}>Preview →</Text>
                </Squircle>
              </Pressable>
            </View>
          )}

          {/* ── STEP: ai loading ── */}
          {step === 'ai' && (
            <View style={{ height: 200, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={{ fontSize: 13, fontFamily: 'ProductSans-Regular', color: TOD_MUTED }}>Generating…</Text>
            </View>
          )}

          {/* ── STEP: preview ── */}
          {step === 'preview' && (
            <View style={{ paddingHorizontal: 16, paddingBottom: 40, gap: 14 }}>
              <Squircle style={{ padding: 22 }} cornerRadius={20} cornerSmoothing={1}
                fillColor={TOD_BG} strokeColor={TOD_BORDER} strokeWidth={1}>
                <Squircle style={{ paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 14 }}
                  cornerRadius={50} cornerSmoothing={1} fillColor={TOD_SUBTLE} strokeColor={TOD_BORDER} strokeWidth={1}>
                  <Text style={{ fontSize: 11, fontFamily: 'ProductSans-Black', color: TOD_MUTED, letterSpacing: 0.4 }}>
                    {choice === 'truth' ? '🤔 TRUTH' : '🎲 DARE'}
                  </Text>
                </Squircle>
                <Text style={{ fontSize: 28, textAlign: 'center', marginBottom: 12 }}>{cardEmoji}</Text>
                <Text style={{ fontSize: 16, fontFamily: 'ProductSans-Black', color: '#fff', textAlign: 'center', lineHeight: 24 }}>{cardQuestion}</Text>
              </Squircle>

              <Pressable
                onPress={handleSend}
                style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
                <Squircle style={{ paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  cornerRadius={50} cornerSmoothing={1} fillColor="#fff">
                  <Ionicons name="send" size={15} color="#000" />
                  <Text style={{ fontSize: 15, fontFamily: 'ProductSans-Black', color: '#000' }}>
                    Send to {partnerName}
                  </Text>
                </Squircle>
              </Pressable>

              <Pressable onPress={() => setStep('list')} style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 13, fontFamily: 'ProductSans-Regular', color: TOD_MUTED }}>Pick a different card</Text>
              </Pressable>
            </View>
          )}
        </Pressable>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

// ─── Truth or Dare — Answer Panel ────────────────────────────────────────────

function TodAnswerPanel({ colors, turnMsg, onSubmit, onClose }: {
  colors: any;
  turnMsg: Msg;
  onSubmit: (answer: string) => void;
  onClose: () => void;
}) {
  const slideY  = useRef(new Animated.Value(700)).current;
  const [text, setText] = useState('');
  const extra   = turnMsg.todExtra ?? {};
  const choice  = extra.choice   as 'truth' | 'dare' | undefined;
  const question = extra.question as string | undefined;

  useEffect(() => {
    Animated.spring(slideY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 230 }).start();
  }, []);

  const dismiss = (cb?: () => void) =>
    Animated.timing(slideY, { toValue: 700, duration: 220, useNativeDriver: true }).start(cb);

  return (
    <KeyboardAvoidingView
      style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end' }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      pointerEvents="box-none"
    >
      {/* backdrop — sits behind the panel; tap it to dismiss */}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => dismiss(onClose)} />

      <Animated.View style={[
        styles.panel,
        { position: 'relative', backgroundColor: '#0a0a0a', borderTopColor: 'rgba(255,255,255,0.08)', transform: [{ translateY: slideY }] },
      ]}>
        {/* inner Pressable swallows all taps so they never reach the backdrop */}
        <Pressable onPress={() => {}}>
          <View style={[styles.panelHandle, { backgroundColor: 'rgba(255,255,255,0.15)' }]} />

          {/* Header */}
          <View style={styles.panelHeader}>
            <Pressable onPress={() => dismiss(onClose)} hitSlop={12}>
              <Squircle style={styles.panelCloseBtn} cornerRadius={10} cornerSmoothing={1} fillColor={TOD_SUBTLE}>
                <Ionicons name="close" size={16} color="#fff" />
              </Squircle>
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={[styles.panelTitle, { color: '#fff', textAlign: 'center' }]}>
                {choice === 'dare' ? 'Complete Dare' : 'Answer Truth'}
              </Text>
            </View>
            <View style={{ width: 32 }} />
          </View>

          <View style={{ paddingHorizontal: 16, paddingBottom: 40, gap: 14 }}>
            {/* Question preview */}
            <Squircle style={{ padding: 20 }} cornerRadius={20} cornerSmoothing={1}
              fillColor={TOD_BG} strokeColor={TOD_BORDER} strokeWidth={1}>
              <Squircle style={{ paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 12 }}
                cornerRadius={50} cornerSmoothing={1} fillColor={TOD_SUBTLE} strokeColor={TOD_BORDER} strokeWidth={1}>
                <Text style={{ fontSize: 10, fontFamily: 'ProductSans-Black', color: TOD_MUTED, letterSpacing: 0.4 }}>
                  {choice === 'truth' ? '🤔 TRUTH' : '🎲 DARE'}
                </Text>
              </Squircle>
              {extra.emoji && <Text style={{ fontSize: 28, textAlign: 'center', marginBottom: 10 }}>{extra.emoji}</Text>}
              <Text style={{ fontSize: 15, fontFamily: 'ProductSans-Black', color: '#fff', lineHeight: 22 }}>
                {question ?? ''}
              </Text>
            </Squircle>

            {/* Truth → text input; Dare → just a complete button */}
            {choice === 'truth' ? (
              <>
                <Squircle style={{ padding: 14, minHeight: 100 }} cornerRadius={16} cornerSmoothing={1}
                  fillColor={TOD_SURFACE} strokeColor={TOD_BORDER} strokeWidth={1}>
                  <TextInput
                    style={{ color: '#fff', fontSize: 15, fontFamily: 'ProductSans-Regular', lineHeight: 22, flex: 1 }}
                    placeholder="Your honest answer…"
                    placeholderTextColor="rgba(255,255,255,0.2)"
                    value={text}
                    onChangeText={setText}
                    multiline
                    maxLength={500}
                    autoFocus
                  />
                </Squircle>
                <Pressable
                  onPress={() => { if (!text.trim()) return; dismiss(() => onSubmit(text.trim())); }}
                  disabled={!text.trim()}
                  style={({ pressed }) => ({
                    opacity: !text.trim() ? 0.3 : pressed ? 0.85 : 1,
                  })}>
                  <Squircle style={{ paddingVertical: 15, alignItems: 'center', justifyContent: 'center' }}
                    cornerRadius={50} cornerSmoothing={1} fillColor="#fff">
                    <Text style={{ fontSize: 15, fontFamily: 'ProductSans-Black', color: '#000' }}>Send Answer</Text>
                  </Squircle>
                </Pressable>
              </>
            ) : (
              <Pressable
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); dismiss(() => onSubmit('completed')); }}
                style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
                <Squircle style={{ paddingVertical: 15, alignItems: 'center', justifyContent: 'center' }}
                  cornerRadius={50} cornerSmoothing={1} fillColor="#fff">
                  <Text style={{ fontSize: 15, fontFamily: 'ProductSans-Black', color: '#000' }}>Mark as Complete</Text>
                </Squircle>
              </Pressable>
            )}
          </View>
        </Pressable>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

// ─── Call Bubble (in-chat record) ─────────────────────────────────────────────

function CallBubble({
  msg, colors, isLastInGroup, myAvatar, partnerAvatar,
}: {
  msg: Msg; colors: any;
  isLastInGroup: boolean;
  myAvatar?: string;
  partnerAvatar?: string;
}) {
  const isMe      = msg.from === 'me';
  const isMissed  = msg.callType === 'missed' || msg.callType === 'declined';
  const isVideo   = msg.callKind === 'video';
  const iconColor = isMissed ? '#ef4444' : '#22c55e';
  const callLabel = isVideo ? 'Video call' : 'Voice call';
  const label     = isMissed
    ? `Missed ${callLabel.toLowerCase()}`
    : `${callLabel} · ${Math.floor((msg.callDuration ?? 0) / 60)}:${((msg.callDuration ?? 0) % 60).toString().padStart(2, '0')}`;

  // My calls → neutral gray (distinct, not the white message bubble)
  // Their calls → same surface as their regular text bubbles
  const bubbleBg   = isMe ? colors.surface2  : colors.surface;
  const labelColor = colors.text;
  const timeColor  = colors.textTertiary;
  const arrowColor = isMissed ? '#ef4444' : '#22c55e';
  // Arrow direction = call direction: outgoing (me) = up, incoming (them) = down
  const arrowIcon  = isMe ? 'arrow-up-outline' : 'arrow-down-outline';

  const avatarUri = isMe ? myAvatar : partnerAvatar;
  const avatarSlot = (
    <View style={{ width: 36, alignItems: isMe ? 'flex-end' : 'flex-start', justifyContent: 'flex-end', paddingBottom: 2 }}>
      {isLastInGroup && <BubbleAvatar uri={avatarUri} size={28} />}
    </View>
  );

  return (
    <View style={[styles.bubbleRow, isMe ? styles.bubbleRowMe : styles.bubbleRowThem]}>
      {!isMe && avatarSlot}
      <Squircle
        cornerRadius={20} cornerSmoothing={1}
        fillColor={bubbleBg}
        strokeColor={colors.border} strokeWidth={StyleSheet.hairlineWidth}
        style={styles.callBubble}
      >
        <View style={[styles.callBubbleIcon, { backgroundColor: isMissed ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)' }]}>
          <Ionicons
            name={isVideo ? (isMissed ? 'videocam-off' : 'videocam') : (isMissed ? 'call' : 'call-outline')}
            size={18}
            color={iconColor}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.callBubbleLabel, { color: labelColor }]}>{label}</Text>
          <Text style={[styles.callBubbleTime, { color: timeColor }]}>{msg.time}</Text>
        </View>
        <Ionicons name={arrowIcon} size={14} color={arrowColor} />
      </Squircle>
      {isMe && avatarSlot}
    </View>
  );
}

// ─── Unmatch Modal ────────────────────────────────────────────────────────────

const UNMATCH_REASONS = [
  { id: 'no_match',   label: "We're not a match",       icon: 'close-circle-outline'   as const },
  { id: 'no_reply',  label: 'Not responding',           icon: 'chatbubble-ellipses-outline' as const },
  { id: 'moved_on',  label: 'Moved on',                 icon: 'walk-outline'           as const },
  { id: 'behaviour', label: 'Inappropriate behavior',   icon: 'warning-outline'        as const },
  { id: 'spam',      label: 'Feels like spam',          icon: 'shield-outline'         as const },
  { id: 'other',     label: 'Other reason',             icon: 'ellipsis-horizontal-outline' as const },
];

function UnmatchModal({ visible, colors, insets, onClose, onConfirm }: {
  visible: boolean; colors: any; insets: any;
  onClose: () => void;
  onConfirm: (reason: string, custom?: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [custom,   setCustom]   = useState('');
  const slideY = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    if (visible) {
      setSelected(null);
      setCustom('');
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 260 }).start();
    } else {
      Animated.timing(slideY, { toValue: 600, duration: 220, useNativeDriver: true }).start();
    }
  }, [visible]);

  if (!visible) return null;

  const canConfirm = !!selected && (selected !== 'other' || custom.trim().length > 0);

  return (
    <Modal
      transparent
      visible={visible}
      onRequestClose={onClose}
      animationType="none"
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} onPress={onClose}>
          <Animated.View
            style={[
              styles.unmatchSheet,
              { backgroundColor: colors.bg, paddingBottom: insets.bottom + 20, transform: [{ translateY: slideY }] },
            ]}
          >
            <Pressable onPress={() => {}}>
              {/* Handle */}
              <View style={{ alignItems: 'center', paddingTop: 12, marginBottom: 20 }}>
                <View style={[styles.panelHandle, { backgroundColor: colors.border, marginTop: 0 }]} />
              </View>

              <Text style={[styles.unmatchTitle, { color: colors.text }]}>Why are you unmatching?</Text>
              <Text style={[styles.unmatchSub, { color: colors.textSecondary }]}>
                Your reason is completely private and helps us improve.
              </Text>

              {/* Reason grid — 2 columns of squircles */}
              <View style={styles.unmatchReasonGrid}>
                {UNMATCH_REASONS.map(r => {
                  const isActive = selected === r.id;
                  return (
                    <Pressable
                      key={r.id}
                      onPress={() => setSelected(r.id)}
                      style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1, flex: 1, minWidth: '45%', maxWidth: '48%' }]}
                    >
                      <Squircle
                        cornerRadius={20} cornerSmoothing={1}
                        fillColor={isActive ? colors.text : colors.surface}
                        strokeColor={isActive ? 'transparent' : colors.border}
                        strokeWidth={StyleSheet.hairlineWidth}
                        style={styles.unmatchReasonSquircle}
                      >
                        <Ionicons name={r.icon} size={20} color={isActive ? colors.bg : colors.textSecondary} />
                        <Text style={[styles.unmatchReasonText, { color: isActive ? colors.bg : colors.text }]} numberOfLines={2}>
                          {r.label}
                        </Text>
                      </Squircle>
                    </Pressable>
                  );
                })}
              </View>

              {/* Other — text input; sheet lifts with keyboard via KeyboardAvoidingView */}
              {selected === 'other' && (
                <Squircle
                  cornerRadius={18} cornerSmoothing={1}
                  fillColor={colors.surface}
                  strokeColor={colors.border}
                  strokeWidth={StyleSheet.hairlineWidth}
                  style={{ marginBottom: 16, paddingHorizontal: 16, paddingVertical: 12, minHeight: 80 }}
                >
                  <TextInput
                    style={[styles.unmatchCustomInput, { color: colors.text }]}
                    placeholder="Tell us more…"
                    placeholderTextColor={colors.placeholder}
                    value={custom}
                    onChangeText={setCustom}
                    multiline
                    maxLength={200}
                    autoFocus
                  />
                </Squircle>
              )}

              {/* Confirm */}
              <Squircle
                cornerRadius={18} cornerSmoothing={1}
                fillColor={canConfirm ? '#ef4444' : colors.surface2}
                style={styles.unmatchConfirmBtn}
              >
                <Pressable
                  onPress={() => canConfirm && onConfirm(selected!, selected === 'other' ? custom.trim() : undefined)}
                  style={{ width: '100%', alignItems: 'center', paddingVertical: 15 }}
                >
                  <Text style={[styles.unmatchConfirmText, { color: canConfirm ? '#fff' : colors.textSecondary }]}>
                    Unmatch
                  </Text>
                </Pressable>
              </Squircle>
            </Pressable>
          </Animated.View>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Partner Profile Modal ─────────────────────────────────────────────────────

const PROFILE_DETAILS_META = [
  { key: 'height',    icon: 'resize-outline'       as const, label: 'Height'     },
  { key: 'drinks',    icon: 'wine-outline'          as const, label: 'Drinks'     },
  { key: 'smokes',    icon: 'flame-outline'         as const, label: 'Smokes'     },
  { key: 'gender',    icon: 'transgender-outline'   as const, label: 'Gender'     },
  { key: 'wantsKids', icon: 'people-outline'        as const, label: 'Wants kids' },
  { key: 'sign',      icon: 'star-outline'          as const, label: 'Star sign'  },
  { key: 'religion',  icon: 'globe-outline'         as const, label: 'Religion'   },
  { key: 'ethnicity', icon: 'people-outline'        as const, label: 'Ethnicity'  },
  { key: 'education', icon: 'school-outline'        as const, label: 'Education'  },
];

// ── AI Insights skeleton shimmer ─────────────────────────────────────────────
function InsightsShimmer({ colors }: { colors: any }) {
  const pulse = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.35, duration: 750, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const bone = (w: number | string, h: number, r = 10) => (
    <Animated.View style={{ opacity: pulse, width: w as any, height: h, borderRadius: r, backgroundColor: colors.surface2 }} />
  );
  return (
    <Squircle
      cornerRadius={24} cornerSmoothing={1}
      fillColor={colors.surface}
      strokeColor={colors.border}
      strokeWidth={StyleSheet.hairlineWidth}
      style={{ gap: 10, paddingTop: 14, paddingBottom: 16, paddingHorizontal: 16 }}
    >
      {/* header row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {bone(26, 26, 8)}
        {bone(100, 14, 7)}
        <View style={{ flex: 1 }} />
        {bone(90, 10, 5)}
      </View>
      {/* compat card skeleton */}
      {bone('100%', 108, 16)}
      {/* chips row skeleton */}
      <View style={{ flexDirection: 'row', gap: 7 }}>
        {bone(110, 34, 20)}
        {bone(130, 34, 20)}
      </View>
      <View style={{ flexDirection: 'row', gap: 7 }}>
        {bone(120, 34, 20)}
        {bone(145, 34, 20)}
      </View>
    </Squircle>
  );
}

function PartnerProfileModal({ visible, colors, insets, name, image, partnerId, token, isPro, myInterests, onClose, onUnmatch }: {
  visible: boolean; colors: any; insets: any;
  name: string; image: string; partnerId: string;
  token?: string;
  isPro?: boolean;
  myInterests?: string[];
  onClose: () => void;
  onUnmatch: () => void;
}) {
  const slideY = useRef(new Animated.Value(SCREEN_H)).current;
  const [profile, setProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, damping: 28, stiffness: 220 }).start();
      if (token && partnerId) {
        setProfileLoading(true);
        apiFetch<any>(`/discover/profile/${partnerId}`, { token })
          .then(data => { setProfile(data); setProfileLoading(false); })
          .catch(() => setProfileLoading(false));
      }
    } else {
      setProfile(null);
      setProfileLoading(false);
      Animated.timing(slideY, { toValue: SCREEN_H, duration: 220, useNativeDriver: true }).start();
    }
  }, [visible]);

  if (!visible) return null;

  const images     = profile?.images ?? (image ? [image] : []);
  const heroPhoto  = images[0] ?? image;
  const profileAge = profile?.age ?? null;
  const about      = profile?.about ?? null;
  const prompts    = profile?.prompts ?? [];
  const interests  = (profile?.interests ?? []) as { emoji: string; label: string }[];
  const languages  = (profile?.languages ?? []) as string[];
  const lookingFor = profile?.lookingFor ?? null;
  const details    = profile?.details ?? {};
  const location   = profile?.location ?? null;
  const distance   = profile?.distance ?? null;
  const verified   = profile?.verified ?? false;
  const purpose    = (profile?.purpose ?? []) as string[];
  const compat     = profile?.compatibility ?? null;

  const activeDetails = PROFILE_DETAILS_META.filter(d => details[d.key]);

  // Shared interests between me and partner (matched label strings)
  const partnerInterestLabels = interests.map(i => i.label);
  const sharedCount = (myInterests ?? []).filter(mi => partnerInterestLabels.includes(mi)).length;

  // All AI insights come from backend compat object only
  const compatInsights = (compat?.insights ?? []) as { emoji: string; label: string }[];
  const compatBrief    = (compat?.brief ?? '') as string;

  return (
    <Modal transparent visible={visible} onRequestClose={onClose} animationType="none">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)' }}>
        <Animated.View
          style={[styles.profileSheet, { backgroundColor: colors.bg, transform: [{ translateY: slideY }] }]}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          >
            {/* ── Hero photo with gradient overlay + floating header ── */}
            <View style={{ height: H_PHOTO, position: 'relative' }}>
              <Image
                source={{ uri: heroPhoto }}
                style={{ width: '100%', height: H_PHOTO }}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={200}
              />

              {/* Top gradient: dark→transparent (for header legibility) */}
              <LinearGradient
                colors={['rgba(0,0,0,0.72)', 'rgba(0,0,0,0.18)', 'transparent']}
                locations={[0, 0.45, 1]}
                style={[StyleSheet.absoluteFill, { height: H_PHOTO * 0.42 }]}
                pointerEvents="none"
              />

              {/* Bottom gradient: transparent→dark (for name overlay) */}
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.92)']}
                locations={[0.4, 0.72, 1]}
                style={[StyleSheet.absoluteFill, { top: H_PHOTO * 0.4 }]}
                pointerEvents="none"
              />

              {/* ── Floating header row ── */}
              <View style={[styles.profileGlobalHeader, { paddingTop: insets.top + 6 }]}>
                <Pressable onPress={onClose} hitSlop={10} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
                  <Squircle style={styles.profileHeaderIconBtn} cornerRadius={12} cornerSmoothing={1} fillColor="rgba(0,0,0,0.38)">
                    <Ionicons name="chevron-back" size={22} color="#fff" />
                  </Squircle>
                </Pressable>

                <View style={{ flex: 1 }} />

                {/* Unmatch */}
                <Pressable onPress={onUnmatch} hitSlop={10} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
                  <Squircle
                    style={styles.profileGlobalUnmatch}
                    cornerRadius={14} cornerSmoothing={1} fillColor="rgba(0,0,0,0.38)"
                  >
                    <Ionicons name="person-remove-outline" size={14} color="#f87171" />
                    <Text style={{ fontSize: 11, fontFamily: 'ProductSans-Bold', color: '#f87171' }}>Unmatch</Text>
                  </Squircle>
                </Pressable>
              </View>

              {/* Name/age/location overlay at bottom of hero */}
              <View style={styles.profileHeroInfo} pointerEvents="none">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.profileHeroName}>
                    {name}{profileAge != null ? `, ${profileAge}` : ''}
                  </Text>
                  {verified && <Ionicons name="checkmark-circle" size={18} color="#4FC3F7" />}
                </View>
                {(location || distance) ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
                    <Ionicons name="location" size={12} color="rgba(255,255,255,0.7)" />
                    <Text style={styles.profileHeroLocation}>
                      {[location, distance ? `${distance} away` : null].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* ── AI Insights (Pro only) ── */}
            <View style={{ marginHorizontal: 16, marginBottom: 4, marginTop: 16 }}>
              {isPro ? (
                profileLoading ? (
                  <InsightsShimmer colors={colors} />
                ) : (
                <Squircle
                  cornerRadius={24} cornerSmoothing={1}
                  fillColor={colors.surface}
                  strokeColor={colors.border}
                  strokeWidth={StyleSheet.hairlineWidth}
                  style={styles.profileInsightsWrap}
                >
                  {/* Header */}
                  <View style={styles.profileInsightsHeader}>
                    <Text style={[styles.profileInsightsTitle, { color: colors.text }]}>AI Insights</Text>
                    <Text style={[styles.profileInsightsSub, { color: colors.textSecondary }]}>Powered by Zod AI</Text>
                  </View>

                  {/* ── Compatibility score (from backend only) ── */}
                  {compat?.percent != null && (
                    <Squircle
                      cornerRadius={16} cornerSmoothing={1}
                      fillColor="rgba(120,120,128,0.10)"
                      strokeColor="rgba(120,120,128,0.18)"
                      strokeWidth={StyleSheet.hairlineWidth}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 14 }}
                    >
                      <Squircle
                        cornerRadius={18} cornerSmoothing={1}
                        fillColor="rgba(120,120,128,0.14)"
                        strokeColor="rgba(120,120,128,0.25)"
                        strokeWidth={1}
                        style={{ width: 80, height: 80, alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Text style={{ fontSize: 26, fontFamily: 'ProductSans-Black', color: colors.text, lineHeight: 30 }}>
                          {(compat.percent / 10).toFixed(1)}
                        </Text>
                        <Text style={{ fontSize: 10, fontFamily: 'ProductSans-Bold', color: colors.textSecondary }}>/10</Text>
                      </Squircle>
                      <View style={{ flex: 1, gap: 3 }}>
                        <Text style={{ fontSize: 10, fontFamily: 'ProductSans-Bold', color: colors.textSecondary, letterSpacing: 1 }}>COMPATIBILITY</Text>
                        <Text style={{ fontSize: 13, fontFamily: 'ProductSans-Bold', color: colors.text }}>
                          {compat.percent >= 80 ? '🔥 Excellent match' : compat.percent >= 60 ? '✨ Great match' : '💫 Building chemistry'}
                        </Text>
                        {!!compatBrief && (
                          <Text style={{ fontSize: 12, fontFamily: 'ProductSans-Regular', color: colors.textSecondary, lineHeight: 17 }}>
                            {compatBrief}
                          </Text>
                        )}
                      </View>
                    </Squircle>
                  )}

                  {/* ── Insight chips from backend ── */}
                  {compatInsights.length > 0 && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                      {compatInsights.map(chip => (
                        <Squircle
                          key={chip.label}
                          cornerRadius={20} cornerSmoothing={1}
                          fillColor="rgba(120,120,128,0.12)"
                          strokeColor="rgba(120,120,128,0.20)"
                          strokeWidth={StyleSheet.hairlineWidth}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 7 }}
                        >
                          <Text style={{ fontSize: 13 }}>{chip.emoji}</Text>
                          <Text style={{ fontSize: 12, fontFamily: 'ProductSans-Medium', color: colors.text }}>{chip.label}</Text>
                        </Squircle>
                      ))}
                    </View>
                  )}

                  {/* ── Per-category score tiles from backend breakdown ── */}
                  {compat?.breakdown && Object.keys(compat.breakdown).length > 0 && (() => {
                    const SCORE_META: Record<string, { emoji: string; color: string }> = {
                      career:      { emoji: '💼', color: '#f59e0b' },
                      values:      { emoji: '🌟', color: '#8b5cf6' },
                      lifestyle:   { emoji: '🏃', color: '#10b981' },
                      interests:   { emoji: '❤️', color: '#ef4444' },
                      goals:       { emoji: '🎯', color: '#3b82f6' },
                      humor:       { emoji: '😄', color: '#f59e0b' },
                      personality: { emoji: '✨', color: '#a78bfa' },
                    };
                    return (
                      <View style={{ gap: 8 }}>
                        <Text style={[styles.profileInsightsCareerlabel, { color: colors.textSecondary }]}>SCORES</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                          {Object.entries(compat.breakdown as Record<string, number>).map(([key, val]) => {
                            const m = SCORE_META[key] ?? { emoji: '⭐', color: colors.text };
                            return (
                              <Squircle
                                key={key}
                                cornerRadius={14} cornerSmoothing={1}
                                fillColor={colors.surface2}
                                strokeColor={colors.border}
                                strokeWidth={StyleSheet.hairlineWidth}
                                style={{ flex: 1, minWidth: 80, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 6, gap: 4 }}
                              >
                                <Text style={{ fontSize: 18 }}>{m.emoji}</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 1 }}>
                                  <Text style={{ fontSize: 20, fontFamily: 'ProductSans-Black', color: m.color }}>{(val / 10).toFixed(1)}</Text>
                                  <Text style={{ fontSize: 10, fontFamily: 'ProductSans-Bold', color: colors.textSecondary }}>/10</Text>
                                </View>
                                <Text style={{ fontSize: 10, fontFamily: 'ProductSans-Medium', color: colors.textSecondary, textTransform: 'capitalize', textAlign: 'center' }}>
                                  {key.replace(/_/g, ' ')}
                                </Text>
                              </Squircle>
                            );
                          })}
                        </View>
                      </View>
                    );
                  })()}

                  {/* No data state */}
                  {!compat && (
                    <Text style={{ fontSize: 12, fontFamily: 'ProductSans-Regular', color: colors.textSecondary, textAlign: 'center', paddingVertical: 8 }}>
                      Compatibility analysis not available yet.
                    </Text>
                  )}
                </Squircle>
                )
              ) : (
                /* Locked state for free users */
                <Squircle
                  cornerRadius={20} cornerSmoothing={1} fillColor={colors.surface}
                  strokeColor={colors.border} strokeWidth={StyleSheet.hairlineWidth}
                  style={styles.profileInsightsLocked}
                >
                  <View style={{ alignItems: 'center', gap: 6 }}>
                    <Squircle style={styles.profileInsightsLockedIcon} cornerRadius={16} cornerSmoothing={1} fillColor={colors.surface2}>
                      <Ionicons name="lock-closed" size={20} color={colors.textSecondary} />
                    </Squircle>
                    <Text style={[styles.profileInsightsLockedTitle, { color: colors.text }]}>AI Insights · Pro</Text>
                    <Text style={[styles.profileInsightsLockedSub, { color: colors.textSecondary }]}>
                      See compatibility score, career, shared interests and more
                    </Text>
                  </View>
                  {/* Blurred stat rows as tease */}
                  <View style={{ gap: 8, opacity: 0.3, pointerEvents: 'none' }}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {[0, 1, 2].map(i => (
                        <View key={i} style={[{ flex: 1, height: 72, borderRadius: 14, backgroundColor: colors.surface2 }]} />
                      ))}
                    </View>
                    <View style={{ height: 48, borderRadius: 14, backgroundColor: colors.surface2 }} />
                  </View>
                </Squircle>
              )}
            </View>

            {/* ── Details section ── */}
            <View style={[styles.profileDetailSec, { backgroundColor: colors.bg }]}>

              {/* About */}
              {about ? (
                <Squircle
                  cornerRadius={20} cornerSmoothing={1}
                  fillColor={colors.surface}
                  strokeColor={colors.border}
                  strokeWidth={StyleSheet.hairlineWidth}
                  style={{ padding: 16, gap: 8, marginBottom: 4 }}
                >
                  <Text style={[styles.profileSecLabel, { color: colors.textSecondary }]}>ABOUT</Text>
                  <Text style={[styles.profileAbout, { color: colors.text }]}>{about}</Text>
                </Squircle>
              ) : null}

              {/* Purpose / Looking for */}
              {(lookingFor || purpose.length > 0) ? (
                <>
                  <View style={styles.profileSec}>
                    <Text style={[styles.profileSecLabel, { color: colors.textSecondary }]}>LOOKING FOR</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {lookingFor ? (
                        <Squircle
                          cornerRadius={14} cornerSmoothing={1} fillColor={colors.surface}
                          strokeColor={colors.border} strokeWidth={StyleSheet.hairlineWidth}
                          style={styles.profilePurposePill}
                        >
                          <Ionicons name="heart-outline" size={14} color={colors.text} />
                          <Text style={[styles.profilePurposeText, { color: colors.text }]}>{lookingFor}</Text>
                        </Squircle>
                      ) : null}
                      {purpose.map((p: string) => (
                        <Squircle
                          key={p} cornerRadius={14} cornerSmoothing={1} fillColor={colors.surface}
                          strokeColor={colors.border} strokeWidth={StyleSheet.hairlineWidth}
                          style={styles.profilePurposePill}
                        >
                          <Text style={[styles.profilePurposeText, { color: colors.text }]}>{p}</Text>
                        </Squircle>
                      ))}
                    </View>
                  </View>
                  <View style={[styles.profileDivider, { backgroundColor: colors.border }]} />
                </>
              ) : null}

              {/* First prompt */}
              {prompts[0] ? (
                <>
                  <Squircle
                    cornerRadius={18} cornerSmoothing={1} fillColor={colors.surface}
                    style={styles.profilePromptCard}
                  >
                    <Text style={[styles.profilePromptQ, { color: colors.textSecondary }]}>{prompts[0].question}</Text>
                    <Text style={[styles.profilePromptA, { color: colors.text }]}>{prompts[0].answer}</Text>
                  </Squircle>
                  <View style={[styles.profileDivider, { backgroundColor: colors.border }]} />
                </>
              ) : null}

              {/* 2nd photo */}
              {images[1] ? (
                <>
                  <Image source={{ uri: images[1] }} style={styles.profileInlinePhoto} contentFit="cover" cachePolicy="memory-disk" transition={200} />
                  <View style={[styles.profileDivider, { backgroundColor: colors.border }]} />
                </>
              ) : null}

              {/* Interests */}
              {interests.length > 0 ? (
                <>
                  <View style={styles.profileSec}>
                    <Text style={[styles.profileSecLabel, { color: colors.textSecondary }]}>INTERESTS</Text>
                    <View style={styles.profileChipRow}>
                      {interests.map((item: { emoji: string; label: string }) => (
                        <Squircle
                          key={item.label} cornerRadius={14} cornerSmoothing={1}
                          fillColor={colors.surface} strokeColor={colors.border} strokeWidth={StyleSheet.hairlineWidth}
                          style={styles.profileChip}
                        >
                          <Text style={{ fontSize: 15 }}>{item.emoji}</Text>
                          <Text style={[styles.profileChipLabel, { color: colors.text }]}>{item.label}</Text>
                        </Squircle>
                      ))}
                    </View>
                  </View>
                  <View style={[styles.profileDivider, { backgroundColor: colors.border }]} />
                </>
              ) : null}

              {/* 2nd prompt */}
              {prompts[1] ? (
                <>
                  <Squircle
                    cornerRadius={18} cornerSmoothing={1} fillColor={colors.surface}
                    style={styles.profilePromptCard}
                  >
                    <Text style={[styles.profilePromptQ, { color: colors.textSecondary }]}>{prompts[1].question}</Text>
                    <Text style={[styles.profilePromptA, { color: colors.text }]}>{prompts[1].answer}</Text>
                  </Squircle>
                  <View style={[styles.profileDivider, { backgroundColor: colors.border }]} />
                </>
              ) : null}

              {/* 3rd photo */}
              {images[2] ? (
                <>
                  <Image source={{ uri: images[2] }} style={styles.profileInlinePhoto} contentFit="cover" cachePolicy="memory-disk" transition={200} />
                  <View style={[styles.profileDivider, { backgroundColor: colors.border }]} />
                </>
              ) : null}

              {/* Detail grid (height, gender, sign etc.) */}
              {activeDetails.length > 0 ? (
                <>
                  <View style={styles.profileSec}>
                    <Text style={[styles.profileSecLabel, { color: colors.textSecondary }]}>DETAILS</Text>
                    <View style={styles.profileDetailGrid}>
                      {activeDetails.map(d => (
                        <Squircle
                          key={d.key} cornerRadius={14} cornerSmoothing={1}
                          fillColor={colors.surface} style={styles.profileDetailChip}
                        >
                          <Ionicons name={d.icon} size={14} color={colors.textSecondary} />
                          <View style={{ marginLeft: 6 }}>
                            <Text style={[styles.profileDetailLabel, { color: colors.textSecondary }]}>{d.label}</Text>
                            <Text style={[styles.profileDetailValue, { color: colors.text }]}>{details[d.key]}</Text>
                          </View>
                        </Squircle>
                      ))}
                    </View>
                  </View>
                  <View style={[styles.profileDivider, { backgroundColor: colors.border }]} />
                </>
              ) : null}

              {/* 3rd prompt */}
              {prompts[2] ? (
                <>
                  <Squircle
                    cornerRadius={18} cornerSmoothing={1} fillColor={colors.surface}
                    style={styles.profilePromptCard}
                  >
                    <Text style={[styles.profilePromptQ, { color: colors.textSecondary }]}>{prompts[2].question}</Text>
                    <Text style={[styles.profilePromptA, { color: colors.text }]}>{prompts[2].answer}</Text>
                  </Squircle>
                  <View style={[styles.profileDivider, { backgroundColor: colors.border }]} />
                </>
              ) : null}

              {/* More photos (4th onwards) */}
              {images.slice(3).map((img: string, i: number) => (
                <React.Fragment key={img + i}>
                  <Image source={{ uri: img }} style={styles.profileInlinePhoto} contentFit="cover" cachePolicy="memory-disk" transition={200} />
                  <View style={[styles.profileDivider, { backgroundColor: colors.border }]} />
                </React.Fragment>
              ))}

              {/* Languages */}
              {languages.length > 0 ? (
                <>
                  <View style={styles.profileSec}>
                    <Text style={[styles.profileSecLabel, { color: colors.textSecondary }]}>LANGUAGES</Text>
                    <View style={styles.profileChipRow}>
                      {languages.map((lang: string) => (
                        <Squircle
                          key={lang} cornerRadius={14} cornerSmoothing={1}
                          fillColor={colors.surface} strokeColor={colors.border} strokeWidth={StyleSheet.hairlineWidth}
                          style={styles.profileChip}
                        >
                          <Ionicons name="language-outline" size={13} color={colors.textSecondary} />
                          <Text style={[styles.profileChipLabel, { color: colors.text }]}>{lang}</Text>
                        </Squircle>
                      ))}
                    </View>
                  </View>
                  <View style={[styles.profileDivider, { backgroundColor: colors.border }]} />
                </>
              ) : null}

              {/* Report & Block */}
              <View style={styles.profileDangerRow}>
                <Pressable
                  hitSlop={4}
                  onPress={() =>
                    Alert.alert('Report', `Report ${name}?`, [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Report', style: 'destructive',
                        onPress: () => apiFetch(`/chat/${partnerId}/report`, { token, method: 'POST', body: JSON.stringify({ reason: 'user_report' }) }).catch(() => {}),
                      },
                    ])
                  }
                  style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.7 : 1 }]}
                >
                  <Squircle
                    cornerRadius={18} cornerSmoothing={1}
                    fillColor={colors.surface}
                    strokeColor={colors.border}
                    strokeWidth={StyleSheet.hairlineWidth}
                    style={styles.profileDangerBtn}
                  >
                    <Ionicons name="flag-outline" size={17} color="#ef4444" />
                    <Text style={[styles.profileDangerText, { color: '#ef4444' }]}>Report</Text>
                  </Squircle>
                </Pressable>

                <Pressable
                  hitSlop={4}
                  onPress={() =>
                    Alert.alert('Block', `Block ${name}?`, [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Block', style: 'destructive',
                        onPress: () => apiFetch(`/chat/${partnerId}/block`, { token, method: 'POST' }).catch(() => {}),
                      },
                    ])
                  }
                  style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.7 : 1 }]}
                >
                  <Squircle
                    cornerRadius={18} cornerSmoothing={1}
                    fillColor={colors.surface}
                    strokeColor={colors.border}
                    strokeWidth={StyleSheet.hairlineWidth}
                    style={styles.profileDangerBtn}
                  >
                    <Ionicons name="ban-outline" size={17} color={colors.textSecondary} />
                    <Text style={[styles.profileDangerText, { color: colors.textSecondary }]}>Block</Text>
                  </Squircle>
                </Pressable>
              </View>

            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
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
  const [contentWarning, setContentWarning] = useState<string | null>(null);
  const [showAi,        setShowAi]        = useState(false);
  const [showCards,     setShowCards]     = useState(false);
  const [showInsight,   setShowInsight]   = useState(false);
  const [answeringCard, setAnsweringCard] = useState<string | null>(null);
  const [replyingTo,    setReplyingTo]    = useState<Msg | null>(null);
  const [isPartnerTyping,  setIsPartnerTyping]  = useState(false);
  // true only when the cache is empty AND we haven't fetched yet
  const [loadingHistory,   setLoadingHistory]   = useState(true);
  // true while catching up missed messages after cache restore
  const [catchingUp,       setCatchingUp]       = useState(false);
  // true while loading an older page (scroll-to-top pagination)
  const [loadingOlder,     setLoadingOlder]     = useState(false);
  // false once the server returns fewer than PAGE_SIZE messages
  const [hasOlderMessages, setHasOlderMessages] = useState(true);
  const [isOnline,        setIsOnline]        = useState(online);
  const [keyboardShown,   setKeyboardShown]   = useState(false);
  const [showProfile,     setShowProfile]     = useState(false);
  const [showUnmatch,     setShowUnmatch]     = useState(false);
  const [isListening,     setIsListening]     = useState(false);
  const [isTranscribing,  setIsTranscribing]  = useState(false);
  const recStartingRef  = useRef(false);

  // ── Message context-menu (long-press) ────────────────────────────────────
  const [ctxMsg,       setCtxMsg]       = useState<Msg | null>(null);
  const [ctxInfoMsg,   setCtxInfoMsg]   = useState<Msg | null>(null);
  const [editingMsg,   setEditingMsg]   = useState<Msg | null>(null);
  const [editText,     setEditText]     = useState('');
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);

  // Load recent emojis from storage on mount
  useEffect(() => {
    AsyncStorage.getItem('chat_recentEmojis').then(raw => {
      if (raw) setRecentEmojis(JSON.parse(raw));
    }).catch(() => {});
  }, []);

  const saveRecentEmoji = useCallback((emoji: string) => {
    setRecentEmojis(prev => {
      const next = [emoji, ...prev.filter(e => e !== emoji)].slice(0, 20);
      AsyncStorage.setItem('chat_recentEmojis', JSON.stringify(next));
      return next;
    });
  }, []);

  const openCtxMenu = useCallback((msg: Msg) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCtxMsg(msg);
  }, []);

  const closeCtxMenu = useCallback(() => setCtxMsg(null), []);

  const handleReact = useCallback(async (msg: Msg, emoji: string) => {
    if (!token) return;
    saveRecentEmoji(emoji);
    closeCtxMenu();
    try {
      const res = await apiFetch<{ action: string; reactions: MsgReaction[] }>(
        `/chat/messages/${msg.id}/react`,
        { token, method: 'POST', body: JSON.stringify({ emoji }) },
      );
      setMessages(prev => prev.map(m =>
        m.id === msg.id ? { ...m, reactions: res.reactions } : m
      ));
      // Persist to local cache so reactions survive re-opens
      patchCacheMessage(partnerId, msg.id, { reactions: res.reactions });
    } catch {}
  }, [token, partnerId, saveRecentEmoji, closeCtxMenu]);

  const handleEditSave = useCallback(async () => {
    if (!token || !editingMsg) return;
    const trimmed = editText.trim();
    if (!trimmed) return;
    const prev = editingMsg.text;
    setMessages(msgs => msgs.map(m =>
      m.id === editingMsg.id ? { ...m, text: trimmed, editedAt: new Date().toISOString() } : m
    ));
    setEditingMsg(null);
    try {
      await apiFetch(`/chat/messages/${editingMsg.id}`, {
        token, method: 'PATCH',
        body: JSON.stringify({ content: trimmed }),
      });
    } catch {
      setMessages(msgs => msgs.map(m =>
        m.id === editingMsg.id ? { ...m, text: prev, editedAt: editingMsg.editedAt } : m
      ));
    }
  }, [token, editingMsg, editText]);

  // Track keyboard visibility to remove safe-area bottom padding when it's up
  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', () => setKeyboardShown(true));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKeyboardShown(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // ── Global call context ───────────────────────────────────────────────────
  const { initiateCall, onCallRecord, onNotifyMessage, notifySend } = useCall();

  const CALL_MSG_THRESHOLD = 10;

  const handleInitiateCall = useCallback((callKind: 'audio' | 'video' = 'audio') => {
    const isVerified = profile?.verification_status === 'verified';
    const realMsgCount = messages.filter(m => !m.isCall && !m.isCard && !m.isAnswer && !m.isTod && !m.isGame).length;
    const needsMsgs = realMsgCount < CALL_MSG_THRESHOLD;
    const msgsLeft  = CALL_MSG_THRESHOLD - realMsgCount;

    if (!isVerified || needsMsgs) {
      const lines: string[] = [];
      if (!isVerified) lines.push('• Get face-verified (Profile → Verify Me)');
      if (needsMsgs)   lines.push(`• Send ${msgsLeft} more message${msgsLeft === 1 ? '' : 's'} (${realMsgCount}/${CALL_MSG_THRESHOLD})`);
      Alert.alert(
        callKind === 'video' ? '📹 Video Call Locked' : '📞 Voice Call Locked',
        `To protect everyone's safety, ${callKind} calls unlock once:\n\n${lines.join('\n')}`,
        [{ text: 'Got it', style: 'default' }],
      );
      return;
    }
    initiateCall({ id: partnerId, name, image: image || undefined }, callKind);
  }, [initiateCall, partnerId, name, image, profile, messages]);

  // ── Truth or Dare game state ──────────────────────────────────────────────
  // showTodPicker: open the "send a card" panel (sender flow)
  const [showTodPicker,      setShowTodPicker]      = useState(false);
  // todPickerDefault: pre-select truth/dare when partner has already chosen
  const [todPickerDefault,   setTodPickerDefault]   = useState<'truth' | 'dare' | null>(null);
  // todAnswerMsg: the turn message the receiver is answering
  const [todAnswerMsg,       setTodAnswerMsg]       = useState<Msg | null>(null);

  // ── Mini-games state ──────────────────────────────────────────────────────
  const [showGames, setShowGames] = useState(false);
  const scrollRef       = useRef<ScrollView>(null);
  const msgLayoutsRef      = useRef<Record<string, number>>({});
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);
  const chatRecorder    = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  // Drive the recording timer directly from native recorder (1 s poll) — no setInterval flicker
  const recState        = useAudioRecorderState(chatRecorder, 1000);
  const scrollToMessage = React.useCallback((id: string) => {
    const y = msgLayoutsRef.current[id];
    if (y !== undefined) {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 100), animated: true });
      // Trigger the purple flash after the scroll animation lands
      setTimeout(() => {
        setHighlightedMsgId(id);
        setTimeout(() => setHighlightedMsgId(null), 1500);
      }, 350);
    }
  }, []);
  const wsRef           = useRef<WebSocket | null>(null);
  const safeSendRef     = useRef<((raw: string) => void) | null>(null);
  // Tracks the last optimistic message ID so we can replace it with the real echo
  const pendingOptIdRef = useRef<string | null>(null);
  // Global dedup set — prevents chat WS + notify WS both adding the same message
  const seenMsgIdsRef   = useRef<Set<string>>(new Set());
  const myId      = profile?.id ?? '';

  // (cache writes now happen directly at each setMessages call-site — no debounce needed)

  // Register for call_record events so call bubbles appear in this chat
  useEffect(() => {
    return onCallRecord((rec) => {
      if (rec.sender_id !== partnerId && rec.receiver_id !== partnerId) return;
      const bubble: Msg = {
        id:           rec.id,
        text:         '',
        from:         rec.sender_id === myId ? 'me' : 'them',
        time:         new Date(rec.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isCall:       true,
        callType:     rec.call_type,
        callKind:     rec.call_kind ?? 'audio',
        callDuration: rec.duration,
      };
      setMessages(prev => {
        if (prev.some(m => m.id === bubble.id)) return prev;
        return [...prev, bubble];
      });
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    });
  }, [onCallRecord, partnerId, myId]);

  // ── Convert API message to local Msg ──────────────────────────────────────
  const apiMsgToMsg = useCallback((m: ApiMessage): Msg => {
    const isTodMsg  = m.msg_type?.startsWith('tod_');
    const isGameMsg = GAME_MSG_TYPES.has(m.msg_type);
    const isImage   = m.msg_type === 'image';
    const isVoice   = m.msg_type === 'voice';
    const isCall    = m.msg_type === 'call';
    return {
      id:      m.id,
      text:    (isImage || isVoice || isCall) ? '' : m.content,
      from:    m.sender_id === myId ? 'me' : 'them',
      time:    _formatTime(m.created_at),
      rawTime: m.created_at,
      isCard:  m.msg_type === 'card',
      isAnswer: m.msg_type === 'answer',
      answerTo: m.metadata?.answerTo,
      replyToId: m.metadata?.replyToId,
      status:  m.sender_id === myId ? (m.is_read ? 'read' : 'delivered') : undefined,
      isTod:    isTodMsg,
      todMsgType: isTodMsg ? (m.msg_type as Msg['todMsgType']) : undefined,
      todExtra:   isTodMsg ? ((m.metadata as Record<string, any>) ?? undefined) : undefined,
      isGame:     isGameMsg,
      gameMsgType: isGameMsg ? m.msg_type : undefined,
      gameExtra:   isGameMsg ? ((m.metadata as Record<string, any>) ?? undefined) : undefined,
      imageUrl:     isImage ? (m.metadata?.imageUrl ?? m.content) : undefined,
      audioUrl:     isVoice ? (m.metadata?.audioUrl ?? m.content) : undefined,
      audioDuration: isVoice ? Number(m.metadata?.duration_sec ?? 0) : undefined,
      isCall,
      callType:     isCall ? ((m.metadata?.call_type ?? 'ended') as Msg['callType']) : undefined,
      callKind:     isCall ? ((m.metadata?.call_kind === 'video' ? 'video' : 'audio') as Msg['callKind']) : undefined,
      callDuration: isCall ? Number(m.metadata?.duration ?? 0) : undefined,
      reactions:    (m as any).reactions ?? [],
      editedAt:     (m as any).edited_at ?? undefined,
      readAt:       (m as any).read_at ?? undefined,
    };
  }, [myId]);

  // ── Load message history ───────────────────────────────────────────────────
  // Strategy:
  //  A) Cache hit  → show instantly, then catch-up (only messages after lastCachedTime)
  //  B) Cache miss → show spinner, fetch last PAGE_SIZE messages, set cache, done
  // ─────────────────────────────────────────────────────────────────────────────
  const PAGE_SIZE = 60;

  useEffect(() => {
    if (!token || !partnerId) { setLoadingHistory(false); return; }
    let cancelled = false;

    const init = async () => {
      // ── A: try cache first ───────────────────────────────────────────────
      const cached = await loadCache(partnerId);

      if (cached.length > 0 && !cancelled) {
        seenMsgIdsRef.current = new Set(cached.map(m => m.id));
        setMessages(cached as Msg[]);
        setLoadingHistory(false);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 80);

        // Catch-up: only fetch messages newer than latest cached message
        const lastTime = getLatestCachedTime(partnerId);
        if (lastTime) {
          setCatchingUp(true);
          try {
            const r = await apiFetch<{ messages: ApiMessage[]; has_more: boolean }>(
              `/chat/${partnerId}/messages?after=${encodeURIComponent(lastTime)}&limit=${PAGE_SIZE}`,
              { token },
            );
            if (cancelled) return;
            if (r.messages.length > 0) {
              const newMsgs = r.messages.map(apiMsgToMsg);
              const newIds  = newMsgs.map(m => m.id).filter(id => !seenMsgIdsRef.current.has(id));
              if (newIds.length > 0) {
                appendToCache(partnerId, newMsgs as CachedMsg[]);
                newMsgs.forEach(m => seenMsgIdsRef.current.add(m.id));
                setMessages(prev => {
                  const existingIds = new Set(prev.map(m => m.id));
                  const toAdd = newMsgs.filter(m => !existingIds.has(m.id));
                  return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
                });
                setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
              }
            }
          } catch { /* network — cached view is fully usable */ }
          finally { if (!cancelled) setCatchingUp(false); }
        }
        return;
      }

      // ── B: no cache — full load ──────────────────────────────────────────
      try {
        const r = await apiFetch<{ messages: ApiMessage[]; has_more: boolean }>(
          `/chat/${partnerId}/messages?limit=${PAGE_SIZE}`,
          { token },
        );
        if (cancelled) return;
        const msgs = r.messages.map(apiMsgToMsg);
        seenMsgIdsRef.current = new Set(msgs.map(m => m.id));
        setCache(partnerId, msgs as CachedMsg[]);
        setMessages(msgs);
        setHasOlderMessages(r.has_more ?? msgs.length === PAGE_SIZE);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 80);
      } catch { /* show empty state */ }
      finally { if (!cancelled) setLoadingHistory(false); }
    };

    init();
    return () => { cancelled = true; };
  }, [token, partnerId]);

  // ── Load older messages (scroll-to-top pagination) ─────────────────────────
  const loadOlderMessages = useCallback(async () => {
    if (!token || !partnerId || loadingOlder || !hasOlderMessages) return;
    const oldest = getOldestCachedTime(partnerId) ?? messages[0]?.rawTime;
    if (!oldest) return;
    setLoadingOlder(true);
    try {
      const r = await apiFetch<{ messages: ApiMessage[]; has_more: boolean }>(
        `/chat/${partnerId}/messages?before=${encodeURIComponent(oldest)}&limit=${PAGE_SIZE}`,
        { token },
      );
      if (!r.messages.length) { setHasOlderMessages(false); return; }
      const older = r.messages.map(apiMsgToMsg);
      older.forEach(m => seenMsgIdsRef.current.add(m.id));
      prependToCache(partnerId, older as CachedMsg[]);
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const toAdd = older.filter(m => !existingIds.has(m.id));
        return [...toAdd, ...prev];
      });
      setHasOlderMessages(r.has_more ?? older.length === PAGE_SIZE);
    } catch { /* silent */ }
    finally { setLoadingOlder(false); }
  }, [token, partnerId, loadingOlder, hasOlderMessages, messages]);

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
              const confirmed = { ...msg, status: 'sent' as const };
              // Replace optimistic bubble with confirmed one in cache.
              // Also patch todExtra / gameExtra so cached links use the backend-assigned IDs.
              patchCacheMessage(partnerId, pendingId, {
                id: msg.id,
                status: 'sent',
                rawTime: msg.rawTime,
                ...(msg.isTod   ? { todExtra:  msg.todExtra  } : {}),
                ...(msg.isGame  ? { gameExtra: msg.gameExtra } : {}),
              });
              return prev.map(x => x.id === pendingId ? confirmed : x);
            }
            if (seenMsgIdsRef.current.has(msg.id)) return prev;
            seenMsgIdsRef.current.add(msg.id);
            appendToCache(partnerId, [msg as CachedMsg]);
            return [...prev, msg];
          });
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
          ws.send(JSON.stringify({ type: 'read' }));

        } else if (payload.type === 'read') {
          setMessages(prev => {
            const updated = prev.map(m =>
              m.from === 'me' && m.status !== 'read' ? { ...m, status: 'read' as const } : m
            );
            // Persist read status to cache
            updated.filter(m => m.from === 'me').forEach(m =>
              patchCacheMessage(partnerId, m.id, { status: 'read' })
            );
            return updated;
          });

        } else if (payload.type === 'game_response') {
          const { ref_msg_id, extra: responseExtra } = payload;
          if (ref_msg_id) {
            setMessages(prev => prev.map(m =>
              m.id === ref_msg_id
                ? { ...m, gameExtra: { ...m.gameExtra, ...(responseExtra ?? {}) } }
                : m
            ));
            patchCacheMessage(partnerId, ref_msg_id, { gameExtra: responseExtra });
          }

        } else if (payload.type === 'typing') {
          setIsPartnerTyping(Boolean(payload.is_typing));
          if (payload.is_typing) setTimeout(() => setIsPartnerTyping(false), 3000);

        } else if (payload.type === 'presence' && payload.user_id === partnerId) {
          setIsOnline(Boolean(payload.online));

        } else if (payload.type === 'message_deleted') {
          removeCacheMessage(partnerId, payload.message_id);
          setMessages(prev => prev.filter(m => m.id !== payload.message_id));

        } else if (payload.type === 'reaction_update') {
          const { message_id, reactions } = payload;
          setMessages(prev => prev.map(m =>
            m.id === message_id ? { ...m, reactions } : m
          ));
          patchCacheMessage(partnerId, message_id, { reactions });

        } else if (payload.type === 'message_edited') {
          const { message_id, content, edited_at } = payload;
          setMessages(prev => prev.map(m =>
            m.id === message_id ? { ...m, text: content, editedAt: edited_at } : m
          ));
          patchCacheMessage(partnerId, message_id, { text: content, editedAt: edited_at });

        } else if (payload.type === 'restricted') {
          const pid = pendingOptIdRef.current;
          if (pid) {
            removeCacheMessage(partnerId, pid);
            setMessages(prev => prev.filter(x => x.id !== pid));
            pendingOptIdRef.current = null;
          }
          Alert.alert('Message blocked', payload.detail ?? 'This content is not allowed in chat.');
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

  // ── Subscribe to global notify WS (presence, new_message, message_deleted) ─
  useEffect(() => {
    if (!partnerId) return;
    // Ask backend for current presence of the partner right away
    notifySend({ type: 'presence_query', user_id: partnerId });

    return onNotifyMessage((payload) => {
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
      } else if (payload.type === 'message_deleted') {
        setMessages(prev => prev.filter(m => m.id !== payload.message_id));
      } else if (payload.type === 'reaction_update') {
        const { message_id, reactions } = payload;
        setMessages(prev => prev.map(m =>
          m.id === message_id ? { ...m, reactions } : m
        ));
        patchCacheMessage(partnerId, message_id, { reactions });
      } else if (payload.type === 'message_edited') {
        const { message_id, content, edited_at } = payload;
        setMessages(prev => prev.map(m =>
          m.id === message_id ? { ...m, text: content, editedAt: edited_at } : m
        ));
        patchCacheMessage(partnerId, message_id, { text: content, editedAt: edited_at });
      }
    });
  }, [partnerId, onNotifyMessage, notifySend, apiMsgToMsg]);

  // ── Typing indicator ──────────────────────────────────────────────────────
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleTextChange = (val: string) => {
    setText(val);
    const { blocked, reason } = checkContent(val);
    setContentWarning(blocked ? reason : null);
    if (!safeSendRef.current) return;
    safeSendRef.current(JSON.stringify({ type: 'typing', is_typing: true }));
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      safeSendRef.current?.(JSON.stringify({ type: 'typing', is_typing: false }));
    }, 2000);
  };

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = (txt: string, opts?: { isCard?: boolean; isAnswer?: boolean; answerTo?: string; replyToId?: string }) => {
    if (!txt.trim()) return;

    const msgType  = opts?.isCard ? 'card' : opts?.isAnswer ? 'answer' : 'text';
    const metadata = opts?.answerTo
      ? { answerTo: opts.answerTo, ...(opts.replyToId ? { replyToId: opts.replyToId } : {}) }
      : null;

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
      replyToId: opts?.replyToId,
      status:   'sending',
    };
    pendingOptIdRef.current = optimisticId;
    setMessages(prev => [...prev, optimistic]);
    setText('');
    setContentWarning(null);
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
    if (contentWarning) {
      Alert.alert('Message blocked', contentWarning);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (answeringCard) {
      sendMessage(text, { isAnswer: true, answerTo: answeringCard });
    } else if (replyingTo) {
      const answerTo = replyingTo.isCall
        ? `${replyingTo.callType === 'missed' || replyingTo.callType === 'declined' ? 'Missed ' : ''}${replyingTo.callKind === 'video' ? 'Video call' : 'Voice call'}`
        : replyingTo.imageUrl
          ? 'Photo'
          : replyingTo.audioUrl
            ? 'Voice Message'
            : replyingTo.isGame
              ? (replyingTo.gameMsgType?.replace(/_/g, ' ') ?? 'Game')
              : replyingTo.isTod
                ? 'Truth or Dare'
                : replyingTo.text;
      sendMessage(text, { isAnswer: true, answerTo, replyToId: replyingTo.id });
      setReplyingTo(null);
    } else {
      sendMessage(text);
    }
  };

  // ── Voice message recording ───────────────────────────────────────────────
  const handleMicPress = async () => {
    if (isListening) {
      // ── Stop recording, upload, and send as voice message ─────────────────
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setIsListening(false);

      if (!chatRecorder.isRecording) return;

      // Capture duration from native recorder — no manual counter drift
      const duration = Math.max(1, Math.round(recState.durationMillis / 1000));

      try {
        await chatRecorder.stop();
        // Release iOS audio session so playback / next recording can reclaim it
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
        const uri = chatRecorder.uri;
        if (!uri) return;

        // Copy to persistent local cache dir so file survives temp-dir cleanup
        // and can be served from cache even after the CDN URL is swapped in.
        const cachedLocalUri = await (async () => {
          try {
            await FileSystem.makeDirectoryAsync(VOICE_CACHE_DIR, { intermediates: true }).catch(() => {});
            const dest = `${VOICE_CACHE_DIR}rec_${Date.now()}.m4a`;
            await FileSystem.copyAsync({ from: uri, to: dest });
            return dest;
          } catch {
            return uri;
          }
        })();

        // Show the message instantly with the local file — playable with zero wait
        const optimisticId = `opt-voice-${Date.now()}`;
        setMessages(prev => [...prev, {
          id: optimisticId,
          text: '',
          from: 'me',
          time: _formatTime(new Date().toISOString()),
          audioUrl: cachedLocalUri,
          audioDuration: duration,
          status: 'sending',
        }]);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);

        // Upload in background — does not block the UI
        ;(async () => {
          try {
            const form = new FormData();
            form.append('file', { uri: cachedLocalUri, name: 'recording.m4a', type: 'audio/m4a' } as any);
            form.append('duration_sec', String(duration));

            const res = await fetch(`${API_V1}/upload/audio`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` },
              body: form,
            });
            const data = await res.json();
            const audioUrl: string = data.url;
            const dur: number = data.duration_sec ?? duration;

            if (!audioUrl) throw new Error('No URL returned');

            // Map CDN URL → local file so VoiceBubble never re-downloads for sender
            _audioUriCache.set(audioUrl, cachedLocalUri);

            // Swap local URI → CDN URL in the message
            setMessages(prev =>
              prev.map(x => x.id === optimisticId ? { ...x, audioUrl, audioDuration: dur } : x)
            );

            // Register so WS echo replaces rather than duplicates this bubble
            pendingOptIdRef.current = optimisticId;

            safeSendRef.current?.(JSON.stringify({
              type: 'message',
              content: audioUrl,
              msg_type: 'voice',
              metadata: { audioUrl, duration_sec: dur },
            }));
          } catch {
            setMessages(prev => prev.filter(x => x.id !== optimisticId));
            Alert.alert('Could not send voice message', 'Please try again.');
          }
        })();
      } catch {
        Alert.alert('Could not send voice message', 'Please try again.');
      }
      return;
    }

    // ── Start recording ────────────────────────────────────────────────────
    if (recStartingRef.current) return; // guard against double-tap
    recStartingRef.current = true;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      // iOS automatically prompts for microphone permission on first use because
      // NSMicrophoneUsageDescription is set in Info.plist. No explicit JS-side
      // permission request is needed — expo-audio's requestRecordingPermissionsAsync
      // and expo-camera's requestMicrophonePermissionsAsync both crash or are
      // undefined in this native build.
      await chatRecorder.prepareToRecordAsync();
      chatRecorder.record();
      setIsListening(true);
    } catch (err: any) {
      const msg: string = err?.message ?? String(err);
      const isPermission = /permission|denied|not authorized/i.test(msg);
      if (isPermission) {
        Alert.alert(
          'Microphone access needed',
          'Please allow microphone access in Settings → Zod → Microphone.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ],
        );
      } else {
        Alert.alert('Could not start recording', msg);
      }
    } finally {
      recStartingRef.current = false;
    }
  };

  // Auto-stop at 60 s — driven by native recorder state, no setInterval needed
  useEffect(() => {
    if (isListening && recState.durationMillis >= 60_000) {
      handleMicPress();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListening, recState.durationMillis]);

  const handleUnmatch = async (reason: string, custom?: string) => {
    // Navigate away immediately — screen unmount closes all modals cleanly
    setShowUnmatch(false);
    setShowProfile(false);
    router.back();
    // Fire-and-forget the API call after navigation is initiated
    apiFetch(`/chat/${partnerId}/unmatch`, {
      token: token ?? undefined,
      method: 'POST',
      body: JSON.stringify({ reason, custom_reason: custom ?? null }),
    }).catch(() => {});
  };

  const handlePhotoSend = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access to send images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const optimisticId = `opt-img-${Date.now()}`;
    const optimistic: Msg = {
      id: optimisticId,
      text: '',
      from: 'me',
      time: nowTime(),
      imageUrl: asset.uri,
      status: 'sending',
    };
    setMessages(prev => [...prev, optimistic]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);

    try {
      if (!token) throw new Error('no token');
      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        type: asset.mimeType ?? 'image/jpeg',
        name: asset.fileName ?? `chat-${Date.now()}.jpg`,
      } as any);
      formData.append('purpose', 'chat');

      const { API_V1: apiV1 } = await import('@/constants/api');
      const uploadRes = await fetch(`${apiV1}/upload/photo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}));
        throw new Error(err?.detail ?? 'Upload failed');
      }

      const uploadData = await uploadRes.json();
      const cdnUrl: string = uploadData?.url;

      if (!cdnUrl) throw new Error('No URL returned from upload');

      // Send the CDN URL as a message (image msg_type)
      const msgPayload = JSON.stringify({
        type: 'message',
        content: cdnUrl,
        msg_type: 'image',
        metadata: { imageUrl: cdnUrl },
      });
      if (safeSendRef.current) {
        safeSendRef.current(msgPayload);
      }
      setMessages(prev => prev.map(x =>
        x.id === optimisticId ? { ...x, imageUrl: cdnUrl, status: 'sent' } : x
      ));
    } catch (err: any) {
      // Remove the optimistic message and alert the user — don't store broken local URIs
      setMessages(prev => prev.filter(x => x.id !== optimisticId));
      Alert.alert('Could not send image', err?.message ?? 'Please try again.');
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

  // Partner accepts the invite — opens the sender panel for them (legacy)
  const handleTodJoin = (inviteMsgId: string) => {
    sendTodMessage('tod_accept', '🎮 Game on!', { inviteId: inviteMsgId });
    setTimeout(() => { setShowTodPicker(true); Keyboard.dismiss(); }, 350);
  };

  // Partner selects Truth or Dare — notifies sender and records choice
  const handleTodChoice = (inviteId: string, choice: 'truth' | 'dare') => {
    Keyboard.dismiss();
    sendTodMessage('tod_choice', `${choice === 'truth' ? '🤔' : '🎲'} I choose ${choice === 'truth' ? 'Truth' : 'Dare'}`, {
      inviteId, choice,
    });
  };

  // Sender taps "Send a Dare →" on the invite — just open the picker pre-filtered,
  // no new invite or choice message needed (round already in progress)
  const handleOpenPickerForRound = (choice: 'truth' | 'dare') => {
    Keyboard.dismiss();
    setTodPickerDefault(choice);
    setShowTodPicker(true);
  };

  // Receiver skips a turn card (once per active game)
  const handleTodSkip = (turnMsg: Msg) => {
    Keyboard.dismiss();
    const extra = turnMsg.todExtra ?? {};
    sendTodMessage('tod_skip', '↩ Skipped', {
      turnMsgId: turnMsg.id,
      inviteId: extra.inviteId,
      choice: extra.choice,
    });
  };

  // An "active game" = last tod_invite within 12 hours.
  // Skip is available once per active game: hidden if any tod_skip already sent in this game.
  const GAME_TTL_MS = 12 * 60 * 60 * 1000;
  const latestGameInvite = [...messages].reverse().find(m => m.isTod && m.todMsgType === 'tod_invite');
  const gameIsActive = latestGameInvite
    ? (Date.now() - new Date(latestGameInvite.rawTime ?? 0).getTime()) < GAME_TTL_MS
    : false;
  const skipUsedInGame = gameIsActive
    ? messages.some(m =>
        m.todMsgType === 'tod_skip' &&
        latestGameInvite &&
        m.rawTime &&
        latestGameInvite.rawTime &&
        m.rawTime > latestGameInvite.rawTime
      )
    : true;

  // Answerer challenges partner for the next round.
  // Embeds the pre-selected choice directly in the tod_invite so we never send
  // a tod_choice with an optimistic inviteId (which the backend can't resolve).
  const handleTodSendAfterChoice = (choice: 'truth' | 'dare') => {
    Keyboard.dismiss();
    sendTodMessage('tod_invite', '🎲 Truth or Dare — want to play?', {
      senderName: profile?.full_name ?? 'Me',
      preSelectedChoice: choice,       // backend sets choice + status='choice_made' immediately
    });
    setTodPickerDefault(choice);
    setShowTodPicker(true);
  };

  // Sender chose their card — broadcast it so both players see the question
  const handleTodSendCard = (
    choice: 'truth' | 'dare',
    question: string,
    emoji: string,
    color: string,
    category: string,
  ) => {
    // Find the latest unanswered invite to link this card back to it
    const latestInvite = [...messages].reverse().find(m => m.isTod && m.todMsgType === 'tod_invite');
    sendTodMessage('tod_next', question, {
      choice,
      question,
      emoji,
      color,
      category,
      senderName: profile?.full_name ?? 'Me',
      ...(latestInvite ? { inviteId: latestInvite.id } : {}),
    });
    setShowTodPicker(false);
    setTodPickerDefault(null);
  };

  // Receiver answers a turn card
  const handleTodAnswer = (answer: string) => {
    if (!todAnswerMsg) return;
    const extra  = todAnswerMsg.todExtra ?? {};
    // For tod_invite cards, infer choice from category; for tod_next, use existing choice field
    const choice = extra.choice
      ?? (extra.category?.toLowerCase() === 'dare' ? 'dare' : 'truth');
    sendTodMessage('tod_answer', answer, {
      turnMsgId: todAnswerMsg.id,
      // Also set inviteId so the invite bubble can detect answered state
      ...(todAnswerMsg.todMsgType === 'tod_invite' ? { inviteId: todAnswerMsg.id } : {}),
      question:  extra.question ?? '',
      emoji:     extra.emoji    ?? '',
      choice,
    });
    setTodAnswerMsg(null);
  };

  // ── Mini-game send handler ──────────────────────────────────────────────────
  const handleGameSend = useCallback((gameMsgType: string, content: string, extra: Record<string, any>) => {
    if (!safeSendRef.current) return;
    const optimisticId = `opt-game-${Date.now()}`;
    const newMsg: Msg = {
      id: optimisticId,
      text: content,
      from: 'me',
      time: _formatTime(new Date().toISOString()),
      status: 'sending',
      isGame: true,
      gameMsgType,
      gameExtra: { ...extra, sender_id: myId },
    };
    pendingOptIdRef.current = optimisticId;
    setMessages(prev => [...prev, newMsg]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    const payload = JSON.stringify({
      type: gameMsgType,
      content,
      extra: { ...extra, sender_id: myId },
      receiver_id: partnerId,
    });
    safeSendRef.current(payload);
  }, [myId, partnerId]);

  // ── Mini-game respond handler (receiver tapping in a bubble) ───────────────
  const handleGameRespond = (originalMsg: Msg, newExtra: Record<string, any>) => {
    if (!originalMsg.gameMsgType) return;
    // For local-only state updates (quiz stepping), just update in-place
    if ((newExtra as any)._localOnly) {
      const { _localOnly, ...cleanExtra } = newExtra as any;
      setMessages(prev => prev.map(m => m.id === originalMsg.id
        ? { ...m, gameExtra: { ...m.gameExtra, ...cleanExtra } }
        : m
      ));
      return;
    }
    // Update the original bubble in-place locally (receiver sees it immediately)
    const cleanExtra = { ...newExtra };
    setMessages(prev => prev.map(m => m.id === originalMsg.id
      ? { ...m, gameExtra: { ...m.gameExtra, ...cleanExtra } }
      : m
    ));
    // Send a lightweight game_response WS event so the sender's bubble also updates
    if (safeSendRef.current) {
      safeSendRef.current(JSON.stringify({
        type: 'game_response',
        ref_msg_id: originalMsg.id,
        game_type: originalMsg.gameMsgType,
        extra: { ...cleanExtra, sender_id: myId },
        receiver_id: partnerId,
      }));
    }
  };

  // ── Fire pending game from MiniGamesPage when this screen regains focus ─────
  // Using useFocusEffect + a module-level queue is more reliable than
  // router.setParams() after router.back(), which suffers a focus-animation
  // race condition that silently drops the payload.
  useFocusEffect(
    useCallback(() => {
      const pending = takePendingGame();
      if (!pending) return;
      const { msgType, content, extra } = pending;
      handleGameSend(msgType, content, extra);
    }, [handleGameSend]),
  );


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
      ]}
      >
        <Pressable onPress={() => router.back()} hitSlop={10}
          style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>

        <Pressable style={styles.headerCenter} hitSlop={4} onPress={() => { Keyboard.dismiss(); setShowProfile(true); }}>
          <View style={styles.headerAvatarWrap}>
            <Image source={{ uri: image }} style={[styles.headerAvatar, { backgroundColor: '#2a2a2a' }]} contentFit="cover"
              cachePolicy="memory-disk"
              transition={{ duration: 200, effect: 'cross-dissolve' }}
              recyclingKey={image} />
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
          <Pressable hitSlop={8} onPress={() => handleInitiateCall('audio')}
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
            <Squircle style={styles.headerBtn} cornerRadius={14} cornerSmoothing={1} fillColor={colors.surface2}>
              <Ionicons name="call" size={17} color={colors.text} />
            </Squircle>
          </Pressable>
          <Pressable hitSlop={8} onPress={() => handleInitiateCall('video')}
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
            <Squircle style={styles.headerBtn} cornerRadius={14} cornerSmoothing={1} fillColor={colors.surface2}>
              <Ionicons name="videocam" size={17} color={colors.text} />
            </Squircle>
          </Pressable>
        </View>
      </View>

      {/* ── Messages ── */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={[styles.messageList, { paddingBottom: 16 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* Date separator */}
          <View style={styles.dateSep}>
            <Text style={[styles.dateText, { color: colors.textTertiary }]}>Today</Text>
          </View>

          {/* Full-screen spinner — only when cache is empty and network not yet back */}
          {loadingHistory && messages.length === 0 && (
            <View style={{ alignItems: 'center', padding: 28 }}>
              <ActivityIndicator size="small" color={colors.textSecondary} style={{ marginBottom: 8 }} />
              <Text style={{ color: colors.textSecondary, fontFamily: 'ProductSans-Regular', fontSize: 13 }}>Loading messages…</Text>
            </View>
          )}

          {/* Load-older button at the very top — tapping fetches the previous page */}
          {!loadingHistory && messages.length > 0 && (
            <View style={{ alignItems: 'center', paddingVertical: 10 }}>
              {loadingOlder ? (
                <ActivityIndicator size="small" color={colors.textTertiary} />
              ) : hasOlderMessages ? (
                <Pressable
                  onPress={loadOlderMessages}
                  style={({ pressed }) => [{
                    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
                    backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth,
                    borderColor: colors.border, opacity: pressed ? 0.6 : 1,
                  }]}
                >
                  <Text style={{ fontSize: 12, fontFamily: 'ProductSans-Bold', color: colors.textSecondary }}>
                    Load earlier messages
                  </Text>
                </Pressable>
              ) : (
                <Text style={{ fontSize: 11, fontFamily: 'ProductSans-Regular', color: colors.textTertiary }}>
                  Beginning of conversation
                </Text>
              )}
            </View>
          )}

          {/* Subtle catch-up indicator — shown when refreshing after cache restore */}
          {catchingUp && (
            <View style={{ alignItems: 'center', paddingBottom: 4 }}>
              <ActivityIndicator size="small" color={colors.textTertiary} />
            </View>
          )}

          {messages.map((msg, idx) => {
            const nextMsg = messages[idx + 1];
            // Show avatar only on the last message in a consecutive group from same sender
            const isLastInGroup = !nextMsg || nextMsg.from !== msg.from;
            const myAvatar    = profile?.photos?.[0] ?? undefined;
            const partnerAvatar = image || undefined;

            // Call record bubble
            if (msg.isCall) {
              return (
                <MsgRow key={msg.id} id={msg.id} highlightedId={highlightedMsgId} msgLayoutsRef={msgLayoutsRef}>
                  <SwipeableRow onReply={() => { setReplyingTo(msg); setAnsweringCard(null); }} direction={msg.from === 'me' ? 'left' : 'right'}>
                    <Pressable onLongPress={() => openCtxMenu(msg)} delayLongPress={350}>
                      <View>
                        <CallBubble msg={msg} colors={colors} isLastInGroup={isLastInGroup} myAvatar={myAvatar} partnerAvatar={partnerAvatar} />
                        <ReactionPills reactions={msg.reactions ?? []} myId={myId} from={msg.from} colors={colors} />
                      </View>
                    </Pressable>
                  </SwipeableRow>
                </MsgRow>
              );
            }

            // Mini-games bubble
            if (msg.isGame && msg.gameMsgType) {
              return (
                <MsgRow key={msg.id} id={msg.id} highlightedId={highlightedMsgId} msgLayoutsRef={msgLayoutsRef}>
                  <SwipeableRow onReply={() => { setReplyingTo(msg); setAnsweringCard(null); }} direction={msg.from === 'me' ? 'left' : 'right'}>
                    <Pressable onLongPress={() => openCtxMenu(msg)} delayLongPress={350}>
                      <View>
                        <GameBubble
                          msg={msg as unknown as GameMsg}
                          colors={colors}
                          myId={myId}
                          partnerId={partnerId}
                          partnerName={name}
                          messages={messages.filter(m => m.isGame) as unknown as GameMsg[]}
                          myAvatar={myAvatar}
                          partnerAvatar={partnerAvatar}
                          isLastInGroup={isLastInGroup}
                          onRespond={(updatedMsg) => handleGameRespond(msg, updatedMsg.gameExtra ?? {})}
                        />
                        <ReactionPills reactions={msg.reactions ?? []} myId={myId} from={msg.from} colors={colors} />
                      </View>
                    </Pressable>
                  </SwipeableRow>
                </MsgRow>
              );
            }

            if (msg.isTod) {
              return (
                <MsgRow key={msg.id} id={msg.id} highlightedId={highlightedMsgId} msgLayoutsRef={msgLayoutsRef}>
                  <SwipeableRow onReply={() => { setReplyingTo(msg); setAnsweringCard(null); }} direction={msg.from === 'me' ? 'left' : 'right'}>
                    <Pressable onLongPress={() => openCtxMenu(msg)} delayLongPress={350}>
                      <View>
                        <TodBubble
                          msg={msg}
                          colors={colors}
                          myId={myId}
                          partnerName={name}
                          onJoin={handleTodJoin}
                          onAnswer={(m) => { setTodAnswerMsg(m); Keyboard.dismiss(); }}
                          onSendTurn={(choice) => { handleTodSendAfterChoice(choice ?? 'truth'); }}
                          onPickCard={handleOpenPickerForRound}
                          onSkip={handleTodSkip}
                          onChoice={handleTodChoice}
                          skipUsed={skipUsedInGame}
                          messages={messages}
                          myAvatar={myAvatar}
                          partnerAvatar={partnerAvatar}
                          isLastInGroup={isLastInGroup}
                        />
                        <ReactionPills reactions={msg.reactions ?? []} myId={myId} from={msg.from} colors={colors} />
                      </View>
                    </Pressable>
                  </SwipeableRow>
                </MsgRow>
              );
            }

            // Voice message bubble
            if (msg.audioUrl) {
              const isMe = msg.from === 'me';
              return (
                <MsgRow key={msg.id} id={msg.id} highlightedId={highlightedMsgId} msgLayoutsRef={msgLayoutsRef}>
                  <SwipeableRow onReply={() => { setReplyingTo(msg); setAnsweringCard(null); }} direction={isMe ? 'left' : 'right'}>
                    <View style={[styles.bubbleRow, isMe ? styles.bubbleRowMe : styles.bubbleRowThem]}>
                      {!isMe && (isLastInGroup ? <BubbleAvatar uri={partnerAvatar} /> : <View style={{ width: 28 }} />)}
                      <View>
                        <VoiceBubble msg={msg} colors={colors} onLongPress={() => openCtxMenu(msg)} />
                        <ReactionPills reactions={msg.reactions ?? []} myId={myId} from={msg.from} colors={colors} />
                      </View>
                      {isMe && (isLastInGroup ? <BubbleAvatar uri={myAvatar} /> : <View style={{ width: 28 }} />)}
                    </View>
                  </SwipeableRow>
                </MsgRow>
              );
            }

            return (
              <MsgRow key={msg.id} id={msg.id} highlightedId={highlightedMsgId} msgLayoutsRef={msgLayoutsRef}>
              <Bubble
                msg={msg}
                colors={colors}
                myId={myId}
                answeredCards={new Set(messages.filter(m => m.isAnswer && m.answerTo).map(m => m.answerTo!))}
                onAnswer={(q) => {
                  setAnsweringCard(q);
                  setShowCards(false);
                  setShowAi(false);
                }}
                onReply={(m) => {
                  setReplyingTo(m);
                  setAnsweringCard(null);
                }}
                onJumpToReply={scrollToMessage}
                onUnsend={async (m) => {
                  if (!token || !m.id) return;
                  setMessages(prev => prev.filter(x => x.id !== m.id));
                  try {
                    await apiFetch(`/chat/messages/${m.id}`, { token, method: 'DELETE' });
                  } catch {
                    setMessages(prev => [m, ...prev].sort((a, b) => a.time.localeCompare(b.time)));
                  }
                }}
                onLongPress={openCtxMenu}
                myAvatar={myAvatar}
                partnerAvatar={partnerAvatar}
                isLastInGroup={isLastInGroup}
              />
              </MsgRow>
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
          { borderTopColor: colors.border, backgroundColor: colors.bg, paddingBottom: keyboardShown ? 8 : insets.bottom + 8 },
        ]}>
          {/* Reply-to strip (swipe-to-reply) */}
          {/* Content restriction warning */}
          {contentWarning && (
            <View style={[styles.answerStrip, { backgroundColor: 'rgba(239,68,68,0.10)', borderColor: 'rgba(239,68,68,0.35)' }]}>
              <Ionicons name="shield-outline" size={13} color="#ef4444" />
              <Text style={[styles.answerStripText, { color: '#ef4444', flex: 1 }]} numberOfLines={2}>
                {contentWarning}
              </Text>
            </View>
          )}

          {replyingTo && !answeringCard && (
            <View style={[styles.answerStrip, { backgroundColor: colors.surface2, borderColor: 'rgba(124,58,237,0.3)' }]}>
              <Ionicons name="return-down-forward" size={13} color="#a78bfa" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, fontFamily: 'ProductSans-Bold', color: '#a78bfa', marginBottom: 1 }}>
                  {replyingTo.from === 'me' ? 'You' : name}
                </Text>
                <Text style={[styles.answerStripText, { color: colors.textSecondary, flex: 0 }]} numberOfLines={1}>
                  {replyingTo.isCall
                    ? `${replyingTo.callType === 'missed' || replyingTo.callType === 'declined' ? 'Missed ' : ''}${replyingTo.callKind === 'video' ? 'Video call' : 'Voice call'}`
                    : replyingTo.imageUrl
                      ? 'Photo'
                      : replyingTo.audioUrl
                        ? 'Voice Message'
                        : replyingTo.isGame
                          ? (replyingTo.gameMsgType?.replace(/_/g, ' ') ?? 'Game')
                          : replyingTo.isTod
                            ? 'Truth or Dare'
                            : replyingTo.text}
                </Text>
              </View>
              <Pressable onPress={() => setReplyingTo(null)} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
              </Pressable>
            </View>
          )}

          {/* Card answer strip */}
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
            {/* Games + Photo buttons — hidden while typing */}
            {!text.trim() && (
              <>
                {/* Games button (full-screen hub) */}
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    Keyboard.dismiss();
                    navPush({
                      pathname: '/mini-games',
                      params: {
                        partnerId,
                        partnerName: name,
                        roomId: partnerId,
                        partnerImage: image,
                      },
                    });
                  }}
                  hitSlop={8}
                  style={({ pressed }) => [pressed && { opacity: 0.6 }]}
                >
                  <Squircle
                    style={styles.inputSideBtn} cornerRadius={14} cornerSmoothing={1}
                    fillColor={colors.surface2}
                  >
                    <Ionicons name="game-controller" size={18} color={colors.text} />
                  </Squircle>
                </Pressable>

                {/* Photo upload button */}
                <Pressable
                  onPress={handlePhotoSend}
                  hitSlop={8}
                  style={({ pressed }) => [pressed && { opacity: 0.6 }]}
                >
                  <Squircle
                    style={styles.inputSideBtn} cornerRadius={14} cornerSmoothing={1}
                    fillColor={colors.surface2}
                  >
                    <Ionicons name="image-outline" size={18} color={colors.text} />
                  </Squircle>
                </Pressable>
              </>
            )}

            {/* Text input */}
            <Squircle
              style={styles.inputWrap} cornerRadius={22} cornerSmoothing={1}
              fillColor={colors.surface} strokeColor={colors.border} strokeWidth={StyleSheet.hairlineWidth}
            >
              {isListening ? (
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' }} />
                  <Text style={{ fontFamily: 'ProductSans-Bold', fontSize: 15, color: '#ef4444' }}>
                    {(() => { const s = Math.floor(recState.durationMillis / 1000); return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`; })()}
                  </Text>
                  <Text style={{ fontFamily: 'ProductSans-Regular', fontSize: 13, color: colors.textSecondary }}>
                    Recording…
                  </Text>
                </View>
              ) : (
                <>
                  <TextInput
                    style={[styles.inputField, { color: colors.text }]}
                    placeholder={
                      answeringCard ? 'Your answer…'
                      : replyingTo ? 'Reply…'
                      : 'Message…'
                    }
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
                </>
              )}
            </Squircle>

            {/* Send / mic */}
            <Pressable
              onPress={text.trim() ? handleSend : handleMicPress}
              hitSlop={8}
              style={({ pressed }) => [pressed && { opacity: 0.7 }]}
            >
              <Squircle
                style={styles.inputSideBtn} cornerRadius={14} cornerSmoothing={1}
                fillColor={
                  contentWarning
                    ? '#ef4444'
                    : text.trim()
                      ? ((answeringCard || replyingTo) ? '#7c3aed' : colors.text)
                      : isListening
                        ? '#ef4444'
                        : colors.surface2
                }
              >
                <Ionicons
                  name={contentWarning ? 'ban' : text.trim() ? 'send' : isListening ? 'stop-circle' : 'mic'}
                  size={18}
                  color={contentWarning ? '#fff' : text.trim() ? ((answeringCard || replyingTo) ? '#fff' : colors.bg) : isListening ? '#fff' : colors.text}
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
          token={token ?? undefined}
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
          defaultChoice={todPickerDefault}
          onSendCard={handleTodSendCard}
          onClose={() => { setShowTodPicker(false); setTodPickerDefault(null); }}
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

      {/* ── Partner Profile Modal ── */}
      <PartnerProfileModal
        visible={showProfile}
        colors={colors}
        insets={insets}
        name={name}
        image={image}
        partnerId={partnerId}
        token={token ?? undefined}
        isPro={profile?.subscription_tier === 'pro'}
        myInterests={[]}
        onClose={() => setShowProfile(false)}
        onUnmatch={() => {
          Alert.alert(
            'Unmatch',
            `Are you sure you want to unmatch with ${name}? This cannot be undone.`,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Unmatch', style: 'destructive', onPress: () => setShowUnmatch(true) },
            ],
          );
        }}
      />

      {/* ── Unmatch Modal ── */}
      <UnmatchModal
        visible={showUnmatch}
        colors={colors}
        insets={insets}
        onClose={() => setShowUnmatch(false)}
        onConfirm={handleUnmatch}
      />

      {/* Call screen is now rendered globally by CallProvider in _layout.tsx */}

      {/* ── Message long-press context menu ── */}
      {ctxMsg && (
        <MsgContextMenu
          msg={ctxMsg}
          myId={myId}
          colors={colors}
          recentEmojis={recentEmojis}
          onClose={closeCtxMenu}
          onReact={(emoji) => handleReact(ctxMsg, emoji)}
          onReply={() => { setReplyingTo(ctxMsg); setAnsweringCard(null); }}
          onCopy={() => {
            const copyText = ctxMsg.text || (ctxMsg.audioUrl ? 'Voice message' : '');
            if (copyText) Share.share({ message: copyText });
          }}
          onEdit={() => {
            setEditingMsg(ctxMsg);
            setEditText(ctxMsg.text ?? '');
          }}
          onSaveImage={async () => {
            if (!ctxMsg.imageUrl) return;
            try {
              const { status } = await MediaLibrary.requestPermissionsAsync();
              if (status !== 'granted') { Alert.alert('Permission needed', 'Allow photo library access to save images.'); return; }
              await MediaLibrary.saveToLibraryAsync(ctxMsg.imageUrl);
              Alert.alert('Saved', 'Image saved to your camera roll.');
            } catch { Alert.alert('Error', 'Could not save image.'); }
          }}
          onUnsend={() => {
            if (!token || !ctxMsg.id) return;
            setMessages(prev => prev.filter(x => x.id !== ctxMsg.id));
            apiFetch(`/chat/messages/${ctxMsg.id}`, { token, method: 'DELETE' }).catch(() => {});
          }}
          onInfo={() => setCtxInfoMsg(ctxMsg)}
          onReport={() => {
            Alert.alert('Report message', 'Are you sure you want to report this message?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Report', style: 'destructive', onPress: () => {
                if (token) apiFetch(`/chat/${partnerId}/report`, { token, method: 'POST', body: JSON.stringify({ reason: 'message_content' }) }).catch(() => {});
              }},
            ]);
          }}
        />
      )}

      {/* ── Message info sheet (uses local data, no API call) ── */}
      {ctxInfoMsg && (
        <MsgInfoSheet
          msg={ctxInfoMsg}
          myId={myId}
          colors={colors}
          onClose={() => setCtxInfoMsg(null)}
        />
      )}

      {/* ── Edit message input sheet ── */}
      {editingMsg && (
        <Modal transparent animationType="slide" statusBarTranslucent onRequestClose={() => setEditingMsg(null)}>
          <Pressable style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.4)' }]} onPress={() => setEditingMsg(null)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
            <Squircle
              style={{ margin: 12, marginBottom: 12, overflow: 'hidden' }}
              cornerRadius={28} cornerSmoothing={1}
              fillColor={colors.surface}
              strokeColor={colors.border}
              strokeWidth={StyleSheet.hairlineWidth}
            >
              <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
                <Text style={{ fontSize: 13, fontFamily: 'ProductSans-Bold', color: colors.textSecondary, marginBottom: 8 }}>Edit message</Text>
                <TextInput
                  autoFocus
                  value={editText}
                  onChangeText={setEditText}
                  multiline
                  style={{ fontSize: 16, fontFamily: 'ProductSans-Regular', color: colors.text, minHeight: 60, maxHeight: 160 }}
                  selectionColor={colors.text}
                  placeholderTextColor={colors.placeholder}
                />
              </View>
              <View style={{ flexDirection: 'row', gap: 10, padding: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
                <Pressable onPress={() => setEditingMsg(null)} style={{ flex: 1 }}>
                  <Squircle cornerRadius={16} cornerSmoothing={1} fillColor={colors.surface2} style={{ paddingVertical: 14, alignItems: 'center' }}>
                    <Text style={{ fontSize: 15, fontFamily: 'ProductSans-Bold', color: colors.textSecondary }}>Cancel</Text>
                  </Squircle>
                </Pressable>
                <Pressable onPress={handleEditSave} style={{ flex: 1 }} disabled={!editText.trim() || editText.trim() === editingMsg?.text}>
                  <Squircle cornerRadius={16} cornerSmoothing={1} fillColor={colors.text} style={{ paddingVertical: 14, alignItems: 'center', opacity: (!editText.trim() || editText.trim() === editingMsg?.text) ? 0.4 : 1 }}>
                    <Text style={{ fontSize: 15, fontFamily: 'ProductSans-Bold', color: colors.bg }}>Save</Text>
                  </Squircle>
                </Pressable>
              </View>
            </Squircle>
          </KeyboardAvoidingView>
        </Modal>
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
  dateSep:      { alignItems: 'center', marginVertical: 10 },
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
  inputWrap:    { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, gap: 8, minHeight: 44, maxHeight: 120 },
  inputField:   { flex: 1, fontSize: 15, fontFamily: 'ProductSans-Regular', maxHeight: 100, paddingTop: 0, paddingBottom: 0, textAlignVertical: 'center' },
  aiInlineBtn:  { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },

  // Panels (shared)
  panel:        { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopWidth: StyleSheet.hairlineWidth, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 28, shadowOffset: { width: 0, height: -4 }, elevation: 22 },
  panelHandle:  { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  panelHeader:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 14, paddingTop: 6 },
  panelIcon:    { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  panelTitle:   { fontSize: 16, fontFamily: 'ProductSans-Black' },
  panelSub:     { fontSize: 12, fontFamily: 'ProductSans-Regular', marginTop: 1 },
  panelCloseBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },

  // AI Panel header
  aiPanelHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 12, paddingTop: 4 },
  aiPanelTitle:  { fontSize: 17, fontFamily: 'ProductSans-Black' },

  // AI lines
  aiLinesList: { paddingHorizontal: 14, paddingTop: 4, paddingBottom: 32, gap: 8 },
  aiLineItem:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 14 },
  aiLineText:  { flex: 1, fontSize: 14, fontFamily: 'ProductSans-Regular', lineHeight: 21 },
  aiLineUse:   { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },

  // AI Panel modes / categories
  aiModeToggle:       { flexDirection: 'row', marginHorizontal: 16, marginBottom: 10, borderRadius: 14, padding: 3, gap: 3 },
  aiModeBtn:          { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, borderRadius: 11 },
  aiModeBtnText:      { fontSize: 13, fontFamily: 'ProductSans-Bold' },
  aiCategoryScroll:   { paddingHorizontal: 16, paddingBottom: 12, paddingTop: 2, gap: 7, flexDirection: 'row' },
  aiCategoryPill:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 13, paddingVertical: 7 },
  aiCategoryPillText: { fontSize: 12, fontFamily: 'ProductSans-Bold' },
  aiGenLabel:         { fontSize: 10, fontFamily: 'ProductSans-Bold', letterSpacing: 1 },
  aiGenInput:         { fontSize: 14, fontFamily: 'ProductSans-Regular', lineHeight: 20, minHeight: 60 },
  aiGenBtn:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  aiGenBtnText:       { fontSize: 15, fontFamily: 'ProductSans-Black' },

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

  catBadgeGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  catBadge:        { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7 },
  catBadgeLabel:   { fontSize: 12, fontFamily: 'ProductSans-Bold' },

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
  // ── T&D bubbles (monochrome) ───────────────────────────────────────────────
  todInviteBubble:   { padding: 18, width: W * 0.76 },
  todInviteEmoji:    { fontSize: 40, marginBottom: 6 },
  todInviteTitle:    { fontSize: 18, fontFamily: 'ProductSans-Black', color: '#fff', marginBottom: 4 },
  todInviteSub:      { fontSize: 13, fontFamily: 'ProductSans-Regular', color: 'rgba(255,255,255,0.5)', marginBottom: 14 },
  todJoinBtn:        { paddingVertical: 11, borderRadius: 50, alignItems: 'center' },
  todJoinBtnText:    { fontSize: 14, fontFamily: 'ProductSans-Black', color: '#000' },
  todAcceptedBadge:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  todAcceptedText:   { fontSize: 12, fontFamily: 'ProductSans-Bold', color: 'rgba(255,255,255,0.4)' },
  todSystemBubble:   { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  todSystemText:     { fontSize: 12, fontFamily: 'ProductSans-Medium' },
  todTurnCard:       { padding: 20, width: W * 0.76 },
  todTurnHeader:     { flexDirection: 'row', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 6 },
  todChoicePill:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4 },
  todChoicePillText: { fontSize: 11, fontFamily: 'ProductSans-Black', letterSpacing: 0.3 },
  todTurnName:       { fontSize: 11, fontFamily: 'ProductSans-Black', color: 'rgba(255,255,255,0.38)', marginBottom: 10, letterSpacing: 0.3 },
  todTurnQuestion:   { fontSize: 16, fontFamily: 'ProductSans-Black', color: '#fff', lineHeight: 24 },
  todAnsweredRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  todAnsweredText:   { fontSize: 12, fontFamily: 'ProductSans-Bold', color: 'rgba(255,255,255,0.4)' },
  todAnswerBtn:      { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 50, alignSelf: 'flex-start', borderWidth: 1 },
  todAnswerBtnText:  { fontSize: 13, fontFamily: 'ProductSans-Black' },
  todAnswerBubble:   { padding: 14, width: W * 0.72 },
  todAnswerLabel:    { fontSize: 10, fontFamily: 'ProductSans-Black', letterSpacing: 0.5 },
  todAnswerQuestion: { fontSize: 11, fontFamily: 'ProductSans-Regular', color: 'rgba(255,255,255,0.4)', marginBottom: 8, fontStyle: 'italic' },
  todAnswerText:     { fontSize: 14, fontFamily: 'ProductSans-Medium', color: '#fff', lineHeight: 21 },

  // TodPickPanel (monochrome)
  todPickBtn:          { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  todPickEmoji:        { fontSize: 28 },
  todPickTitle:        { fontSize: 15, fontFamily: 'ProductSans-Black', color: '#fff', marginBottom: 2 },
  todPickSub:          { fontSize: 12, fontFamily: 'ProductSans-Regular', color: 'rgba(255,255,255,0.4)' },
  todCardPreview:      { borderRadius: 20, padding: 20, minHeight: 120 },
  todCardPreviewQuestion: { fontSize: 16, fontFamily: 'ProductSans-Black', color: '#fff', lineHeight: 23 },
  todRevealBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 50 },
  todRevealBtnText:    { fontSize: 15, fontFamily: 'ProductSans-Black', color: '#000' },
  todAnswerInput:      { minHeight: 100, padding: 14 },
  todSourceBtn:        { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  todSourceIcon:       { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  todSourceTitle:      { fontSize: 14, fontFamily: 'ProductSans-Black', marginBottom: 2 },
  todSourceSub:        { fontSize: 12, fontFamily: 'ProductSans-Regular' },
  todSourceBadge:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  todCatBtn:           { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  todTemplateCard:     { borderRadius: 18, padding: 18, marginBottom: 2 },
  todTemplateCardText: { fontSize: 14, fontFamily: 'ProductSans-Black', color: '#fff', lineHeight: 21 },
  todNudgeBtn:         { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 50 },
  todNudgeText:        { fontSize: 13, fontFamily: 'ProductSans-Bold' },

  // Call bubble (in-chat)
  callBubble:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, maxWidth: W * 0.72 },
  callBubbleIcon:   { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  callBubbleLabel:  { fontSize: 14, fontFamily: 'ProductSans-Bold', marginBottom: 2 },
  callBubbleTime:   { fontSize: 11, fontFamily: 'ProductSans-Regular' },

  // Call screen
  callRoot:         { flex: 1, alignItems: 'center', justifyContent: 'space-between' },
  callTopInfo:      { alignItems: 'center', gap: 8, paddingHorizontal: 24 },
  callPartnerName:  { fontSize: 28, fontFamily: 'ProductSans-Black', color: '#ffffff', textAlign: 'center' },
  callStatus:       { fontSize: 16, fontFamily: 'ProductSans-Regular', color: 'rgba(255,255,255,0.65)', textAlign: 'center' },
  callRecRow:       { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  callRecDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' },
  callRecText:      { fontSize: 12, fontFamily: 'ProductSans-Bold', color: '#22c55e', letterSpacing: 1.5 },
  callAvatarWrap:   { alignItems: 'center', justifyContent: 'center', width: 360, height: 360 },
  callRing:         { position: 'absolute', width: 120, height: 120, borderRadius: 60, borderWidth: 1.5 },
  callAvatarOuter:  { width: 132, height: 132, borderRadius: 66, backgroundColor: 'rgba(255,255,255,0.1)', padding: 6 },
  callAvatarInner:  { flex: 1, borderRadius: 60, overflow: 'hidden' },
  callAvatarImg:    { width: '100%', height: '100%' },
  callControls:     { width: '100%', paddingHorizontal: 36 },
  callIncomingRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 12 },
  callActiveRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 12 },
  callCtrlBtn:      { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  callCtrlLabel:    { fontSize: 12, fontFamily: 'ProductSans-Regular', color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  callEndBtn:       { width: 72, height: 72, borderRadius: 36, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center' },

  // Unmatch modal
  unmatchSheet:        { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 18 },
  unmatchTitle:        { fontSize: 19, fontFamily: 'ProductSans-Black', marginBottom: 6 },
  unmatchSub:          { fontSize: 13, fontFamily: 'ProductSans-Regular', marginBottom: 20, lineHeight: 19 },
  unmatchReasonGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  unmatchReasonSquircle: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, paddingHorizontal: 10, minHeight: 86 },
  unmatchReasonText:   { fontSize: 13, fontFamily: 'ProductSans-Medium', textAlign: 'center', lineHeight: 17 },
  unmatchCustomInput:  { fontSize: 14, fontFamily: 'ProductSans-Regular', lineHeight: 20 },
  unmatchConfirmBtn:   { borderRadius: 18, overflow: 'hidden', marginBottom: 4 },
  unmatchConfirmText:  { fontSize: 15, fontFamily: 'ProductSans-Black' },

  // Partner profile sheet
  profileSheet:           { position: 'absolute', bottom: 0, left: 0, right: 0, top: 0, overflow: 'hidden' },

  // Global header (mirrors chat screen header)
  profileGlobalHeader:    { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 14, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 8, zIndex: 10 },
  profileHeaderIconBtn:   { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  profileGlobalUnmatch:   { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 8, height: 34 },

  // Hero photo
  profileHeroInfo:     { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20 },
  profileHeroName:     { fontSize: 28, fontFamily: 'ProductSans-Black', color: '#fff' },
  profileHeroLocation: { fontSize: 13, fontFamily: 'ProductSans-Regular', color: 'rgba(255,255,255,0.75)' },

  // AI conversation starter box (monochrome)
  profileAiBox:        { marginHorizontal: 16, marginVertical: 14, padding: 16 },
  profileAiIcon:       { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  profileAiLabel:      { fontSize: 11, fontFamily: 'ProductSans-Bold', letterSpacing: 0.8 },
  profileAiText:       { fontSize: 15, fontFamily: 'ProductSans-Regular', lineHeight: 22, fontStyle: 'italic' },
  profileAiSkeleton:   { height: 14, borderRadius: 7, opacity: 0.2 },

  // AI Insights section
  profileInsightsWrap:         { gap: 10, paddingTop: 14, paddingBottom: 16, paddingHorizontal: 16 },
  profileInsightsHeader:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  profileInsightsIcon:         { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  profileInsightsTitle:        { fontSize: 15, fontFamily: 'ProductSans-Black', flex: 1 },
  profileInsightsSub:          { fontSize: 11, fontFamily: 'ProductSans-Regular' },
  profileInsightsTiles:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  profileInsightsTile:         { flex: 1, minWidth: 72, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, paddingHorizontal: 8, gap: 4 },
  profileInsightsTileNum:      { fontSize: 22, fontFamily: 'ProductSans-Black' },
  profileInsightsTileLabel:    { fontSize: 11, fontFamily: 'ProductSans-Regular', textAlign: 'center', lineHeight: 14 },
  profileInsightsCareerlabel:  { fontSize: 10, fontFamily: 'ProductSans-Bold', letterSpacing: 1.2 },
  profileInsightsCareerRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  profileInsightsCareerIcon:   { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  profileInsightsCareerMeta:   { fontSize: 10, fontFamily: 'ProductSans-Regular' },
  profileInsightsCareerValue:  { fontSize: 13, fontFamily: 'ProductSans-Bold' },
  profileInsightsLocked:       { gap: 16, paddingVertical: 20, paddingHorizontal: 16, marginBottom: 8 },
  profileInsightsLockedIcon:   { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  profileInsightsLockedTitle:  { fontSize: 16, fontFamily: 'ProductSans-Black' },
  profileInsightsLockedSub:    { fontSize: 13, fontFamily: 'ProductSans-Regular', textAlign: 'center', lineHeight: 18, maxWidth: 240 },

  // Profile sections
  profileDetailSec:    { paddingHorizontal: 16, paddingTop: 16 },
  profileSec:          { gap: 12, marginBottom: 4 },
  profileSecLabel:     { fontSize: 10, fontFamily: 'ProductSans-Bold', letterSpacing: 1.5 },
  profileAbout:        { fontSize: 14, fontFamily: 'ProductSans-Regular', lineHeight: 22 },
  profileDivider:      { height: StyleSheet.hairlineWidth, marginVertical: 18 },
  profilePromptCard:   { padding: 14, gap: 6, marginBottom: 4 },
  profilePromptQ:      { fontSize: 11, fontFamily: 'ProductSans-Bold', letterSpacing: 0.3 },
  profilePromptA:      { fontSize: 14, fontFamily: 'ProductSans-Regular', lineHeight: 21 },
  profileInlinePhoto:  { width: '100%', height: W * 0.9, borderRadius: 18 },
  profileChipRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  profileChip:         { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9 },
  profileChipLabel:    { fontSize: 13, fontFamily: 'ProductSans-Medium' },
  profilePurposePill:  { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9 },
  profilePurposeText:  { fontSize: 13, fontFamily: 'ProductSans-Medium' },
  profileDetailGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  profileDetailChip:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, minWidth: 130 },
  profileDetailLabel:  { fontSize: 10, fontFamily: 'ProductSans-Regular' },
  profileDetailValue:  { fontSize: 12, fontFamily: 'ProductSans-Bold' },

  // Report & Block
  profileDangerRow:    { flexDirection: 'row', gap: 10, marginTop: 4, marginBottom: 8 },
  profileDangerBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 14 },
  profileDangerText:   { fontSize: 14, fontFamily: 'ProductSans-Medium' },
});
