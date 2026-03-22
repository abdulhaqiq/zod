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
  KeyboardAvoidingView,
  Modal,
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
import { apiFetch } from '@/constants/api';
import { setPendingGame } from '@/constants/gameQueue';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';

const { width: W, height: H } = Dimensions.get('window');

// ─── Brand palette ────────────────────────────────────────────────────────────
const BRAND = {
  cardFill:    'rgba(255, 255, 255, 0.05)',  // Glass fill
  cardBorder:  'rgba(255, 255, 255, 0.10)',  // Glass border
  gold:        '#D0A53E',                    // Satin Sheen Gold — highlights
  orange:      '#E05327',                    // Flame Orange — accents only
  bgTop:       '#0C0C1A',                    // True deep dark
  bgBottom:    '#040408',                    // Near black
  optionFill:  'rgba(255, 255, 255, 0.07)', // Option boxes
  optionBorder:'rgba(255, 255, 255, 0.12)', // Option box border
  white:       '#E8E7FF',                    // Soft white with slight blue tint
  btnFill:     '#EDEDFF',                    // Button background
  btnText:     '#0C0C1A',                    // Button text — deep dark
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

  // ── question_cards — Icebreaker ──────────────────────────────────────────────
  _gc('question_cards','Icebreaker','🌊',"What's a hobby you picked up during the past year?",0,'#002830'),
  _gc('question_cards','Icebreaker','🎯',"What's something most people don't know about you when they first meet you?",1,'#002830'),
  _gc('question_cards','Icebreaker','🌍',"If you could live anywhere in the world for a year, where would you go?",2,'#002830'),
  _gc('question_cards','Icebreaker','☕',"Are you a morning person or night owl — and does it actually fit you?",3,'#002830'),
  _gc('question_cards','Icebreaker','🎒',"What's the best trip you've ever taken?",4,'#002830'),
  _gc('question_cards','Icebreaker','📚',"What's the last book, show, or podcast that genuinely changed how you think?",5,'#002830'),
  _gc('question_cards','Icebreaker','🎸',"What kind of music do you listen to that would surprise people?",6,'#002830'),
  _gc('question_cards','Icebreaker','🌮',"What's your comfort food and what memory does it bring back?",7,'#002830'),
  _gc('question_cards','Icebreaker','⚽',"Were you sporty growing up, and does that still show?",8,'#002830'),
  _gc('question_cards','Icebreaker','💻',"What app do you use more than you'd want to admit?",9,'#002830'),

  // ── question_cards — Vulnerable ──────────────────────────────────────────────
  _gc('question_cards','Vulnerable','🌧️',"What's something you're still working through from your past?",0,'#1a0030'),
  _gc('question_cards','Vulnerable','🤐',"What's something you find hard to say out loud?",1,'#1a0030'),
  _gc('question_cards','Vulnerable','🪟',"When do you feel most like yourself — and when do you feel least like yourself?",2,'#1a0030'),
  _gc('question_cards','Vulnerable','🧩',"What's a part of yourself you're still trying to understand?",3,'#1a0030'),
  _gc('question_cards','Vulnerable','💭',"What kind of support do you actually need when things get hard?",4,'#1a0030'),
  _gc('question_cards','Vulnerable','🌱',"What's the most important way you've grown in the last two years?",5,'#1a0030'),
  _gc('question_cards','Vulnerable','🕳️',"What's something you've lost that you haven't fully let go of?",6,'#1a0030'),
  _gc('question_cards','Vulnerable','🫂',"What does real intimacy mean to you — not physical, but emotional?",7,'#1a0030'),
  _gc('question_cards','Vulnerable','🌙',"What do you think about right before you fall asleep?",8,'#1a0030'),
  _gc('question_cards','Vulnerable','💬',"What's something you wish people would just ask you about instead of assuming?",9,'#1a0030'),

  // ── question_cards — Bold ─────────────────────────────────────────────────────
  _gc('question_cards','Bold','🎲',"What's a risk you took that actually paid off?",0,'#2a0e00'),
  _gc('question_cards','Bold','🏴',"What's an opinion you hold that most people around you disagree with?",1,'#2a0e00'),
  _gc('question_cards','Bold','🧨',"What's the most unfiltered thing you'd say to someone who hurt you?",2,'#2a0e00'),
  _gc('question_cards','Bold','⚔️',"When did you last stand up for something even though it cost you?",3,'#2a0e00'),
  _gc('question_cards','Bold','🔓',"What's something you stopped hiding and started owning?",4,'#2a0e00'),
  _gc('question_cards','Bold','🚫',"What's a boundary you've set that people keep testing?",5,'#2a0e00'),
  _gc('question_cards','Bold','💥',"What's the most controversial thing you actually believe about dating?",6,'#2a0e00'),
  _gc('question_cards','Bold','🗣️',"What's something you've said that you have zero regrets about?",7,'#2a0e00'),
  _gc('question_cards','Bold','🧠',"What's something society tells you to feel but you just… don't?",8,'#2a0e00'),
  _gc('question_cards','Bold','🌊',"What would you do differently if you cared less about what people thought?",9,'#2a0e00'),

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

const SHIMMER_BG = 'rgba(255,255,255,0.06)';

function LoadingSkeleton() {
  return (
    <View style={{ gap: 24, paddingTop: 16 }}>
      {/* Featured card skeleton — matches FeaturedGameCard marginHorizontal: 14 */}
      <View style={{ marginHorizontal: 14 }}>
        <Shimmer width="100%" height={204} borderRadius={26} bgColor={SHIMMER_BG} />
      </View>

      {/* List section skeleton — matches s.listSection paddingHorizontal: 14 */}
      <View style={{ paddingHorizontal: 14, gap: 10 }}>
        {/* "All Games" label */}
        <Shimmer width={88} height={14} borderRadius={7} bgColor={SHIMMER_BG} />
        {/* Vertical game list rows */}
        {[0, 1, 2, 3].map(i => (
          <View key={i} style={{
            flexDirection: 'row', alignItems: 'center', gap: 14,
            paddingVertical: 12, paddingHorizontal: 14,
            borderRadius: 20, backgroundColor: SHIMMER_BG,
          }}>
            {/* Icon squircle */}
            <Shimmer width={50} height={50} borderRadius={16} bgColor="rgba(255,255,255,0.05)" />
            {/* Text lines */}
            <View style={{ flex: 1, gap: 8 }}>
              <Shimmer width="55%" height={13} borderRadius={6} bgColor="rgba(255,255,255,0.05)" />
              <Shimmer width="75%" height={10} borderRadius={5} bgColor="rgba(255,255,255,0.05)" />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Category pill ────────────────────────────────────────────────────────────

function CategoryPill({ label, isActive, accent, onPress }: {
  label: string; isActive: boolean; accent: string; onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}>
      <Squircle style={s.catPill}
        cornerRadius={50} cornerSmoothing={1}
        fillColor={isActive ? 'rgba(255,255,255,0.12)' : 'transparent'}
        strokeColor={isActive ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.18)'}
        strokeWidth={isActive ? 1.5 : 1}>
        <Text style={[s.catPillText, { color: isActive ? '#ffffff' : 'rgba(255,255,255,0.45)' }]}>{label}</Text>
      </Squircle>
    </Pressable>
  );
}

// ─── Big single-card preview (one card at a time) ────────────────────────────

// ─── Per-category row colors ──────────────────────────────────────────────────

function getCategoryColors(category: string, gameType: string, fallbackAccent: string): {
  bg: string; border: string; label: string;
} {
  const cat = category?.toLowerCase() ?? '';
  const map: Record<string, { bg: string; border: string; label: string }> = {
    deep:        { bg: 'rgba(10,16,68,0.95)',  border: 'rgba(70,110,255,0.22)',  label: '#7B9FFF' },
    fun:         { bg: 'rgba(44,24,0,0.95)',   border: 'rgba(255,162,40,0.22)',  label: '#FFAA28' },
    romantic:    { bg: 'rgba(58,0,22,0.95)',   border: 'rgba(255,70,130,0.22)',  label: '#FF6AAE' },
    spicy:       { bg: 'rgba(58,8,0,0.95)',    border: 'rgba(255,90,40,0.22)',   label: '#FF7050' },
    icebreaker:  { bg: 'rgba(0,34,44,0.95)',   border: 'rgba(40,210,210,0.22)',  label: '#40D8D8' },
    vulnerable:  { bg: 'rgba(28,2,54,0.95)',   border: 'rgba(190,90,255,0.22)',  label: '#C870FF' },
    bold:        { bg: 'rgba(50,18,0,0.95)',   border: 'rgba(255,125,30,0.22)',  label: '#FF8A30' },
    truth:       { bg: 'rgba(34,26,0,0.95)',   border: 'rgba(208,165,62,0.25)',  label: '#D0A53E' },
    dare:        { bg: 'rgba(54,10,0,0.95)',   border: 'rgba(224,83,39,0.25)',   label: '#E05327' },
    classic:     { bg: 'rgba(18,6,56,0.95)',   border: 'rgba(150,110,255,0.22)', label: '#9878FF' },
    dating:      { bg: 'rgba(54,0,22,0.95)',   border: 'rgba(255,70,110,0.22)',  label: '#FF5080' },
    life:        { bg: 'rgba(4,22,42,0.95)',   border: 'rgba(50,150,230,0.22)',  label: '#4AA8F0' },
    pop:         { bg: 'rgba(30,2,52,0.95)',   border: 'rgba(210,70,255,0.22)',  label: '#D050FF' },
  };
  return map[cat] ?? { bg: 'rgba(18,18,30,0.95)', border: 'rgba(255,255,255,0.1)', label: fallbackAccent };
}

/** Rich per-game card background — brightened so card stands out on near-black page. */
function resolveCardBg(card: GameCardData, game: MiniGameMeta): string {
  switch (game.game_type) {
    case 'truth_or_dare':
      return card.category?.toLowerCase() === 'dare' ? '#4A1800' : '#3E2800';
    case 'wyr':          return '#1E1060';
    case 'nhi':          return '#04271A';
    case 'hot_takes':    return '#3D0E00';
    case 'quiz':         return '#042040';
    case 'build_date':   return '#1A0E48';
    case 'emoji_story':  return '#1A3000';
    case 'question_cards': {
      const cat = card.category?.toLowerCase() ?? '';
      if (cat === 'deep')     return '#101E50';
      if (cat === 'romantic') return '#480020';
      if (cat === 'spicy')    return '#480E00';
      return '#382000';
    }
    default:
      return game.bg_color || '#1a0d3a';
  }
}

function BigCardPreview({ card, game }: { card: GameCardData; game: MiniGameMeta }) {
  const accent = game.accent_color;
  const cardBg = resolveCardBg(card, game);

  // WYR: two option boxes side by side
  if (game.game_type === 'wyr') {
    return (
      <Squircle
        style={{ width: '100%', minHeight: H * 0.36, padding: 22, gap: 18, justifyContent: 'center' }}
        cornerRadius={28} cornerSmoothing={1}
        fillColor={cardBg} strokeColor={`${accent}50`} strokeWidth={1.5}
      >
        <Squircle style={bp.badge} cornerRadius={50} cornerSmoothing={1} fillColor={`${accent}22`}>
          <Text style={[bp.badgeText, { color: accent }]}>Would You Rather</Text>
        </Squircle>
        <Text style={bp.emoji}>{card.emoji}</Text>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'stretch' }}>
          <Squircle style={{ flex: 1, padding: 16, gap: 6 }} cornerRadius={20} cornerSmoothing={1}
            fillColor="rgba(255,255,255,0.09)" strokeColor={`${accent}30`} strokeWidth={1}>
            <Text style={[bp.optLabel, { color: accent }]}>A</Text>
            <Text style={[bp.optText, { color: '#fff' }]}>{card.option_a}</Text>
          </Squircle>
          <Text style={bp.wyrOr}>or</Text>
          <Squircle style={{ flex: 1, padding: 16, gap: 6 }} cornerRadius={20} cornerSmoothing={1}
            fillColor="rgba(255,255,255,0.09)" strokeColor={`${accent}30`} strokeWidth={1}>
            <Text style={[bp.optLabel, { color: accent }]}>B</Text>
            <Text style={[bp.optText, { color: '#fff' }]}>{card.option_b}</Text>
          </Squircle>
        </View>
      </Squircle>
    );
  }

  // Truth or Dare
  if (game.game_type === 'truth_or_dare') {
    const isDare     = card.category?.toLowerCase() === 'dare';
    const badgeColor = isDare ? BRAND.orange : BRAND.gold;
    const badgeLabel = `${isDare ? '🎲' : '🤔'} ${isDare ? 'Dare' : 'Truth'}`;
    const badgeFill  = isDare ? 'rgba(224,83,39,0.22)' : 'rgba(208,165,62,0.22)';
    return (
      <Squircle
        style={{ width: '100%', minHeight: H * 0.36, padding: 28, gap: 22, alignItems: 'center', justifyContent: 'center' }}
        cornerRadius={28} cornerSmoothing={1}
        fillColor={cardBg} strokeColor={`${badgeColor}50`} strokeWidth={1.5}
      >
        <Squircle style={[bp.badge, { alignSelf: 'flex-start' }]} cornerRadius={50} cornerSmoothing={1} fillColor={badgeFill}>
          <Text style={[bp.badgeText, { color: badgeColor }]}>{badgeLabel}</Text>
        </Squircle>
        <Text style={bp.emoji}>{card.emoji || (isDare ? '🎯' : '🌙')}</Text>
        <Text style={[bp.question, { color: '#fff' }]}>{card.question}</Text>
      </Squircle>
    );
  }

  // Quiz / Build Date: show question + options
  if (game.game_type === 'quiz' || game.game_type === 'build_date') {
    return (
      <Squircle
        style={{ width: '100%', minHeight: H * 0.36, padding: 22, gap: 16, justifyContent: 'center' }}
        cornerRadius={28} cornerSmoothing={1}
        fillColor={cardBg} strokeColor={`${accent}50`} strokeWidth={1.5}
      >
        <Squircle style={bp.badge} cornerRadius={50} cornerSmoothing={1} fillColor={`${accent}22`}>
          <Text style={[bp.badgeText, { color: accent }]}>{game.name}</Text>
        </Squircle>
        <Text style={bp.emoji}>{card.emoji}</Text>
        <Text style={[bp.question, { color: '#fff' }]}>{card.question}</Text>
        {(card.options ?? []).length > 0 && (
          <View style={{ gap: 8, width: '100%' }}>
            {(card.options ?? []).map((opt, i) => (
              <Squircle key={i} style={{ paddingHorizontal: 16, paddingVertical: 12 }}
                cornerRadius={14} cornerSmoothing={1}
                fillColor="rgba(255,255,255,0.09)" strokeColor={`${accent}25`} strokeWidth={1}>
                <Text style={[bp.optText, { color: '#fff' }]}>{opt}</Text>
              </Squircle>
            ))}
          </View>
        )}
      </Squircle>
    );
  }

  // Default: question cards, NHI, hot takes, emoji story
  return (
    <Squircle
      style={{ width: '100%', minHeight: H * 0.36, padding: 28, gap: 22, alignItems: 'center', justifyContent: 'center' }}
      cornerRadius={28} cornerSmoothing={1}
      fillColor={cardBg} strokeColor={`${accent}50`} strokeWidth={1.5}
    >
      <Squircle style={[bp.badge, { alignSelf: 'flex-start' }]} cornerRadius={50} cornerSmoothing={1} fillColor={`${accent}22`}>
        <Text style={[bp.badgeText, { color: accent }]}>{game.name}</Text>
      </Squircle>
      <Text style={bp.emoji}>{card.emoji}</Text>
      <Text style={[bp.question, { color: '#fff' }]}>{card.question}</Text>
    </Squircle>
  );
}

const bp = StyleSheet.create({
  badge:    { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 13, paddingVertical: 7 },
  badgeText:{ fontSize: 12, fontFamily: 'ProductSans-Black', letterSpacing: 0.3 },
  emoji:    { fontSize: 66, textAlign: 'center', lineHeight: 80, width: '100%' },
  question: { fontSize: 20, fontFamily: 'ProductSans-Black', lineHeight: 30, textAlign: 'center', width: '100%' },
  optText:  { fontSize: 15, fontFamily: 'ProductSans-Black', lineHeight: 22 },
  optLabel: { fontSize: 10, fontFamily: 'ProductSans-Black', letterSpacing: 0.5 },
  wyrOr:    { color: 'rgba(255,255,255,0.35)', fontSize: 16, fontFamily: 'ProductSans-Black', alignSelf: 'center' },
});

// ─── Custom write card ────────────────────────────────────────────────────────

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



// ─── Truth / Dare badge pills ─────────────────────────────────────────────────

function TruthDareTabs({ active, onChange }: { active: string; onChange: (v: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 14, paddingBottom: 12 }}>
      {(['Truth', 'Dare'] as const).map(tab => {
        const isActive = active.toLowerCase() === tab.toLowerCase();
        const accent   = tab === 'Dare' ? '#E05327' : '#D0A53E';
        return (
          <Pressable key={tab} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onChange(tab); }}
            style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}>
            <Squircle style={{ paddingHorizontal: 16, paddingVertical: 8 }}
              cornerRadius={50} cornerSmoothing={1}
              fillColor={isActive ? accent : 'transparent'}
              strokeColor={isActive ? accent : 'rgba(255,255,255,0.18)'}
              strokeWidth={1.5}>
              <Text style={{ fontSize: 13, fontFamily: 'ProductSans-Black',
                color: isActive ? '#ffffff' : 'rgba(255,255,255,0.45)' }}>
                {tab === 'Truth' ? '🤔  Truth' : '🎲  Dare'}
              </Text>
            </Squircle>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ─── Card list row — no icon, category-tinted dark bg ────────────────────────

function CardListRow({ card, game, onSelect }: {
  card: GameCardData; game: MiniGameMeta; onSelect: () => void;
}) {
  const { bg, border, label } = getCategoryColors(card.category, game.game_type, game.accent_color);
  const preview = game.game_type === 'wyr' && card.option_a && card.option_b
    ? `${card.option_a}  ·  ${card.option_b}`
    : card.question;

  return (
    <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onSelect(); }}
      style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1, transform: [{ scale: pressed ? 0.988 : 1 }] }]}>
      <Squircle style={s.cardRow} cornerRadius={18} cornerSmoothing={1}
        fillColor={bg} strokeColor={border} strokeWidth={1}>
        <View style={{ flex: 1, gap: 5 }}>
          {card.category ? (
            <Text style={[s.cardRowCat, { color: label }]}>{card.category.toUpperCase()}</Text>
          ) : null}
          <Text style={s.cardRowText} numberOfLines={3}>{preview}</Text>
        </View>
        <Ionicons name="chevron-forward" size={13} color="rgba(255,255,255,0.22)" style={{ marginTop: 2 }} />
      </Squircle>
    </Pressable>
  );
}

