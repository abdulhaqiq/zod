import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { getSvgPath } from 'figma-squircle';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  ClipPath,
  Defs,
  G,
  Image as SvgImage,
  LinearGradient as SvgLinearGradient,
  Path,
  Rect,
  Stop,
  Svg,
} from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import Squircle from '@/components/ui/Squircle';

const { width: W } = Dimensions.get('window');

const CARD_W = W * 0.46;
const CARD_H = CARD_W * 1.42;

const CARD_PATH = getSvgPath({ width: CARD_W, height: CARD_H, cornerRadius: 30, cornerSmoothing: 1, preserveSmoothing: true });

const FALLBACK_AVATAR = 'https://randomuser.me/api/portraits/lego/1.jpg';

export interface MatchedProfile {
  /** age is optional — omit for work/professional mode */
  id: string;
  name: string;
  age?: number;
  image: string;
  interests?: { emoji: string; label: string }[];
  prompts?: { question: string; answer: string }[];
  isSuperLike?: boolean;
}

interface Props {
  profile: MatchedProfile;
  onChat: () => void;
  onDismiss: () => void;
}

export default function MatchScreen({ profile, onChat, onDismiss }: Props) {
  const isSuper = !!profile.isSuperLike;
  const insets = useSafeAreaInsets();
  const { profile: me } = useAuth();
  const myPhoto = me?.photos?.[0] ?? FALLBACK_AVATAR;
  const opacity   = useRef(new Animated.Value(0)).current;
  const scaleMe   = useRef(new Animated.Value(0.85)).current;
  const scaleThem = useRef(new Animated.Value(0.85)).current;

  // Generate conversation starters from shared interests / prompts
  const starters = useRef<string[]>([]).current;
  if (starters.length === 0) {
    const myInterests   = (me as any)?.interests ?? [];
    const themInterests = profile.interests ?? [];
    const shared = themInterests.filter((t: any) =>
      myInterests.some((m: any) => m.label === t.label)
    );
    if (shared.length > 0) {
      starters.push(`You both love ${shared[0].emoji} ${shared[0].label} — what got you into it?`);
    }
    if (profile.prompts && profile.prompts.length > 0) {
      const p = profile.prompts[0];
      starters.push(`"${p.question}" — I saw your answer and had to ask more 😄`);
    }
    starters.push(`Hey ${profile.name}! What's been making you smile lately? 😊`);
    starters.push(`If we could only do one thing together this weekend, what would you pick?`);
    // Keep only 2
    starters.splice(2);
  }

  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  useEffect(() => {
    // Haptic: success pulse then heavy thud — notification is sent server-side to both parties
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }, 300);

    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.spring(scaleMe,   { toValue: 1, friction: 7, tension: 60, useNativeDriver: true }),
      Animated.spring(scaleThem, { toValue: 1, friction: 7, tension: 60, delay: 120, useNativeDriver: true }),
    ]).start();
  }, []);

  const dismiss = (cb: () => void) => {
    Animated.timing(opacity, { toValue: 0, duration: 320, useNativeDriver: true }).start(cb);
  };

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => dismiss(onDismiss)}
    >
    <Animated.View style={[styles.fill, { opacity }]}>
      {/* Background — gold for super like, warm dark for regular */}
      <LinearGradient
        colors={isSuper
          ? ['#3D2000', '#1F1000', '#0A0500']
          : ['#3B1205', '#1E0A02', '#0A0302']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Top label */}
      <Text style={[styles.topLabel, { marginTop: insets.top + 22, color: isSuper ? '#F59E0B' : '#fff' }]}>
        {isSuper ? '⭐ Super Match!' : "It's a Match! 🎉"}
      </Text>
      <Text style={styles.topSub}>
        {isSuper
          ? `You super liked each other — 48 hours to connect`
          : `You and ${profile.name} liked each other`}
      </Text>

      {/* ── Overlapping profile cards ── */}
      <View style={styles.cardsArea}>

        {/* My card — back left */}
        <Animated.View style={[styles.cardBack, { transform: [{ scale: scaleMe }, { translateX: -CARD_W * 0.28 }, { translateY: -CARD_H * 0.06 }, { rotate: '-9deg' }] }]}>
          <Svg width={CARD_W} height={CARD_H}>
            <Defs>
              <ClipPath id="clipMe">
                <Path d={CARD_PATH} />
              </ClipPath>
              <SvgLinearGradient id="gradMe" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0.5" stopColor="transparent" stopOpacity={0} />
                <Stop offset="1" stopColor="#000" stopOpacity={0.75} />
              </SvgLinearGradient>
            </Defs>
            <G clipPath="url(#clipMe)">
              <SvgImage href={myPhoto} width={CARD_W} height={CARD_H} preserveAspectRatio="xMidYMid slice" />
              <Rect width={CARD_W} height={CARD_H} fill="url(#gradMe)" />
            </G>
          </Svg>
          <Text style={styles.cardName}>You</Text>
        </Animated.View>

        {/* Their card — front right */}
        <Animated.View style={[styles.cardFront, { transform: [{ scale: scaleThem }, { translateX: CARD_W * 0.22 }, { translateY: CARD_H * 0.04 }, { rotate: '4deg' }] }]}>
          <Svg width={CARD_W} height={CARD_H}>
            <Defs>
              <ClipPath id="clipThem">
                <Path d={CARD_PATH} />
              </ClipPath>
              <SvgLinearGradient id="gradThem" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0.5" stopColor="transparent" stopOpacity={0} />
                <Stop offset="1" stopColor="#000" stopOpacity={0.75} />
              </SvgLinearGradient>
            </Defs>
            <G clipPath="url(#clipThem)">
              <SvgImage href={profile.image} width={CARD_W} height={CARD_H} preserveAspectRatio="xMidYMid slice" />
              <Rect width={CARD_W} height={CARD_H} fill="url(#gradThem)" />
              {/* Gold border overlay for super like */}
              {isSuper && <Path d={CARD_PATH} fill="none" stroke="#F59E0B" strokeWidth={4} />}
            </G>
          </Svg>
          {isSuper && (
            <View style={styles.superStarBadge}>
              <Ionicons name="star" size={12} color="#fff" />
            </View>
          )}
          <Text style={styles.cardName}>{profile.name}{profile.age ? `, ${profile.age}` : ''}</Text>
        </Animated.View>

        {/* Floating bubbles */}
        <View style={[styles.bubble, styles.bubblePurple, styles.bubbleLeft]}>
          <Ionicons name="heart" size={18} color="#fff" />
        </View>
        <View style={[styles.bubble, styles.bubbleBlue, styles.bubbleTopRight]}>
          <Ionicons name="star" size={18} color="#fff" />
        </View>
        <View style={[styles.bubble, styles.bubbleRed, styles.bubbleBottomRight]}>
          <Ionicons name="heart" size={18} color="#fff" />
        </View>
      </View>

      {/* ── Bottom actions ── */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 24 }]}>

        {/* Conversation starters — Squircle card */}
        <Text style={styles.starterLabel}>Break the ice ✨</Text>
        <Squircle
          cornerRadius={22}
          cornerSmoothing={1}
          fillColor="rgba(255,255,255,0.08)"
          style={styles.starterCard}
        >
          {starters.map((s, i) => {
            const isLast = i === starters.length - 1;
            return (
              <Pressable
                key={i}
                onPress={() => { setCopiedIdx(i); onChat(); }}
                style={({ pressed }) => [
                  styles.starterRow,
                  !isLast && styles.starterDivider,
                  pressed && { opacity: 0.6 },
                  copiedIdx === i && styles.starterRowActive,
                ]}
              >
                <Text style={styles.starterText}>{s}</Text>
                <Ionicons name="arrow-forward-circle-outline" size={18} color="rgba(255,255,255,0.4)" />
              </Pressable>
            );
          })}
        </Squircle>

        {/* Start chatting — Squircle */}
        <Pressable onPress={() => dismiss(onChat)} style={({ pressed }) => [pressed && { opacity: 0.85 }]}>
          <Squircle
            cornerRadius={26}
            cornerSmoothing={1}
            fillColor="rgba(255,255,255,0.12)"
            style={styles.ctaBtn}
          >
            <View style={styles.ctaIcon}>
              <Ionicons name="chatbubble-ellipses" size={20} color="#fff" />
            </View>
            <Text style={styles.ctaText}>Start Chatting</Text>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.45)" />
          </Squircle>
        </Pressable>

        {/* Keep browsing */}
        <Pressable onPress={() => dismiss(onDismiss)} style={styles.skipBtn}>
          <Text style={styles.skipText}>Keep Browsing</Text>
        </Pressable>
      </View>
    </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },

  topLabel: {
    textAlign: 'center',
    fontSize: 28,
    fontFamily: 'ProductSans-Black',
    color: '#fff',
    letterSpacing: 0.3,
  },

  topSub: {
    textAlign: 'center',
    fontSize: 14,
    fontFamily: 'ProductSans-Regular',
    color: 'rgba(255,255,255,0.5)',
    marginTop: 6,
  },

  /* Cards */
  cardsArea: {
    flex: 1,
    marginTop: 20,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardBack: {
    position: 'absolute',
    width: CARD_W,
    height: CARD_H,
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },

  cardFront: {
    position: 'absolute',
    width: CARD_W,
    height: CARD_H,
    shadowColor: '#000',
    shadowOpacity: 0.7,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 14,
    zIndex: 2,
  },

  cardName: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    color: '#fff',
    fontSize: 15,
    fontFamily: 'ProductSans-Bold',
  },

  superStarBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F59E0B',
    shadowOpacity: 0.7,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },

  /* Floating bubbles */
  bubble: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    zIndex: 5,
  },

  bubblePurple:      { backgroundColor: '#7B2FBE' },
  bubbleBlue:        { backgroundColor: '#1E88E5' },
  bubbleRed:         { backgroundColor: '#E53935' },

  bubbleLeft:        { left: W * 0.08, top: '30%' },
  bubbleTopRight:    { right: W * 0.08, top: '8%' },
  bubbleBottomRight: { right: W * 0.06, bottom: '16%' },

  /* Bottom */
  bottom: {
    paddingHorizontal: 26,
    gap: 14,
  },

  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingRight: 20,
    paddingLeft: 10,
  },

  ctaIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  ctaText: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'ProductSans-Bold',
    color: '#fff',
  },

  skipBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },

  skipText: {
    fontSize: 14,
    fontFamily: 'ProductSans-Medium',
    color: 'rgba(255,255,255,0.38)',
  },

  /* Conversation starters */
  starterLabel: {
    fontSize: 13,
    fontFamily: 'ProductSans-Bold',
    color: 'rgba(255,255,255,0.65)',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  starterCard: {
    overflow: 'hidden',
    marginBottom: 4,
  },
  starterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 10,
  },
  starterDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  starterRowActive: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  starterText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'ProductSans-Regular',
    color: '#fff',
    lineHeight: 18,
  },
});
