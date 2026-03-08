import { Ionicons } from '@expo/vector-icons';
import { useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { useAppTheme } from '@/context/ThemeContext';
import Squircle from '@/components/ui/Squircle';

export default function ThemeToggle() {
  const { isDark, toggle, colors } = useAppTheme();
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const handleToggle = () => {
    Animated.sequence([
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(rotateAnim, {
        toValue: 0,
        duration: 0,
        useNativeDriver: true,
      }),
    ]).start();
    toggle();
  };

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Pressable
      onPress={handleToggle}
      style={styles.container}
      hitSlop={12}
    >
      <Squircle
        style={styles.btn}
        cornerRadius={14}
        cornerSmoothing={1}
        fillColor={isDark ? '#1A1A1A' : '#F2F2F7'}
        strokeColor={isDark ? '#2A2A2A' : '#E5E5EA'}
        strokeWidth={1}
      >
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Ionicons
            name={isDark ? 'sunny' : 'moon'}
            size={18}
            color={isDark ? '#FFD60A' : '#636366'}
          />
        </Animated.View>
      </Squircle>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 200,
    right: 20,
    zIndex: 9999,
  },
  btn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
