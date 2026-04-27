import { navPush } from '@/utils/nav';
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Google from 'expo-auth-session/providers/google';
import { Image } from 'expo-image';
import * as LocalAuthentication from 'expo-local-authentication';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { getDeviceInfo } from '@/utils/deviceInfo';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import Squircle from '@/components/ui/Squircle';

import { apiFetch, authedFetch } from '@/constants/api';
import {
  useAuth,
  loadRecentAccount,
  saveRecentAccount,
  type RecentAccount,
  type UserProfile,
} from '@/context/AuthContext';

WebBrowser.maybeCompleteAuthSession();

const TERMS_URL   = 'https://zod.dhabli.com/terms';
const PRIVACY_URL = 'https://zod.dhabli.com/privacy';

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  is_new_user?: boolean;
}

const Logo = ({ size = 180 }: { size?: number }) => {
  const h = Math.round(size * (347 / 741));
  return (
    <Svg width={size} height={h} viewBox="0 0 741 347" fill="none">
      <Path
        d="M168.701 346.924H0L128.174 116.699C84.9609 127.441 35.6445 169.922 21.4844 201.416C6.34766 186.768 0 170.898 0 156.494C0 130.615 20.9961 109.619 49.5605 109.619H218.262L91.0645 339.6C134.033 328.613 182.617 286.377 196.777 255.127C211.914 269.775 218.262 285.4 218.262 299.805C218.262 325.928 197.266 346.924 168.701 346.924ZM347.9 346.924C282.471 346.924 229.492 293.701 229.492 228.027C229.492 162.354 282.471 109.131 347.9 109.131C413.33 109.131 466.309 162.354 466.309 228.027C466.309 293.701 413.33 346.924 347.9 346.924ZM393.799 320.068C402.344 320.068 407.471 312.988 407.471 301.025C407.471 253.662 336.182 136.23 302.002 135.986C293.945 135.986 288.33 142.578 288.33 155.029C288.33 202.393 359.619 320.068 393.799 320.068ZM707.275 346.924C675.781 346.924 644.775 335.693 644.775 300.781C631.592 330.566 602.539 346.924 573.73 346.924C545.166 346.924 516.846 331.055 503.662 297.119C497.314 280.518 494.141 259.521 494.141 237.793C494.141 209.229 499.512 179.932 509.521 158.936C525.635 124.756 556.396 108.887 584.473 108.887C612.061 108.887 637.207 124.023 644.775 151.855V80.8105C644.775 58.1055 640.869 51.5137 623.535 41.2598L724.854 0V312.012C724.854 324.951 729.248 339.355 740.723 342.773C730.957 345.459 718.994 346.924 707.275 346.924ZM615.479 307.129C625.244 307.129 635.742 301.514 644.775 291.26V161.133C636.475 148.926 627.93 143.555 619.873 143.555C596.436 143.555 582.764 186.768 582.764 237.305C582.764 250.732 583.74 263.916 586.182 275.391C590.82 297.119 602.539 307.129 615.479 307.129Z"
        fill="white"
      />
    </Svg>
  );
};

const GoogleLogo = () => (
  <Svg width={20} height={20} viewBox="0 0 48 48">
    <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    <Path fill="none" d="M0 0h48v48H0z"/>
  </Svg>
);

const GOOGLE_IOS_CLIENT_ID     = '48845965654-q028qerm28qe3vo5t8mh6e12r108oo2g.apps.googleusercontent.com';
const GOOGLE_ANDROID_CLIENT_ID = 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com';

