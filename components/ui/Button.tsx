import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import { useAppTheme } from '@/context/ThemeContext';
import Squircle from './Squircle';

export type ButtonVariant = 'primary' | 'secondary';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  style?: ViewStyle;
}

export default function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  style,
}: ButtonProps) {
  const { colors } = useAppTheme();

  const fillColor =
    variant === 'primary' ? colors.btnPrimaryBg : colors.surface2;
  const textColor =
    variant === 'primary' ? colors.btnPrimaryText : colors.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.pressable,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Squircle
        style={styles.squircle}
        cornerRadius={20}
        cornerSmoothing={1}
        fillColor={fillColor}
      >
        <Text style={[styles.label, { color: textColor }]}>{title}</Text>
      </Squircle>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    height: 58,
  },
  squircle: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  label: {
    fontSize: 16,
    fontFamily: 'ProductSans-Bold',
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.35,
  },
});
