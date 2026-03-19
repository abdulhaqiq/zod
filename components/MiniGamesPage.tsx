/**
 * MiniGamesPage.tsx
 *
 * Full-screen game hub. Opened from the chat toolbar game button.
 * Fetches all mini-games + cards from the backend API.
 *
 * Route params (via expo-router):
 *   partnerId   — the other user's id
 *   partnerName — display name
 *   roomId      — chat room id (used for saving responses)
 *
 * Flow:
 *   Hub (game list) → Game Detail (categories + cards) → send to chat
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Squircle from '@/components/ui/Squircle';
import { apiFetch } from '@/constants/api';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';

const { width: W, height: H } = Dimensions.get('window');

// ─── Brand palette ────────────────────────────────────────────────────────────
const BRAND = {
  cardFill:    'rgba(12, 50, 109, 0.35)',   // Dark Midnight Blue tint
  cardBorder:  'rgba(208, 165, 62, 0.45)',  // Satin Sheen Gold border
  gold:        '#D0A53E',                    // Satin Sheen Gold — highlights
  orange:      '#E05327',                    // Flame Orange — accents only
  bgTop:       '#1a0d3a',                    // Spectral Night top
  bgBottom:    '#0a0614',                    // Spectral Night bottom
  optionFill:  'rgba(12, 50, 109, 0.5)',    // Option boxes
  optionBorder:'rgba(208, 165, 62, 0.25)',  // Option box border
  white:       '#E2E1E0',                    // Chinese White text
  btnFill:     '#E2E1E0',                    // Button background — Chinese White
  btnText:     '#1C1C1C',                    // Button text — Eerie Black
} as const;

// ─── Gradient helpers ─────────────────────────────────────────────────────────

/** Lighten a hex color by mixing it toward white by `amount` (0–1). */
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface MiniGameMeta {
  id: string;
  game_type: string;
  name: string;
  tagline: string;
  description: string;
  emoji: string;
  accent_color: string;
  bg_color: string;
  categories: string[];
  sort_order: number;
}

interface GameCardData {
  id: string;
  game: string;
  category: string;
  emoji: string;
  question: string;
  color: string;
  option_a?: string;
  option_b?: string;
  options?: string[];
}

// ─── Fallback cards (used when DB has no rows yet) ────────────────────────────

function _gc(game: string, category: string, emoji: string, question: string, n: number, color: string, option_a?: string, option_b?: string): GameCardData {
  return { id: `fb-${game}-${category}-${n}`, game, category, emoji, question, color, option_a, option_b };
}

