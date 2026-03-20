import { navPush, navReplace } from '@/utils/nav';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Button from '@/components/ui/Button';
import Squircle from '@/components/ui/Squircle';
import { useAppTheme } from '@/context/ThemeContext';

const MAX_PHOTOS = 6;
const MIN_PHOTOS = 2;

const SCREEN_W   = Dimensions.get('window').width;
const H_PADDING  = 20;
const GAP        = 10;
const CELL_SIZE  = (SCREEN_W - H_PADDING * 2 - GAP * 2) / 3;

export default function Photos() {
  const router = useRouter();
  const { colors } = useAppTheme();

  const [photos,  setPhotos]  = useState<string[]>([]);
  const [touched, setTouched] = useState(false);

  const pickImage = async (slotIndex?: number) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photos.');
      return;
    }
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: slotIndex === undefined,
      selectionLimit: slotIndex !== undefined ? 1 : remaining,
      quality: 0.85,
    });

    if (!result.canceled) {
      const uris = result.assets.map(a => a.uri);
      if (slotIndex !== undefined && uris.length === 1) {
        setPhotos(prev => {
          const next = [...prev];
          next[slotIndex] = uris[0];
          return next;
        });
      } else {
        setPhotos(prev => [...prev, ...uris].slice(0, MAX_PHOTOS));
      }
    }
  };

  const removePhoto = (index: number) =>
    setPhotos(prev => prev.filter((_, i) => i !== index));

  const promoteToMain = (index: number) => {
    if (index === 0) return;
    setPhotos(prev => {
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.unshift(item);
      return next;
    });
  };

  const error = touched && photos.length < MIN_PHOTOS
    ? `Add at least ${MIN_PHOTOS - photos.length} more photo${MIN_PHOTOS - photos.length > 1 ? 's' : ''}`
    : null;

  const handleContinue = () => {
    setTouched(true);
    if (photos.length < MIN_PHOTOS) return;
    navReplace('/feed');
  };

  const slots = Array.from({ length: MAX_PHOTOS }, (_, i) => photos[i] ?? null);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <View style={styles.body}>
          <Text style={[styles.title, { color: colors.text }]}>Add your{'\n'}photos</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Add at least {MIN_PHOTOS} photos. First photo is your main profile picture.
          </Text>

          {/* 3 × 2 perfect grid */}
          <View style={styles.grid}>
            {slots.map((uri, i) => (
              <View key={i} style={styles.cell}>
                {uri ? (
                  /* Plain View with overflow:hidden so the image is actually clipped */
                  <View style={styles.filledSlot}>
                    <Image source={{ uri }} style={styles.img} />

                    {i === 0 && (
                      <View style={[styles.mainBadge, { backgroundColor: colors.btnPrimaryBg }]}>
                        <Text style={[styles.mainBadgeText, { color: colors.btnPrimaryText }]}>
                          Main
                        </Text>
                      </View>
                    )}

                    <View style={styles.controls}>
                      {i > 0 && (
                        <Pressable
                          onPress={() => promoteToMain(i)}
                          style={[styles.ctrlBtn, { backgroundColor: '#00000070' }]}
                          hitSlop={6}
                        >
                          <Ionicons name="star" size={11} color="#fff" />
                        </Pressable>
                      )}
                      <Pressable
                        onPress={() => removePhoto(i)}
                        style={[styles.ctrlBtn, styles.removeBtn]}
                        hitSlop={6}
                      >
                        <Ionicons name="close" size={13} color="#fff" />
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => pickImage()}
                    style={({ pressed }) => [pressed && { opacity: 0.7 }, { flex: 1 }]}
                    disabled={i > photos.length}
                  >
                    <Squircle
                      style={[styles.slot, i > photos.length && { opacity: 0.35 }]}
                      cornerRadius={20}
                      cornerSmoothing={1}
                      fillColor={colors.surface}
                      strokeColor={i === photos.length ? colors.btnPrimaryBg : colors.border}
                      strokeWidth={i === photos.length ? 2 : 1.5}
                    >
                      <Ionicons
                        name="add"
                        size={i === photos.length ? 28 : 22}
                        color={i === photos.length ? colors.btnPrimaryBg : colors.textSecondary}
                      />
                      {i === 0 && photos.length === 0 && (
                        <Text style={[styles.addLabel, { color: colors.textSecondary }]}>
                          Add photo
                        </Text>
                      )}
                    </Squircle>
                  </Pressable>
                )}
              </View>
            ))}
          </View>

          {/* Status row */}
          <View style={styles.statusRow}>
            <Text style={[styles.counter, { color: photos.length >= MIN_PHOTOS ? colors.btnPrimaryBg : colors.textSecondary }]}>
              {photos.length} of {MAX_PHOTOS} photos added
            </Text>
            {error && (
              <View style={styles.errorRow}>
                <Ionicons name="warning" size={13} color={colors.error} />
                <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
              </View>
            )}
          </View>

          {/* Tips */}
          <Squircle style={styles.tipsCard} cornerRadius={18} cornerSmoothing={1} fillColor={colors.surface}>
            <Text style={[styles.tipsHead, { color: colors.text }]}>📸  Tips for great photos</Text>
            {[
              { icon: 'sunny-outline'  as const, text: 'Good lighting makes a big difference'        },
              { icon: 'person-outline' as const, text: 'Show your face clearly in the first photo'   },
              { icon: 'star-outline'   as const, text: 'Tap the star to set any photo as your main'  },
            ].map((tip, i) => (
              <View key={i} style={styles.tipRow}>
                <Ionicons name={tip.icon} size={14} color={colors.btnPrimaryBg} />
                <Text style={[styles.tipText, { color: colors.textSecondary }]}>{tip.text}</Text>
              </View>
            ))}
          </Squircle>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={photos.length >= MIN_PHOTOS ? 'Continue' : 'Continue'}
          onPress={handleContinue}
          style={styles.btn}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:          { flex: 1 },
  scroll:        { flexGrow: 1 },
  body:          { paddingHorizontal: H_PADDING, paddingTop: 56, paddingBottom: 16 },
  title:         { fontSize: 34, fontFamily: 'ProductSans-Black', lineHeight: 42, marginBottom: 8 },
  subtitle:      { fontSize: 14, fontFamily: 'ProductSans-Regular', lineHeight: 21, marginBottom: 20 },

  grid:          {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  cell:          { width: CELL_SIZE, height: CELL_SIZE * 1.25 },
  filledSlot:    { flex: 1, borderRadius: 20, overflow: 'hidden', backgroundColor: '#111' },
  slot:          { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  img:           { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', resizeMode: 'cover' },

  mainBadge:     { position: 'absolute', top: 7, left: 7, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  mainBadgeText: { fontSize: 10, fontFamily: 'ProductSans-Bold' },
  controls:      { position: 'absolute', bottom: 7, right: 7, flexDirection: 'row', gap: 5 },
  ctrlBtn:       { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  removeBtn:     { backgroundColor: '#ff3b3baa' },

  addLabel:      { fontSize: 11, fontFamily: 'ProductSans-Regular', marginTop: 5 },

  statusRow:     { marginTop: 14, gap: 6 },
  counter:       { fontSize: 13, fontFamily: 'ProductSans-Bold' },
  errorRow:      { flexDirection: 'row', alignItems: 'center', gap: 5 },
  errorText:     { fontSize: 12, fontFamily: 'ProductSans-Regular' },

  tipsCard:      { marginTop: 20, padding: 16, gap: 10 },
  tipsHead:      { fontSize: 14, fontFamily: 'ProductSans-Bold', marginBottom: 4 },
  tipRow:        { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  tipText:       { fontSize: 13, fontFamily: 'ProductSans-Regular', flex: 1, lineHeight: 20 },

  footer:        { paddingHorizontal: 24, paddingBottom: 24, paddingTop: 12 },
  btn:           { width: '100%' },
});
