import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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
  Text,
  TextInput,
  View,
} from 'react-native';
import ChipSelectorSheet, { type ChipOption } from '@/components/ui/ChipSelectorSheet';
import ScreenHeader from '@/components/ui/ScreenHeader';
import Squircle from '@/components/ui/Squircle';
import { API_V1, apiFetch } from '@/constants/api';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';
import type { AppColors } from '@/constants/appColors';
import { fetchWorkLookups, getCachedWorkLookups } from '@/utils/workLookups';

// ─── Photo grid constants ─────────────────────────────────────────────────────

const SCREEN_W   = Dimensions.get('window').width;
const GRID_PAD   = 16;
const GRID_GAP   = 8;
const SLOT_SIZE  = (SCREEN_W - GRID_PAD * 2 - GRID_GAP * 2) / 3;
const MAX_PHOTOS = 6;

// ─── Photo Grid ───────────────────────────────────────────────────────────────

function PhotoGrid({
  photos, onPhotosChange, colors, token,
}: {
  photos: (string | null)[];
  onPhotosChange: (next: (string | null)[]) => void;
  colors: AppColors;
  token: string | null;
}) {
  const [uploading, setUploading] = useState<number | null>(null);

  const pickPhoto = async (index: number) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'Please allow photo library access in Settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4],
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

      const res = await fetch(`${API_V1}/upload/photo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        Alert.alert('Photo Rejected', (err as any).detail ?? 'Upload failed. Please try again.');
        return;
      }

      const data = await res.json() as { url: string };
      const next = [...photos];
      next[index] = data.url;
      onPhotosChange(next);
    } catch {
      Alert.alert('Upload Failed', 'Please check your connection and try again.');
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
    <View style={pgStyles.grid}>
      {photos.map((uri, i) => (
        <Pressable
          key={i}
          onPress={() => uploading === null && (uri ? removePhoto(i) : pickPhoto(i))}
          style={({ pressed }) => [
            pgStyles.slot,
            { backgroundColor: colors.surface2, borderColor: colors.border },
            pressed && { opacity: 0.75 },
          ]}
        >
          {uploading === i ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : uri ? (
            <>
              <Image source={{ uri }} style={pgStyles.img} resizeMode="cover" />
              <Pressable style={pgStyles.removeBtn} onPress={() => removePhoto(i)} hitSlop={4}>
                <View style={pgStyles.removeBg}>
                  <Ionicons name="close" size={12} color="#fff" />
                </View>
              </Pressable>
            </>
          ) : (
            <Ionicons name="add" size={24} color={colors.textSecondary} />
          )}
        </Pressable>
      ))}
    </View>
  );
}

const pgStyles = StyleSheet.create({
  grid:      { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  slot:      { width: SLOT_SIZE, height: SLOT_SIZE * 1.3, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  img:       { width: '100%', height: '100%' },
  removeBtn: { position: 'absolute', top: 4, right: 4 },
  removeBg:  { width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
});

// ─── Prompt Card ─────────────────────────────────────────────────────────────

function PromptCard({
  index, question, answer, colors,
  onPickQuestion, onChangeAnswer, onRemove,
}: {
  index: number; question: string; answer: string; colors: AppColors;
  onPickQuestion: () => void; onChangeAnswer: (text: string) => void; onRemove: () => void;
}) {
  return (
    <Squircle style={[pcStyles.card, { borderColor: colors.border }]}
      cornerRadius={18} cornerSmoothing={1}
      fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
      <Pressable
        onPress={onPickQuestion}
        style={({ pressed }) => [pcStyles.questionRow, { borderBottomColor: colors.border }, pressed && { opacity: 0.7 }]}
      >
        <Text style={[pcStyles.questionNum, { color: colors.textSecondary }]}>Prompt {index + 1}</Text>
        <Text style={[pcStyles.question, { color: colors.text }]} numberOfLines={2}>
          {question || 'Tap to choose a question'}
        </Text>
        <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
      </Pressable>
      <TextInput
        value={answer}
        onChangeText={onChangeAnswer}
        placeholder="Write your answer…"
        placeholderTextColor={colors.textSecondary}
        multiline
        maxLength={180}
        style={[pcStyles.answerInput, { color: colors.text }]}
      />
      <Pressable onPress={onRemove} style={pcStyles.removeRow} hitSlop={8}>
        <Ionicons name="trash-outline" size={14} color={colors.textSecondary} />
        <Text style={[pcStyles.removeText, { color: colors.textSecondary }]}>Remove prompt</Text>
      </Pressable>
    </Squircle>
  );
}

const pcStyles = StyleSheet.create({
  card:        { overflow: 'hidden', marginBottom: 10 },
  questionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  questionNum: { fontSize: 11, fontFamily: 'ProductSans-Bold', letterSpacing: 0.8 },
  question:    { flex: 1, fontSize: 13, fontFamily: 'ProductSans-Bold' },
  answerInput: { padding: 14, minHeight: 80, fontSize: 14, fontFamily: 'ProductSans-Regular', textAlignVertical: 'top' },
  removeRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 12, paddingTop: 0 },
  removeText:  { fontSize: 12, fontFamily: 'ProductSans-Regular' },
});

// ─── Main Page ────────────────────────────────────────────────────────────────

interface WorkPrompt { question: string; answer: string; }

export default function WorkEditProfilePage() {
  const router = useRouter();
  const { token, profile, updateProfile } = useAuth();
  const { colors } = useAppTheme();

  // Fetch prompt questions from DB via shared lookup cache
  const [promptQuestions, setPromptQuestions] = useState<ChipOption[]>(
    getCachedWorkLookups()?.work_prompt_questions ?? []
  );
  const promptsLoaded = useRef(false);
  useEffect(() => {
    if (promptsLoaded.current) return;
    promptsLoaded.current = true;
    fetchWorkLookups().then(map => setPromptQuestions(map.work_prompt_questions ?? []));
  }, []);

  const [photos,  setPhotos]  = useState<(string | null)[]>(() => {
    const p = profile?.work_photos ?? [];
    const arr: (string | null)[] = [...p];
    while (arr.length < MAX_PHOTOS) arr.push(null);
    return arr;
  });

  const [prompts, setPrompts] = useState<WorkPrompt[]>(() => {
    const raw = (profile?.work_prompts as WorkPrompt[] | null) ?? [];
    return raw.slice(0, 2);
  });

  const [saving, setSaving] = useState(false);

  // Chip picker for question selection
  interface ChipState { promptIndex: number; selected: string[]; }
  const [chipPicker, setChipPicker] = useState<ChipState | null>(null);

  // Sync on profile load
  useEffect(() => {
    if (!profile) return;
    const p = profile.work_photos ?? [];
    const arr: (string | null)[] = [...p];
    while (arr.length < MAX_PHOTOS) arr.push(null);
    setPhotos(arr);
    setPrompts((profile.work_prompts as WorkPrompt[] | null ?? []).slice(0, 2));
  }, [profile?.id]);

  const saveAll = async (photosArr: (string | null)[], promptsArr: WorkPrompt[]) => {
    setSaving(true);
    try {
      const cleanPhotos = photosArr.filter(Boolean) as string[];
      const cleanPrompts = promptsArr.filter(p => p.question || p.answer);
      await apiFetch('/profile/me', {
        method: 'PATCH', token: token ?? undefined,
        body: JSON.stringify({ work_photos: cleanPhotos, work_prompts: cleanPrompts }),
      });
      updateProfile({ work_photos: cleanPhotos, work_prompts: cleanPrompts } as any);
    } catch {
      Alert.alert('Error', 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handlePhotosChange = (next: (string | null)[]) => {
    setPhotos(next);
    saveAll(next, prompts);
  };

  const addPrompt = () => {
    if (prompts.length >= 2) return;
    const next = [...prompts, { question: '', answer: '' }];
    setPrompts(next);
  };

  const updatePrompt = (index: number, patch: Partial<WorkPrompt>) => {
    const next = prompts.map((p, i) => i === index ? { ...p, ...patch } : p);
    setPrompts(next);
    saveAll(photos, next);
  };

  const removePrompt = (index: number) => {
    const next = prompts.filter((_, i) => i !== index);
    setPrompts(next);
    saveAll(photos, next);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader
        title="Work Profile"
        rightLabel={saving ? 'Saving…' : undefined}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{ padding: GRID_PAD, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Photos ──────────────────────────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>WORK PHOTOS</Text>
        <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>
          Use professional or founder-style photos · up to {MAX_PHOTOS}
        </Text>
        <PhotoGrid
          photos={photos}
          onPhotosChange={handlePhotosChange}
          colors={colors}
          token={token}
        />

        {/* ── Prompts ──────────────────────────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: 28 }]}>WORK PROMPTS</Text>
        <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>
          2 prompts · let your work personality shine
        </Text>

        {prompts.map((p, i) => (
          <PromptCard
            key={i}
            index={i}
            question={p.question}
            answer={p.answer}
            colors={colors}
            onPickQuestion={() => setChipPicker({ promptIndex: i, selected: p.question ? [p.question] : [] })}
            onChangeAnswer={(text) => updatePrompt(i, { answer: text })}
            onRemove={() => removePrompt(i)}
          />
        ))}

        {prompts.length < 2 && (
          <Pressable
            onPress={addPrompt}
            style={({ pressed }) => [
              styles.addBtn,
              { borderColor: colors.border, backgroundColor: colors.surface },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons name="add-circle-outline" size={18} color={colors.text} />
            <Text style={[styles.addBtnText, { color: colors.text }]}>Add prompt</Text>
          </Pressable>
        )}
      </ScrollView>

      {/* ── Chip picker for prompt question ─────────────────────────────── */}
      {chipPicker !== null && (
        <ChipSelectorSheet
          visible
          onClose={() => setChipPicker(null)}
          title="Choose a Question"
          singleSelect
          maxSelect={1}
          options={promptQuestions.length ? promptQuestions : [{ label: 'Loading…' }]}
          selected={chipPicker.selected}
          onChange={([val]) => {
            updatePrompt(chipPicker.promptIndex, { question: val });
            setChipPicker(null);
          }}
          colors={colors}
        />
      )}
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  sectionLabel: { fontSize: 12, fontFamily: 'ProductSans-Bold', letterSpacing: 1.5, marginBottom: 4 },
  sectionSub:   { fontSize: 12, fontFamily: 'ProductSans-Regular', marginBottom: 12 },
  addBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingVertical: 14 },
  addBtnText:   { fontSize: 14, fontFamily: 'ProductSans-Medium' },
});
