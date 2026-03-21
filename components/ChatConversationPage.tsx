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
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
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

const { width: W, height: SCREEN_H } = Dimensions.get('window');
const CARD_W  = W - 72;
const CARD_GAP = 12;
const H_PHOTO = Math.round(W * 1.2);

// ─── Types ────────────────────────────────────────────────────────────────────

interface Msg {
  id: string;
  text: string;
  from: 'me' | 'them';
  time: string;
  isCard?: boolean;
  isAnswer?: boolean;
  answerTo?: string;
  replyToId?: string;
  // sending → sent (echoed back) → delivered (partner has ws open) → read
  status?: 'sending' | 'sent' | 'delivered' | 'read';
  // Truth or Dare game messages
  isTod?: boolean;
  todMsgType?: 'tod_invite' | 'tod_accept' | 'tod_answer' | 'tod_next';
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

// How far the bubble translates before hitting the cap
const SWIPE_THRESHOLD = 72;
// How far the raw gesture must travel to fire reply (lower = easier to trigger)
const REPLY_THRESHOLD = 48;
// Minimum dx before we claim the gesture (high enough to let iOS back-swipe win)
const CLAIM_THRESHOLD = 18;
// Left-edge dead zone: don't steal from iOS back-swipe when starting near edge
const EDGE_DEAD_ZONE  = 30;

// direction='right' → their messages (left side), drag left→right to reply
// direction='left'  → my messages (right side), drag right→left to reply
function SwipeableRow({ onReply, direction = 'right', children }: {
  onReply?: () => void;
  direction?: 'left' | 'right';
  children: React.ReactNode;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const triggered  = useRef(false);
  const isLeftSwipe = direction === 'left';

  const iconOpacity = translateX.interpolate({
    inputRange:  isLeftSwipe ? [-SWIPE_THRESHOLD, -40, 0] : [0, 40, SWIPE_THRESHOLD],
    outputRange: [1, 0.5, 0],
    extrapolate: 'clamp',
  });
  const iconScale = translateX.interpolate({
    inputRange:  isLeftSwipe ? [-SWIPE_THRESHOLD, 0] : [0, SWIPE_THRESHOLD],
    outputRange: [1, 0.5],
    extrapolate: 'clamp',
  });

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => {
        const hDominant = Math.abs(gs.dx) > Math.abs(gs.dy) * 2.5;
        if (isLeftSwipe) {
          return gs.dx < -CLAIM_THRESHOLD && hDominant;
        } else {
          // Right-direction: guard against iOS left-edge back swipe
          return gs.dx > CLAIM_THRESHOLD && hDominant && gs.x0 > EDGE_DEAD_ZONE;
        }
      },
      onPanResponderGrant: () => { triggered.current = false; },
      onPanResponderMove: (_, gs) => {
        if (isLeftSwipe) {
          if (gs.dx < 0) {
            translateX.setValue(Math.max(gs.dx * 0.5, -SWIPE_THRESHOLD));
            if (gs.dx < -REPLY_THRESHOLD && !triggered.current) triggered.current = true;
          }
        } else {
          if (gs.dx > 0) {
            translateX.setValue(Math.min(gs.dx * 0.5, SWIPE_THRESHOLD));
            if (gs.dx > REPLY_THRESHOLD && !triggered.current) triggered.current = true;
          }
        }
      },
      onPanResponderRelease: (_, gs) => {
        const fired = isLeftSwipe ? gs.dx < -REPLY_THRESHOLD : gs.dx > REPLY_THRESHOLD;
        if (fired && onReply) onReply();
        triggered.current = false;
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 120, friction: 10 }).start();
      },
      onPanResponderTerminate: () => {
        triggered.current = false;
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  return (
    <View style={{ position: 'relative' }}>
      {/* Reply icon: left side for right-swipe, right side for left-swipe */}
      <Animated.View style={[
        { position: 'absolute', top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', width: 32 },
        isLeftSwipe ? { right: 8 } : { left: 40 },
        { opacity: iconOpacity, transform: [{ scale: iconScale }] },
      ]}>
        <Ionicons name="return-down-forward-outline" size={20} color="#7c3aed" />
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX }] }} {...pan.panHandlers}>
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

function VoiceBubble({ msg, colors }: { msg: Msg; colors: any }) {
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
  );
}

// ─── Bubble ───────────────────────────────────────────────────────────────────

