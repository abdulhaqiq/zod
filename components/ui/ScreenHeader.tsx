import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AppColors } from '@/constants/appColors';

interface ScreenHeaderProps {
  title: string;
  onClose: () => void;
  /** Label for the right-side action button (e.g. "Save", "Reset", "Done") */
  rightLabel?: string;
  onRightPress?: () => void;
  colors: AppColors;
  /** Extra content rendered below the header row (e.g. tab pills) */
  children?: React.ReactNode;
}

export default function ScreenHeader({
  title,
  onClose,
  rightLabel,
  onRightPress,
  colors,
  children,
}: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  const isDark = colors.bg === '#000000';

  const gradientColors = isDark
    ? (['#1a1a1a', '#111111', '#000000'] as const)
    : (['#e8e8ed', '#f2f2f7', '#ffffff'] as const);

  return (
    <LinearGradient
      colors={gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[styles.header, { paddingTop: insets.top + 10 }]}
    >
      <View style={styles.headerRow}>
        {/* Left — close / back */}
        <Pressable
          onPress={onClose}
          hitSlop={12}
          style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="close" size={22} color={colors.text} />
        </Pressable>

        {/* Centre — title */}
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>

        {/* Right — action or spacer */}
        {rightLabel && onRightPress ? (
          <Pressable onPress={onRightPress} hitSlop={12} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
            <Text style={[styles.rightLabel, { color: colors.textSecondary }]}>{rightLabel}</Text>
          </Pressable>
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>

      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header:     { paddingHorizontal: 20, paddingBottom: 16 },
  headerRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  closeBtn:   { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title:      { fontSize: 18, fontFamily: 'ProductSans-Black' },
  rightLabel: { fontSize: 13, fontFamily: 'ProductSans-Bold', minWidth: 36, textAlign: 'right' },
  placeholder:{ width: 36 },
});