// ─── Game Detail Screen ───────────────────────────────────────────────────────

function GameDetailScreen({ game, token, partnerId, partnerName, roomId, onBack, onSend }: {
  game: MiniGameMeta;
  token: string;
  partnerId: string;
  partnerName: string;
  roomId: string;
  onBack: () => void;
  onSend: (game: MiniGameMeta, card: GameCardData | null, customText?: string) => void;
}) {
  const isTod = game.game_type === 'truth_or_dare';
  const [cards, setCards]                   = useState<GameCardData[]>([]);
  const [loading, setLoading]               = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>(isTod ? 'Truth' : '');
  const [selectedCard, setSelectedCard]     = useState<GameCardData | null>(null);
  const [writeModal, setWriteModal]         = useState(false);
  const [aiModal, setAiModal]               = useState(false);
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

  const sendLabel = (() => {
    if (!selectedCard) return `Send to ${partnerName}`;
    if (game.game_type === 'truth_or_dare') {
      const isDare = selectedCard.category?.toLowerCase() === 'dare';
      return `Send ${isDare ? 'Dare' : 'Truth'} to ${partnerName}`;
    }
    if (game.game_type === 'quiz')           return `Send Quiz to ${partnerName}`;
    if (game.game_type === 'question_cards') return `Ask ${partnerName} This`;
    if (game.game_type === 'hot_takes')      return `Send Hot Take to ${partnerName}`;
    if (game.game_type === 'nhi')            return `Send Never Have I Ever to ${partnerName}`;
    if (game.game_type === 'wyr')            return `Send Would You Rather to ${partnerName}`;
    return `Send to ${partnerName}`;
  })();

  const customPlaceholder: Record<string, string> = {
    wyr:            'Option A|||Option B (use ||| to separate)',
    nhi:            'Never have I ever…',
    hot_takes:      'My hot take is…',
    quiz:           'Your question here',
    build_date:     'Build your date step',
    emoji_story:    'Start your emoji story',
    truth_or_dare:  'Ask a truth or dare…',
    question_cards: 'Ask a deep question…',
  };

  return (
    <View style={[s.detailRoot, { backgroundColor: '#000000' }]}>

      {/* ── ScreenHeader-style header ── */}
      <LinearGradient
        colors={['#1a1a1a', '#111111', '#000000']}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
        style={[s.detailHeader, { paddingTop: insets.top + 10 }]}
      >
        <View style={s.detailHeaderRow}>
          {/* Back */}
          <Pressable onPress={onBack} hitSlop={12}
            style={({ pressed }) => [s.headerBtn, pressed && { opacity: 0.6 }]}>
            <Ionicons name="close" size={22} color="#fff" />
          </Pressable>
          {/* Centre — title only, no emoji */}
          <Text style={s.previewTitle}>{game.name}</Text>
          {/* Right actions */}
          <View style={{ flexDirection: 'row', gap: 2 }}>
            <Pressable onPress={() => setWriteModal(true)} hitSlop={10}
              style={({ pressed }) => [s.headerBtn, pressed && { opacity: 0.6 }]}>
              <Ionicons name="create-outline" size={21} color="#fff" />
            </Pressable>
            <Pressable onPress={() => setAiModal(true)} hitSlop={10}
              style={({ pressed }) => [s.headerBtn, pressed && { opacity: 0.6 }]}>
              <Ionicons name="sparkles" size={20} color="#fff" />
            </Pressable>
          </View>
        </View>

        {/* Truth / Dare badge pills — only for truth_or_dare */}
        {isTod && (
          <TruthDareTabs active={activeCategory} onChange={setActiveCategory} />
        )}

        {/* Category pills — other games */}
        {!isTod && game.categories.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 14, paddingBottom: 12 }}>
            <CategoryPill label="All" isActive={activeCategory === ''} accent={game.accent_color} onPress={() => setActiveCategory('')} />
            {game.categories.map(cat => (
              <CategoryPill key={cat} label={cat} isActive={activeCategory === cat}
                accent={game.accent_color} onPress={() => setActiveCategory(cat)} />
            ))}
          </ScrollView>
        )}
      </LinearGradient>

      {/* ── Card list ── */}
      {loading ? (
        <LoadingSkeleton />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={c => c.id}
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: insets.bottom + 24, gap: 8 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <CardListRow card={item} game={game} onSelect={() => setSelectedCard(item)} />
          )}
          ListEmptyComponent={
            <View style={{ paddingTop: 60, alignItems: 'center' }}>
              <Text style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'ProductSans-Regular', fontSize: 14 }}>
                No cards in this category
              </Text>
            </View>
          }
        />
      )}

      {/* ── Card preview + send bottom sheet ── */}
      <Modal visible={!!selectedCard} animationType="slide" transparent onRequestClose={() => setSelectedCard(null)}>
        <Pressable style={s.modalBackdrop} onPress={() => setSelectedCard(null)}>
          <Pressable style={[s.modalSheet, { paddingBottom: insets.bottom + 24 }]} onPress={e => e.stopPropagation()}>
            <LinearGradient colors={['#10101E', '#06060E']} style={StyleSheet.absoluteFill} />
            <View style={[s.modalHandle, { backgroundColor: `${game.accent_color}60` }]} />
            {selectedCard && (
              <>
                <BigCardPreview card={selectedCard} game={game} />
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    const card = selectedCard;
                    setSelectedCard(null);
                    onSend(game, card);
                  }}
                  style={({ pressed }) => [{ marginTop: 14, opacity: pressed ? 0.85 : 1 }]}
                >
                  <Squircle style={s.bigSendBtn} cornerRadius={50} cornerSmoothing={1}
                    fillColor={game.accent_color} strokeWidth={0}>
                    <Ionicons name="send" size={16} color="#fff" />
                    <Text style={s.bigSendBtnText}>{sendLabel}</Text>
                  </Squircle>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Write Your Own Modal ── */}
      <Modal visible={writeModal} animationType="slide" transparent onRequestClose={() => setWriteModal(false)}>
        <KeyboardAvoidingView
          style={s.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setWriteModal(false)} />
          <Pressable style={[s.modalSheet, { paddingBottom: insets.bottom + 24 }]} onPress={e => e.stopPropagation()}>
            <LinearGradient colors={['#0E0E1C', '#06060E']} style={StyleSheet.absoluteFill} />
            <View style={[s.modalHandle, { backgroundColor: `${game.accent_color}60` }]} />
            <Text style={[s.modalTitle, { color: game.accent_color }]}>Write Your Own</Text>
            <CustomCard
              accent={game.accent_color}
              label="Write Your Own"
              placeholder={customPlaceholder[game.game_type] ?? 'Your custom prompt…'}
              onSend={text => { setWriteModal(false); onSend(game, null, text); }}
            />
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Create with AI Modal ── */}
      <Modal visible={aiModal} animationType="slide" transparent onRequestClose={() => setAiModal(false)}>
        <KeyboardAvoidingView
          style={s.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setAiModal(false)} />
          <Pressable style={[s.modalSheet, { paddingBottom: insets.bottom + 24 }]} onPress={e => e.stopPropagation()}>
            <LinearGradient colors={['#0E0E1C', '#06060E']} style={StyleSheet.absoluteFill} />
            <View style={[s.modalHandle, { backgroundColor: `${game.accent_color}60` }]} />
            <Text style={[s.modalTitle, { color: game.accent_color }]}>Create with AI</Text>
            <AiCard
              accent={game.accent_color}
              gameType={game.game_type}
              token={token}
              onSend={text => { setAiModal(false); onSend(game, null, text); }}
            />
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Featured cinematic card (Truth or Dare) ─────────────────────────────────

