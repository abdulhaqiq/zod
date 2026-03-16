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

function LoadingSkeleton() {
  return (
    <View style={{ padding: 20, gap: 14 }}>
      {[0, 1, 2, 3, 4].map(i => (
        <View key={i} style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <Shimmer width={56} height={56} borderRadius={18} />
          <View style={{ flex: 1, gap: 8 }}>
            <Shimmer width="70%" height={16} borderRadius={8} />
            <Shimmer width="45%" height={12} borderRadius={6} />
          </View>
          <Shimmer width={24} height={24} borderRadius={12} />
        </View>
      ))}
    </View>
  );
}

// ─── Category pill ────────────────────────────────────────────────────────────

function CategoryPill({ label, isActive, accent, onPress }: {
  label: string; isActive: boolean; accent: string; onPress: () => void;
}) {
  // For very light accent colors (like white), use dark text when active
  const activeTextColor = accent.toLowerCase() === '#f8fafc' || accent.toLowerCase() === '#ffffff' ? '#0f172a' : '#fff';
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}>
      <Squircle style={s.catPill}
        cornerRadius={50} cornerSmoothing={1}
        fillColor={isActive ? accent : 'rgba(255,255,255,0.07)'}
        strokeColor={isActive ? accent : 'rgba(255,255,255,0.15)'}
        strokeWidth={1.5}>
        <Text style={[s.catPillText, { color: isActive ? activeTextColor : 'rgba(255,255,255,0.6)' }]}>{label}</Text>
      </Squircle>
    </Pressable>
  );
}

// ─── WYR Card ─────────────────────────────────────────────────────────────────

function WyrCard({ card, accent, onSend }: { card: GameCardData; accent: string; onSend: (card: GameCardData) => void }) {
  return (
    <Squircle style={s.gameCard} cornerRadius={24} cornerSmoothing={1}
      fillColor="rgba(255,255,255,0.05)"
      strokeColor={`${accent}60`} strokeWidth={1.5}>
      <Squircle style={s.gameCardBadge} cornerRadius={50} cornerSmoothing={1} fillColor={`${accent}25`}>
        <Text style={{ fontSize: 14 }}>{card.emoji}</Text>
        <Text style={[s.gameCardBadgeText, { color: accent }]}>Would You Rather</Text>
      </Squircle>
      <View style={s.wyrRow}>
        <Squircle style={s.wyrBox} cornerRadius={16} cornerSmoothing={1} fillColor="rgba(255,255,255,0.08)">
          <Text style={s.wyrLabel}>A</Text>
          <Text style={s.wyrText}>{card.option_a ?? ''}</Text>
        </Squircle>
        <Text style={s.wyrOr}>or</Text>
        <Squircle style={s.wyrBox} cornerRadius={16} cornerSmoothing={1} fillColor="rgba(255,255,255,0.08)">
          <Text style={s.wyrLabel}>B</Text>
          <Text style={s.wyrText}>{card.option_b ?? ''}</Text>
        </Squircle>
      </View>
      <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onSend(card); }} style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}>
        <Squircle style={[s.sendCardBtn, { backgroundColor: accent }]} cornerRadius={50} cornerSmoothing={1} fillColor={accent}>
          <Ionicons name="send" size={14} color="#fff" />
          <Text style={s.sendCardBtnText}>Send This</Text>
        </Squircle>
      </Pressable>
    </Squircle>
  );
}

// ─── Statement Card (NHI / Hot Takes) ────────────────────────────────────────

function StatementCard({ card, accent, label, onSend }: { card: GameCardData; accent: string; label: string; onSend: (card: GameCardData) => void }) {
  return (
    <Squircle style={s.gameCard} cornerRadius={24} cornerSmoothing={1}
      fillColor="rgba(255,255,255,0.05)"
      strokeColor={`${accent}60`} strokeWidth={1.5}>
      <Squircle style={s.gameCardBadge} cornerRadius={50} cornerSmoothing={1} fillColor={`${accent}25`}>
        <Text style={{ fontSize: 14 }}>{card.emoji}</Text>
        <Text style={[s.gameCardBadgeText, { color: accent }]}>{label}</Text>
      </Squircle>
      <Text style={s.statementText}>{card.question}</Text>
      <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onSend(card); }} style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}>
        <Squircle style={s.sendCardBtn} cornerRadius={50} cornerSmoothing={1} fillColor={accent}>
          <Ionicons name="send" size={14} color="#fff" />
          <Text style={s.sendCardBtnText}>Send This</Text>
        </Squircle>
      </Pressable>
    </Squircle>
  );
}

