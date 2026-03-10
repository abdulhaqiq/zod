import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import ChipSelectorSheet, { type ChipOption } from '@/components/ui/ChipSelectorSheet';
import ScreenHeader from '@/components/ui/ScreenHeader';
import Squircle from '@/components/ui/Squircle';
import { API_BASE } from '@/constants/api';
import { apiFetch } from '@/constants/api';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';
import type { AppColors } from '@/constants/appColors';

const { width: W } = Dimensions.get('window');
const GRID_PADDING = 12;
const GRID_GAP = 8;
const SLOT_SIZE = (W - 32 - GRID_PADDING * 2 - GRID_GAP * 2) / 3;

// ─── Chip data ────────────────────────────────────────────────────────────────

const INTERESTS: ChipOption[] = [
  { emoji: '☕', label: 'Coffee' },    { emoji: '✈️', label: 'Travel' },
  { emoji: '📚', label: 'Books' },     { emoji: '🎨', label: 'Art' },
  { emoji: '🎵', label: 'Music' },     { emoji: '🎮', label: 'Gaming' },
  { emoji: '🍕', label: 'Food' },      { emoji: '🧘', label: 'Yoga' },
  { emoji: '🏋️', label: 'Fitness' },  { emoji: '📸', label: 'Photography' },
  { emoji: '🍷', label: 'Wine' },      { emoji: '🥾', label: 'Hiking' },
  { emoji: '🎬', label: 'Movies' },    { emoji: '🌿', label: 'Nature' },
  { emoji: '🧁', label: 'Baking' },    { emoji: '🎤', label: 'Karaoke' },
  { emoji: '🐾', label: 'Pets' },      { emoji: '🏄', label: 'Surfing' },
  { emoji: '🎸', label: 'Guitar' },    { emoji: '🌍', label: 'Languages' },
  { emoji: '🏀', label: 'Basketball' }, { emoji: '⚽', label: 'Football' },
  { emoji: '🎭', label: 'Theatre' },   { emoji: '🚴', label: 'Cycling' },
];

const CAUSES: ChipOption[] = [
  { emoji: '🌍', label: 'Environment' },     { emoji: '📖', label: 'Education' },
  { emoji: '💚', label: 'Mental Health' },   { emoji: '🏳️‍🌈', label: 'LGBTQ+' },
  { emoji: '🤝', label: 'Volunteering' },    { emoji: '🐾', label: 'Animal Rights' },
  { emoji: '🌱', label: 'Sustainability' },  { emoji: '⚖️', label: 'Social Justice' },
  { emoji: '🏥', label: 'Healthcare' },      { emoji: '🌊', label: 'Ocean Conservation' },
  { emoji: '🍎', label: 'Food Security' },   { emoji: '👶', label: 'Child Welfare' },
  { emoji: '🕊️', label: 'Peace' },          { emoji: '🏘️', label: 'Community' },
  { emoji: '💡', label: 'Innovation' },      { emoji: '🎓', label: 'Scholarships' },
];

const QUALITIES: ChipOption[] = [
  { emoji: '💫', label: 'Loyalty' },         { emoji: '🤝', label: 'Honesty' },
  { emoji: '😄', label: 'Humor' },            { emoji: '🚀', label: 'Ambition' },
  { emoji: '💛', label: 'Kindness' },         { emoji: '🧠', label: 'Intelligence' },
  { emoji: '🎯', label: 'Drive' },            { emoji: '🌈', label: 'Open-mindedness' },
  { emoji: '💪', label: 'Confidence' },       { emoji: '🎭', label: 'Creativity' },
  { emoji: '🤗', label: 'Empathy' },          { emoji: '🏆', label: 'Resilience' },
  { emoji: '✨', label: 'Authenticity' },     { emoji: '🌱', label: 'Growth mindset' },
  { emoji: '🎶', label: 'Passion' },          { emoji: '🦁', label: 'Courage' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SectionLabel({ title, colors }: { title: string; colors: AppColors }) {
  return (
    <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{title}</Text>
  );
}

function Group({ children, colors }: { children: React.ReactNode; colors: AppColors }) {
  return (
    <Squircle style={styles.group} cornerRadius={22} cornerSmoothing={1}
      fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
      {children}
    </Squircle>
  );
}

function EditRow({
  icon, label, value, preview, onPress, colors, accentIcon = false, last = false,
}: {
  icon: any; label: string; value?: string; preview?: string; onPress?: () => void;
  colors: AppColors; accentIcon?: boolean; last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.editRow,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
        pressed && { opacity: 0.65 },
      ]}
    >
      <Squircle style={styles.editIconWrap} cornerRadius={10} cornerSmoothing={1}
        fillColor={accentIcon ? '#833ab4' : colors.surface2}>
        <Ionicons name={icon} size={16} color={accentIcon ? '#fff' : colors.text} />
      </Squircle>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={[styles.editLabel, { color: colors.text }]}>{label}</Text>
        {preview ? (
          <Text style={[styles.editPreview, { color: colors.textSecondary }]} numberOfLines={1}>
            {preview}
          </Text>
        ) : null}
      </View>
      {value ? <Text style={[styles.editValue, { color: colors.textSecondary }]}>{value}</Text> : null}
      <Ionicons name="chevron-forward" size={15} color={colors.textSecondary} />
    </Pressable>
  );
}

