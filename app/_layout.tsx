import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import 'react-native-reanimated';

import AppSplashScreen from '@/components/AppSplashScreen';
import ThemeToggle from '@/components/ThemeToggle';
import { AuthProvider, useAuth, UserProfile } from '@/context/AuthContext';
import { AppThemeProvider, useAppTheme } from '@/context/ThemeContext';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  initialRouteName: 'welcome',
};

const AUTH_SCREENS = ['welcome', 'phone', 'otp', 'passkey'];

const ONBOARDING_SCREENS = [
  'profile', 'gender', 'purpose', 'goals', 'height',
  'interests', 'lifestyle', 'values', 'prompts', 'photos',
];

const MIN_PHOTOS = 3;

function firstIncompleteStep(p: UserProfile): string {
  if (!p.full_name || !p.date_of_birth)      return '/profile';
  if (!p.gender)                              return '/gender';
  if (!p.purpose?.length)                     return '/purpose';
  if (!p.height_cm)                          return '/height';
  if (!p.interests?.length)                  return '/interests';
  if (!p.lifestyle)                          return '/lifestyle';
  if (!p.values_list?.length)                return '/values';
  if (!p.bio)                                return '/prompts';
  if ((p.photos?.length ?? 0) < MIN_PHOTOS)  return '/photos';
  // All steps done but not yet marked onboarded — stay on photos
  return '/photos';
}

(Text as any).defaultProps = (Text as any).defaultProps ?? {};
(Text as any).defaultProps.style = { fontFamily: 'ProductSans-Regular' };

function RootLayoutInner() {
  const colorScheme = useColorScheme();
  const { isDark } = useAppTheme();
  const { token, isLoading, isOnboarded, profile } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  // splashDone: the animated intro has finished and been unmounted
  const [splashDone, setSplashDone] = useState(false);
  // routingDone: the guard has made its first routing decision
  // The splash only starts fading out once this is true, so it always
  // hides onto the correct screen — never a flash of the wrong one.
  const [routingDone, setRoutingDone] = useState(false);
  // covering: instant opaque black overlay shown during post-splash
  // auth redirects (e.g. logout while on the feed screen).
  const [covering, setCovering] = useState(false);
  const coverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isLoggedIn = !!token;
  const authReady  = !isLoading;

  useEffect(() => {
    // Run as soon as auth state is known — do NOT wait for splashDone.
    // This means routing fires while the splash is still covering the screen,
    // so when the splash fades out the correct screen is already showing.
    if (!authReady) return;

    const currentScreen     = segments[0] as string | undefined;
    const isOnAuthScreen      = AUTH_SCREENS.includes(currentScreen ?? '');
    const isOnOnboardingScreen = ONBOARDING_SCREENS.includes(currentScreen ?? '');
    const isOnProtectedScreen  = !isOnAuthScreen && !isOnOnboardingScreen;

    let didNavigate = false;

    if (!isLoggedIn && !isOnAuthScreen) {
      // Logged-out user on a protected screen (e.g. after logout on the feed).
      // Show instant black cover so the feed never shows during the redirect.
      if (splashDone) {
        setCovering(true);
        if (coverTimerRef.current) clearTimeout(coverTimerRef.current);
        coverTimerRef.current = setTimeout(() => setCovering(false), 350);
      }
      router.replace('/welcome');
      didNavigate = true;

    } else if (isLoggedIn && isOnAuthScreen) {
      if (isOnboarded) {
        router.replace('/(tabs)' as any);
      } else {
        const next = profile ? firstIncompleteStep(profile) : '/profile';
        router.replace(next as any);
      }
      didNavigate = true;

    } else if (isLoggedIn && !isOnboarded && isOnProtectedScreen) {
      const next = profile ? firstIncompleteStep(profile) : '/profile';
      router.replace(next as any);
      didNavigate = true;
    }

    // Signal splash it may begin fading out — routing has been decided.
    // We use a short timeout so router.replace() has one JS tick to register
    // the new route before the splash starts revealing the screen.
    if (!routingDone) {
      setTimeout(() => setRoutingDone(true), didNavigate ? 100 : 0);
    }

  }, [authReady, isLoggedIn, isOnboarded, segments]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <View style={{ flex: 1 }}>
        <Stack>
          <Stack.Screen name="welcome"         options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)"          options={{ headerShown: false }} />
          <Stack.Screen name="phone"           options={{ headerShown: false }} />
          <Stack.Screen name="otp"             options={{ headerShown: false }} />
          <Stack.Screen name="passkey"         options={{ headerShown: false }} />
          <Stack.Screen name="profile"         options={{ headerShown: false }} />
          <Stack.Screen name="gender"          options={{ headerShown: false }} />
          <Stack.Screen name="purpose"         options={{ headerShown: false }} />
          <Stack.Screen name="goals"           options={{ headerShown: false }} />
          <Stack.Screen name="height"          options={{ headerShown: false }} />
          <Stack.Screen name="interests"       options={{ headerShown: false }} />
          <Stack.Screen name="lifestyle"       options={{ headerShown: false }} />
          <Stack.Screen name="values"          options={{ headerShown: false }} />
          <Stack.Screen name="prompts"         options={{ headerShown: false }} />
          <Stack.Screen name="photos"          options={{ headerShown: false }} />
          <Stack.Screen name="feed"            options={{ headerShown: false }} />
          <Stack.Screen name="profile-view"    options={{ headerShown: false, presentation: 'card' }} />
          <Stack.Screen name="edit-profile"    options={{ headerShown: false }} />
          <Stack.Screen name="verification"    options={{ headerShown: false }} />
          <Stack.Screen name="work-experience" options={{ headerShown: false }} />
          <Stack.Screen name="education"       options={{ headerShown: false }} />
          <Stack.Screen name="location-search" options={{ headerShown: false }} />
          <Stack.Screen name="subscription"    options={{ headerShown: false, presentation: 'fullScreenModal' }} />
          <Stack.Screen name="chat"            options={{ headerShown: false }} />
          <Stack.Screen name="modal"           options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>

        <StatusBar style={isDark ? 'light' : 'dark'} />

        {/* Animated splash — stays visible until auth check AND routing are both done.
            Fades out only after the correct screen is already in the stack. */}
        {!splashDone && (
          <AppSplashScreen ready={routingDone} onFinish={() => setSplashDone(true)} />
        )}

        {/* Instant black cover for post-splash auth redirects (e.g. logout).
            Prevents the feed from flashing while router.replace fires. */}
        {covering && <View style={styles.cover} />}

        {splashDone && isLoggedIn && <ThemeToggle />}
      </View>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  cover: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    zIndex: 1000,
  },
});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'ProductSans-Regular': require('@/assets/product sans full/ProductSans-Regular.ttf'),
    'ProductSans-Medium':  require('@/assets/product sans full/ProductSans-Medium.ttf'),
    'ProductSans-Bold':    require('@/assets/product sans full/ProductSans-Bold.ttf'),
    'ProductSans-Black':   require('@/assets/product sans full/ProductSans-Black.ttf'),
    'ProductSans-Light':   require('@/assets/product sans full/ProductSans-Light.ttf'),
  });

  if (!fontsLoaded) return null;

  return (
    <AppThemeProvider>
      <AuthProvider>
        <RootLayoutInner />
      </AuthProvider>
    </AppThemeProvider>
  );
}