// ─── Quiz / Date step card ────────────────────────────────────────────────────

function QuizCard({ card, accent, label, onSend }: { card: GameCardData; accent: string; label: string; onSend: (card: GameCardData) => void }) {
  return (
    <Squircle style={s.gameCard} cornerRadius={24} cornerSmoothing={1}
      fillColor="rgba(255,255,255,0.05)"
      strokeColor={`${accent}60`} strokeWidth={1.5}>
      <Squircle style={s.gameCardBadge} cornerRadius={50} cornerSmoothing={1} fillColor={`${accent}25`}>
        <Text style={{ fontSize: 14 }}>{card.emoji}</Text>
        <Text style={[s.gameCardBadgeText, { color: accent }]}>{label}</Text>
      </Squircle>
      <Text style={s.statementText}>{card.question}</Text>
      {(card.options ?? []).map((opt, i) => (
        <Squircle key={i} style={s.quizOpt} cornerRadius={14} cornerSmoothing={1} fillColor={`${accent}15`}>
          <Text style={[s.quizOptText, { color: '#fff' }]}>{opt}</Text>
        </Squircle>
      ))}
      <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onSend(card); }} style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}>
        <Squircle style={s.sendCardBtn} cornerRadius={50} cornerSmoothing={1} fillColor={accent}>
          <Ionicons name="send" size={14} color="#fff" />
          <Text style={s.sendCardBtnText}>Send This Quiz</Text>
        </Squircle>
      </Pressable>
    </Squircle>
  );
}

// ─── Custom write card ────────────────────────────────────────────────────────

// ─── Truth or Dare Card ───────────────────────────────────────────────────────

function TodCard({ card, accent, onSend }: { card: GameCardData; accent: string; onSend: (card: GameCardData) => void }) {
  const isDare = card.category?.toLowerCase() === 'dare';
  const badgeColor = isDare ? '#f59e0b' : '#a78bfa';
  const badgeLabel = isDare ? '😈 Dare' : '🤫 Truth';
  return (
    <Squircle style={s.gameCard} cornerRadius={24} cornerSmoothing={1}
      fillColor="rgba(255,255,255,0.05)"
      strokeColor={`${accent}60`} strokeWidth={1.5}>
      <Squircle style={s.gameCardBadge} cornerRadius={50} cornerSmoothing={1} fillColor={`${badgeColor}25`}>
        <Text style={[s.gameCardBadgeText, { color: badgeColor }]}>{badgeLabel}</Text>
      </Squircle>
      <Text style={s.statementText}>{card.question}</Text>
      <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onSend(card); }} style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}>
        <Squircle style={s.sendCardBtn} cornerRadius={50} cornerSmoothing={1} fillColor={accent}>
          <Ionicons name="send" size={14} color="#fff" />
          <Text style={[s.sendCardBtnText, { color: isDare ? '#0f172a' : '#fff' }]}>Send This</Text>
        </Squircle>
      </Pressable>
    </Squircle>
  );
}

