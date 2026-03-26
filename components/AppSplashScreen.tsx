import * as SplashScreen from 'expo-splash-screen';
import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

/**
 * Wait two animation frames before resolving.
 * One rAF = JS is scheduled for next frame.
 * Two rAFs = React has committed + native layer has composited.
 * This guarantees our View is pixel-painted before we hide the native splash.
 */
function afterTwoFrames(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

interface Props {
  /** Called after the full animation (fade-in → hold → fade-out) completes */
  onFinish: () => void;
  /**
   * When true the splash may begin its fade-out.
   * While false the logo stays fully visible — no matter how long auth takes.
   */
  ready?: boolean;
}

// No fade-in: start at full opacity so the native splash (same black + logo)
// hands off imperceptibly to the JS splash on the very first frame.
const MIN_HOLD_MS = 1200; // minimum time the logo stays visible
const FADE_OUT_MS = 500;

export default function AppSplashScreen({ onFinish, ready = false }: Props) {
  // Start fully visible — no fade-in delay that would show a black frame
  const opacity    = useRef(new Animated.Value(1)).current;
  const canFadeOut = useRef(false);
  const authReady  = useRef(false);
  const fadingOut  = useRef(false);

  function startFadeOut() {
    if (fadingOut.current) return;
    fadingOut.current = true;
    Animated.timing(opacity, {
      toValue: 0,
      duration: FADE_OUT_MS,
      useNativeDriver: true,
    }).start(() => onFinish());
  }

  // Hide the native splash only after our view is fully painted.
  // useEffect alone fires after JS commit but before the native layer renders —
  // waiting two rAFs guarantees the React Native compositor has flushed our
  // black+logo view to the screen before we dismiss the native splash.
  useEffect(() => {
    let cancelled = false;
    afterTwoFrames().then(() => {
      if (!cancelled) SplashScreen.hideAsync().catch(() => {});
    });

    // Start the minimum hold timer
    const timer = setTimeout(() => {
      canFadeOut.current = true;
      if (authReady.current) startFadeOut();
    }, MIN_HOLD_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  // Watch the ready prop — when it flips to true, fade out if hold is done
  useEffect(() => {
    if (!ready) return;
    authReady.current = true;
    if (canFadeOut.current) startFadeOut();
  }, [ready]);

  return (
    <View style={styles.container}>
      <Animated.View style={{ opacity }}>
        <Image
          source={require('@/assets/images/splash-icon.png')}
          style={styles.logo}
          contentFit="contain"
          cachePolicy="memory"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  logo: {
    width: 260,
    height: 120,
  },
});
