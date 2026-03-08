/**
 * ChipSelectorSheet — reusable bottom-sheet chip picker.
 *
 * Usage:
 *   <ChipSelectorSheet
 *     visible={show}
 *     onClose={() => setShow(false)}
 *     title="Interests"
 *     subtitle="Pick up to 5"
 *     maxSelect={5}
 *     options={INTERESTS}
 *     selected={interests}
 *     onChange={setInterests}
 *     colors={colors}
 *   />
 */

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AppColors } from '@/constants/appColors';

export interface ChipOption {
  emoji?: string;
  label: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** When true: tapping a chip immediately selects it and closes the sheet */
  singleSelect?: boolean;
  maxSelect?: number;
  options: ChipOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  colors: AppColors;
}

const { height: SCREEN_H } = Dimensions.get('window');

export default function ChipSelectorSheet({
  visible, onClose, title, subtitle, singleSelect = false, maxSelect = 99,
  options, selected, onChange, colors,
}: Props) {
  const insets = useSafeAreaInsets();
  const slideY = useRef(new Animated.Value(SCREEN_H)).current;

  useEffect(() => {
    Animated.spring(slideY, {
      toValue: visible ? 0 : SCREEN_H,
      useNativeDriver: true,
      tension: 68,
      friction: 11,
    }).start();
  }, [visible]);

  const toggle = (label: string) => {
    if (singleSelect) {
      onChange([label]);
      onClose();
      return;
    }
    if (selected.includes(label)) {
      onChange(selected.filter(s => s !== label));
    } else if (selected.length < maxSelect) {
      onChange([...selected, label]);
    }
  };

  const atMax = !singleSelect && selected.length >= maxSelect;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={onClose} />

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: colors.surface, paddingBottom: insets.bottom + 16 },
          { transform: [{ translateY: slideY }] },
        ]}
      >
        {/* Handle */}
        <View style={[styles.handle, { backgroundColor: colors.border }]} />

        {/* Header */}
        <View style={styles.sheetHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>{title}</Text>
            {subtitle ? (
              <Text style={[styles.sheetSub, { color: colors.textSecondary }]}>{subtitle}</Text>
            ) : null}
          </View>
          <Pressable onPress={onClose} hitSlop={12} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
            <Ionicons name="close-circle" size={26} color={colors.textTertiary} />
          </Pressable>
        </View>

        {/* Selection counter — hidden in single-select mode */}
        {!singleSelect && maxSelect < 99 && (
          <View style={[styles.counterRow, { backgroundColor: colors.bg }]}>
            <Text style={[styles.counterText, { color: atMax ? colors.text : colors.textSecondary }]}>
              {selected.length} / {maxSelect} selected
            </Text>
            {selected.length > 0 && (
              <Pressable onPress={() => onChange([])} hitSlop={8}>
                <Text style={[styles.clearText, { color: colors.textSecondary }]}>Clear all</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Chips */}
        <ScrollView
          style={styles.chipsScroll}
          contentContainerStyle={styles.chipsWrap}
          showsVerticalScrollIndicator={false}
        >
          {options.map(opt => {
            const isSelected = selected.includes(opt.label);
            const disabled = !isSelected && atMax;
            return (
              <Pressable
                key={opt.label}
                onPress={() => toggle(opt.label)}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    backgroundColor: isSelected ? colors.text : colors.bg,
                    borderColor: isSelected ? colors.text : colors.border,
                    opacity: disabled ? 0.35 : pressed ? 0.7 : 1,
                  },
                ]}
              >
                {opt.emoji ? (
                  <Text style={styles.chipEmoji}>{opt.emoji}</Text>
                ) : null}
                <Text
                  style={[
                    styles.chipLabel,
                    { color: isSelected ? colors.bg : colors.text },
                  ]}
                >
                  {opt.label}
                </Text>
                {isSelected && (
                  <Ionicons name="checkmark" size={13} color={colors.bg} style={{ marginLeft: 2 }} />
                )}
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Done button — hidden in single-select mode (selection closes sheet automatically) */}
        {!singleSelect && (
          <Pressable
            style={[styles.doneBtn, { backgroundColor: colors.text }]}
            onPress={onClose}
          >
            <Text style={[styles.doneBtnText, { color: colors.bg }]}>
              Done{selected.length > 0 ? ` (${selected.length})` : ''}
            </Text>
          </Pressable>
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop:    { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet:       { position: 'absolute', bottom: 0, left: 0, right: 0, maxHeight: SCREEN_H * 0.82, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  handle:      { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },

  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20, paddingVertical: 16, gap: 12 },
  sheetTitle:  { fontSize: 20, fontFamily: 'ProductSans-Black' },
  sheetSub:    { fontSize: 13, fontFamily: 'ProductSans-Regular', marginTop: 2 },

  counterRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 8 },
  counterText: { fontSize: 12, fontFamily: 'ProductSans-Bold' },
  clearText:   { fontSize: 12, fontFamily: 'ProductSans-Medium' },

  chipsScroll: { flexShrink: 1 },
  chipsWrap:   { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, paddingBottom: 20, gap: 10 },
  chip:        { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 50, borderWidth: 1.5 },
  chipEmoji:   { fontSize: 16 },
  chipLabel:   { fontSize: 14, fontFamily: 'ProductSans-Medium' },

  doneBtn:     { marginHorizontal: 20, marginTop: 4, paddingVertical: 16, borderRadius: 50, alignItems: 'center' },
  doneBtnText: { fontSize: 15, fontFamily: 'ProductSans-Black' },
});