const FALLBACK_GAME_CARDS: GameCardData[] = [
  // ── question_cards ──────────────────────────────────────────────────────────
  _gc('question_cards','Deep','🌀',"What's one belief you've held for years that you recently started questioning?",0,'#1e1b4b'),
  _gc('question_cards','Deep','🎵',"If your life had a theme song right now, what would it be and why?",1,'#1e1b4b'),
  _gc('question_cards','Deep','💔',"What's the hardest thing you've ever had to forgive someone for?",2,'#1e1b4b'),
  _gc('question_cards','Deep','⏳',"If you could relive one moment in your life, which would it be?",3,'#1e1b4b'),
  _gc('question_cards','Deep','🌠',"What's something you want to accomplish before you die that most people would never guess?",4,'#1e1b4b'),
  _gc('question_cards','Deep','🏡',"What does 'home' mean to you?",5,'#1e1b4b'),
  _gc('question_cards','Deep','🪞',"If you could talk to your 16-year-old self for 5 minutes, what would you say?",6,'#1e1b4b'),
  _gc('question_cards','Deep','🌑',"What's one secret fear you've never told anyone?",7,'#1e1b4b'),
  _gc('question_cards','Deep','✨',"At what point in your life did you feel most alive?",8,'#1e1b4b'),
  _gc('question_cards','Deep','❤️',"How do you know when you're in love?",9,'#1e1b4b'),
  _gc('question_cards','Deep','⚡',"What's something that scares you but excites you at the same time?",10,'#1e1b4b'),
  _gc('question_cards','Deep','💡',"What's the most important lesson love has taught you?",11,'#1e1b4b'),

  _gc('question_cards','Fun','🍕',"If you were a pizza topping, what would you be and why?",0,'#3a2800'),
  _gc('question_cards','Fun','😳',"What's the most embarrassing thing that happened to you in public?",1,'#3a2800'),
  _gc('question_cards','Fun','🔍',"What's the strangest thing you've Googled in the last week?",2,'#3a2800'),
  _gc('question_cards','Fun','⭐',"If you could swap lives with a celebrity for a day, who and why?",3,'#3a2800'),
  _gc('question_cards','Fun','🤹',"What's your most useless talent?",4,'#3a2800'),
  _gc('question_cards','Fun','🐾',"If your pet could talk, what would be their biggest complaint about you?",5,'#3a2800'),
  _gc('question_cards','Fun','🎤',"What's your go-to karaoke song?",6,'#3a2800'),
  _gc('question_cards','Fun','📺',"If you had to star in a reality TV show, which one?",7,'#3a2800'),
  _gc('question_cards','Fun','🏆',"What's the most ridiculous argument you've ever won?",8,'#3a2800'),
  _gc('question_cards','Fun','👽',"If aliens visited Earth, what would you be embarrassed to explain to them?",9,'#3a2800'),
  _gc('question_cards','Fun','😂',"If you were a meme, which one would you be?",10,'#3a2800'),
  _gc('question_cards','Fun','🛒',"What's the most random thing you've ever impulse-bought?",11,'#3a2800'),

  _gc('question_cards','Romantic','🕯️',"What's your idea of the perfect date?",0,'#3d0a28'),
  _gc('question_cards','Romantic','💌',"What small gesture makes you feel most loved?",1,'#3d0a28'),
  _gc('question_cards','Romantic','👀',"Do you believe in love at first sight?",2,'#3d0a28'),
  _gc('question_cards','Romantic','🎶',"What song instantly puts you in a romantic mood?",3,'#3d0a28'),
  _gc('question_cards','Romantic','🎁',"What's the most thoughtful thing someone has ever done for you?",4,'#3d0a28'),
  _gc('question_cards','Romantic','💬',"What's the most meaningful compliment you've ever received?",5,'#3d0a28'),
  _gc('question_cards','Romantic','🌹',"What quality do you look for first in a partner?",6,'#3d0a28'),
  _gc('question_cards','Romantic','☔',"What's something you'd want to do together on a rainy Sunday?",7,'#3d0a28'),
  _gc('question_cards','Romantic','💞',"How do you show love — words, actions, or something else?",8,'#3d0a28'),
  _gc('question_cards','Romantic','🌅',"What's one experience you want to share with someone special?",9,'#3d0a28'),
  _gc('question_cards','Romantic','☀️',"What would your dream morning look like with someone you love?",10,'#3d0a28'),
  _gc('question_cards','Romantic','🎀',"What's one thing you'd do to surprise the person you love?",11,'#3d0a28'),

  _gc('question_cards','Spicy','🔥',"What's one rule you love to break?",0,'#3d0c0c'),
  _gc('question_cards','Spicy','😏',"What's the boldest thing you've done to get someone's attention?",1,'#3d0c0c'),
  _gc('question_cards','Spicy','🤫',"Have you ever done something you immediately thought 'I can never tell anyone this'?",2,'#3d0c0c'),
  _gc('question_cards','Spicy','📲',"Have you ever sent a text to the wrong person — what was it?",3,'#3d0c0c'),
  _gc('question_cards','Spicy','⚡',"What's the most spontaneous thing you've ever done?",4,'#3d0c0c'),
  _gc('question_cards','Spicy','😅',"Have you ever lied to get out of a date?",5,'#3d0c0c'),
  _gc('question_cards','Spicy','👀',"What do you find attractive that you'd never admit out loud?",6,'#3d0c0c'),
  _gc('question_cards','Spicy','😬',"What's the worst date you've ever been on?",7,'#3d0c0c'),
  _gc('question_cards','Spicy','😤',"What's your biggest pet peeve in dating?",8,'#3d0c0c'),
  _gc('question_cards','Spicy','🎭',"What's the most creative excuse you've ever made?",9,'#3d0c0c'),
  _gc('question_cards','Spicy','💅',"What's the pettiest thing you've done after a breakup?",10,'#3d0c0c'),
  _gc('question_cards','Spicy','🙈',"What's your most 'oops' moment on a date?",11,'#3d0c0c'),

  // ── wyr ─────────────────────────────────────────────────────────────────────
  _gc('wyr','Classic','💀',"Know date you die vs. how you die",0,'#2d1a5e',"Know the date","Know how"),
  _gc('wyr','Classic','🧠',"Perfect memory vs. forget painful things",1,'#2d1a5e',"Perfect memory","Forget painful things"),
  _gc('wyr','Classic','📵',"Lose your phone vs. lose your wallet",2,'#2d1a5e',"Lose my phone","Lose my wallet"),
  _gc('wyr','Classic','🤍',"One true love vs. 10 great friendships",3,'#2d1a5e',"One true love","10 great friendships"),
  _gc('wyr','Classic','🎬',"Speak only in song lyrics vs. movie quotes",4,'#2d1a5e',"Song lyrics","Movie quotes"),
  _gc('wyr','Classic','🌆',"Live in a big city vs. the countryside",5,'#2d1a5e',"Big city","Countryside"),
  _gc('wyr','Classic','☕',"No internet for a month vs. no coffee",6,'#2d1a5e',"No internet","No coffee"),
  _gc('wyr','Classic','🚀',"Explore the ocean vs. outer space",7,'#2d1a5e',"Explore ocean","Outer space"),
  _gc('wyr','Classic','😴',"Photographic memory vs. only need 4 hours sleep",8,'#2d1a5e',"Photographic memory","4 hrs sleep"),
  _gc('wyr','Classic','🏛️',"Famous now but forgotten vs. unknown but remembered forever",9,'#2d1a5e',"Famous now","Remembered forever"),
  _gc('wyr','Classic','⏸️',"Rewind button vs. pause button for your life",10,'#2d1a5e',"Rewind","Pause"),
  _gc('wyr','Classic','🍽️',"Eat your favourite meal every day vs. never eat it again",11,'#2d1a5e',"Eat it every day","Never eat it again"),

  // ── nhi ─────────────────────────────────────────────────────────────────────
  _gc('nhi','Fun','🙈',"Never have I ever lied to get out of plans",0,'#3a2800'),
  _gc('nhi','Fun','📱',"Never have I ever stalked an ex on social media",1,'#3a2800'),
  _gc('nhi','Fun','😴',"Never have I ever fallen asleep on a date",2,'#3a2800'),
  _gc('nhi','Fun','🍕',"Never have I ever eaten an entire pizza alone",3,'#3a2800'),
  _gc('nhi','Fun','✈️',"Never have I ever missed a flight",4,'#3a2800'),
  _gc('nhi','Spicy','😅',"Never have I ever sent a text to the wrong person",5,'#3d0c0c'),
  _gc('nhi','Spicy','👻',"Never have I ever ghosted someone I actually liked",6,'#3d0c0c'),
  _gc('nhi','Spicy','🤥',"Never have I ever faked being sick to avoid someone",7,'#3d0c0c'),
  _gc('nhi','Spicy','🕵️',"Never have I ever googled a date before meeting them",8,'#3d0c0c'),
  _gc('nhi','Spicy','💌',"Never have I ever written a love letter I never sent",9,'#3d0c0c'),

  // ── hot_takes ────────────────────────────────────────────────────────────────
  _gc('hot_takes','Dating','🔥',"Dating apps have made dating worse, not better",0,'#3d0c0c'),
  _gc('hot_takes','Dating','💅',"Playing hard to get is just manipulation",1,'#3d0c0c'),
  _gc('hot_takes','Dating','🤔',"Splitting the bill on a first date is the right move",2,'#3d0c0c'),
  _gc('hot_takes','Dating','😤',"Long-distance relationships never really work",3,'#3d0c0c'),
  _gc('hot_takes','Life','🌶️',"Social media has ruined modern dating",4,'#3d0c0c'),
  _gc('hot_takes','Life','🏠',"Working from home is better than office life",5,'#3d0c0c'),
  _gc('hot_takes','Life','☕',"Morning people have a personality advantage over night owls",6,'#3d0c0c'),
  _gc('hot_takes','Life','🎮',"Video games are a valid hobby at any age",7,'#3d0c0c'),
  _gc('hot_takes','Life','🐱',"Cat people and dog people are fundamentally different",8,'#3d0c0c'),
  _gc('hot_takes','Pop','🎵',"Streaming has made music worse overall",9,'#3d0c0c'),
];

