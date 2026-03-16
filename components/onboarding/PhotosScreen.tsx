// Step 10 — Photos (final step, sets is_onboarded=true)
import * as ImagePicker from 'expo-image-picker';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';
import { API_V1 } from '@/constants/api';
import { useProfileSave } from '@/hooks/useProfileSave';
import OnboardingShell from './OnboardingShell';

const MAX_PHOTOS = 6;

export default function PhotosScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { save, saving } = useProfileSave();
  const { token, setOnboarded, profile } = useAuth();

  // photos: CDN URLs — initialise from saved profile so restarts show existing uploads
  const [photos, setPhotos] = useState<string[]>(profile?.photos ?? []);
  // uploading: track which slot index is uploading
  const [uploading, setUploading] = useState<number | null>(null);

  // Keep a ref so the auto-save after upload always sees the latest list
  const photosRef = useRef<string[]>(profile?.photos ?? []);

  // Maps backend rejection reasons to user-friendly titles + icons
  const getRejectionTitle = (detail: string): string => {
    const d = detail.toLowerCase();
    if (d.includes('face'))      return 'No Face Detected';
    if (d.includes('blurry') || d.includes('blur')) return 'Photo Too Blurry';
    if (d.includes('watermark') || d.includes('text overlay')) return 'Watermark Detected';
    if (d.includes('explicit') || d.includes('nsfw')) return 'Explicit Content';
    if (d.includes('under 18') || d.includes('age')) return 'Age Restriction';
    if (d.includes('similar') || d.includes('duplicate')) return 'Duplicate Photo';
    if (d.includes('analysed') || d.includes('analyzed')) return 'Photo Could Not Be Checked';
    return 'Photo Not Accepted';
  };

  const pickAndUpload = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
      aspect: [3, 4],
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const slotIndex = photosRef.current.length;
    setUploading(slotIndex);

    try {
      const form = new FormData();
      form.append('file', {
        uri: asset.uri,
        name: asset.fileName ?? `photo_${Date.now()}.jpg`,
        type: asset.mimeType ?? 'image/jpeg',
      } as any);

      const res = await fetch(`${API_V1}/upload/photo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      const data = await res.json();

      // Analysis rejected the photo — show the specific reason
      if (!res.ok) {
        const detail: string = data?.detail ?? 'Please try a different photo.';
        Alert.alert(getRejectionTitle(detail), detail);
        return;
      }

      // Analysis passed — add to grid and persist
      const updated = [...photosRef.current, data.url].slice(0, MAX_PHOTOS);
      photosRef.current = updated;
      setPhotos(updated);
      await save({ photos: updated });
    } catch (err: any) {
      Alert.alert('Upload failed', 'Could not connect to server. Please check your connection.');
    } finally {
      setUploading(null);
    }
  };

  const removePhoto = async (url: string) => {
    const updated = photosRef.current.filter((p) => p !== url);
    photosRef.current = updated;
    setPhotos(updated);
    // Persist removal too
    await save({ photos: updated });
  };

  const handleContinue = async () => {
    if (photos.length < 3) return;
    const ok = await save({ photos, is_onboarded: true });
    if (ok) {
      await setOnboarded();
      router.replace('/(tabs)' as any);
    }
  };

  return (
    <OnboardingShell
      step={10}
      title="Add your photos"
      subtitle={`${photos.length} / ${MAX_PHOTOS} added`}
      onContinue={handleContinue}
      continueDisabled={photos.length < 3}
      loading={saving}
    >
      <View style={styles.grid}>
        {Array.from({ length: MAX_PHOTOS }).map((_, i) => {
          const url = photos[i];
          const isUploading = uploading === i;

          if (url) {
            return (
              <View key={i} style={styles.slot}>
                <ExpoImage source={{ uri: url }} style={styles.img} contentFit="cover" cachePolicy="memory-disk" />
                <Pressable
                  style={[styles.remove, { backgroundColor: colors.text }]}
                  onPress={() => removePhoto(url)}
                >
                  <Ionicons name="close" size={14} color={colors.bg} />
                </Pressable>
                {i === 0 && (
                  <View style={[styles.mainBadge, { backgroundColor: colors.text }]}>
                    <Text style={[styles.mainBadgeText, { color: colors.bg }]}>Main</Text>
                  </View>
                )}
              </View>
            );
          }

          if (isUploading) {
            return (
              <View
                key={i}
                style={[styles.slot, styles.emptySlot, { borderColor: colors.border, backgroundColor: colors.surface }]}
              >
                <ActivityIndicator color={colors.text} />
              </View>
            );
          }

          return (
            <Pressable
              key={i}
              style={[styles.slot, styles.emptySlot, { borderColor: colors.border, backgroundColor: colors.surface }]}
              onPress={i === photos.length && uploading === null ? pickAndUpload : undefined}
            >
              {i === photos.length && (
                <Ionicons name="add" size={28} color={colors.textSecondary} />
              )}
            </Pressable>
          );
        })}
      </View>
    </OnboardingShell>
  );
}

const SLOT_SIZE = 104;

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  slot: { width: SLOT_SIZE, height: SLOT_SIZE * 1.2, borderRadius: 16, overflow: 'hidden', position: 'relative' },
  emptySlot: { borderWidth: 1.5, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  img: { width: '100%', height: '100%' },
  remove: { position: 'absolute', top: 6, right: 6, width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  mainBadge: { position: 'absolute', bottom: 6, left: 6, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  mainBadgeText: { fontSize: 10, fontFamily: 'ProductSans-Bold' },
});