// ─── Photo Grid ───────────────────────────────────────────────────────────────

function PhotoGrid({
  photos, onPhotosChange, colors,
}: {
  photos: (string | null)[];
  onPhotosChange: (next: (string | null)[]) => void;
  colors: AppColors;
}) {
  const [uploading, setUploading] = useState<number | null>(null);
  const { token } = useAuth();

  const pickPhoto = async (index: number) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access in Settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    setUploading(index);
    try {
      const form = new FormData();
      form.append('file', {
        uri: asset.uri,
        name: asset.fileName ?? 'photo.jpg',
        type: asset.mimeType ?? 'image/jpeg',
      } as any);

      const res = await apiFetch(`${API_BASE}/api/v1/upload/photo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        Alert.alert('Photo rejected', (err as any).detail ?? 'Upload failed');
        return;
      }

      const data = await res.json() as { url: string };
      const next = [...photos];
      next[index] = data.url;
      onPhotosChange(next);
    } catch (e) {
      Alert.alert('Upload failed', 'Please try again.');
    } finally {
      setUploading(null);
    }
  };

  const removePhoto = (index: number) => {
    Alert.alert('Remove Photo', 'Remove this photo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: () => {
          const next = [...photos];
          next[index] = null;
          onPhotosChange(next);
        },
      },
    ]);
  };

  return (
    <View style={styles.photoGrid}>
      {photos.map((uri, i) => (
        <Pressable
          key={i}
          onPress={() => uploading === null && (uri ? removePhoto(i) : pickPhoto(i))}
          style={({ pressed }) => [
            styles.photoSlot,
            { backgroundColor: colors.surface2, borderColor: colors.border },
            pressed && { opacity: 0.75 },
          ]}
        >
          {uploading === i ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : uri ? (
            <>
              <Image source={{ uri }} style={styles.photoImg} resizeMode="cover" />
              <Pressable style={styles.photoRemoveBtn} onPress={() => removePhoto(i)} hitSlop={4}>
                <View style={styles.photoRemoveBg}>
                  <Ionicons name="close" size={12} color="#fff" />
                </View>
              </Pressable>
            </>
          ) : (
            <Ionicons name="add" size={24} color={colors.textTertiary} />
          )}
        </Pressable>
      ))}
    </View>
  );
}

// ─── Best Photo Row (with Switch) ─────────────────────────────────────────────

function BestPhotoRow({ colors }: { colors: AppColors }) {
  const [enabled, setEnabled] = useState(false);
  return (
    <View style={[
      styles.editRow,
      { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    ]}>
      <Squircle style={styles.editIconWrap} cornerRadius={10} cornerSmoothing={1} fillColor={colors.surface2}>
        <Ionicons name="star-outline" size={16} color={colors.text} />
      </Squircle>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={[styles.editLabel, { color: colors.text }]}>Best Photo</Text>
        <Text style={[styles.editPreview, { color: colors.textSecondary }]}>
          {enabled ? 'Highlighted on your profile' : 'Highlight your favourite shot'}
        </Text>
      </View>
      <Switch
        value={enabled}
        onValueChange={setEnabled}
        thumbColor={colors.bg}
        trackColor={{ false: colors.surface2, true: colors.text }}
      />
    </View>
  );
}

// ─── Chip Edit Row ────────────────────────────────────────────────────────────

function ChipEditRow({
  icon, label, selected, onPress, colors, last = false,
}: {
  icon: any; label: string; selected: string[]; onPress: () => void;
  colors: AppColors; last?: boolean;
}) {
  const preview = selected.length > 0
    ? selected.slice(0, 3).join(' · ') + (selected.length > 3 ? ` +${selected.length - 3}` : '')
    : undefined;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.editRow,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
        pressed && { opacity: 0.65 },
      ]}
    >
      <Squircle style={styles.editIconWrap} cornerRadius={10} cornerSmoothing={1} fillColor={colors.surface2}>
        <Ionicons name={icon} size={16} color={colors.text} />
      </Squircle>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={[styles.editLabel, { color: colors.text }]}>{label}</Text>
        {preview ? (
          <Text style={[styles.editPreview, { color: colors.textSecondary }]} numberOfLines={1}>{preview}</Text>
        ) : (
          <Text style={[styles.editPreview, { color: colors.textTertiary }]}>Tap to select</Text>
        )}
      </View>
      {selected.length > 0 && (
        <View style={[styles.chipCountBadge, { backgroundColor: colors.surface2 }]}>
          <Text style={[styles.chipCountText, { color: colors.text }]}>{selected.length}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={15} color={colors.textSecondary} />
    </Pressable>
  );
}

// ─── Edit Profile Page ────────────────────────────────────────────────────────

export default function EditProfilePage() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { profile, token, updateProfile } = useAuth();

  // ── Photos ───────────────────────────────────────────────────────────────
  const buildPhotoSlots = (urls: string[] | null): (string | null)[] => {
    const filled = (urls ?? []).slice(0, 6);
    const slots: (string | null)[] = [...filled];
    while (slots.length < 6) slots.push(null);
    return slots;
  };

  const [photos, setPhotos] = useState<(string | null)[]>(() =>
    buildPhotoSlots(profile?.photos ?? null)
  );

  // ── Bio ──────────────────────────────────────────────────────────────────
  const [bio, setBio] = useState(profile?.bio ?? '');
  const MAX_BIO = 300;

  // ── Chip selections ───────────────────────────────────────────────────────
  const [interests, setInterests]   = useState<string[]>(profile?.interests ?? []);
  const [causes, setCauses]         = useState<string[]>(profile?.causes ?? []);
  const [qualities, setQualities]   = useState<string[]>(profile?.values_list ?? []);

  const [showInterests, setShowInterests]   = useState(false);
  const [showCauses, setShowCauses]         = useState(false);
  const [showQualities, setShowQualities]   = useState(false);

  const [saving, setSaving] = useState(false);

  // Patch helper
  const patch = useCallback(async (payload: Record<string, unknown>) => {
    try {
      const res = await apiFetch(`${API_BASE}/api/v1/profile/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const updated = await res.json();
        updateProfile(updated);
      }
    } catch {
      // silently fail — local state still updated
    }
  }, [token, updateProfile]);

  // Auto-save photos whenever the slots change
  const isFirstMount = useRef(true);
  useEffect(() => {
    if (isFirstMount.current) { isFirstMount.current = false; return; }
    const urls = photos.filter((u): u is string => !!u);
    patch({ photos: urls });
  }, [photos]);

  // Auto-save chip arrays on close
  const saveInterests = useCallback((vals: string[]) => {
    setInterests(vals);
    setShowInterests(false);
    patch({ interests: vals });
  }, [patch]);

  const saveCauses = useCallback((vals: string[]) => {
    setCauses(vals);
    setShowCauses(false);
    patch({ causes: vals });
  }, [patch]);

  const saveQualities = useCallback((vals: string[]) => {
    setQualities(vals);
    setShowQualities(false);
    patch({ values_list: vals });
  }, [patch]);

  // ── Derived display values ────────────────────────────────────────────────
  const workLabel = (() => {
    const we = profile?.work_experience;
    if (!we?.length) return undefined;
    const latest = we[0];
    const parts = [latest.job_title, latest.company].filter(Boolean);
    return parts.join(' · ') || undefined;
  })();

  const eduLabel = (() => {
    const ed = profile?.education;
    if (!ed?.length) return undefined;
    const latest = ed[0];
    const parts = [latest.institution, latest.course].filter(Boolean);
    return parts.join(' – ') || undefined;
  })();

  const handleSave = async () => {
    setSaving(true);
    await patch({ bio: bio.trim() || null });
    setSaving(false);
    router.back();
  };

  return (
    <View style={[styles.safe, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScreenHeader
          title="Edit Profile"
          onClose={() => router.back()}
          rightLabel={saving ? '…' : 'Save'}
          onRightPress={saving ? undefined : handleSave}
          colors={colors}
        />

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── PHOTOS & VIDEOS ─────────────────────────────────────────── */}
          <View style={styles.section}>
            <SectionLabel title="PHOTOS & VIDEOS" colors={colors} />
            <Group colors={colors}>
              <View style={styles.photosInner}>
                <PhotoGrid photos={photos} onPhotosChange={setPhotos} colors={colors} />
                <Pressable style={[styles.videoBtn, { borderColor: colors.border, backgroundColor: colors.surface2 }]}>
                  <Ionicons name="videocam-outline" size={18} color={colors.text} />
                  <Text style={[styles.videoBtnText, { color: colors.text }]}>Add Video Loop</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} style={{ marginLeft: 'auto' }} />
                </Pressable>
              </View>
            </Group>
          </View>

          {/* ── MEDIA ──────────────────────────────────────────────────── */}
          <View style={styles.section}>
            <SectionLabel title="MEDIA" colors={colors} />
            <Group colors={colors}>
              <BestPhotoRow colors={colors} />
              <EditRow
                icon="checkmark-circle-outline"
                label="Verification"
                value="Get Verified"
                onPress={() => router.push('/verification')}
                colors={colors}
                last
              />
            </Group>
          </View>

          {/* ── PERSONALITY ─────────────────────────────────────────────── */}
          <View style={styles.section}>
            <SectionLabel title="PERSONALITY" colors={colors} />
            <Group colors={colors}>
              <ChipEditRow
                icon="heart-outline"
                label="Interests"
                selected={interests}
                onPress={() => setShowInterests(true)}
                colors={colors}
              />
              <ChipEditRow
                icon="globe-outline"
                label="Causes & Communities"
                selected={causes}
                onPress={() => setShowCauses(true)}
                colors={colors}
              />
              <ChipEditRow
                icon="diamond-outline"
                label="Qualities I Value"
                selected={qualities}
                onPress={() => setShowQualities(true)}
                colors={colors}
                last
              />
            </Group>
          </View>

          {/* ── BIO ─────────────────────────────────────────────────────── */}
          <View style={styles.section}>
            <SectionLabel title="BIO" colors={colors} />
            <View style={styles.bioWrap}>
              <Squircle
                style={styles.bioBox}
                cornerRadius={18} cornerSmoothing={1}
                fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1.5}
              >
                <TextInput
                  style={[styles.bioInput, { color: colors.text }]}
                  placeholder="Write something about yourself…"
                  placeholderTextColor={colors.placeholder}
                  value={bio}
                  onChangeText={t => setBio(t.slice(0, MAX_BIO))}
                  multiline maxLength={MAX_BIO}
                  selectionColor={colors.text}
                />
              </Squircle>
              <Text style={[styles.bioCount, { color: colors.textTertiary }]}>
                {bio.length}/{MAX_BIO}
              </Text>
            </View>
          </View>

          {/* ── IDENTITY ────────────────────────────────────────────────── */}
          <View style={styles.section}>
            <SectionLabel title="IDENTITY" colors={colors} />
            <Group colors={colors}>
              <EditRow
                icon="person-outline"
                label="Gender"
                value={profile?.gender ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1) : undefined}
                onPress={() =>
                  Alert.alert(
                    "Can't change gender",
                    'Your gender cannot be changed once it has been set.',
                    [{ text: 'OK' }]
                  )
                }
                colors={colors}
                last
              />
            </Group>
          </View>

          {/* ── WORK & EDUCATION ────────────────────────────────────────── */}
          <View style={styles.section}>
            <SectionLabel title="WORK & EDUCATION" colors={colors} />
            <Group colors={colors}>
              <EditRow
                icon="briefcase-outline"
                label="Work"
                value={workLabel}
                preview={workLabel ? undefined : 'Tap to add'}
                onPress={() => router.push('/work-experience')}
                colors={colors}
              />
              <EditRow
                icon="school-outline"
                label="Education"
                value={eduLabel}
                preview={eduLabel ? undefined : 'Tap to add'}
                onPress={() => router.push('/education')}
                colors={colors}
                last
              />
            </Group>
          </View>

          {/* ── LOCATION ────────────────────────────────────────────────── */}
          <View style={styles.section}>
            <SectionLabel title="LOCATION" colors={colors} />
            <Group colors={colors}>
              <EditRow
                icon="location-outline"
                label="Living Now"
                value={profile?.city ?? undefined}
                preview={profile?.city ? undefined : 'Tap to set'}
                onPress={() => router.push('/location-search?type=living')}
                colors={colors}
              />
              <EditRow
                icon="home-outline"
                label="Hometown"
                value={profile?.hometown ?? undefined}
                preview={profile?.hometown ? undefined : 'Tap to set'}
                onPress={() => router.push('/location-search?type=hometown')}
                colors={colors}
                last
              />
            </Group>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Chip selector sheets ─────────────────────────────────────────── */}
      <ChipSelectorSheet
        visible={showInterests}
        onClose={() => setShowInterests(false)}
        title="Interests"
        subtitle="Pick up to 5 things you love"
        maxSelect={5}
        options={INTERESTS}
        selected={interests}
        onChange={saveInterests}
        colors={colors}
      />
      <ChipSelectorSheet
        visible={showCauses}
        onClose={() => setShowCauses(false)}
        title="Causes & Communities"
        subtitle="What causes matter to you?"
        maxSelect={6}
        options={CAUSES}
        selected={causes}
        onChange={saveCauses}
        colors={colors}
      />
      <ChipSelectorSheet
        visible={showQualities}
        onClose={() => setShowQualities(false)}
        title="Qualities I Value"
        subtitle="Pick traits you look for in a partner"
        maxSelect={5}
        options={QUALITIES}
        selected={qualities}
        onChange={saveQualities}
        colors={colors}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:         { flex: 1 },
  flex:         { flex: 1 },
  scroll:       { paddingBottom: 48 },

  section:      { paddingHorizontal: 16, marginTop: 22, gap: 6 },
  sectionLabel: { fontSize: 12, fontFamily: 'ProductSans-Bold', letterSpacing: 1.5, marginLeft: 2, marginBottom: 2 },

  group:        { overflow: 'hidden' },

  editRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13 },
  editIconWrap: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  editLabel:    { fontSize: 14, fontFamily: 'ProductSans-Regular' },
  editPreview:  { fontSize: 11, fontFamily: 'ProductSans-Regular' },
  editValue:    { fontSize: 12, fontFamily: 'ProductSans-Regular', maxWidth: 130, textAlign: 'right' },

  chipCountBadge: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginRight: 2 },
  chipCountText:  { fontSize: 11, fontFamily: 'ProductSans-Bold' },

  photosInner:    { padding: GRID_PADDING, gap: GRID_GAP },
  photoGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  photoSlot:      {
    width: SLOT_SIZE,
    height: SLOT_SIZE / 2,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoImg:       { width: '100%', height: '100%' },
  photoRemoveBtn: { position: 'absolute', top: 4, right: 4 },
  photoRemoveBg:  { width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },

  videoBtn:       { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 13 },
  videoBtnText:   { fontSize: 14, fontFamily: 'ProductSans-Regular' },

  bioWrap:        { gap: 6 },
  bioBox:         { padding: 14, minHeight: 120 },
  bioInput:       { fontSize: 15, fontFamily: 'ProductSans-Regular', lineHeight: 22, textAlignVertical: 'top' },
  bioCount:       { fontSize: 11, fontFamily: 'ProductSans-Regular', textAlign: 'right', marginRight: 4 },
});