function getFallbackGameCards(gameType: string, category?: string): GameCardData[] {
  const base = FALLBACK_GAME_CARDS.filter(c => c.game === gameType);
  if (!category) return base;
  return base.filter(c => c.category === category);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns '#fff' or '#0f172a' depending on the perceived brightness of a hex color. */
function contrastText(hex: string): string {
  const clean = hex.replace('#', '');
  if (clean.length < 6) return '#fff';
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  // Relative luminance (sRGB)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? '#0f172a' : '#fff';
}

// ─── Shimmer ──────────────────────────────────────────────────────────────────

function Shimmer({ width, height, borderRadius = 12, bgColor = '#1a1a1a' }: { width: number | string; height: number; borderRadius?: number; bgColor?: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(anim, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
    ).start();
  }, []);
  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [-300, 300] });
  return (
    <View style={{ width: width as any, height, borderRadius, backgroundColor: bgColor, overflow: 'hidden' }}>
      <Animated.View style={{ ...StyleSheet.absoluteFillObject, transform: [{ translateX }] }}>
        <LinearGradient colors={['transparent', 'rgba(255,255,255,0.08)', 'transparent']}
          start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFillObject} />
      </Animated.View>
    </View>
  );
}

const SHIMMER_BG = 'rgba(255,255,255,0.07)';

function LoadingSkeleton() {
  return (
    <View style={{ padding: 20, gap: 14 }}>
      {[0, 1, 2, 3, 4].map(i => (
        <View key={i} style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <Shimmer width={56} height={56} borderRadius={18} bgColor={SHIMMER_BG} />
          <View style={{ flex: 1, gap: 8 }}>
            <Shimmer width="70%" height={16} borderRadius={8} bgColor={SHIMMER_BG} />
            <Shimmer width="45%" height={12} borderRadius={6} bgColor={SHIMMER_BG} />
          </View>
          <Shimmer width={24} height={24} borderRadius={12} bgColor={SHIMMER_BG} />
        </View>
      ))}
    </View>
  );
}

// ─── Category pill ────────────────────────────────────────────────────────────

function CategoryPill({ label, isActive, onPress }: {
  label: string; isActive: boolean; accent: string; onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}>
      <Squircle style={s.catPill}
        cornerRadius={50} cornerSmoothing={1}
        fillColor={isActive ? BRAND.gold : 'rgba(12,50,109,0.4)'}
        strokeColor={isActive ? BRAND.gold : BRAND.cardBorder}
        strokeWidth={1.5}>
        <Text style={[s.catPillText, { color: isActive ? '#1a0d00' : BRAND.white }]}>{label}</Text>
      </Squircle>
    </Pressable>
  );
}

// ─── WYR Card ─────────────────────────────────────────────────────────────────

function WyrCard({ card, accent, onSend }: { card: GameCardData; accent: string; onSend: (card: GameCardData) => void }) {
  return (
    <Squircle style={s.gameCard} cornerRadius={24} cornerSmoothing={1}
      fillColor={BRAND.cardFill} strokeColor={`${accent}55`} strokeWidth={1.5}>
      <Squircle style={s.gameCardBadge} cornerRadius={50} cornerSmoothing={1} fillColor={`${accent}22`}>
        <Text style={[s.gameCardBadgeText, { color: accent }]}>Would You Rather</Text>
      </Squircle>
      <View style={s.wyrRow}>
        <Squircle style={s.wyrBox} cornerRadius={16} cornerSmoothing={1}
          fillColor={BRAND.optionFill} strokeColor={`${accent}30`} strokeWidth={1}>
          <Text style={[s.wyrLabel, { color: accent }]}>A</Text>
          <Text style={[s.wyrText, { color: BRAND.white }]}>{card.option_a ?? ''}</Text>
        </Squircle>
        <Text style={s.wyrOr}>or</Text>
        <Squircle style={s.wyrBox} cornerRadius={16} cornerSmoothing={1}
          fillColor={BRAND.optionFill} strokeColor={`${accent}30`} strokeWidth={1}>
          <Text style={[s.wyrLabel, { color: accent }]}>B</Text>
          <Text style={[s.wyrText, { color: BRAND.white }]}>{card.option_b ?? ''}</Text>
        </Squircle>
      </View>
      <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onSend(card); }} style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}>
        <Squircle style={s.sendCardBtn} cornerRadius={50} cornerSmoothing={1} fillColor={BRAND.btnFill}>
          <Ionicons name="send" size={14} color={BRAND.btnText} />
          <Text style={[s.sendCardBtnText, { color: BRAND.btnText }]}>Send This</Text>
        </Squircle>
      </Pressable>
    </Squircle>
  );
}

// ─── Statement Card (NHI / Hot Takes / Question Cards) ───────────────────────

function StatementCard({ card, accent, label, onSend }: { card: GameCardData; accent: string; label: string; onSend: (card: GameCardData) => void }) {
  return (
    <Squircle style={s.gameCard} cornerRadius={24} cornerSmoothing={1}
      fillColor={BRAND.cardFill} strokeColor={`${accent}55`} strokeWidth={1.5}>
      <Squircle style={s.gameCardBadge} cornerRadius={50} cornerSmoothing={1} fillColor={`${accent}22`}>
        <Text style={[s.gameCardBadgeText, { color: accent }]}>{label}</Text>
      </Squircle>
      <Text style={[s.statementText, { color: BRAND.white }]}>{card.question}</Text>
      <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onSend(card); }} style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}>
        <Squircle style={s.sendCardBtn} cornerRadius={50} cornerSmoothing={1} fillColor={BRAND.btnFill}>
          <Ionicons name="send" size={14} color={BRAND.btnText} />
          <Text style={[s.sendCardBtnText, { color: BRAND.btnText }]}>Send This</Text>
        </Squircle>
      </Pressable>
    </Squircle>
  );
}

// ─── Quiz / Date step card ────────────────────────────────────────────────────

function QuizCard({ card, accent, label, onSend }: { card: GameCardData; accent: string; label: string; onSend: (card: GameCardData) => void }) {
  return (
    <Squircle style={s.gameCard} cornerRadius={24} cornerSmoothing={1}
      fillColor={BRAND.cardFill} strokeColor={`${accent}55`} strokeWidth={1.5}>
      <Squircle style={s.gameCardBadge} cornerRadius={50} cornerSmoothing={1} fillColor={`${accent}22`}>
        <Text style={[s.gameCardBadgeText, { color: accent }]}>{label}</Text>
      </Squircle>
      <Text style={[s.statementText, { color: BRAND.white }]}>{card.question}</Text>
      {(card.options ?? []).map((opt, i) => (
        <Squircle key={i} style={s.quizOpt} cornerRadius={14} cornerSmoothing={1}
          fillColor={BRAND.optionFill} strokeColor={`${accent}30`} strokeWidth={1}>
          <Text style={[s.quizOptText, { color: BRAND.white }]}>{opt}</Text>
        </Squircle>
      ))}
      <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onSend(card); }} style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}>
        <Squircle style={s.sendCardBtn} cornerRadius={50} cornerSmoothing={1} fillColor={BRAND.btnFill}>
          <Ionicons name="send" size={14} color={BRAND.btnText} />
          <Text style={[s.sendCardBtnText, { color: BRAND.btnText }]}>Send This Quiz</Text>
        </Squircle>
      </Pressable>
    </Squircle>
  );
}

