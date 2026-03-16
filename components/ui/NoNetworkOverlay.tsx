import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '@/context/ThemeContext';

interface Props {
  onRetry: () => void;
}

export default function NoNetworkOverlay({ onRetry }: Props) {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.overlay, { backgroundColor: colors.bg }]}>
      <View style={styles.content}>
        <View style={[styles.iconWrap, { backgroundColor: colors.surface }]}>
          <Ionicons name="wifi-outline" size={40} color={colors.textSecondary} />
        </View>

        <Text style={[styles.title, { color: colors.text }]}>No Internet Connection</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Check your connection and try again.
        </Text>

        <Pressable
          onPress={onRetry}
          style={({ pressed }) => [
            styles.retryBtn,
            { backgroundColor: colors.text },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.retryText, { color: colors.bg }]}>Try Again</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontFamily: 'ProductSans-Bold',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'ProductSans-Regular',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 36,
    paddingVertical: 14,
    borderRadius: 16,
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.97 }],
  },
  retryText: {
    fontSize: 15,
    fontFamily: 'ProductSans-Bold',
  },
});
