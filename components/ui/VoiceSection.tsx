/**
 * VoiceSection — record up to 2 voice prompts (30s each) with a topic selector.
 * Used inside MyProfilePage.
 *
 * Each clip: { topic: string, url: string, duration_sec: number }
 */
import { Ionicons } from '@expo/vector-icons';
import {
  RecordingPresets,
  createAudioPlayer,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { API_V1, apiFetch } from '@/constants/api';
import { useAuth } from '@/context/AuthContext';
import { useProfileSave } from '@/hooks/useProfileSave';
import type { AppColors } from '@/constants/appColors';

// ─── Topic options ────────────────────────────────────────────────────────────

const TOPICS = [
  'About my life',
  'My passions',
  'Two truths and a lie',
  'My dream weekend',
  'What makes me laugh',
  'My biggest adventure',
  'What I\'m looking for',
  'My guilty pleasure',
  'A fun fact about me',
  'My love language',
  'Morning or night person',
  'My perfect day',
  'Favourite travel memory',
  'What I value most',
  'My hidden talent',
];

// ─── Types ────────────────────────────────────────────────────────────────────

export type VoicePrompt = { topic: string; url: string; duration_sec: number };

interface Props {
  colors: AppColors;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(sec: number) {
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ─── Topic picker modal ───────────────────────────────────────────────────────

function TopicPicker({
  visible,
  onSelect,
  onClose,
  colors,
}: {
  visible: boolean;
  onSelect: (t: string) => void;
  onClose: () => void;
  colors: AppColors;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
        <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
        <Text style={[styles.sheetTitle, { color: colors.text }]}>Choose a topic</Text>
        <FlatList
          data={TOPICS}
          keyExtractor={t => t}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                styles.topicRow,
                { borderBottomColor: colors.border, opacity: pressed ? 0.6 : 1 },
              ]}
              onPress={() => { onSelect(item); onClose(); }}
            >
              <Text style={[styles.topicText, { color: colors.text }]}>{item}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            </Pressable>
          )}
        />
      </View>
    </Modal>
  );
}

// ─── Single clip card ─────────────────────────────────────────────────────────

function ClipCard({
  clip,
  onDelete,
  colors,
}: {
  clip: VoicePrompt;
  onDelete: () => void;
  colors: AppColors;
}) {
  const playerRef = useRef<any>(null);
  const subsRef   = useRef<any[]>([]);

  const [playing, setPlaying] = useState(false);
  const [pos,     setPos]     = useState(0);

  // Tear down the player when the card unmounts
  useEffect(() => {
    return () => {
      subsRef.current.forEach(s => s.remove());
      subsRef.current = [];
      playerRef.current?.remove();
      playerRef.current = null;
    };
  }, []);

  const togglePlay = async () => {
    if (playing) {
      setPlaying(false);
      playerRef.current?.pause();
      return;
    }
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    try {
      if (playerRef.current) {
        setPlaying(true);
        playerRef.current.play();
        return;
      }
      // First tap — create the player lazily
      const player = createAudioPlayer({ uri: clip.url });
      subsRef.current = [
        player.addListener('playbackStatusUpdate', (s: any) => {
          setPos(s.currentTime ?? 0);
        }),
        player.addListener('playToEnd', () => {
          setPlaying(false);
          setPos(0);
          player.seekTo(0);
        }),
      ];
      playerRef.current = player;
      setPlaying(true);
      player.play();
    } catch {
      setPlaying(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Remove clip', 'Delete this voice prompt?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: () => {
          playerRef.current?.pause();
          playerRef.current?.remove();
          playerRef.current = null;
          subsRef.current.forEach(s => s.remove());
          subsRef.current = [];
          onDelete();
        },
      },
    ]);
  };

  const progress = clip.duration_sec > 0 ? Math.min(pos / clip.duration_sec, 1) : 0;

  return (
    <View style={[styles.clipCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.clipTop}>
        <Text style={[styles.clipTopic, { color: colors.text }]}>{clip.topic}</Text>
        <Pressable onPress={handleDelete} hitSlop={8}>
          <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* Progress bar */}
      <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
        <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: colors.text }]} />
      </View>

      <View style={styles.clipBottom}>
        <Pressable
          style={[styles.playBtn, { backgroundColor: colors.text }]}
          onPress={togglePlay}
        >
          <Ionicons name={playing ? 'pause' : 'play'} size={16} color={colors.bg} />
        </Pressable>
        <Text style={[styles.clipDur, { color: colors.textSecondary }]}>
          {fmt(playing ? pos : clip.duration_sec)}
        </Text>
      </View>
    </View>
  );
}

// ─── Recorder ────────────────────────────────────────────────────────────────

