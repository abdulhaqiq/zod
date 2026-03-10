import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface Props {
  /** Called after the full animation (fade-in → hold → fade-out) completes */
  onFinish: () => void;
  /**
   * When true the splash may begin its fade-out.
   * While false the logo stays fully visible — no matter how long auth takes.
   */
  ready?: boolean;
}

const FADE_IN_MS  = 800;
const MIN_HOLD_MS = 1000; // minimum time the logo stays visible
const FADE_OUT_MS = 500;

export default function AppSplashScreen({ onFinish, ready = false }: Props) {
  const opacity       = useRef(new Animated.Value(0)).current;
  const canFadeOut    = useRef(false); // true once min hold time has elapsed
  const authReady     = useRef(false); // true once parent signals ready
  const fadingOut     = useRef(false);

  function startFadeOut() {
    if (fadingOut.current) return;
    fadingOut.current = true;
    Animated.timing(opacity, {
      toValue: 0,
      duration: FADE_OUT_MS,
      useNativeDriver: true,
    }).start(() => onFinish());
  }

  // Fade in, then start min-hold timer
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: FADE_IN_MS,
      useNativeDriver: true,
    }).start(() => {
      setTimeout(() => {
        canFadeOut.current = true;
        // If auth was already ready before the hold ended, fade out now
        if (authReady.current) startFadeOut();
      }, MIN_HOLD_MS);
    });
  }, []);

  // Watch the ready prop — when it flips to true, fade out if hold is done
  useEffect(() => {
    if (!ready) return;
    authReady.current = true;
    if (canFadeOut.current) startFadeOut();
    // If hold isn't done yet, the setTimeout above will trigger fade-out
  }, [ready]);

  return (
    <View style={styles.container}>
      <Animated.View style={{ opacity }}>
        <Svg width={160} height={75} viewBox="0 0 741 347" fill="none">
          <Path
            d="M168.701 346.924H0L128.174 116.699C84.9609 127.441 35.6445 169.922 21.4844 201.416C6.34766 186.768 0 170.898 0 156.494C0 130.615 20.9961 109.619 49.5605 109.619H218.262L91.0645 339.6C134.033 328.613 182.617 286.377 196.777 255.127C211.914 269.775 218.262 285.4 218.262 299.805C218.262 325.928 197.266 346.924 168.701 346.924ZM347.9 346.924C282.471 346.924 229.492 293.701 229.492 228.027C229.492 162.354 282.471 109.131 347.9 109.131C413.33 109.131 466.309 162.354 466.309 228.027C466.309 293.701 413.33 346.924 347.9 346.924ZM393.799 320.068C402.344 320.068 407.471 312.988 407.471 301.025C407.471 253.662 336.182 136.23 302.002 135.986C293.945 135.986 288.33 142.578 288.33 155.029C288.33 202.393 359.619 320.068 393.799 320.068ZM707.275 346.924C675.781 346.924 644.775 335.693 644.775 300.781C631.592 330.566 602.539 346.924 573.73 346.924C545.166 346.924 516.846 331.055 503.662 297.119C497.314 280.518 494.141 259.521 494.141 237.793C494.141 209.229 499.512 179.932 509.521 158.936C525.635 124.756 556.396 108.887 584.473 108.887C612.061 108.887 637.207 124.023 644.775 151.855V80.8105C644.775 58.1055 640.869 51.5137 623.535 41.2598L724.854 0V312.012C724.854 324.951 729.248 339.355 740.723 342.773C730.957 345.459 718.994 346.924 707.275 346.924ZM615.479 307.129C625.244 307.129 635.742 301.514 644.775 291.26V161.133C636.475 148.926 627.93 143.555 619.873 143.555C596.436 143.555 582.764 186.768 582.764 237.305C582.764 250.732 583.74 263.916 586.182 275.391C590.82 297.119 602.539 307.129 615.479 307.129Z"
            fill="white"
          />
        </Svg>
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
});