// ─── Custom write card ────────────────────────────────────────────────────────

// ─── Truth or Dare Card ───────────────────────────────────────────────────────

function TodCard({ card, onSend }: { card: GameCardData; accent: string; onSend: (card: GameCardData) => void }) {
  const isDare     = card.category?.toLowerCase() === 'dare';
  const badgeColor = isDare ? BRAND.orange : BRAND.gold;
  const badgeLabel = isDare ? 'Dare' : 'Truth';
  return (
    <Squircle style={s.gameCard} cornerRadius={24} cornerSmoothing={1}
      fillColor={BRAND.cardFill} strokeColor={BRAND.cardBorder} strokeWidth={1.5}>
      <Squircle style={s.gameCardBadge} cornerRadius={50} cornerSmoothing={1}
        fillColor={isDare ? 'rgba(224,83,39,0.18)' : 'rgba(208,165,62,0.18)'}>
        <Text style={[s.gameCardBadgeText, { color: badgeColor }]}>{badgeLabel}</Text>
      </Squircle>
      <Text style={[s.statementText, { color: BRAND.white }]}>{card.question}</Text>
      <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onSend(card); }} style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}>
        <Squircle style={s.sendCardBtn} cornerRadius={50} cornerSmoothing={1} fillColor={BRAND.btnFill}>
          <Ionicons name="send" size={14} color={BRAND.btnText} />
          <Text style={[s.sendCardBtnText, { color: BRAND.btnText }]}>
            {isDare ? 'Send Dare' : 'Send Truth'}
          </Text>
        </Squircle>
      </Pressable>
    </Squircle>
  );
}

function CustomCard({ label, placeholder, onSend }: {
  accent: string; label: string; placeholder: string;
  onSend: (text: string) => void;
}) {
  const [text, setText] = useState('');
  return (
    <Squircle style={s.gameCard} cornerRadius={24} cornerSmoothing={1}
      fillColor={BRAND.cardFill} strokeColor={BRAND.cardBorder} strokeWidth={1.5}>
      <Squircle style={s.gameCardBadge} cornerRadius={50} cornerSmoothing={1} fillColor="rgba(208,165,62,0.18)">
        <Ionicons name="create-outline" size={13} color={BRAND.gold} />
        <Text style={[s.gameCardBadgeText, { color: BRAND.gold }]}>{label}</Text>
      </Squircle>
      <Squircle style={s.customInput} cornerRadius={16} cornerSmoothing={1}
        fillColor={BRAND.optionFill} strokeColor={BRAND.optionBorder} strokeWidth={1}>
        <TextInput
          value={text} onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor="rgba(226,225,224,0.3)"
          style={[s.customInputText, { color: BRAND.white }]}
          multiline maxLength={200}
        />
      </Squircle>
      <Pressable onPress={() => { if (text.trim()) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onSend(text.trim()); } }}
        disabled={!text.trim()}
        style={({ pressed }) => [{ opacity: !text.trim() ? 0.4 : pressed ? 0.8 : 1 }]}>
        <Squircle style={s.sendCardBtn} cornerRadius={50} cornerSmoothing={1} fillColor={BRAND.btnFill}>
          <Ionicons name="send" size={14} color={BRAND.btnText} />
          <Text style={[s.sendCardBtnText, { color: BRAND.btnText }]}>Send Custom</Text>
        </Squircle>
      </Pressable>
    </Squircle>
  );
}

// ─── AI-generate card ─────────────────────────────────────────────────────────

type AiGenerated = {
  question: string;
  emoji: string;
  sub_type?: string;
};