function CustomCard({ accent, label, placeholder, onSend }: {
  accent: string; label: string; placeholder: string;
  onSend: (text: string) => void;
}) {
  const [text, setText] = useState('');
  return (
    <Squircle style={s.gameCard} cornerRadius={24} cornerSmoothing={1}
      fillColor="rgba(255,255,255,0.04)" strokeColor="rgba(255,255,255,0.1)" strokeWidth={1}>
      <Squircle style={s.gameCardBadge} cornerRadius={50} cornerSmoothing={1} fillColor={`${accent}25`}>
        <Ionicons name="create-outline" size={13} color={accent} />
        <Text style={[s.gameCardBadgeText, { color: accent }]}>{label}</Text>
      </Squircle>
      <Squircle style={s.customInput} cornerRadius={16} cornerSmoothing={1}
        fillColor="rgba(255,255,255,0.07)" strokeColor="rgba(255,255,255,0.1)" strokeWidth={1}>
        <TextInput
          value={text} onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor="rgba(255,255,255,0.3)"
          style={s.customInputText}
          multiline maxLength={200}
        />
      </Squircle>
      <Pressable onPress={() => { if (text.trim()) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onSend(text.trim()); } }}
        disabled={!text.trim()}
        style={({ pressed }) => [{ opacity: !text.trim() ? 0.4 : pressed ? 0.8 : 1 }]}>
        <Squircle style={s.sendCardBtn} cornerRadius={50} cornerSmoothing={1} fillColor={accent}>
          <Ionicons name="send" size={14} color="#fff" />
          <Text style={s.sendCardBtnText}>Send Custom</Text>
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
          <Text style={{ color: accent, fontSize: 11, fontFamily: 'ProductSans-Black', letterSpacing: 0.4 }}>Would You Rather</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Squircle style={{ flex: 1, padding: 12, gap: 4 }} cornerRadius={14} cornerSmoothing={1} fillColor="rgba(255,255,255,0.08)">
            <Text style={{ fontSize: 10, color: accent, fontFamily: 'ProductSans-Black', letterSpacing: 0.5 }}>A</Text>
            <Text style={{ color: '#fff', fontSize: 14, fontFamily: 'ProductSans-Bold', lineHeight: 20 }}>{optA.trim()}</Text>
          </Squircle>
          <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14, fontFamily: 'ProductSans-Black', alignSelf: 'center' }}>or</Text>
          <Squircle style={{ flex: 1, padding: 12, gap: 4 }} cornerRadius={14} cornerSmoothing={1} fillColor="rgba(255,255,255,0.08)">
            <Text style={{ fontSize: 10, color: accent, fontFamily: 'ProductSans-Black', letterSpacing: 0.5 }}>B</Text>
            <Text style={{ color: '#fff', fontSize: 14, fontFamily: 'ProductSans-Bold', lineHeight: 20 }}>{optB.trim()}</Text>
          </Squircle>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onRegenerate(); }} disabled={loading}
            style={({ pressed }) => [{ flex: 1, opacity: loading ? 0.5 : pressed ? 0.75 : 1 }]}>
            <Squircle style={[s.sendCardBtn, { backgroundColor: 'rgba(255,255,255,0.1)' }]} cornerRadius={50} cornerSmoothing={1} fillColor="rgba(255,255,255,0.08)">
              <Text style={{ fontSize: 13 }}>🔄</Text>
              <Text style={[s.sendCardBtnText, { fontSize: 13 }]}>Try Again</Text>
            </Squircle>
          </Pressable>
          <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onSend(generated.question); }}
            style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.8 : 1 }]}>
            <Squircle style={s.sendCardBtn} cornerRadius={50} cornerSmoothing={1} fillColor={accent}>
              <Ionicons name="send" size={14} color="#fff" />
              <Text style={s.sendCardBtnText}>Send This</Text>
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
        fillColor="rgba(255,255,255,0.06)" strokeColor={`${accent}40`} strokeWidth={1}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 18 }}>{generated.emoji}</Text>
          <Text style={{ color: accent, fontSize: 11, fontFamily: 'ProductSans-Black', letterSpacing: 0.4 }}>
            {gameType === 'quiz' ? 'Quiz Question' : 'Date Step'}
          </Text>
        </View>
        <Text style={s.statementText}>{q.trim()}</Text>
        <View style={{ gap: 6 }}>
          {opts.map((opt, i) => (
            <Squircle key={i} style={{ paddingHorizontal: 14, paddingVertical: 10 }} cornerRadius={12} cornerSmoothing={1} fillColor={`${accent}18`}>
              <Text style={{ color: '#fff', fontSize: 14, fontFamily: 'ProductSans-Bold' }}>{opt.trim()}</Text>
            </Squircle>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onRegenerate(); }} disabled={loading}
            style={({ pressed }) => [{ flex: 1, opacity: loading ? 0.5 : pressed ? 0.75 : 1 }]}>
            <Squircle style={s.sendCardBtn} cornerRadius={50} cornerSmoothing={1} fillColor="rgba(255,255,255,0.08)">
              <Text style={{ fontSize: 13 }}>🔄</Text>
              <Text style={[s.sendCardBtnText, { fontSize: 13 }]}>Try Again</Text>
            </Squircle>
          </Pressable>
          <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onSend(generated.question); }}
            style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.8 : 1 }]}>
            <Squircle style={s.sendCardBtn} cornerRadius={50} cornerSmoothing={1} fillColor={accent}>
              <Ionicons name="send" size={14} color="#fff" />
              <Text style={s.sendCardBtnText}>Send This</Text>
            </Squircle>
          </Pressable>
        </View>
      </Squircle>
    );
  }

  // Truth or Dare: show truth/dare badge
  if (gameType === 'truth_or_dare') {
    const isDare = generated.sub_type === 'dare';
    const badgeColor = isDare ? '#f59e0b' : '#a78bfa';
    const badgeLabel = isDare ? '😈 Dare' : '🤫 Truth';
    return (
      <Squircle style={{ padding: 14, gap: 10 }} cornerRadius={18} cornerSmoothing={1}
        fillColor="rgba(255,255,255,0.06)" strokeColor={`${accent}40`} strokeWidth={1}>
        <Squircle style={s.gameCardBadge} cornerRadius={50} cornerSmoothing={1} fillColor={`${badgeColor}25`}>
          <Text style={[s.gameCardBadgeText, { color: badgeColor }]}>{badgeLabel}</Text>
        </Squircle>
        <Text style={s.statementText}>{generated.question}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onRegenerate(); }} disabled={loading}
            style={({ pressed }) => [{ flex: 1, opacity: loading ? 0.5 : pressed ? 0.75 : 1 }]}>
            <Squircle style={s.sendCardBtn} cornerRadius={50} cornerSmoothing={1} fillColor="rgba(255,255,255,0.08)">
              <Text style={{ fontSize: 13 }}>🔄</Text>
              <Text style={[s.sendCardBtnText, { fontSize: 13 }]}>Try Again</Text>
            </Squircle>
          </Pressable>
          <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onSend(generated.question); }}
            style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.8 : 1 }]}>
            <Squircle style={s.sendCardBtn} cornerRadius={50} cornerSmoothing={1} fillColor={accent}>
              <Ionicons name="send" size={14} color="#fff" />
              <Text style={s.sendCardBtnText}>Send This</Text>
            </Squircle>
          </Pressable>
        </View>
      </Squircle>
    );
  }

  // Default: statement / question card
  return (
    <Squircle style={{ padding: 14, gap: 10 }} cornerRadius={18} cornerSmoothing={1}
      fillColor="rgba(255,255,255,0.06)" strokeColor={`${accent}40`} strokeWidth={1}>
      <Text style={{ fontSize: 22, textAlign: 'center' }}>{generated.emoji}</Text>
      <Text style={[s.statementText, { textAlign: 'center', fontSize: 16 }]}>{generated.question}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onRegenerate(); }} disabled={loading}
          style={({ pressed }) => [{ flex: 1, opacity: loading ? 0.5 : pressed ? 0.75 : 1 }]}>
          <Squircle style={s.sendCardBtn} cornerRadius={50} cornerSmoothing={1} fillColor="rgba(255,255,255,0.08)">
            <Text style={{ fontSize: 13 }}>🔄</Text>
            <Text style={[s.sendCardBtnText, { fontSize: 13 }]}>Try Again</Text>
          </Squircle>
        </Pressable>
        <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onSend(generated.question); }}
          style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.8 : 1 }]}>
          <Squircle style={s.sendCardBtn} cornerRadius={50} cornerSmoothing={1} fillColor={accent}>
            <Ionicons name="send" size={14} color="#fff" />
            <Text style={s.sendCardBtnText}>Send This</Text>
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
      fillColor="rgba(99,102,241,0.08)" strokeColor={`${accent}55`} strokeWidth={1.5}>

      {/* Badge */}
      <Squircle style={s.gameCardBadge} cornerRadius={50} cornerSmoothing={1} fillColor={`${accent}25`}>
        <Text style={{ fontSize: 13 }}>✨</Text>
        <Text style={[s.gameCardBadgeText, { color: accent }]}>Create with AI</Text>
      </Squircle>

      {/* Truth or Dare mode picker */}
      {isTod && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['truth', 'dare', ''] as const).map((mode) => {
            const label = mode === 'truth' ? '🤫 Truth' : mode === 'dare' ? '😈 Dare' : '🎲 Surprise';
            const isActive = todMode === mode;
            const modeColor = mode === 'dare' ? '#f59e0b' : mode === 'truth' ? '#a78bfa' : accent;
            return (
              <Pressable key={mode} onPress={() => setTodMode(mode)}
                style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.75 : 1 }]}>
                <Squircle style={{ paddingVertical: 10, alignItems: 'center' }} cornerRadius={14} cornerSmoothing={1}
                  fillColor={isActive ? `${modeColor}30` : 'rgba(255,255,255,0.06)'}
                  strokeColor={isActive ? modeColor : 'rgba(255,255,255,0.1)'} strokeWidth={1.5}>
                  <Text style={{ color: isActive ? modeColor : 'rgba(255,255,255,0.5)', fontSize: 13, fontFamily: isActive ? 'ProductSans-Black' : 'ProductSans-Regular' }}>
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
        fillColor="rgba(255,255,255,0.07)" strokeColor="rgba(255,255,255,0.1)" strokeWidth={1}>
        <TextInput
          value={theme} onChangeText={setTheme}
          placeholder="Optional: add a theme or mood…"
          placeholderTextColor="rgba(255,255,255,0.3)"
          style={[s.customInputText, { paddingTop: 0 }]}
          maxLength={80}
          returnKeyType="done"
        />
      </Squircle>

      {/* Generate button */}
      <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); generate(); }} disabled={loading}
        style={({ pressed }) => [{ opacity: loading ? 0.6 : pressed ? 0.8 : 1 }]}>
        <Squircle style={s.sendCardBtn} cornerRadius={50} cornerSmoothing={1}
          fillColor={loading ? 'rgba(255,255,255,0.12)' : accent}>
          {loading
            ? <ActivityIndicator size="small" color="#fff" />
            : <><Text style={{ fontSize: 14 }}>✨</Text><Text style={s.sendCardBtnText}>
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
  const insets = useSafeAreaInsets();

  useEffect(() => {
    setLoading(true);
    apiFetch<GameCardData[]>(`/mini-games/${game.game_type}/cards`, { token })
      .then(data => setCards(Array.isArray(data) ? data : []))
      .catch(() => setCards([]))
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
    <View style={[s.detailRoot, { backgroundColor: game.bg_color }]}>
      {/* Header */}
      <LinearGradient colors={[game.bg_color, 'transparent']} style={[s.detailHeader, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={onBack} hitSlop={12} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
          <Squircle style={s.backBtn} cornerRadius={12} cornerSmoothing={1} fillColor="rgba(255,255,255,0.1)">
            <Ionicons name="arrow-back" size={18} color="#fff" />
          </Squircle>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.detailTitle}>{game.emoji} {game.name}</Text>
          <Text style={[s.detailSub, { color: game.accent_color }]}>{game.tagline}</Text>
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

        {/* Description */}
        <Squircle style={s.descBox} cornerRadius={18} cornerSmoothing={1} fillColor="rgba(255,255,255,0.06)">
          <Text style={s.descText}>{game.description}</Text>
        </Squircle>

        {/* Cards */}
        {loading ? (
          <View style={{ gap: 14 }}>
            {[0, 1, 2].map(i => <Shimmer key={i} width="100%" height={160} borderRadius={24} bgColor={`${game.bg_color}cc`} />)}
          </View>
        ) : (
          <>
            {filtered.map(renderCard)}
            {/* Write your own */}
            <CustomCard
              accent={game.accent_color}
              label="Write Your Own"
              placeholder={customPlaceholder[game.game_type] ?? 'Your custom prompt…'}
              onSend={text => onSend(game, null, text)}
            />
            {/* Create with AI */}
            <AiCard
              accent={game.accent_color}
              gameType={game.game_type}
              token={token}
              onSend={text => onSend(game, null, text)}
            />
          </>
        )}
      </ScrollView>
    </View>
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
          <View style={[s.gameRowIcon, { backgroundColor: `${game.accent_color}20` }]}>
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
    <View style={[s.root, { backgroundColor: colors.bg }]}>
      {/* ── Header ── */}
      <Animated.View style={[s.header, { paddingTop: insets.top + 16, opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
          <Squircle style={s.backBtn} cornerRadius={12} cornerSmoothing={1} fillColor={colors.surface2}>
            <Ionicons name="arrow-back" size={18} color={colors.text} />
          </Squircle>
        </Pressable>

        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[s.hubTitle, { color: colors.text }]}>🎮 Games</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {partnerImage ? (
              <Image source={{ uri: partnerImage }} style={s.partnerThumb} contentFit="cover" />
            ) : (
              <View style={[s.partnerThumb, { backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }]}>
                <Ionicons name="person" size={10} color={colors.textSecondary} />
              </View>
            )}
            <Text style={[s.hubSub, { color: colors.textSecondary }]}>Play with {partnerName}</Text>
          </View>
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
    </View>
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
});
