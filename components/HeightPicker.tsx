import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
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

const ITEM_HEIGHT = 56;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

const CM_MIN = 140;
const CM_MAX = 220;
const FT_OPTIONS: string[] = [];
for (let ft = 4; ft <= 7; ft++) {
  for (let inch = 0; inch <= 11; inch++) {
    const total = ft * 12 + inch;
    const cm = Math.round(total * 2.54);
    if (cm >= CM_MIN && cm <= CM_MAX) {
      FT_OPTIONS.push(`${ft}' ${inch}"`);
    }
  }
}

const CM_OPTIONS = Array.from({ length: CM_MAX - CM_MIN + 1 }, (_, i) => `${CM_MIN + i} cm`);

export default function HeightPickerScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();

  const [unit, setUnit] = useState<'ft' | 'cm'>('cm');
  const options = unit === 'cm' ? CM_OPTIONS : FT_OPTIONS;

  const [selectedIndex, setSelectedIndex] = useState(Math.floor(options.length / 2));
  const scrollRef = useRef<ScrollView>(null);

  const scrollToIndex = (index: number, animated = true) => {
    scrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated });
  };

  useEffect(() => {
    setTimeout(() => scrollToIndex(selectedIndex, false), 50);
  }, [unit]);

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const rawIndex = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    const index = Math.max(0, Math.min(rawIndex, options.length - 1));
    setSelectedIndex(index);
    scrollToIndex(index);
  };

  const switchUnit = (next: 'ft' | 'cm') => {
    if (next === unit) return;
    const currentLabel = options[selectedIndex];
    setUnit(next);
    const nextOpts = next === 'cm' ? CM_OPTIONS : FT_OPTIONS;
    let bestIdx = Math.floor(nextOpts.length / 2);
    // Try to keep approximate same height
    const currentCm = unit === 'cm'
      ? parseInt(currentLabel)
      : (() => {
          const m = currentLabel.match(/(\d+)' (\d+)"/);
          return m ? Math.round((parseInt(m[1]) * 12 + parseInt(m[2])) * 2.54) : 170;
        })();
    if (next === 'cm') {
      bestIdx = Math.max(0, currentCm - CM_MIN);
    } else {
      const targetFtTotal = currentCm / 2.54;
      bestIdx = FT_OPTIONS.findIndex((_, i) => {
        const m = FT_OPTIONS[i].match(/(\d+)' (\d+)"/);
        return m && Math.abs(parseInt(m[1]) * 12 + parseInt(m[2]) - targetFtTotal) < 1;
      });
      if (bestIdx === -1) bestIdx = Math.floor(FT_OPTIONS.length / 2);
    }
    setSelectedIndex(bestIdx);
    setTimeout(() => scrollToIndex(bestIdx, false), 50);
  };

  const selectedHeight = options[selectedIndex] ?? '';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Squircle style={styles.backBtn} cornerRadius={14} cornerSmoothing={1} fillColor={colors.backBtnBg}>
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </Squircle>
        </Pressable>
      </View>

      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.text }]}>How tall{'\n'}are you?</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          You can hide this on your profile later.
        </Text>

        {/* Unit toggle */}
        <Squircle style={[styles.toggle, { borderColor: colors.border }]} cornerRadius={14} cornerSmoothing={1} fillColor={colors.surface}>
          {(['cm', 'ft'] as const).map((u) => (
            <Pressable key={u} onPress={() => switchUnit(u)} style={[styles.toggleBtn, unit === u && { backgroundColor: colors.btnPrimaryBg }]} hitSlop={4}>
              <Text style={[styles.toggleText, { color: unit === u ? colors.btnPrimaryText : colors.textSecondary }]}>
                {u === 'cm' ? 'cm' : 'ft / in'}
              </Text>
            </Pressable>
          ))}
        </Squircle>

        {/* Picker */}
        <View style={[styles.pickerWrap, { borderColor: colors.border }]}>
          {/* highlight band */}
          <View style={[styles.highlight, { backgroundColor: `${colors.btnPrimaryBg}22`, borderTopColor: colors.btnPrimaryBg, borderBottomColor: colors.btnPrimaryBg }]} pointerEvents="none" />

          <ScrollView
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
            snapToInterval={ITEM_HEIGHT}
            decelerationRate="fast"
            onMomentumScrollEnd={handleScrollEnd}
            contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * 2 }}
            style={{ height: PICKER_HEIGHT }}
          >
            {options.map((opt, i) => {
              const dist = Math.abs(i - selectedIndex);
              const opacity = dist === 0 ? 1 : dist === 1 ? 0.55 : 0.25;
              const scale = dist === 0 ? 1 : 0.88;
              const size = dist === 0 ? 32 : 22;

              return (
                <Pressable key={opt} onPress={() => { setSelectedIndex(i); scrollToIndex(i); }}>
                  <View style={[styles.pickerItem]}>
                    <Text style={[styles.pickerText, { color: colors.text, opacity, transform: [{ scale }], fontSize: size, fontFamily: dist === 0 ? 'ProductSans-Black' : 'ProductSans-Regular' }]}>
                      {opt}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <Text style={[styles.selectedLabel, { color: colors.textSecondary }]}>
          Selected: <Text style={{ color: colors.text, fontFamily: 'ProductSans-Bold' }}>{selectedHeight}</Text>
        </Text>
      </View>

      <View style={styles.footer}>
        <Button title="Continue" onPress={() => router.push('/interests')} style={styles.btn} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 28 },
  title: { fontSize: 38, fontFamily: 'ProductSans-Black', lineHeight: 46, marginBottom: 10 },
  subtitle: { fontSize: 14, fontFamily: 'ProductSans-Regular', lineHeight: 21, marginBottom: 28 },
  toggle: { flexDirection: 'row', overflow: 'hidden', alignSelf: 'center', padding: 4, gap: 4, marginBottom: 36 },
  toggleBtn: { paddingHorizontal: 24, paddingVertical: 9, borderRadius: 10 },
  toggleText: { fontSize: 14, fontFamily: 'ProductSans-Bold' },
  pickerWrap: { alignItems: 'center', marginHorizontal: 24 },
  highlight: { position: 'absolute', top: ITEM_HEIGHT * 2, height: ITEM_HEIGHT, left: 0, right: 0, borderTopWidth: 1, borderBottomWidth: 1 },
  pickerItem: { height: ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  pickerText: { textAlign: 'center' },
  selectedLabel: { textAlign: 'center', marginTop: 20, fontSize: 13, fontFamily: 'ProductSans-Regular' },
  footer: { paddingHorizontal: 24, paddingBottom: 24, paddingTop: 12 },
  btn: { width: '100%' },
});
