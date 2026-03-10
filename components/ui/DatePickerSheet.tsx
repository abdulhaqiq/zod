/**
 * DatePickerSheet — three-column drum-roll date picker (Month / Day / Year).
 * Enforces a minimum age via `maxDate` prop (defaults to 18 years ago today).
 */

import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AppColors } from '@/constants/appColors';

const { height: SCREEN_H } = Dimensions.get('window');
const ITEM_H = 52;
const VISIBLE = 5;
const CENTER = Math.floor(VISIBLE / 2); // 2

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function daysInMonth(month: number, year: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function buildYears(maxYear: number): string[] {
  const years: string[] = [];
  for (let y = maxYear; y >= 1930; y--) years.push(String(y));
  return years;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  value: Date | null;
  onChange: (date: Date) => void;
  colors: AppColors;
  /** Latest allowed date — defaults to 18 years ago */
  maxDate?: Date;
}

export default function DatePickerSheet({ visible, onClose, value, onChange, colors, maxDate }: Props) {
  const insets = useSafeAreaInsets();
  const slideY = useRef(new Animated.Value(SCREEN_H)).current;

  const cutoff = maxDate ?? (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 18);
    return d;
  })();

  const maxYear = cutoff.getFullYear();

  // State: 0-based month, 1-based day, 4-digit year
  const initial = value ?? cutoff;
  const [month, setMonth] = useState(initial.getMonth());
  const [day,   setDay]   = useState(initial.getDate());
  const [year,  setYear]  = useState(initial.getFullYear());

  // Derive lists
  const dayCount = daysInMonth(month, year);
  const days     = Array.from({ length: dayCount }, (_, i) => String(i + 1));
  const years    = buildYears(maxYear);

  // Clamp day when month/year changes
  useEffect(() => {
    const maxDay = daysInMonth(month, year);
    if (day > maxDay) setDay(maxDay);
  }, [month, year]);

  // Animate sheet
  useEffect(() => {
    Animated.spring(slideY, {
      toValue: visible ? 0 : SCREEN_H,
      useNativeDriver: true,
      tension: 68,
      friction: 11,
    }).start();

    if (visible) {
      const src = value ?? cutoff;
      setMonth(src.getMonth());
      setDay(src.getDate());
      setYear(src.getFullYear());
    }
  }, [visible]);

  const handleDone = () => {
    const clamped = Math.min(day, daysInMonth(month, year));
    onChange(new Date(year, month, clamped));
    onClose();
  };

  const isDark = colors.bg === '#000000';
  const stripBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={handleDone} />

      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: colors.surface, paddingBottom: insets.bottom + 12 },
          { transform: [{ translateY: slideY }] },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: colors.border }]} />

        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={[styles.action, { color: colors.textSecondary }]}>Cancel</Text>
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>Date of Birth</Text>
          <Pressable onPress={handleDone} hitSlop={12}>
            <Text style={[styles.action, styles.done, { color: colors.text }]}>Done</Text>
          </Pressable>
        </View>

        {/* Three-column wheel */}
        <View style={styles.wheels}>
          {/* Selection strip — sits behind all three columns */}
          <View
            pointerEvents="none"
            style={[
              styles.strip,
              {
                top: CENTER * ITEM_H,
                backgroundColor: stripBg,
                borderTopColor: colors.border,
                borderBottomColor: colors.border,
              },
            ]}
          />

          {/* Month */}
          <Column
            options={MONTHS}
            selected={month}
            onSelect={setMonth}
            colors={colors}
            flex={5}
          />

          {/* Day */}
          <Column
            options={days}
            selected={day - 1}
            onSelect={(i) => setDay(i + 1)}
            colors={colors}
            flex={2}
          />

          {/* Year */}
          <Column
            options={years}
            selected={years.indexOf(String(year))}
            onSelect={(i) => setYear(Number(years[i]))}
            colors={colors}
            flex={3}
          />
        </View>
      </Animated.View>
    </Modal>
  );
}

// ─── Single column ────────────────────────────────────────────────────────────

interface ColProps {
  options: string[];
  selected: number;
  onSelect: (index: number) => void;
  colors: AppColors;
  flex: number;
}

function Column({ options, selected, onSelect, colors, flex }: ColProps) {
  const scrollRef = useRef<ScrollView>(null);
  const [active, setActive] = useState(Math.max(0, selected));

  useEffect(() => {
    const idx = Math.max(0, Math.min(selected, options.length - 1));
    setActive(idx);
    setTimeout(() => scrollRef.current?.scrollTo({ y: idx * ITEM_H, animated: false }), 80);
  }, [selected, options.length]);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.max(0, Math.min(
      Math.round(e.nativeEvent.contentOffset.y / ITEM_H),
      options.length - 1,
    ));
    setActive(idx);
    scrollRef.current?.scrollTo({ y: idx * ITEM_H, animated: true });
    onSelect(idx);
  };

  return (
    <View style={{ flex, height: ITEM_H * VISIBLE, overflow: 'hidden' }}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        onMomentumScrollEnd={onScrollEnd}
        onScrollEndDrag={onScrollEnd}
        contentContainerStyle={{ paddingTop: CENTER * ITEM_H, paddingBottom: CENTER * ITEM_H }}
      >
        {options.map((opt, i) => {
          const dist = Math.abs(i - active);
          const opacity  = dist === 0 ? 1 : dist === 1 ? 0.5 : 0.2;
          const scale    = dist === 0 ? 1 : dist === 1 ? 0.92 : 0.84;
          const fontSize = dist === 0 ? 18 : 15;
          return (
            <Pressable
              key={`${opt}-${i}`}
              style={styles.item}
              onPress={() => {
                setActive(i);
                scrollRef.current?.scrollTo({ y: i * ITEM_H, animated: true });
                onSelect(i);
              }}
            >
              <Text
                style={{
                  color: colors.text,
                  opacity,
                  fontSize,
                  transform: [{ scale }],
                  fontFamily: dist === 0 ? 'ProductSans-Bold' : 'ProductSans-Regular',
                  textAlign: 'center',
                }}
                numberOfLines={1}
              >
                {opt}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title:  { fontSize: 16, fontFamily: 'ProductSans-Black' },
  action: { fontSize: 15, fontFamily: 'ProductSans-Medium' },
  done:   { fontFamily: 'ProductSans-Bold' },
  wheels: { flexDirection: 'row', position: 'relative' },
  strip: {
    position: 'absolute', left: 0, right: 0, height: ITEM_H,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: -1,
  },
  item: { height: ITEM_H, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
});
