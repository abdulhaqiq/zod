/**
 * WheelPickerSheet — native iOS drum-roll picker in a bottom sheet.
 * Uses @react-native-picker/picker for the real iOS spinning wheel.
 */

import { Picker } from '@react-native-picker/picker';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AppColors } from '@/constants/appColors';

const { height: SCREEN_H } = Dimensions.get('window');

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
  const insets = useSafeAreaInsets();
  const slideY = useRef(new Animated.Value(SCREEN_H)).current;
  const [current, setCurrent] = useState(selected || options[0]);

  useEffect(() => {
    if (visible) setCurrent(selected || options[0]);
    Animated.spring(slideY, {
      toValue: visible ? 0 : SCREEN_H,
      useNativeDriver: true,
      tension: 68,
      friction: 11,
    }).start();
  }, [visible]);

  const handleDone = () => {
    onChange(current);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={() => { onChange(current); onClose(); }} />

      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: colors.surface, paddingBottom: insets.bottom },
          { transform: [{ translateY: slideY }] },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: colors.border }]} />

        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={[styles.action, { color: colors.textSecondary }]}>Cancel</Text>
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Pressable onPress={handleDone} hitSlop={12}>
            <Text style={[styles.action, styles.done, { color: colors.text }]}>Done</Text>
          </Pressable>
        </View>

        {/* Native iOS picker wheel */}
        <Picker
          selectedValue={current}
          onValueChange={(val) => setCurrent(val as string)}
          style={{ color: colors.text }}
          itemStyle={{ color: colors.text, fontFamily: 'ProductSans-Regular', fontSize: 18 }}
        >
          {options.map(opt => (
            <Picker.Item key={opt} label={opt} value={opt} />
          ))}
        </Picker>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
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
});