function Bubble({ msg, colors, onAnswer, answeredCards, myAvatar, partnerAvatar, isLastInGroup, onReply, onJumpToReply, onUnsend }: {
  msg: Msg; colors: any;
  onAnswer?: (q: string) => void;
  answeredCards?: Set<string>;
  myAvatar?: string;
  partnerAvatar?: string;
  isLastInGroup?: boolean;
  onReply?: (msg: Msg) => void;
  onJumpToReply?: (id: string) => void;
  onUnsend?: (msg: Msg) => void;
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
    const isImage = !!msg.imageUrl;
    const options: string[] = [];
    if (isImage) options.push('Save Image');
    if (isMe && msg.id && !msg.id.startsWith('opt-')) options.push('Unsend');
    options.push('Cancel');

    const cancelIdx = options.length - 1;
    const destructiveIdx = options.indexOf('Unsend');

    const handleAction = async (idx: number) => {
      const action = options[idx];
      if (action === 'Save Image' && msg.imageUrl) {
        try {
          const { status } = await MediaLibrary.requestPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission needed', 'Allow photo library access to save images.');
            return;
          }
          await MediaLibrary.saveToLibraryAsync(msg.imageUrl);
          Alert.alert('Saved', 'Image saved to your camera roll.');
        } catch {
          Alert.alert('Error', 'Could not save image.');
        }
      } else if (action === 'Unsend') {
        onUnsend?.(msg);
      }
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: cancelIdx, destructiveButtonIndex: destructiveIdx >= 0 ? destructiveIdx : undefined },
        handleAction,
      );
    } else {
      // Android fallback
      Alert.alert(
        'Message options',
        undefined,
        options
          .filter(o => o !== 'Cancel')
          .map((o, i) => ({
            text: o,
            style: o === 'Unsend' ? 'destructive' : 'default',
            onPress: () => handleAction(i),
          } as any))
          .concat([{ text: 'Cancel', style: 'cancel' }]),
      );
    }
  }, [msg, isMe, onUnsend]);

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
          {bubble}
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
          {bubble}
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
        <Pressable onLongPress={handleLongPress} delayLongPress={380}>
          {bubble}
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
                  <Image source={{ uri: images[1] }} style={styles.profileInlinePhoto} contentFit="cover" />
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
                  <Image source={{ uri: images[2] }} style={styles.profileInlinePhoto} contentFit="cover" />
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
                  <Image source={{ uri: img }} style={styles.profileInlinePhoto} contentFit="cover" />
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
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [loadingHistory,  setLoadingHistory]  = useState(true);
  const [isOnline,        setIsOnline]        = useState(online);
  const [keyboardShown,   setKeyboardShown]   = useState(false);
  const [showProfile,     setShowProfile]     = useState(false);
  const [showUnmatch,     setShowUnmatch]     = useState(false);
  const [isListening,     setIsListening]     = useState(false);
  const [isTranscribing,  setIsTranscribing]  = useState(false);
  const recStartingRef  = useRef(false);

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
  const [showTodPicker,  setShowTodPicker]  = useState(false);
  // todAnswerMsg: the turn message the receiver is answering
  const [todAnswerMsg,   setTodAnswerMsg]   = useState<Msg | null>(null);

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
        } else if (payload.type === 'game_response') {
          // Receiver answered a game bubble — update the original bubble in-place
          const { ref_msg_id, extra: responseExtra } = payload;
          if (ref_msg_id) {
            setMessages(prev => prev.map(m =>
              m.id === ref_msg_id
                ? { ...m, gameExtra: { ...m.gameExtra, ...(responseExtra ?? {}) } }
                : m
            ));
          }
        } else if (payload.type === 'typing') {
          setIsPartnerTyping(Boolean(payload.is_typing));
          if (payload.is_typing) setTimeout(() => setIsPartnerTyping(false), 3000);
        } else if (payload.type === 'presence' && payload.user_id === partnerId) {
          setIsOnline(Boolean(payload.online));
        } else if (payload.type === 'message_deleted') {
          setMessages(prev => prev.filter(m => m.id !== payload.message_id));
        } else if (payload.type === 'restricted') {
          // Backend rejected the message — remove the optimistic bubble and alert
          const pid = pendingOptIdRef.current;
          if (pid) {
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
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        Alert.alert('Permission needed', 'Please allow microphone access to send voice messages.');
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await chatRecorder.prepareToRecordAsync(RecordingPresets.HIGH_QUALITY);
      chatRecorder.record();
      setIsListening(true);
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
    setShowTodPicker(false);
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

            // Call record bubble
            if (msg.isCall) {
              return (
                <MsgRow key={msg.id} id={msg.id} highlightedId={highlightedMsgId} msgLayoutsRef={msgLayoutsRef}>
                  <SwipeableRow onReply={() => { setReplyingTo(msg); setAnsweringCard(null); }} direction={msg.from === 'me' ? 'left' : 'right'}>
                    <CallBubble
                      msg={msg}
                      colors={colors}
                      isLastInGroup={isLastInGroup}
                      myAvatar={myAvatar}
                      partnerAvatar={partnerAvatar}
                    />
                  </SwipeableRow>
                </MsgRow>
              );
            }

            // Mini-games bubble
            if (msg.isGame && msg.gameMsgType) {
              return (
                <MsgRow key={msg.id} id={msg.id} highlightedId={highlightedMsgId} msgLayoutsRef={msgLayoutsRef}>
                  <SwipeableRow onReply={() => { setReplyingTo(msg); setAnsweringCard(null); }} direction={msg.from === 'me' ? 'left' : 'right'}>
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
                      onRespond={(updatedMsg) => handleGameRespond(
                        msg,
                        updatedMsg.gameExtra ?? {},
                      )}
                    />
                  </SwipeableRow>
                </MsgRow>
              );
            }

            if (msg.isTod) {
              return (
                <MsgRow key={msg.id} id={msg.id} highlightedId={highlightedMsgId} msgLayoutsRef={msgLayoutsRef}>
                  <SwipeableRow onReply={() => { setReplyingTo(msg); setAnsweringCard(null); }} direction={msg.from === 'me' ? 'left' : 'right'}>
                    <TodBubble
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
                      {!isMe && (
                        isLastInGroup
                          ? <BubbleAvatar uri={partnerAvatar} />
                          : <View style={{ width: 28 }} />
                      )}
                      <VoiceBubble msg={msg} colors={colors} />
                      {isMe && (
                        isLastInGroup
                          ? <BubbleAvatar uri={myAvatar} />
                          : <View style={{ width: 28 }} />
                      )}
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
                  // Optimistically remove from UI
                  setMessages(prev => prev.filter(x => x.id !== m.id));
                  try {
                    await apiFetch(`/chat/messages/${m.id}`, { token, method: 'DELETE' });
                  } catch {
                    // Restore if API call fails
                    setMessages(prev => [m, ...prev].sort((a, b) => a.time.localeCompare(b.time)));
                  }
                }}
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
        onUnmatch={() => setShowUnmatch(true)}
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