function FeaturedGameCard({ game, onPress }: { game: MiniGameMeta; onPress: () => void }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, []);

  // Derive a rich cinematic bg from accent color
  const c = game.accent_color;
  return (
    <Animated.View style={{ opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
      <Pressable
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onPress(); }}
        style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.975 : 1 }] }]}
      >
        <View style={s.featCard}>
          {/* Base dark cinematic gradient (simulates a dark photo bg) */}
          <LinearGradient
            colors={[`${c}28`, `${c}14`, '#040406']}
            start={{ x: 0.3, y: 0 }} end={{ x: 0.9, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {/* Large decorative emoji watermarks — simulates background "artwork" */}
          <Text style={[s.featArt, { fontSize: 130, right: -10, top: -16, opacity: 0.13 }]}>{game.emoji}</Text>
          <Text style={[s.featArt, { fontSize: 64, left: 18, bottom: 54, opacity: 0.07 }]}>{game.emoji}</Text>
          {/* Bottom gradient overlay — key to "image with overlay" feel */}
          <LinearGradient
            colors={['transparent', 'rgba(4,4,6,0.82)']}
            style={[StyleSheet.absoluteFill, { top: '25%' }]}
          />
          {/* Top content */}
          <View style={s.featTop}>
            <View style={s.featBadge}>
              <Text style={s.featBadgeText}>✦  FEATURED</Text>
            </View>
          </View>
          {/* Bottom content */}
          <View style={s.featBody}>
            <Text style={s.featTitle}>{game.name}</Text>
            <Text style={s.featDesc} numberOfLines={2}>{game.description}</Text>
          </View>
          {/* Bottom bar */}
          <View style={s.featBar}>
            <Squircle style={s.featBarIcon} cornerRadius={14} cornerSmoothing={1}
              fillColor={c} strokeWidth={0}>
              <Text style={{ fontSize: 20 }}>{game.emoji}</Text>
            </Squircle>
            <View style={{ flex: 1 }}>
              <Text style={s.featBarName}>{game.name}</Text>
              <Text style={s.featBarSub} numberOfLines={1}>{game.tagline || game.description}</Text>
            </View>
            <View style={s.featPlayBtn}>
              <Text style={s.featPlayText}>Play</Text>
              <Ionicons name="arrow-forward" size={12} color="#fff" />
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Minimal vertical list row — each item is its own squircle card ───────────

function GameListItem({ game, index, isLast, onPress }: {
  game: MiniGameMeta; index: number; isLast: boolean; onPress: () => void;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1, duration: 360, delay: index * 45,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, []);
  return (
    <Animated.View style={{ opacity: anim, transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) }] }}>
      <Pressable
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
        style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] }]}
      >
        <Squircle style={s.listRow} cornerRadius={20} cornerSmoothing={1}
          fillColor="rgba(255,255,255,0.055)" strokeColor="rgba(255,255,255,0.11)" strokeWidth={1}>
          {/* Squircle app icon — solid accent, no border */}
          <Squircle style={s.listIcon} cornerRadius={16} cornerSmoothing={1}
            fillColor={game.accent_color} strokeWidth={0}>
            <Text style={{ fontSize: 26 }}>{game.emoji}</Text>
          </Squircle>
          {/* Text */}
          <View style={{ flex: 1 }}>
            <Text style={s.listName}>{game.name}</Text>
            <Text style={s.listDesc} numberOfLines={1}>{game.tagline || game.description}</Text>
          </View>
          <Ionicons name="chevron-forward" size={15} color="rgba(255,255,255,0.22)" />
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

    let extra: Record<string, any> = {
      phase: 'invite',
      cardId: card?.id,
    };

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
    // Truth or Dare always sends a generic invite — partner picks T/D in chat
    const content = game.game_type === 'truth_or_dare'
      ? '🎲 Truth or Dare — want to play?'
      : card
        ? `${game.emoji} ${game.name}: ${label.slice(0, 60)}`
        : `${game.emoji} ${game.name}`;

    // Store payload in a module-level slot, then navigate back.
    // router.setParams() after router.back() is unreliable (race with focus
    // animation), so ChatConversationPage picks this up via useFocusEffect.
    setPendingGame({ msgType, content, extra });
    router.back();
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

  const featuredGame = games.find(g => g.game_type === 'truth_or_dare') ?? games[0] ?? null;

  return (
    <View style={s.root}>
      <LinearGradient colors={['#0C0C1A', '#08081A', '#040408']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />

      {/* ── ScreenHeader-style header ── */}
      <Animated.View style={{ opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) }] }}>
        <View style={[s.header, { paddingTop: insets.top + 10 }]}>
          <LinearGradient
            colors={['#18182E', '#10101E', '#0C0C1A']}
            start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={s.headerRow}>
            {/* Close */}
            <Pressable onPress={() => router.back()} hitSlop={12}
              style={({ pressed }) => [s.headerBtn, pressed && { opacity: 0.6 }]}>
              <Ionicons name="close" size={22} color="#EEEEFF" />
            </Pressable>
            {/* Centre */}
            <View style={{ alignItems: 'center', gap: 2 }}>
              <Text style={s.hubTitle}>Games</Text>
              <Text style={s.hubSub}>with {partnerName}</Text>
            </View>
            {/* Right — recent/history icon */}
            <Pressable hitSlop={12} style={s.headerBtn}>
              <Ionicons name="time-outline" size={22} color="rgba(220,218,255,0.5)" />
            </Pressable>
          </View>
        </View>
      </Animated.View>

      {/* ── Content ── */}
      {loading ? (
        <LoadingSkeleton />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 32, gap: 24 }}>
          {/* Featured card */}
          {featuredGame && (
            <FeaturedGameCard
              game={featuredGame}
              onPress={() => {
                // T&D: send invite immediately — no card detail screen needed
                if (featuredGame.game_type === 'truth_or_dare') {
                  handleSend(featuredGame, null);
                } else {
                  setSelected(featuredGame);
                }
              }}
            />
          )}

          {/* Vertical game list — individual squircle cards */}
          <View style={s.listSection}>
            <Text style={s.sectionLabel}>All Games</Text>
            <View style={{ gap: 8 }}>
              {games.map((game, i) => (
                <GameListItem
                  key={game.id} game={game} index={i}
                  isLast={i === games.length - 1}
                  onPress={() => {
                    if (game.game_type === 'truth_or_dare') {
                      handleSend(game, null);
                    } else {
                      setSelected(game);
                    }
                  }}
                />
              ))}
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },

  // ── ScreenHeader-style header ────────────────────────────────────────────────
  header:    { paddingHorizontal: 20, paddingBottom: 14, overflow: 'hidden' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  hubTitle:  { fontSize: 17, fontFamily: 'ProductSans-Black', color: '#EEEEFF' },
  hubSub:    { fontSize: 12, fontFamily: 'ProductSans-Regular', color: 'rgba(220,218,255,0.45)' },

  // Section
  sectionLabel:  { fontSize: 16, fontFamily: 'ProductSans-Black', color: '#EEEEFF', letterSpacing: -0.2, marginBottom: 10 },
  listSection: { paddingHorizontal: 14 },

  // ── Featured cinematic card ──────────────────────────────────────────────────
  featCard:    { marginHorizontal: 14, height: 204, borderRadius: 26, overflow: 'hidden', padding: 18, justifyContent: 'space-between' },
  featArt:     { position: 'absolute', fontFamily: 'System' },
  featTop:     { flexDirection: 'row' },
  featBadge:   { paddingHorizontal: 11, paddingVertical: 5, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 50 },
  featBadgeText: { color: 'rgba(255,255,255,0.88)', fontSize: 10, fontFamily: 'ProductSans-Black', letterSpacing: 1 },
  featBody:    { gap: 5 },
  featTitle:   { fontSize: 24, fontFamily: 'ProductSans-Black', color: '#fff', letterSpacing: -0.4, lineHeight: 30 },
  featDesc:    { fontSize: 12, fontFamily: 'ProductSans-Regular', color: 'rgba(255,255,255,0.55)', lineHeight: 17 },
  featBar:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  featBarIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  featBarName: { fontSize: 13, fontFamily: 'ProductSans-Black', color: '#fff' },
  featBarSub:  { fontSize: 11, fontFamily: 'ProductSans-Regular', color: 'rgba(255,255,255,0.42)' },
  featPlayBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 50 },
  featPlayText:{ color: '#fff', fontSize: 13, fontFamily: 'ProductSans-Black' },

  // ── Vertical game list rows — squircle cards ─────────────────────────────────
  listRow:  { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 14 },
  listIcon: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center' },
  listName: { fontSize: 15, fontFamily: 'ProductSans-Black', color: '#EEEEFF', marginBottom: 2 },
  listDesc: { fontSize: 12, fontFamily: 'ProductSans-Regular', color: 'rgba(210,208,255,0.45)' },

  // Legacy stubs (kept to avoid unused errors)
  partnerThumb:      { width: 16, height: 16, borderRadius: 8 },
  partnerAvatarWrap: { width: 44, height: 44, padding: 2 },
  partnerAvatar:     { width: 40, height: 40, borderRadius: 14 },
  backBtn:           { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  hubSubPill:        { alignSelf: 'flex-start' },

  // Card list row (inside detail screen) — no icon, text-only
  cardRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 14, paddingHorizontal: 16 },
  cardRowCat:  { fontSize: 10, fontFamily: 'ProductSans-Black', letterSpacing: 1, opacity: 0.9 },
  cardRowText: { fontSize: 14, fontFamily: 'ProductSans-Bold', color: '#DDDEFF', lineHeight: 21 },

  // Detail screen
  detailRoot:      { flex: 1 },
  detailHeader:    { paddingHorizontal: 20, paddingBottom: 0 },
  detailHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14 },
  detailTitle:      { fontSize: 20, fontFamily: 'ProductSans-Black', color: '#fff' },
  detailSub:        { fontSize: 13, fontFamily: 'ProductSans-Bold', marginTop: 2 },
  previewGameEmoji: { fontSize: 18, marginBottom: 1 },
  previewTitle:     { fontSize: 18, fontFamily: 'ProductSans-Black', color: '#ffffff', letterSpacing: 0 },
  bigSendBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 17 },
  bigSendBtnText:  { fontSize: 16, fontFamily: 'ProductSans-Black', color: '#fff' },
  pickDiffText:    { fontSize: 14, fontFamily: 'ProductSans-Regular', color: 'rgba(255,255,255,0.45)' },

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

  // Header icon buttons — legacy alias kept for safety
  headerIconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  // Modal
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalSheet:    { borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', padding: 20, paddingBottom: 40, gap: 16 },
  modalHandle:   { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 4 },
  modalTitle:    { fontSize: 18, fontFamily: 'ProductSans-Black', letterSpacing: 0.2 },
});