export default function WelcomeScreen() {
  const { signIn, performQuickSignIn } = useAuth();
  const router = useRouter();
  const [appleLoading,  setAppleLoading]  = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [quickLoading,  setQuickLoading]  = useState(false);
  const [eulaAccepted,  setEulaAccepted]  = useState(false);
  // null = loading, undefined = no recent account, RecentAccount = has one
  const [recentAccount, setRecentAccount] = useState<RecentAccount | null | undefined>(null);
  const [showOtherMethods, setShowOtherMethods] = useState(false);
  const [testModeEnabled, setTestModeEnabled] = useState(false);

  const [googleRequest, googleResponse, promptGoogleAsync] = Google.useAuthRequest({
    iosClientId:     GOOGLE_IOS_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
  });

  useEffect(() => {
    loadRecentAccount()
      .then(acc => setRecentAccount(acc ?? undefined))
      .catch(() => setRecentAccount(undefined));
    
    // Fetch test mode config
    apiFetch<{ test_mode_enabled: boolean }>('/config/public')
      .then(data => setTestModeEnabled(data.test_mode_enabled))
      .catch(() => setTestModeEnabled(false)); // Default to false if API fails
  }, []);

  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const { authentication } = googleResponse;
      if (authentication?.accessToken) {
        handleGoogleToken(authentication.accessToken);
      }
    } else if (googleResponse?.type === 'error') {
      setGoogleLoading(false);
      Alert.alert('Sign In Failed', googleResponse.error?.message ?? 'Google sign-in failed. Please try again.');
    } else if (googleResponse?.type === 'dismiss' || googleResponse?.type === 'cancel') {
      setGoogleLoading(false);
    }
  }, [googleResponse]);

  const openInAppBrowser = (url: string) =>
    WebBrowser.openBrowserAsync(url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      enableBarCollapsing: true,
    });

  const handleGoogleToken = async (googleAccessToken: string) => {
    try {
      const device = await getDeviceInfo();
      const data = await apiFetch<TokenResponse>('/auth/google', {
        method: 'POST',
        body: JSON.stringify({ access_token: googleAccessToken, device }),
      });

      const me = await authedFetch<UserProfile>('/profile/me', data.access_token);

      // Pass pre-fetched profile to avoid a redundant /profile/me call inside signIn()
      await signIn(data.access_token, data.refresh_token, me.is_onboarded, 'google', me);

      const dest = me.is_onboarded ? '/(tabs)' : '/gender';

      // New user — collect and verify phone number as part of sign-up
      if (data.is_new_user && !me.phone) {
        router.push({ pathname: '/phone' as any, params: { mode: 'link', next: dest } });
        return;
      }

      goToPasskeySetup(
        { name: me.full_name ?? null, phone: me.phone ?? null, photo: me.photos?.[0] ?? null, method: 'google' },
        dest,
      );
    } catch (err: any) {
      Alert.alert('Sign In Failed', err.message ?? 'Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!eulaAccepted) {
      Alert.alert('Please agree first', 'You must accept our Terms of Service and Community Guidelines before continuing.');
      return;
    }
    setGoogleLoading(true);
    await promptGoogleAsync();
  };

  /** Navigate to passkey setup passing account info so the screen can save it.
   *  If the same user is signing in again → skip (already saved).
   *  If a different user → silently overwrite the saved account.
   *  If no saved account → show the passkey setup screen to ask permission. */
  const goToPasskeySetup = async (
    account: { name: string | null; phone: string | null; photo: string | null; method: 'phone' | 'apple' | 'google' },
    next: string,
  ) => {
    const existing = await loadRecentAccount();
    if (!existing) {
      // No saved account — show passkey screen to ask the user
      router.push({
        pathname: '/passkey' as any,
        params: {
          name:   account.name   ?? '',
          phone:  account.phone  ?? '',
          photo:  account.photo  ?? '',
          method: account.method,
          next,
        },
      });
      return;
    }
    // Determine if this is the same user (compare by phone for phone accounts)
    const isSameUser = account.method === 'phone'
      ? (existing.phone != null && existing.phone === account.phone)
      : existing.method === 'apple';

    if (!isSameUser) {
      // Different user — silently overwrite so the card reflects the new user
      await saveRecentAccount(account);
    }
    // Guard in _layout.tsx handles the navigation to (tabs)/onboarding.
    // Calling router.replace here too would double-mount the feed screen.
  };

  const handleAppleSignIn = async (fromQuickSignIn = false) => {
    try {
      setAppleLoading(true);

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const { identityToken, fullName } = credential;
      if (!identityToken) {
        Alert.alert('Sign In Failed', 'No identity token returned from Apple.');
        return;
      }

      const appleFullName = [fullName?.givenName, fullName?.familyName]
        .filter(Boolean)
        .join(' ') || undefined;

      const device = await getDeviceInfo();
      const data = await apiFetch<TokenResponse>('/auth/apple', {
        method: 'POST',
        body: JSON.stringify({ identity_token: identityToken, full_name: appleFullName, device }),
      });

      const me = await authedFetch<UserProfile>('/profile/me', data.access_token);

      // Pass pre-fetched profile to avoid a redundant /profile/me call inside signIn()
      await signIn(data.access_token, data.refresh_token, me.is_onboarded, 'apple', me);

      // After signing in, offer to save to Keychain only if this was a fresh sign-in
      if (!fromQuickSignIn) {
        const dest = me.is_onboarded ? '/(tabs)' : '/gender';

        // New user — collect and verify phone number as part of sign-up
        if (data.is_new_user && !me.phone) {
          router.push({ pathname: '/phone' as any, params: { mode: 'link', next: dest } });
          return;
        }

        goToPasskeySetup(
          { name: me.full_name ?? null, phone: me.phone ?? null, photo: me.photos?.[0] ?? null, method: 'apple' },
          dest,
        );
      }
    } catch (err: any) {
      if (err?.code === 'ERR_REQUEST_CANCELED') return;
      Alert.alert('Sign In Failed', err.message ?? 'Please try again.');
    } finally {
      setAppleLoading(false);
    }
  };

  /** Quick sign-in — biometric gate → silent token refresh → direct login (no OTP) */
  const handleQuickSignIn = async () => {
    if (!recentAccount || quickLoading) return;

    // ── 1. Device authentication gate (Face ID → Touch ID → Passcode) ────────
    // iOS picks the best method the device supports; passcode is the fallback
    // when Face ID/Touch ID is unavailable or permission has been denied.
    try {
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (enrolled) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: `Sign in as ${recentAccount.name ?? 'you'}`,
          cancelLabel:   'Cancel',
          fallbackLabel: 'Use Passcode',
        });
        if (!result.success) return; // user cancelled
      }
    } catch { /* no auth hardware — continue */ }

    // ── 2. Silent re-auth using stored refresh token ───────────────────────────
    setQuickLoading(true);
    try {
      const dest = await performQuickSignIn();
      if (dest) {
        // Success — context state was updated; the routing guard in _layout.tsx
        // will navigate automatically. No explicit router.replace needed here.
        return;
      }
      // Token expired — clear card and fall back to normal sign-in
      setRecentAccount(undefined);
      Alert.alert('Session expired', 'Please sign in again.');
    } catch (err: any) {
      if (err?.message === 'NETWORK_ERROR') {
        Alert.alert('No connection', 'Check your internet and try again.');
      } else {
        setRecentAccount(undefined);
        Alert.alert('Session expired', 'Please sign in again.');
      }
    } finally {
      setQuickLoading(false);
    }
  };

  // Still loading saved account from storage — render nothing to avoid flash
  if (recentAccount === null) return null;

  const hasRecent = recentAccount !== undefined;

  return (
    <View style={styles.container}>
      <Image
        source={{ uri: 'https://i.ibb.co/RkpmdXSH/2148020007.jpg' }}
        style={styles.bg}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={200}
      />
      <View style={styles.overlay} />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {/* ── Logo pinned to top-left ── */}
          <View style={styles.logoWrap}>
            <Logo size={120} />
          </View>

          {/* ── Tagline sits just above the buttons ── */}
          <View style={styles.bottom}>
            {hasRecent && !showOtherMethods ? (
              /* ── Quick sign-in card ──────────────────────────────── */
              <>
                <TouchableOpacity activeOpacity={0.82} onPress={() => {
                    if (!eulaAccepted) {
                      Alert.alert('Please agree first', 'You must accept our Terms of Service and Community Guidelines before continuing.');
                      return;
                    }
                    handleQuickSignIn();
                  }} disabled={quickLoading}>
                  <Squircle
                    style={styles.recentBtn}
                    cornerRadius={22}
                    cornerSmoothing={1}
                    fillColor="#fff"
                  >
                    <View style={styles.recentAvatar}>
                      {recentAccount.photo ? (
                        <Image
                          source={{ uri: recentAccount.photo }}
                          style={styles.recentAvatarImg}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                        />
                      ) : (
                        <View style={styles.recentAvatarPlaceholder} />
                      )}
                    </View>
                    <View style={styles.recentInfo}>
                      <Text style={styles.recentLabel}>Continue as</Text>
                      <Text style={styles.recentName} numberOfLines={1}>
                        {recentAccount.name ?? 'Continue'}
                      </Text>
                      {recentAccount.phone && (
                        <Text style={styles.recentPhone} numberOfLines={1}>
                          {recentAccount.phone}
                        </Text>
                      )}
                    </View>
                    {quickLoading
                      ? <ActivityIndicator size="small" color="rgba(0,0,0,0.4)" />
                      : <Ionicons name="chevron-forward" size={20} color="rgba(0,0,0,0.35)" />
                    }
                  </Squircle>
                </TouchableOpacity>

                <Pressable onPress={() => setShowOtherMethods(true)}>
                  <Text style={styles.otherMethods}>Use another account</Text>
                </Pressable>
              </>
            ) : (
              /* ── Standard auth buttons ───────────────────────────── */
              <View style={styles.authButtons}>
                <TouchableOpacity
                  style={styles.btnApple}
                  onPress={() => {
                    if (!eulaAccepted) {
                      Alert.alert('Please agree first', 'You must accept our Terms of Service and Community Guidelines before continuing.');
                      return;
                    }
                    handleAppleSignIn(false);
                  }}
                  disabled={appleLoading}
                  activeOpacity={0.85}
                >
                  {appleLoading ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <View style={styles.btnAppleInner}>
                      <Ionicons name="logo-apple" size={20} color="#000" />
                      <Text style={styles.btnAppleText}>Continue with Apple</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.btnGoogle}
                  onPress={handleGoogleSignIn}
                  disabled={googleLoading || !googleRequest}
                  activeOpacity={0.85}
                >
                  {googleLoading ? (
                    <ActivityIndicator color="#444" />
                  ) : (
                    <View style={styles.btnGoogleInner}>
                      <GoogleLogo />
                      <Text style={styles.btnGoogleText}>Continue with Google</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {testModeEnabled && (
                  <TouchableOpacity
                    style={[styles.btnPhone, !eulaAccepted && { opacity: 0.45 }]}
                    onPress={() => {
                      if (!eulaAccepted) {
                        Alert.alert('Please agree first', 'You must accept our Terms of Service and Community Guidelines before continuing.');
                        return;
                      }
                      navPush('/phone' as any);
                    }}
                  >
                    <Text style={styles.btnPhoneText}>Use phone number</Text>
                  </TouchableOpacity>
                )}

                {hasRecent && (
                  <Pressable onPress={() => setShowOtherMethods(false)}>
                    <Text style={styles.otherMethods}>Back</Text>
                  </Pressable>
                )}
              </View>
            )}

            {/* ── EULA checkbox ── */}
            <Pressable onPress={() => setEulaAccepted(v => !v)} style={styles.eulaRow}>
              <View style={[styles.eulaBox, eulaAccepted && styles.eulaBoxChecked]}>
                {eulaAccepted && <Ionicons name="checkmark" size={13} color="#000" />}
              </View>
              <Text style={styles.eulaText}>
                I agree to the{' '}
                <Text style={styles.legalLink} onPress={() => openInAppBrowser(TERMS_URL)}>
                  Terms of Service
                </Text>
                {' '}and{' '}
                <Text style={styles.legalLink} onPress={() => openInAppBrowser('https://zod.dhabli.com/community-guidelines')}>
                  Community Guidelines
                </Text>
                . I confirm I am 18 or older and will not post objectionable content.
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  bg: { ...StyleSheet.absoluteFillObject },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  safeArea: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 0,
    paddingBottom: 36,
    justifyContent: 'space-between',
  },
  logoWrap: {
    paddingTop: 8,
    alignSelf: 'flex-start',
  },
  bottom: { gap: 14 },
  otherMethods: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'ProductSans-Medium',
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  authButtons: { gap: 12 },
  btnApple: {
    backgroundColor: '#fff',
    borderRadius: 50,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  btnAppleInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnAppleText: { fontSize: 16, fontFamily: 'ProductSans-Bold', color: '#000', marginTop: 0, marginBottom: 0, includeFontPadding: false },
  btnPhone: {
    backgroundColor: 'transparent',
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#fff',
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPhoneText: { fontSize: 16, fontFamily: 'ProductSans-Bold', color: '#fff' },
  btnGoogle: {
    backgroundColor: 'transparent',
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#fff',
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  btnGoogleInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnGoogleText: { fontSize: 16, fontFamily: 'ProductSans-Bold', color: '#fff', marginTop: 0, marginBottom: 0, includeFontPadding: false },
  legal: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontFamily: 'ProductSans-Regular',
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 4,
  },
  legalLink: { textDecorationLine: 'underline', color: '#fff' },
  eulaRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 4 },
  eulaBox:   { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center', marginTop: 1, backgroundColor: 'transparent', flexShrink: 0 },
  eulaBoxChecked: { backgroundColor: '#fff', borderColor: '#fff' },
  eulaText:  { flex: 1, color: 'rgba(255,255,255,0.7)', fontSize: 11, fontFamily: 'ProductSans-Regular', lineHeight: 17 },

  // Recent account card
  recentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 14,
    minHeight: 72,
  },
  recentAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#e5e5e5',
  },
  recentAvatarImg: { width: 48, height: 48 },
  recentAvatarPlaceholder: { flex: 1, backgroundColor: '#d0d0d0' },
  recentInfo: { flex: 1 },
  recentLabel: {
    fontSize: 10,
    fontFamily: 'ProductSans-Regular',
    color: 'rgba(0,0,0,0.45)',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  recentName: { fontSize: 16, fontFamily: 'ProductSans-Bold', color: '#000' },
  recentPhone: {
    fontSize: 13,
    fontFamily: 'ProductSans-Regular',
    color: 'rgba(0,0,0,0.5)',
    marginTop: 1,
  },
});
