import { navPush, navReplace } from '@/utils/nav';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Squircle from '@/components/ui/Squircle';
import { useAppTheme } from '@/context/ThemeContext';

const { width: W } = Dimensions.get('window');
const LIKED_CARD_W = Math.floor((W - 44) / 2);
const LIKED_PHOTO_H = Math.floor(LIKED_CARD_W * 4 / 3);

interface WorkProfile {
  id: string; name: string; verified: boolean;
  role: string; company: string;
  images: string[];
  industries: string[];
  linkedInUrl?: string;
}

// Placeholder until server-side work matches are implemented
const WORK_MATCHED: WorkProfile[] = [];

export default function WorkMatchedPage({ insets }: { insets: any }) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const visible = WORK_MATCHED.filter(p => !dismissed.includes(p.id));

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.pageTitle, { color: colors.text }]}>Matched</Text>
          <Text style={[styles.pageSub, { color: colors.textSecondary }]}>{visible.length} people matched with you</Text>
        </View>
      </View>

      {/* Cards */}
      <View style={styles.grid}>
        {visible.map((p) => (
          <View key={p.id} style={[styles.cardWrap, { width: LIKED_CARD_W }]}>
            <Squircle style={styles.card} cornerRadius={24} cornerSmoothing={1}
              fillColor={colors.surface} strokeColor={colors.border} strokeWidth={StyleSheet.hairlineWidth}>
              <View style={styles.photoWrap}>
                <ExpoImage source={{ uri: p.images[0] }} style={styles.photo} contentFit="cover" />
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.75)']} style={styles.photoGrad}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={styles.photoName}>{p.name}</Text>
                    {p.verified && <Ionicons name="checkmark-circle" size={11} color="#fff" />}
                  </View>
                  <Text style={styles.photoRole} numberOfLines={1}>{p.role}</Text>
                </LinearGradient>
                {p.linkedInUrl && (
                  <View style={[styles.linkedInBadge, { position: 'absolute', top: 8, right: 8 }]}>
                    <Text style={styles.linkedInText}>in</Text>
                  </View>
                )}
                <View style={[styles.checkBadge, { backgroundColor: colors.text }]}>
                  <Ionicons name="checkmark" size={11} color={colors.bg} />
                </View>
              </View>

              <View style={styles.infoRow}>
                <Squircle style={styles.chip} cornerRadius={20} cornerSmoothing={1} fillColor={colors.surface2}>
                  <Text style={[styles.chipLabel, { color: colors.text }]} numberOfLines={1}>{p.industries[0]}</Text>
                </Squircle>
                <View style={styles.actions}>
                  <Pressable onPress={() => setDismissed(prev => [...prev, p.id])} style={({ pressed }) => [pressed && { opacity: 0.65 }]} hitSlop={6}>
                    <Squircle style={styles.passBtn} cornerRadius={50} cornerSmoothing={1}
                      fillColor={colors.surface2} strokeColor={colors.border} strokeWidth={StyleSheet.hairlineWidth}>
                      <Ionicons name="close" size={18} color={colors.text} />
                    </Squircle>
                  </Pressable>
                  <Pressable
                    onPress={() => navPush({ pathname: '/chat', params: { name: p.name, image: p.images[0], online: 'false' } })}
                    style={({ pressed }) => [pressed && { opacity: 0.65 }, { flex: 1 }]}
                    hitSlop={6}
                  >
                    <Squircle style={styles.msgBtn} cornerRadius={50} cornerSmoothing={1} fillColor={colors.text}>
                      <Ionicons name="chatbubble" size={14} color={colors.bg} />
                      <Text style={[styles.msgBtnText, { color: colors.bg }]}>Message</Text>
                    </Squircle>
                  </Pressable>
                </View>
              </View>
            </Squircle>
          </View>
        ))}
      </View>

      {visible.length === 0 && (
        <View style={styles.emptyWrap}>
          <Squircle style={styles.emptyIcon} cornerRadius={28} cornerSmoothing={1} fillColor={colors.surface}>
            <Ionicons name="briefcase-outline" size={32} color={colors.textTertiary} />
          </Squircle>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No matches yet</Text>
          <Text style={[styles.emptySub, { color: colors.textSecondary }]}>Keep connecting to find your co-founder</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16 },
  pageTitle:    { fontSize: 24, fontFamily: 'ProductSans-Black' },
  pageSub:      { fontSize: 13, fontFamily: 'ProductSans-Regular', marginTop: 2, marginBottom: 16 },

  grid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16 },
  cardWrap:     {},
  card:         { width: '100%', overflow: 'hidden', borderRadius: 24 },
  photoWrap:    { width: LIKED_CARD_W, height: LIKED_PHOTO_H, position: 'relative' },
  photo:        { width: LIKED_CARD_W, height: LIKED_PHOTO_H },
  photoGrad:    { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 10, gap: 2 },
  photoName:    { fontSize: 14, fontFamily: 'ProductSans-Black', color: '#fff' },
  photoRole:    { color: 'rgba(255,255,255,0.8)', fontSize: 10, fontFamily: 'ProductSans-Regular' },
  checkBadge:   { position: 'absolute', top: 10, right: 10, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  linkedInBadge:{ width: 20, height: 20, borderRadius: 5, backgroundColor: '#0A66C2', alignItems: 'center', justifyContent: 'center' },
  linkedInText: { fontSize: 11, fontFamily: 'ProductSans-Black', color: '#fff' },

  infoRow:      { padding: 10, gap: 8 },
  chip:         { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5 },
  chipLabel:    { fontSize: 12, fontFamily: 'ProductSans-Medium' },
  actions:      { flexDirection: 'row', gap: 8, alignItems: 'center' },
  passBtn:      { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  msgBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  msgBtnText:   { fontSize: 13, fontFamily: 'ProductSans-Bold' },

  emptyWrap:    { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyIcon:    { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  emptyTitle:   { fontSize: 18, fontFamily: 'ProductSans-Black' },
  emptySub:     { fontSize: 14, fontFamily: 'ProductSans-Regular', textAlign: 'center' },
});
