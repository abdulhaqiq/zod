/**
 * ChipSelectorSheet — reusable bottom-sheet chip picker.
 *
 * - singleSelect=true  → chips + "Update" button (confirms selection, saves, closes)
 * - singleSelect=false → multi-select chips + "Done (n)" button
 *
 * When ChipOption.group is set, options are rendered under labelled category
 * headers (e.g. "Technical", "Business"). Ungrouped options render first.
 *
 * Internal state is used so toggles are instant regardless of parent re-renders.
 * onChange is fired with the confirmed selection when Update / Done is pressed.
 */

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
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
  /** Stable key stored in the DB (e.g. the lookup row ID as a string). Falls back to label. */
  value?: string;
  emoji?: string;
  label: string;
  /** Optional category group heading, e.g. "Technical", "Business" */
  group?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** When true: single-select mode with Update button */
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

  const [localSelected, setLocalSelected] = useState<string[]>(selected);

  useEffect(() => {
    if (visible) setLocalSelected(selected);
    Animated.spring(slideY, {
      toValue: visible ? 0 : SCREEN_H,
      useNativeDriver: true,
      tension: 68,
      friction: 11,
    }).start();
  }, [visible]);

  const toggle = (key: string) => {
    if (singleSelect) { setLocalSelected([key]); return; }
    setLocalSelected(prev => {
      if (prev.includes(key)) return prev.filter(s => s !== key);
      if (prev.length < maxSelect) return [...prev, key];
      return prev;
    });
  };

  const handleConfirm = () => { onChange(localSelected); onClose(); };
  const atMax = !singleSelect && localSelected.length >= maxSelect;

  // ── Build grouped sections ──────────────────────────────────────────────────
  const hasGroups = options.some(o => o.group);

  type Section = { heading: string | null; opts: ChipOption[] };
  const sections: Section[] = [];

  if (hasGroups) {
    const order: string[] = [];
    const map: Record<string, ChipOption[]> = {};
    for (const opt of options) {
      const g = opt.group ?? '';
      if (!map[g]) { order.push(g); map[g] = []; }
      map[g].push(opt);
    }
    for (const g of order) {
      sections.push({ heading: g || null, opts: map[g] });
    }
  } else {
    sections.push({ heading: null, opts: options });
  }

  const renderChip = (opt: ChipOption) => {
    const key = opt.value ?? opt.label;
    const isSelected = localSelected.includes(key);
    const disabled = !isSelected && atMax;
    return (
      <Pressable
        key={key}
        onPress={() => toggle(key)}
        style={({ pressed }) => [
          styles.chip,
          {
            backgroundColor: isSelected ? colors.text : colors.bg,
            borderColor: isSelected ? colors.text : colors.border,
            opacity: disabled ? 0.32 : pressed ? 0.65 : 1,
          },
        ]}
      >
        {opt.emoji ? <Text style={styles.chipEmoji}>{opt.emoji}</Text> : null}
        <Text style={[styles.chipLabel, { color: isSelected ? colors.bg : colors.text }]}>
          {opt.label}
        </Text>
        {isSelected && (
          <Ionicons name="checkmark" size={11} color={colors.bg} style={{ marginLeft: 1 }} />
        )}
      </Pressable>
    );
  };

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

        {/* Selection counter — only in multi-select mode */}
        {!singleSelect && maxSelect < 99 && (
          <View style={[styles.counterRow, { backgroundColor: colors.bg }]}>
            <Text style={[styles.counterText, { color: atMax ? colors.text : colors.textSecondary }]}>
              {localSelected.length} / {maxSelect} selected
            </Text>
            {localSelected.length > 0 && (
              <Pressable onPress={() => setLocalSelected([])} hitSlop={8}>
                <Text style={[styles.clearText, { color: colors.textSecondary }]}>Clear all</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Chips — flat or grouped */}
        <ScrollView
          style={styles.chipsScroll}
          contentContainerStyle={styles.chipsWrap}
          showsVerticalScrollIndicator={false}
        >
          {sections.map((sec, si) => (
            <View key={si} style={{ width: '100%' }}>
              {sec.heading ? (
                <Text style={[styles.groupHeading, { color: colors.textSecondary }]}>
                  {sec.heading.toUpperCase()}
                </Text>
              ) : null}
              <View style={styles.chipRow}>
                {sec.opts.map(renderChip)}
              </View>
              {si < sections.length - 1 && (
                <View style={[styles.groupDivider, { backgroundColor: colors.border }]} />
              )}
            </View>
          ))}
        </ScrollView>

        {/* Confirm button */}
        <Pressable
          style={[
            styles.doneBtn,
            { backgroundColor: localSelected.length > 0 ? colors.text : colors.surface2 },
          ]}
          onPress={handleConfirm}
          disabled={localSelected.length === 0}
        >
          <Text style={[styles.doneBtnText, { color: localSelected.length > 0 ? colors.bg : colors.textTertiary }]}>
            {singleSelect
              ? 'Update'
              : `Done${localSelected.length > 0 ? ` (${localSelected.length})` : ''}`}
          </Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop:    { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet:       { position: 'absolute', bottom: 0, left: 0, right: 0, maxHeight: SCREEN_H * 0.86, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  handle:      { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },

  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20, paddingVertical: 14, gap: 12 },
  sheetTitle:  { fontSize: 20, fontFamily: 'ProductSans-Black' },
  sheetSub:    { fontSize: 13, fontFamily: 'ProductSans-Regular', marginTop: 2 },

  counterRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 8 },
  counterText: { fontSize: 12, fontFamily: 'ProductSans-Bold' },
  clearText:   { fontSize: 12, fontFamily: 'ProductSans-Medium' },

  chipsScroll: { flexShrink: 1 },
  chipsWrap:   { paddingHorizontal: 16, paddingBottom: 20, gap: 0 },

  // Grouped layout
  groupHeading:  { fontSize: 10, fontFamily: 'ProductSans-Bold', letterSpacing: 1.4, marginTop: 14, marginBottom: 8, marginLeft: 2 },
  groupDivider:  { height: StyleSheet.hairlineWidth, marginTop: 14 },
  chipRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  // Chips — slightly smaller than before
  chip:        { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 50, borderWidth: 1.5 },
  chipEmoji:   { fontSize: 14 },
  chipLabel:   { fontSize: 12.5, fontFamily: 'ProductSans-Medium' },

  doneBtn:     { marginHorizontal: 20, marginTop: 4, paddingVertical: 15, borderRadius: 50, alignItems: 'center' },
  doneBtnText: { fontSize: 15, fontFamily: 'ProductSans-Black' },
});
