/**
 * WheelPickerSheet — reusable drum-roll / iOS-style wheel picker in a bottom sheet.
 *
 * Usage:
 *   <WheelPickerSheet
 *     visible={show}
 *     onClose={() => setShow(false)}
 *     title="Height"
 *     options={HEIGHT_OPTIONS}
 *     selected={height}
 *     onChange={setHeight}
 *     colors={colors}
 *   />
 */

import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
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

const ITEM_H        = 52;   // height of each option row
const VISIBLE       = 5;    // odd number so middle is always centred
const SHEET_H       = ITEM_H * VISIBLE + 180; // wheel + header + button
const CENTER_OFFSET = Math.floor(VISIBLE / 2); // 2

interface Props {
  visible:  boolean;
  onClose:  () => void;
  title:    string;
  options:  string[];
  selected: string;
  onChange: (value: string) => void;
  colors:   AppColors;
}

export default function WheelPickerSheet({
  visible, onClose, title, options, selected, onChange, colors,
}: Props) {
  const insets  = useSafeAreaInsets();
  const slideY  = useRef(new Animated.Value(SCREEN_H)).current;
  const scrollRef = useRef<ScrollView>(null);

  const initialIndex = Math.max(0, options.indexOf(selected));
  const [activeIdx, setActiveIdx] = useState(initialIndex);

  // Animate sheet in/out
  useEffect(() => {
    Animated.spring(slideY, {
      toValue: visible ? 0 : SCREEN_H,
      useNativeDriver: true,
      tension: 68,
      friction: 11,
    }).start();

    if (visible) {
      const idx = Math.max(0, options.indexOf(selected));
      setActiveIdx(idx);
      // Scroll to selected after mount
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: idx * ITEM_H, animated: false });
      }, 80);
    }
  }, [visible]);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y   = e.nativeEvent.contentOffset.y;
    const idx = Math.round(y / ITEM_H);
    const clamped = Math.max(0, Math.min(idx, options.length - 1));
    setActiveIdx(clamped);
    scrollRef.current?.scrollTo({ y: clamped * ITEM_H, animated: true });
  };

  const handleDone = () => {
    onChange(options[activeIdx]);
    onClose();
  };

  const isDark = colors.bg === '#000000';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={() => { onChange(options[activeIdx]); onClose(); }} />

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: colors.surface, paddingBottom: insets.bottom + 12 },
          { transform: [{ translateY: slideY }] },
        ]}
      >
        {/* Handle */}
        <View style={[styles.handle, { backgroundColor: colors.border }]} />

        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={[styles.headerAction, { color: colors.textSecondary }]}>Cancel</Text>
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{title}</Text>
          <Pressable onPress={handleDone} hitSlop={12}>
            <Text style={[styles.headerAction, styles.headerDone, { color: colors.text }]}>Done</Text>
          </Pressable>
        </View>

        {/* Wheel */}
        <View style={[styles.wheelWrap, { height: ITEM_H * VISIBLE }]}>
          {/* Selection highlight strip */}
          <View
            pointerEvents="none"
            style={[
              styles.selectionStrip,
              {
                top: CENTER_OFFSET * ITEM_H,
                height: ITEM_H,
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                borderTopColor: colors.border,
                borderBottomColor: colors.border,
              },
            ]}
          />

          <ScrollView
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
            snapToInterval={ITEM_H}
            decelerationRate="fast"
            onMomentumScrollEnd={onScrollEnd}
            onScrollEndDrag={onScrollEnd}
            contentContainerStyle={{
              paddingTop:    CENTER_OFFSET * ITEM_H,
              paddingBottom: CENTER_OFFSET * ITEM_H,
            }}
          >
            {options.map((opt, i) => {
              const distance = Math.abs(i - activeIdx);
              const opacity  = distance === 0 ? 1 : distance === 1 ? 0.5 : 0.2;
              const scale    = distance === 0 ? 1 : distance === 1 ? 0.92 : 0.84;
              const fontSize = distance === 0 ? 20 : 16;

              return (
                <Pressable
                  key={opt}
                  style={styles.item}
                  onPress={() => {
                    setActiveIdx(i);
                    scrollRef.current?.scrollTo({ y: i * ITEM_H, animated: true });
                  }}
                >
                  <Text
                    style={[
                      styles.itemText,
                      {
                        color:    colors.text,
                        opacity,
                        fontSize,
                        transform: [{ scale }],
                        fontFamily: distance === 0 ? 'ProductSans-Bold' : 'ProductSans-Regular',
                      },
                    ]}
                  >
                    {opt}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop:       { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },

  sheet:          {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    overflow: 'hidden',
  },

  handle:         { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },

  header:         {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle:    { fontSize: 16, fontFamily: 'ProductSans-Black' },
  headerAction:   { fontSize: 15, fontFamily: 'ProductSans-Medium' },
  headerDone:     { fontFamily: 'ProductSans-Bold' },

  wheelWrap:      { position: 'relative', overflow: 'hidden' },
  selectionStrip: {
    position: 'absolute', left: 0, right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  item:           { height: ITEM_H, alignItems: 'center', justifyContent: 'center' },
  itemText:       { textAlign: 'center' },
});