function Recorder({
  onDone,
  onCancel,
  colors,
}: {
  onDone: (uri: string, duration: number) => void;
  onCancel: () => void;
  colors: AppColors;
}) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isActive, setIsActive] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const MAX = 30;

  const stop = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsActive(false);
    await recorder.stop();
    const uri = recorder.uri;
    const duration = recorder.currentTime || elapsed;
    if (uri) onDone(uri, duration);
  };

  const start = async () => {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        Alert.alert('Microphone access needed', 'Please allow microphone access in Settings.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsActive(true);
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed(e => {
          if (e + 1 >= MAX) { stop(); return MAX; }
          return e + 1;
        });
      }, 1000);
    } catch {
      Alert.alert('Microphone access needed', 'Please allow microphone access in Settings.');
    }
  };

  useEffect(() => {
    start();
    return () => {
      timerRef.current && clearInterval(timerRef.current);
      try {
        if (recorder.isRecording) recorder.stop();
      } catch {}
    };
  }, []);

  const recording = isActive;

  const remaining = MAX - elapsed;
  const pct = elapsed / MAX;

  return (
    <View style={[styles.recorder, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.recTitle, { color: colors.text }]}>Recording…</Text>

      {/* Circular progress feel via arc-ish bar */}
      <View style={[styles.recTrack, { backgroundColor: colors.border }]}>
        <View style={[styles.recFill, { width: `${pct * 100}%`, backgroundColor: '#e53935' }]} />
      </View>

      <Text style={[styles.recTime, { color: remaining <= 5 ? '#e53935' : colors.text }]}>
        {remaining}s remaining
      </Text>

      <View style={styles.recRow}>
        <Pressable style={[styles.recBtn, { backgroundColor: colors.border }]} onPress={onCancel}>
          <Text style={{ color: colors.text, fontFamily: 'ProductSans-Medium' }}>Cancel</Text>
        </Pressable>
        <Pressable style={[styles.recBtn, { backgroundColor: '#e53935' }]} onPress={stop}>
          <Ionicons name="stop" size={18} color="#fff" />
          <Text style={{ color: '#fff', fontFamily: 'ProductSans-Medium', marginLeft: 6 }}>Stop</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Main VoiceSection ────────────────────────────────────────────────────────

export default function VoiceSection({ colors }: Props) {
  const { token, profile, updateProfile } = useAuth();
  const { save } = useProfileSave();

  const [clips, setClips] = useState<VoicePrompt[]>(profile?.voice_prompts ?? []);
  const [showTopicPicker, setShowTopicPicker] = useState(false);
  const [pendingTopic, setPendingTopic] = useState<string | null>(null);
  const [showRecorder, setShowRecorder] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Keep in sync with profile
  useEffect(() => {
    if (profile?.voice_prompts) setClips(profile.voice_prompts);
  }, [profile?.voice_prompts]);

  const persist = async (updated: VoicePrompt[]) => {
    setClips(updated);
    updateProfile({ voice_prompts: updated });
    await save({ voice_prompts: updated });
  };

  const handleAddPress = () => {
    if (clips.length >= 2) {
      Alert.alert('Limit reached', 'You can add up to 2 voice prompts.');
      return;
    }
    setShowTopicPicker(true);
  };

  const handleTopicSelect = (topic: string) => {
    setPendingTopic(topic);
    setShowRecorder(true);
  };

  const handleRecordDone = async (uri: string, duration: number) => {
    setShowRecorder(false);
    if (!pendingTopic) return;
    setUploading(true);

    try {
      const form = new FormData();
      form.append('file', { uri, name: 'voice.m4a', type: 'audio/m4a' } as any);
      form.append('duration_sec', String(Math.round(duration)));

      const res = await fetch(`${API_V1}/upload/audio`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).detail ?? 'Upload failed');
      }

      const data = await res.json() as { url: string; duration_sec: number };
      const newClip: VoicePrompt = { topic: pendingTopic, url: data.url, duration_sec: data.duration_sec };
      await persist([...clips, newClip]);
    } catch (e: any) {
      Alert.alert('Upload failed', e.message ?? 'Could not upload audio.');
    } finally {
      setUploading(false);
      setPendingTopic(null);
    }
  };

  const handleDelete = async (idx: number) => {
    await persist(clips.filter((_, i) => i !== idx));
  };

  return (
    <View>
      {clips.map((clip, idx) => (
        <ClipCard key={clip.url} clip={clip} onDelete={() => handleDelete(idx)} colors={colors} />
      ))}

      {clips.length < 2 && !showRecorder && (
        <Pressable
          style={[styles.addBtn, { borderColor: colors.border }]}
          onPress={handleAddPress}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <>
              <Ionicons name="mic-outline" size={20} color={colors.text} />
              <Text style={[styles.addText, { color: colors.text }]}>
                {clips.length === 0 ? 'Record a voice prompt' : 'Add another prompt'}
              </Text>
            </>
          )}
        </Pressable>
      )}

      {showRecorder && (
        <Recorder
          colors={colors}
          onDone={handleRecordDone}
          onCancel={() => { setShowRecorder(false); setPendingTopic(null); }}
        />
      )}

      <TopicPicker
        visible={showTopicPicker}
        colors={colors}
        onSelect={handleTopicSelect}
        onClose={() => setShowTopicPicker(false)}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Clip card
  clipCard: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 10 },
  clipTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  clipTopic: { fontSize: 15, fontFamily: 'ProductSans-Bold', flex: 1, marginRight: 8 },
  progressTrack: { height: 4, borderRadius: 2, overflow: 'hidden', marginBottom: 10 },
  progressFill: { height: 4, borderRadius: 2 },
  clipBottom: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  playBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  clipDur: { fontSize: 13, fontFamily: 'ProductSans-Regular' },

  // Add button
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 16,
    paddingVertical: 16, marginBottom: 10,
  },
  addText: { fontSize: 15, fontFamily: 'ProductSans-Medium' },

  // Recorder
  recorder: { borderRadius: 16, borderWidth: 1, padding: 18, marginBottom: 10 },
  recTitle: { fontSize: 16, fontFamily: 'ProductSans-Bold', textAlign: 'center', marginBottom: 14 },
  recTrack: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 10 },
  recFill: { height: 6, borderRadius: 3 },
  recTime: { fontSize: 14, fontFamily: 'ProductSans-Medium', textAlign: 'center', marginBottom: 16 },
  recRow: { flexDirection: 'row', gap: 10 },
  recBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 12, gap: 4,
  },

  // Topic sheet
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '70%' },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontFamily: 'ProductSans-Bold', marginBottom: 12 },
  topicRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topicText: { fontSize: 15, fontFamily: 'ProductSans-Regular' },
});
