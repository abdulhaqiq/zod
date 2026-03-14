import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';

const { width: W } = Dimensions.get('window');

const CARD_W = W * 0.46;
const CARD_H = CARD_W * 1.42;

const FALLBACK_AVATAR = 'https://randomuser.me/api/portraits/lego/1.jpg';

export interface MatchedProfile {
  id: string;
  name: string;
  age: number;
  image: string;
  interests?: { emoji: string; label: string }[];
  prompts?: { question: string; answer: string }[];
}

interface Props {
  profile: MatchedProfile;
  onChat: () => void;
  onDismiss: () => void;
}

export default function MatchScreen({ profile, onChat, onDismiss }: Props) {
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
    // Keep only 3
    starters.splice(3);
  }

  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  useEffect(() => {
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
      {/* Warm dark gradient — same as reference */}
      <LinearGradient
        colors={['#3B1205', '#1E0A02', '#0A0302']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Top label */}
      <Text style={[styles.topLabel, { marginTop: insets.top + 22 }]}>
        It's a Match! 🎉
      </Text>
      <Text style={styles.topSub}>
        You and {profile.name} liked each other
      </Text>

      {/* ── Overlapping profile cards ── */}
      <View style={styles.cardsArea}>

        {/* My card — back left */}
        <Animated.View style={[styles.cardBack, { transform: [{ scale: scaleMe }, { translateX: -CARD_W * 0.28 }, { translateY: -CARD_H * 0.06 }, { rotate: '-9deg' }] }]}>
          <Image source={{ uri: myPhoto }} style={styles.cardPhoto} resizeMode="cover" />
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.72)']} style={styles.cardGrad}>
            <Text style={styles.cardName}>You</Text>
          </LinearGradient>
        </Animated.View>

        {/* Their card — front right */}
        <Animated.View style={[styles.cardFront, { transform: [{ scale: scaleThem }, { translateX: CARD_W * 0.22 }, { translateY: CARD_H * 0.04 }, { rotate: '4deg' }] }]}>
          <Image source={{ uri: profile.image }} style={styles.cardPhoto} resizeMode="cover" />
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.72)']} style={styles.cardGrad}>
            <Text style={styles.cardName}>{profile.name}, {profile.age}</Text>
          </LinearGradient>
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

        {/* Conversation starters */}
        <Text style={styles.starterLabel}>Break the ice ✨</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.starterRow} contentContainerStyle={{ paddingHorizontal: 4 }}>
          {starters.map((s, i) => (
            <Pressable
              key={i}
              onPress={() => { setCopiedIdx(i); onChat(); }}
              style={({ pressed }) => [styles.starterChip, pressed && { opacity: 0.78 }, copiedIdx === i && styles.starterChipActive]}
            >
              <Text style={styles.starterText} numberOfLines={2}>{s}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Start chatting */}
        <Pressable
          onPress={() => dismiss(onChat)}
          style={({ pressed }) => [styles.ctaBtn, pressed && { opacity: 0.85 }]}
        >
          <View style={styles.ctaIcon}>
            <Ionicons name="chatbubble-ellipses" size={20} color="#fff" />
          </View>
          <Text style={styles.ctaText}>Start Chatting</Text>
          <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.45)" />
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
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: '#222',
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
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: '#222',
    shadowColor: '#000',
    shadowOpacity: 0.7,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 14,
    zIndex: 2,
  },

  cardPhoto: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },

  cardGrad: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 48,
  },

  cardName: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'ProductSans-Bold',
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
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 50,
    paddingVertical: 10,
    paddingRight: 20,
    paddingLeft: 10,
  },

  ctaIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E85D04',
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
  starterRow: {
    marginBottom: 14,
  },
  starterChip: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 10,
    maxWidth: 220,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  starterChipActive: {
    backgroundColor: 'rgba(255,100,100,0.3)',
    borderColor: 'rgba(255,100,100,0.5)',
  },
  starterText: {
    fontSize: 13,
    fontFamily: 'ProductSans-Regular',
    color: '#fff',
    lineHeight: 18,
  },
});
