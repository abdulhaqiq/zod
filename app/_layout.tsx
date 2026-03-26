import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import 'react-native-reanimated';

// Hold the native splash until our JS splash is ready to take over.
SplashScreen.preventAutoHideAsync();

/**
 * Lets RootLayoutInner (deep in the provider tree) signal when
 * routing is resolved so the splash can begin fading out.
 * splashDone tells inner components when the splash has fully finished.
 */
const SplashCtx = createContext<{
  signalReady: () => void;
  splashDone: boolean;
}>({ signalReady: () => {}, splashDone: false });

import { AuthProvider, useAuth, UserProfile } from '@/context/AuthContext';
import { CallProvider, useCall } from '@/context/CallContext';
import { AppThemeProvider, useAppTheme } from '@/context/ThemeContext';
import { API_V1 } from '@/constants/api';
import { darkColors, lightColors } from '@/constants/appColors';
import { useAutoLocation } from '@/hooks/useAutoLocation';
import * as Camera from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';

// Show match/message banners while the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  false,
    shouldShowBanner: true,
    shouldShowList:   true,
  }),
});

export const unstable_settings = {
  initialRouteName: 'welcome',
};

const AUTH_SCREENS = ['welcome', 'phone', 'otp'];

const ONBOARDING_SCREENS = [
  'passkey',
  'profile', 'gender', 'purpose', 'goals', 'height',
  'interests', 'lifestyle', 'values', 'prompts', 'photos',
  'religion', 'faith',
];

const MIN_PHOTOS = 3;

// Goal IDs start at 267 (items with emoji in values_list).
// Personal values (251-266) have no emoji and are saved at a later step.
const GOAL_ID_MIN = 267;

const MUSLIM_RELIGION_ID = 49;

function firstIncompleteStep(p: UserProfile): string {
  if (!p.full_name || !p.date_of_birth)                           return '/profile';
  if (!p.gender_id)                                               return '/gender';
  if (!p.purpose?.length)                                         return '/purpose';
  if (!p.values_list?.some(id => id >= GOAL_ID_MIN))             return '/goals';
  if (!p.height_cm)                                              return '/height';
  if (!p.interests?.length)                                      return '/interests';
  if (!p.lifestyle)                                              return '/lifestyle';
  if (!p.values_list?.some(id => id < GOAL_ID_MIN))             return '/values';
  if (!p.bio)                                                    return '/prompts';
  if ((p.photos?.length ?? 0) < MIN_PHOTOS)                     return '/photos';
  // Religion is always the final onboarding step entry point.
  // Muslims with halal mode on will be pushed to /faith from the religion screen itself.
  return '/religion';
}

(Text as any).defaultProps = (Text as any).defaultProps ?? {};
(Text as any).defaultProps.style = { fontFamily: 'ProductSans-Regular' };

function NoConnectionScreen() {
  const { retryBootstrap, isLoading } = useAuth();
  const { isDark } = useAppTheme();
  const colors = isDark ? darkColors : lightColors;

  return (
    <View style={[noConnStyles.root, { backgroundColor: colors.bg }]}>
      <View style={noConnStyles.content}>
        <Text style={noConnStyles.icon}>📡</Text>
        <Text style={[noConnStyles.title, { color: colors.text }]}>
          No Connection
        </Text>
        <Text style={[noConnStyles.subtitle, { color: colors.textSecondary }]}>
          Unable to reach the server.{'\n'}Check your internet and try again.
        </Text>
        <Pressable
          onPress={retryBootstrap}
          disabled={isLoading}
          style={({ pressed }) => [
            noConnStyles.btn,
            { backgroundColor: colors.text, opacity: pressed || isLoading ? 0.7 : 1 },
          ]}
        >
          {isLoading
            ? <ActivityIndicator color={colors.bg} size="small" />
            : <Text style={[noConnStyles.btnText, { color: colors.bg }]}>Try Again</Text>
          }
        </Pressable>
      </View>
    </View>
  );
}

const noConnStyles = StyleSheet.create({
  root:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content:  { alignItems: 'center', gap: 16, paddingHorizontal: 40 },
  icon:     { fontSize: 56 },
  title:    { fontSize: 24, fontFamily: 'ProductSans-Black', textAlign: 'center' },
  subtitle: { fontSize: 15, fontFamily: 'ProductSans-Regular', textAlign: 'center', lineHeight: 22 },
  btn:      { marginTop: 8, paddingHorizontal: 36, paddingVertical: 14, borderRadius: 50, minWidth: 140, alignItems: 'center' },
  btnText:  { fontSize: 16, fontFamily: 'ProductSans-Bold' },
});