function AiGeneratedPreview({
  generated,
  gameType,
  accent,
  onSend,
  onRegenerate,
  loading,
}: {
  generated: AiGenerated;
  gameType: string;
  accent: string;
  onSend: (text: string) => void;
  onRegenerate: () => void;
  loading: boolean;
}) {
  // WYR: split "A|||B"
  if (gameType === 'wyr' && generated.question.includes('|||')) {
    const [optA, optB] = generated.question.split('|||');
    return (
      <Squircle style={{ padding: 14, gap: 12 }} cornerRadius={18} cornerSmoothing={1}
        fillColor="rgba(255,255,255,0.06)" strokeColor={`${accent}40`} strokeWidth={1}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 18 }}>{generated.emoji}</Text>
          <Text style={{ color: BRAND.gold, fontSize: 11, fontFamily: 'ProductSans-Black', letterSpacing: 0.4 }}>Would You Rather</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Squircle style={{ flex: 1, padding: 12, gap: 4 }} cornerRadius={14} cornerSmoothing={1}
            fillColor={BRAND.optionFill} strokeColor={BRAND.optionBorder} strokeWidth={1}>
            <Text style={{ fontSize: 10, color: BRAND.gold, fontFamily: 'ProductSans-Black', letterSpacing: 0.5 }}>A</Text>
            <Text style={{ color: BRAND.white, fontSize: 14, fontFamily: 'ProductSans-Bold', lineHeight: 20 }}>{optA.trim()}</Text>
          </Squircle>
          <Text style={{ color: 'rgba(208,165,62,0.4)', fontSize: 14, fontFamily: 'ProductSans-Black', alignSelf: 'center' }}>or</Text>
          <Squircle style={{ flex: 1, padding: 12, gap: 4 }} cornerRadius={14} cornerSmoothing={1}
            fillColor={BRAND.optionFill} strokeColor={BRAND.optionBorder} strokeWidth={1}>
            <Text style={{ fontSize: 10, color: BRAND.gold, fontFamily: 'ProductSans-Black', letterSpacing: 0.5 }}>B</Text>
            <Text style={{ color: BRAND.white, fontSize: 14, fontFamily: 'ProductSans-Bold', lineHeight: 20 }}>{optB.trim()}</Text>
          </Squircle>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onRegenerate(); }} disabled={loading}
            style={({ pressed }) => [{ flex: 1, opacity: loading ? 0.5 : pressed ? 0.75 : 1 }]}>
            <Squircle style={s.sendCardBtn} cornerRadius={50} cornerSmoothing={1} fillColor="rgba(255,255,255,0.08)">
              <Text style={{ fontSize: 13 }}>↺</Text>
              <Text style={[s.sendCardBtnText, { fontSize: 13 }]}>Try Again</Text>
            </Squircle>
          </Pressable>
          <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onSend(generated.question); }}
            style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.8 : 1 }]}>
            <Squircle style={s.sendCardBtn} cornerRadius={50} cornerSmoothing={1} fillColor={BRAND.btnFill}>
              <Ionicons name="send" size={14} color={BRAND.btnText} />
              <Text style={[s.sendCardBtnText, { color: BRAND.btnText }]}>Send This</Text>
            </Squircle>
          </Pressable>
        </View>
      </Squircle>
    );
  }

  // Quiz / Build Date: "Question|||Opt1|||Opt2|||..."
  if ((gameType === 'quiz' || gameType === 'build_date') && generated.question.includes('|||')) {
    const [q, ...opts] = generated.question.split('|||');
    return (
      <Squircle style={{ padding: 14, gap: 10 }} cornerRadius={18} cornerSmoothing={1}
        fillColor={BRAND.cardFill} strokeColor={BRAND.cardBorder} strokeWidth={1.5}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 18 }}>{generated.emoji}</Text>
          <Text style={{ color: BRAND.gold, fontSize: 11, fontFamily: 'ProductSans-Black', letterSpacing: 0.4 }}>
            {gameType === 'quiz' ? 'Quiz Question' : 'Date Step'}
          </Text>
        </View>
        <Text style={[s.statementText, { color: BRAND.white }]}>{q.trim()}</Text>
        <View style={{ gap: 6 }}>
          {opts.map((opt, i) => (
            <Squircle key={i} style={{ paddingHorizontal: 14, paddingVertical: 10 }} cornerRadius={12} cornerSmoothing={1}
              fillColor={BRAND.optionFill} strokeColor={BRAND.optionBorder} strokeWidth={1}>
              <Text style={{ color: BRAND.white, fontSize: 14, fontFamily: 'ProductSans-Bold' }}>{opt.trim()}</Text>
            </Squircle>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onRegenerate(); }} disabled={loading}
            style={({ pressed }) => [{ flex: 1, opacity: loading ? 0.5 : pressed ? 0.75 : 1 }]}>
            <Squircle style={s.sendCardBtn} cornerRadius={50} cornerSmoothing={1} fillColor="rgba(255,255,255,0.08)">
              <Text style={{ fontSize: 13 }}>↺</Text>
              <Text style={[s.sendCardBtnText, { fontSize: 13 }]}>Try Again</Text>
            </Squircle>
          </Pressable>
          <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onSend(generated.question); }}
            style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.8 : 1 }]}>
            <Squircle style={s.sendCardBtn} cornerRadius={50} cornerSmoothing={1} fillColor={BRAND.btnFill}>
              <Ionicons name="send" size={14} color={BRAND.btnText} />
              <Text style={[s.sendCardBtnText, { color: BRAND.btnText }]}>Send This</Text>
            </Squircle>
          </Pressable>
        </View>
      </Squircle>
    );
  }

  // Truth or Dare: show truth/dare badge
  if (gameType === 'truth_or_dare') {
    const isDare     = generated.sub_type === 'dare';
    const badgeColor = isDare ? BRAND.orange : BRAND.gold;
    const badgeLabel = isDare ? 'Dare' : 'Truth';
    return (
      <Squircle style={{ padding: 14, gap: 10 }} cornerRadius={18} cornerSmoothing={1}
        fillColor={BRAND.cardFill} strokeColor={BRAND.cardBorder} strokeWidth={1.5}>
        <Squircle style={s.gameCardBadge} cornerRadius={50} cornerSmoothing={1}
          fillColor={isDare ? 'rgba(224,83,39,0.18)' : 'rgba(208,165,62,0.18)'}>
          <Text style={[s.gameCardBadgeText, { color: badgeColor }]}>{badgeLabel}</Text>
        </Squircle>
        <Text style={[s.statementText, { color: BRAND.white }]}>{generated.question}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onRegenerate(); }} disabled={loading}
            style={({ pressed }) => [{ flex: 1, opacity: loading ? 0.5 : pressed ? 0.75 : 1 }]}>
            <Squircle style={s.sendCardBtn} cornerRadius={50} cornerSmoothing={1} fillColor="rgba(255,255,255,0.08)">
              <Text style={{ fontSize: 13 }}>↺</Text>
              <Text style={[s.sendCardBtnText, { fontSize: 13 }]}>Try Again</Text>
            </Squircle>
          </Pressable>
          <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onSend(generated.question); }}
            style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.8 : 1 }]}>
            <Squircle style={s.sendCardBtn} cornerRadius={50} cornerSmoothing={1} fillColor={BRAND.btnFill}>
              <Ionicons name="send" size={14} color={BRAND.btnText} />
              <Text style={[s.sendCardBtnText, { color: BRAND.btnText }]}>
                {isDare ? 'Send Dare' : 'Send Truth'}
              </Text>
            </Squircle>
          </Pressable>
        </View>
      </Squircle>
    );
  }

  // Default: statement / question card
  return (
    <Squircle style={{ padding: 14, gap: 10 }} cornerRadius={18} cornerSmoothing={1}
      fillColor={BRAND.cardFill} strokeColor={BRAND.cardBorder} strokeWidth={1.5}>
      <Text style={{ fontSize: 22, textAlign: 'center' }}>{generated.emoji}</Text>
      <Text style={[s.statementText, { textAlign: 'center', fontSize: 16, color: BRAND.white }]}>{generated.question}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onRegenerate(); }} disabled={loading}
          style={({ pressed }) => [{ flex: 1, opacity: loading ? 0.5 : pressed ? 0.75 : 1 }]}>
          <Squircle style={s.sendCardBtn} cornerRadius={50} cornerSmoothing={1} fillColor="rgba(255,255,255,0.08)">
            <Text style={{ fontSize: 13 }}>↺</Text>
            <Text style={[s.sendCardBtnText, { fontSize: 13 }]}>Try Again</Text>
          </Squircle>
        </Pressable>
        <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onSend(generated.question); }}
          style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.8 : 1 }]}>
          <Squircle style={s.sendCardBtn} cornerRadius={50} cornerSmoothing={1} fillColor={BRAND.btnFill}>
            <Ionicons name="send" size={14} color={BRAND.btnText} />
            <Text style={[s.sendCardBtnText, { color: BRAND.btnText }]}>Send This</Text>
          </Squircle>
        </Pressable>
      </View>
    </Squircle>
  );
}