function RootLayoutInner() {
  const { isDark, syncFromBackend, setApiFetch } = useAppTheme();
  const { token, isLoading, isOnboarded, profile, isNetworkError } = useAuth();
  const { setIncomingCall } = useCall();
  const { signalReady, splashDone } = useContext(SplashCtx);
  const router = useRouter();
  const segments = useSegments();

  // Track whether we've already signalled the splash — avoids double-firing.
  const routingSignalledRef = useRef(false);
  // covering: instant opaque black overlay shown during post-splash
  // auth redirects (e.g. logout while on the feed screen).
  const [covering, setCovering] = useState(false);
  const coverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Request all permissions silently once user is authenticated ──────────
  // iOS shows its own native dialogs; no custom modal needed.
  const permRequestedRef = useRef(false);
  useEffect(() => {
    if (!splashDone || !token || permRequestedRef.current) return;
    permRequestedRef.current = true;
    (async () => {
      try { await Camera.requestCameraPermissionsAsync(); }        catch {}
      try { await MediaLibrary.requestPermissionsAsync(); }        catch {}
      try { await Camera.requestMicrophonePermissionsAsync(); }    catch {}
    })();
  }, [splashDone, token]);

  // Auto-update location on every app open (non-blocking, best-effort)
  useAutoLocation();

  // ── Push notification registration + call action categories ─────────────
  useEffect(() => {
    if (!token) return;

    const register = async () => {
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') return;

        // Android needs a notification channel
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
          });
          // Separate high-priority channel for incoming calls
          await Notifications.setNotificationChannelAsync('incoming_call', {
            name: 'Incoming Calls',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 500, 200, 500],
            sound: 'default',
          });
        }

        // Register notification category with Accept / Decline action buttons
        await Notifications.setNotificationCategoryAsync('incoming_call', [
          {
            identifier: 'accept',
            buttonTitle: '✅ Accept',
            options: { opensAppToForeground: true },
          },
          {
            identifier: 'decline',
            buttonTitle: '❌ Decline',
            options: { opensAppToForeground: false, isDestructive: true },
          },
        ]);

        const pushTokenData = await Notifications.getExpoPushTokenAsync();
        const expoPushToken = pushTokenData.data;

        // Save to backend
        await fetch(`${API_V1}/profile/me/push-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ token: expoPushToken }),
        });
      } catch { /* Expo Go or simulator — silently skip */ }
    };

    register();
  }, [token]);

  // ── Handle push notification taps (app in background / killed) ────────────
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const data   = response.notification.request.content.data as Record<string, any>;
      const action = response.actionIdentifier;
      if (!data) return;

      // ── Incoming call notification actions ──────────────────────────────
      if (data.type === 'call') {
        const callerName  = (data.caller_name  ?? data.sender_name ?? 'Someone') as string;
        const callerImage = (data.caller_image ?? data.sender_image ?? '') as string;
        const callerId    = (data.from ?? data.sender_id ?? '') as string;

        if (action === 'decline') {
          // User tapped Decline from the notification — no need to open the app
          return;
        }
        // 'accept' or default tap → open app and show incoming call screen
        setIncomingCall({ id: callerId, name: callerName, image: callerImage || undefined });
        return;
      }

      // ── Active-call persistent notification tap → just bring app to foreground
      // (CallContext still holds the active call state, so the call screen re-appears)
      if (data.type === 'active_call') return;

      // ── Regular chat / match notifications ──────────────────────────────
      if (data.type === 'match' || data.type === 'chat') {
        const otherId = data.other_user_id as string | undefined;
        const name    = data.other_name   as string | undefined;
        const image   = data.other_image  as string | undefined;
        const roomId  = data.room_id      as string | undefined;
        if (otherId) {
          router.push({
            pathname: '/chat',
            params: { matchId: roomId ?? otherId, name: name ?? '', image: image ?? '', online: 'false' },
          } as any);
        }
      }
    });
    return () => sub.remove();
  }, [router, setIncomingCall]);

  // Sync theme from backend profile whenever profile changes
  useEffect(() => {
    if (profile?.dark_mode !== undefined && profile.dark_mode !== null) {
      syncFromBackend(profile.dark_mode);
    }
  }, [profile?.dark_mode]);

  // Inject the API save function into ThemeContext so toggle() can PATCH backend
  useEffect(() => {
    if (!token) return;
    setApiFetch(async (fields: Record<string, unknown>) => {
      await fetch(`${API_V1}/profile/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(fields),
      });
    });
  }, [token]);

  const isLoggedIn = !!token;
  const authReady  = !isLoading;

  useEffect(() => {
    // Run as soon as auth state is known — do NOT wait for splashDone.
    // This means routing fires while the splash is still covering the screen,
    // so when the splash fades out the correct screen is already showing.
    if (!authReady) return;
    // If there's a network error, routing is handled by the NoConnectionScreen —
    // don't redirect the user anywhere.
    if (isNetworkError) {
      if (!routingSignalledRef.current) {
        routingSignalledRef.current = true;
        signalReady();
      }
      return;
    }

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
      // If token is set but profile hasn't arrived yet (e.g. mid quick-sign-in),
      // hold off — navigating now would flash the profile/onboarding screen.
      if (!profile && !isOnboarded) {
        // Don't set didNavigate — routingDone will be signalled on next fire
        // eslint-disable-next-line no-empty
      } else if (isOnboarded) {
        router.replace('/(tabs)' as any);
        didNavigate = true;
      } else {
        const next = profile ? firstIncompleteStep(profile) : '/profile';
        router.replace(next as any);
        didNavigate = true;
      }

    } else if (isLoggedIn && !isOnboarded && isOnProtectedScreen) {
      const next = profile ? firstIncompleteStep(profile) : '/profile';
      router.replace(next as any);
      didNavigate = true;

    } else if (
      isLoggedIn &&
      isOnboarded &&
      (profile?.face_scan_required || profile?.id_scan_required) &&
      currentScreen !== 'face-scan-required'
    ) {
      // Account flagged for mandatory verification (face scan or ID upload).
      // Block access to all other screens until the required scan is completed.
      router.replace('/face-scan-required' as any);
      didNavigate = true;

    } else if (isLoggedIn && isOnboarded && isOnOnboardingScreen) {
      // User just completed onboarding while on an onboarding screen (e.g. pressed
      // Finish on FaithScreen or Continue on ReligionScreen). Redirect to the app.
      router.replace('/(tabs)' as any);
      didNavigate = true;
    }

    // Signal splash it may begin fading out — routing has been decided.
    // We use a short timeout so router.replace() has one JS tick to register
    // the new route before the splash starts revealing the screen.
    if (!routingSignalledRef.current) {
      routingSignalledRef.current = true;
      setTimeout(signalReady, didNavigate ? 100 : 0);
    }

  }, [authReady, isLoggedIn, isOnboarded, isNetworkError, profile?.face_scan_required, profile?.id_scan_required, segments]);

  const bgColor = isDark ? darkColors.bg : lightColors.bg;

  return (
    <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <View style={{ flex: 1, backgroundColor: bgColor }}>

        {/* Only render the Stack when there's no network error */}
        {!isNetworkError && (
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
            <Stack.Screen name="chat"            options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="mini-games"     options={{ headerShown: false }} />
            <Stack.Screen name="notifications"   options={{ headerShown: false }} />
            <Stack.Screen name="security"        options={{ headerShown: false }} />
            <Stack.Screen name="legal"           options={{ headerShown: false }} />
            <Stack.Screen name="get-help"        options={{ headerShown: false }} />
            <Stack.Screen name="purchases"              options={{ headerShown: false }} />
            <Stack.Screen name="admin-verifications"  options={{ headerShown: false }} />
            <Stack.Screen name="zod-work"             options={{ headerShown: false }} />
            <Stack.Screen name="work-edit-profile"    options={{ headerShown: false }} />
            <Stack.Screen name="religion"             options={{ headerShown: false }} />
            <Stack.Screen name="faith"               options={{ headerShown: false }} />
            <Stack.Screen name="face-scan-required"   options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="modal"                options={{ presentation: 'modal', title: 'Modal' }} />
          </Stack>
        )}

        <StatusBar style={isDark ? 'light' : 'dark'} />

        {/* No connection overlay — shown on top after splash fades out. */}
        {isNetworkError && splashDone && (
          <View style={StyleSheet.absoluteFill}>
            <NoConnectionScreen />
          </View>
        )}

        {/* Instant black cover for post-splash auth redirects (e.g. logout). */}
        {covering && <View style={styles.cover} />}

        {/* Opaque cover while auth is bootstrapping. */}
        {isLoading && !splashDone && (
          <View style={[styles.cover, { backgroundColor: bgColor }]} />
        )}


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

/** Thin bridge: reads token from AuthContext and passes it to CallProvider. */
function CallProviderBridge() {
  const { token } = useAuth();
  return (
    <CallProvider token={token}>
      <RootLayoutInner />
    </CallProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'ProductSans-Regular': require('@/assets/product sans full/ProductSans-Regular.ttf'),
    'ProductSans-Medium':  require('@/assets/product sans full/ProductSans-Medium.ttf'),
    'ProductSans-Bold':    require('@/assets/product sans full/ProductSans-Bold.ttf'),
    'ProductSans-Black':   require('@/assets/product sans full/ProductSans-Black.ttf'),
    'ProductSans-Light':   require('@/assets/product sans full/ProductSans-Light.ttf'),
    'PageSerif':           require('../PAGE SERIF (Demo_Font).otf'),
  });

  const [splashReady, setSplashReady] = useState(false);
  const [splashDone,  setSplashDone]  = useState(false);

  const splashCtx = useMemo(
    () => ({ signalReady: () => setSplashReady(true), splashDone }),
    [splashDone],
  );

  // Hide the native splash only when fonts AND auth routing are both ready.
  // This gives a single seamless Zod-logo screen — no JS overlay, no black flicker.
  useEffect(() => {
    if (!fontsLoaded || !splashReady) return;
    SplashScreen.hideAsync()
      .catch(() => {})
      .finally(() => setSplashDone(true));
  }, [fontsLoaded, splashReady]);

  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      {fontsLoaded && (
        <SplashCtx.Provider value={splashCtx}>
          <AppThemeProvider>
            <AuthProvider>
              <CallProviderBridge />
            </AuthProvider>
          </AppThemeProvider>
        </SplashCtx.Provider>
      )}
    </View>
  );
}