function AiCard({ accent, gameType, token, onSend }: {
  accent: string;
  gameType: string;
  token: string;
  onSend: (text: string) => void;
}) {
  const [theme,     setTheme]     = useState('');
  const [todMode,   setTodMode]   = useState<'truth' | 'dare' | ''>('');
  const [loading,   setLoading]   = useState(false);
  const [generated, setGenerated] = useState<AiGenerated | null>(null);
  const [error,     setError]     = useState(false);

  const isTod = gameType === 'truth_or_dare';

  const generate = async (subType?: string) => {
    setLoading(true);
    setGenerated(null);
    setError(false);
    const effectiveSubType = subType ?? (isTod ? todMode : '');
    try {
      const result = await apiFetch<{ question: string; emoji: string; color: string; sub_type?: string }>(
        '/mini-games/generate',
        {
          method: 'POST',
          token,
          body: JSON.stringify({
            game_type: gameType,
            theme,
            chat_context: [],
            sub_type: effectiveSubType,
          }),
        }
      );
      setGenerated({ question: result.question, emoji: result.emoji, sub_type: result.sub_type ?? effectiveSubType });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Squircle style={s.gameCard} cornerRadius={24} cornerSmoothing={1}
      fillColor={BRAND.cardFill} strokeColor={BRAND.cardBorder} strokeWidth={1.5}>

      {/* Badge */}
      <Squircle style={s.gameCardBadge} cornerRadius={50} cornerSmoothing={1} fillColor="rgba(208,165,62,0.18)">
        <Text style={[s.gameCardBadgeText, { color: BRAND.gold }]}>Create with AI</Text>
      </Squircle>

      {/* Truth or Dare mode picker */}
      {isTod && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['truth', 'dare', ''] as const).map((mode) => {
            const label = mode === 'truth' ? 'Truth' : mode === 'dare' ? 'Dare' : 'Surprise';
            const isActive = todMode === mode;
            const modeColor = mode === 'dare' ? BRAND.orange : mode === 'truth' ? BRAND.gold : 'rgba(226,225,224,0.6)';
            return (
              <Pressable key={mode} onPress={() => setTodMode(mode)}
                style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.75 : 1 }]}>
                <Squircle style={{ paddingVertical: 10, alignItems: 'center' }} cornerRadius={14} cornerSmoothing={1}
                  fillColor={isActive ? (mode === 'dare' ? 'rgba(224,83,39,0.2)' : mode === 'truth' ? 'rgba(208,165,62,0.2)' : 'rgba(255,255,255,0.1)') : 'rgba(255,255,255,0.05)'}
                  strokeColor={isActive ? modeColor : 'rgba(208,165,62,0.2)'} strokeWidth={1.5}>
                  <Text style={{ color: isActive ? modeColor : 'rgba(226,225,224,0.4)', fontSize: 13, fontFamily: isActive ? 'ProductSans-Black' : 'ProductSans-Regular' }}>
                    {label}
                  </Text>
                </Squircle>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Theme hint input */}
      <Squircle style={[s.customInput, { minHeight: 48 }]} cornerRadius={14} cornerSmoothing={1}
        fillColor={BRAND.optionFill} strokeColor={BRAND.optionBorder} strokeWidth={1}>
        <TextInput
          value={theme} onChangeText={setTheme}
          placeholder="Optional: add a theme or mood…"
          placeholderTextColor="rgba(226,225,224,0.3)"
          style={[s.customInputText, { paddingTop: 0, color: BRAND.white }]}
          maxLength={80}
          returnKeyType="done"
        />
      </Squircle>

      {/* Generate button */}
      <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); generate(); }} disabled={loading}
        style={({ pressed }) => [{ opacity: loading ? 0.6 : pressed ? 0.8 : 1 }]}>
        <Squircle style={s.sendCardBtn} cornerRadius={50} cornerSmoothing={1}
          fillColor={loading ? 'rgba(255,255,255,0.12)' : BRAND.btnFill}>
          {loading
            ? <ActivityIndicator size="small" color={BRAND.btnText} />
            : <><Text style={[s.sendCardBtnText, { color: BRAND.btnText }]}>
                {isTod
                  ? (todMode === 'truth' ? 'Generate Truth' : todMode === 'dare' ? 'Generate Dare' : 'Generate Surprise')
                  : 'Generate'
                }
              </Text></>
          }
        </Squircle>
      </Pressable>

      {/* Error */}
      {error && (
        <Text style={{ color: '#f87171', fontSize: 13, fontFamily: 'ProductSans-Regular', textAlign: 'center', marginTop: -6 }}>
          Generation failed — tap Generate to retry
        </Text>
      )}

      {/* Generated preview */}
      {generated && (
        <AiGeneratedPreview
          generated={generated}
          gameType={gameType}
          accent={accent}
          onSend={onSend}
          onRegenerate={() => generate()}
          loading={loading}
        />
      )}
    </Squircle>
  );
}



function GameDetailScreen({ game, token, partnerId, partnerName, roomId, onBack, onSend }: {
  game: MiniGameMeta;
  token: string;
  partnerId: string;
  partnerName: string;
  roomId: string;
  onBack: () => void;
  onSend: (game: MiniGameMeta, card: GameCardData | null, customText?: string) => void;
}) {
  const [cards, setCards] = useState<GameCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [writeModal, setWriteModal] = useState(false);
  const [aiModal, setAiModal] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    setLoading(true);
    apiFetch<GameCardData[]>(`/mini-games/${game.game_type}/cards`, { token })
      .then(data => {
        const fetched = Array.isArray(data) ? data : [];
        setCards(fetched.length > 0 ? fetched : getFallbackGameCards(game.game_type));
      })
      .catch(() => setCards(getFallbackGameCards(game.game_type)))
      .finally(() => setLoading(false));
  }, [game.game_type, token]);

  const filtered = cards.filter(c => !activeCategory || c.category === activeCategory);

  const renderCard = (card: GameCardData) => {
    if (game.game_type === 'wyr') {
      return <WyrCard key={card.id} card={card} accent={game.accent_color} onSend={c => onSend(game, c)} />;
    }
    if (game.game_type === 'quiz' || game.game_type === 'build_date') {
      return <QuizCard key={card.id} card={card} accent={game.accent_color} label={game.name} onSend={c => onSend(game, c)} />;
    }
    if (game.game_type === 'truth_or_dare') {
      return <TodCard key={card.id} card={card} accent={game.accent_color} onSend={c => onSend(game, c)} />;
    }
    return <StatementCard key={card.id} card={card} accent={game.accent_color} label={game.name} onSend={c => onSend(game, c)} />;
  };

  const customPlaceholder: Record<string, string> = {
    wyr: 'Option A|||Option B (use ||| to separate)',
    nhi: 'Never have I ever…',
    hot_takes: 'My hot take is…',
    quiz: 'Your question here',
    build_date: 'Build your date step',
    emoji_story: 'Start your emoji story',
    truth_or_dare: 'Ask a truth or dare…',
    question_cards: 'Ask a deep question…',
  };

  return (
    <LinearGradient
      colors={[game.bg_color, '#080612']}
      locations={[0, 1]}
      style={s.detailRoot}
    >
      {/* Header */}
      <LinearGradient colors={[`${game.bg_color}f8`, 'transparent']} style={[s.detailHeader, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={onBack} hitSlop={12} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
          <Squircle style={s.backBtn} cornerRadius={12} cornerSmoothing={1} fillColor="rgba(255,255,255,0.1)">
            <Ionicons name="arrow-back" size={18} color="#fff" />
          </Squircle>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.detailTitle}>{game.name}</Text>
          <Text style={[s.detailSub, { color: game.accent_color }]}>{game.tagline}</Text>
        </View>
        {/* Write Your Own & AI buttons */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable onPress={() => setWriteModal(true)} hitSlop={8} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
            <Squircle style={s.headerIconBtn} cornerRadius={12} cornerSmoothing={1} fillColor="rgba(255,255,255,0.12)" strokeColor="rgba(255,255,255,0.2)" strokeWidth={1}>
              <Ionicons name="create-outline" size={18} color="#fff" />
            </Squircle>
          </Pressable>
          <Pressable onPress={() => setAiModal(true)} hitSlop={8} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
            <Squircle style={s.headerIconBtn} cornerRadius={12} cornerSmoothing={1} fillColor="rgba(255,255,255,0.12)" strokeColor="rgba(255,255,255,0.2)" strokeWidth={1}>
              <Ionicons name="sparkles" size={18} color="#fff" />
            </Squircle>
          </Pressable>
        </View>
      </LinearGradient>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 40, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Category pills */}
        {game.categories.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
            <CategoryPill label="All" isActive={activeCategory === ''} accent={game.accent_color} onPress={() => setActiveCategory('')} />
            {game.categories.map(cat => (
              <CategoryPill key={cat} label={cat} isActive={activeCategory === cat} accent={game.accent_color} onPress={() => setActiveCategory(cat)} />
            ))}
          </ScrollView>
        )}

        {/* Cards */}
        {loading ? (
          <View style={{ gap: 14 }}>
            {[0, 1, 2].map(i => <Shimmer key={i} width="100%" height={160} borderRadius={24} bgColor="rgba(12,50,109,0.5)" />)}
          </View>
        ) : (
          filtered.map(renderCard)
        )}
      </ScrollView>

      {/* Write Your Own Modal */}
      <Modal visible={writeModal} animationType="slide" transparent onRequestClose={() => setWriteModal(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setWriteModal(false)}>
          <Pressable style={s.modalSheet} onPress={e => e.stopPropagation()}>
            <LinearGradient colors={[game.bg_color, '#080612']} style={StyleSheet.absoluteFill} />
            <View style={[s.modalHandle, { backgroundColor: `${game.accent_color}60` }]} />
            <Text style={[s.modalTitle, { color: game.accent_color }]}>Write Your Own</Text>
            <CustomCard
              accent={game.accent_color}
              label="Write Your Own"
              placeholder={customPlaceholder[game.game_type] ?? 'Your custom prompt…'}
              onSend={text => { setWriteModal(false); onSend(game, null, text); }}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Create with AI Modal */}
      <Modal visible={aiModal} animationType="slide" transparent onRequestClose={() => setAiModal(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setAiModal(false)}>
          <Pressable style={s.modalSheet} onPress={e => e.stopPropagation()}>
            <LinearGradient colors={[game.bg_color, '#080612']} style={StyleSheet.absoluteFill} />
            <View style={[s.modalHandle, { backgroundColor: `${game.accent_color}60` }]} />
            <Text style={[s.modalTitle, { color: game.accent_color }]}>Create with AI</Text>
            <AiCard
              accent={game.accent_color}
              gameType={game.game_type}
              token={token}
              onSend={text => { setAiModal(false); onSend(game, null, text); }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </LinearGradient>
  );
}

// ─── Game Row Item (animated, extracted to satisfy Rules of Hooks) ────────────

function GameRowItem({ game, index, onPress }: { game: MiniGameMeta; index: number; onPress: () => void }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1, duration: 350, delay: index * 60,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, []);
  return (
    <Animated.View style={{ opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
        <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}>
        <Squircle style={s.gameRow} cornerRadius={22} cornerSmoothing={1}
          fillColor={game.bg_color} strokeColor={`${game.accent_color}35`} strokeWidth={1}>
          <View style={[s.gameRowGlow, { backgroundColor: `${game.accent_color}10` }]} />
          <View style={[s.gameRowIcon, { backgroundColor: `${game.accent_color}22` }]}>
            <Text style={{ fontSize: 28 }}>{game.emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.gameRowName}>{game.name}</Text>
            <Text style={[s.gameRowDesc, { color: `${game.accent_color}cc` }]}>{game.description}</Text>
          </View>
          <View style={[s.gameRowChevron, { backgroundColor: `${game.accent_color}18` }]}>
            <Ionicons name="chevron-forward" size={16} color={game.accent_color} />
          </View>
        </Squircle>
      </Pressable>
    </Animated.View>
  );
}

// ─── Hub Screen ───────────────────────────────────────────────────────────────

export default function MiniGamesPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { token } = useAuth();
  const params = useLocalSearchParams<{ partnerId?: string; partnerName?: string; roomId?: string; partnerImage?: string }>();
  const partnerId   = params.partnerId   ?? '';
  const partnerName = params.partnerName ?? 'them';
  const roomId      = params.roomId      ?? '';
  const partnerImage = params.partnerImage;

  const [games, setGames]   = useState<MiniGameMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MiniGameMeta | null>(null);

  // Header entrance animation
  const headerAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 500, useNativeDriver: true, easing: Easing.out(Easing.cubic) }).start();
  }, []);

  useEffect(() => {
    if (!token) return;
    apiFetch<MiniGameMeta[]>('/mini-games', { token })
      .then(data => setGames(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const handleSend = (game: MiniGameMeta, card: GameCardData | null, customText?: string) => {
    // Build the extra payload matching the existing WS message format
    let msgType = `game_${game.game_type}`;
    // Map canonical types
    if (game.game_type === 'wyr')         msgType = 'game_wyr';
    if (game.game_type === 'nhi')         msgType = 'game_nhi';
    if (game.game_type === 'hot_takes')   msgType = 'game_hot';
    if (game.game_type === 'quiz')        msgType = 'game_quiz';
    if (game.game_type === 'build_date')  msgType = 'game_date';
    if (game.game_type === 'emoji_story') msgType = 'game_emoji';
    if (game.game_type === 'truth_or_dare') msgType = 'tod_invite';
    if (game.game_type === 'question_cards') msgType = 'card';

    let extra: Record<string, any> = { phase: 'invite', cardId: card?.id };

    if (game.game_type === 'wyr') {
      const optA = card ? card.option_a : (customText?.split('|||')[0] ?? customText);
      const optB = card ? card.option_b : (customText?.split('|||')[1] ?? '');
      extra = { ...extra, optA, optB };
    } else if (game.game_type === 'nhi' || game.game_type === 'hot_takes') {
      extra = { ...extra, statement: card ? card.question : customText, opinion: card ? card.question : customText };
    } else if (game.game_type === 'quiz') {
      extra = { ...extra, aAnswers: [] };
    } else if (game.game_type === 'build_date') {
      // aPicks must come from DateInviteForm (GamesPanel) — MiniGamesPage doesn't collect them
      // so start the game without sender picks; receiver picks alone and result shows their choices
      extra = { ...extra, aPicks: null, bPicks: [] };
    } else if (game.game_type === 'emoji_story') {
      extra = { ...extra, rounds: [] };
    }

    const label = card ? card.question : (customText ?? '');
    const content = card
      ? `${game.emoji} ${game.name}: ${label.slice(0, 60)}`
      : `${game.emoji} ${game.name}`;

    // Navigate back to chat with the game payload as params
    router.back();
    // Use a small delay so the chat screen is mounted before we fire
    setTimeout(() => {
      router.setParams({
        pendingGame: JSON.stringify({ msgType, content, extra }),
      });
    }, 50);
  };

  if (selected) {
    return (
      <GameDetailScreen
        game={selected}
        token={token ?? ''}
        partnerId={partnerId}
        partnerName={partnerName}
        roomId={roomId}
        onBack={() => setSelected(null)}
        onSend={handleSend}
      />
    );
  }

  return (
    <LinearGradient colors={[BRAND.bgTop, '#0e0a28', BRAND.bgBottom]} locations={[0, 0.5, 1]} style={s.root}>
      {/* ── Header ── */}
      <Animated.View style={[s.header, { paddingTop: insets.top + 16, opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
          <Squircle style={s.backBtn} cornerRadius={12} cornerSmoothing={1} fillColor="rgba(12,50,109,0.5)">
            <Ionicons name="arrow-back" size={18} color={BRAND.white} />
          </Squircle>
        </Pressable>

        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[s.hubTitle, { color: BRAND.white }]}>Games</Text>
          <Text style={[s.hubSub, { color: BRAND.white }]}>Play with {partnerName}</Text>
        </View>
      </Animated.View>

      {/* ── Game list ── */}
      {loading ? (
        <LoadingSkeleton />
      ) : (
        <FlatList
          data={games}
          keyExtractor={g => g.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 32, paddingTop: 8, gap: 10 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: game, index }) => (
            <GameRowItem game={game} index={index} onPress={() => setSelected(game)} />
          )}
        />
      )}
    </LinearGradient>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header:       { paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', alignItems: 'center' },
  hubTitle:     { fontSize: 22, fontFamily: 'ProductSans-Black' },
  hubSub:       { fontSize: 12, fontFamily: 'ProductSans-Regular', marginTop: 1 },
  partnerThumb: { width: 16, height: 16, borderRadius: 8 },
  backBtn:      { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  // Game row
  gameRow:        { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, overflow: 'hidden' },
  gameRowGlow:    { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },
  gameRowIcon:    { width: 58, height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  gameRowName:    { fontSize: 16, fontFamily: 'ProductSans-Black', color: '#fff', marginBottom: 3 },
  gameRowDesc:    { fontSize: 12, fontFamily: 'ProductSans-Regular', lineHeight: 17 },
  gameRowChevron: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  // Detail screen
  detailRoot:   { flex: 1 },
  detailHeader: { paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  detailTitle:  { fontSize: 20, fontFamily: 'ProductSans-Black', color: '#fff' },
  detailSub:    { fontSize: 13, fontFamily: 'ProductSans-Bold', marginTop: 2 },

  // Category pills
  catPill:     { paddingHorizontal: 14, paddingVertical: 8 },
  catPillText: { fontSize: 13, fontFamily: 'ProductSans-Bold' },

  // Description box
  descBox:  { padding: 14 },
  descText: { fontSize: 14, fontFamily: 'ProductSans-Regular', color: 'rgba(255,255,255,0.65)', lineHeight: 21 },

  gameCard:        { padding: 18, gap: 14 },
  gameCardBadge:   { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6 },
  gameCardBadgeText: { fontSize: 11, fontFamily: 'ProductSans-Black', letterSpacing: 0.4 },

  // WYR
  wyrRow:  { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  wyrBox:  { flex: 1, padding: 14, gap: 6 },
  wyrLabel: { fontSize: 10, fontFamily: 'ProductSans-Black', color: 'rgba(255,255,255,0.45)', letterSpacing: 0.5 },
  wyrText:  { fontSize: 14, fontFamily: 'ProductSans-Black', color: '#fff', lineHeight: 20 },
  wyrOr:    { color: 'rgba(255,255,255,0.3)', fontSize: 14, fontFamily: 'ProductSans-Black', alignSelf: 'center' },

  // Statement (NHI / Hot Takes)
  statementText: { fontSize: 18, fontFamily: 'ProductSans-Black', color: '#fff', lineHeight: 26 },

  // Quiz options
  quizOpt:     { paddingHorizontal: 14, paddingVertical: 10 },
  quizOptText: { fontSize: 14, fontFamily: 'ProductSans-Bold' },

  // Custom input
  customInput:     { minHeight: 80, padding: 14 },
  customInputText: { color: '#fff', fontSize: 15, fontFamily: 'ProductSans-Regular', lineHeight: 22 },

  // Send button
  sendCardBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  sendCardBtnText: { fontSize: 15, fontFamily: 'ProductSans-Black', color: '#fff' },

  // Header icon buttons (Write / AI)
  headerIconBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },

  // Modal
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalSheet:    { borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', padding: 20, paddingBottom: 40, gap: 16 },
  modalHandle:   { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 4 },
  modalTitle:    { fontSize: 18, fontFamily: 'ProductSans-Black', letterSpacing: 0.2 },
});
