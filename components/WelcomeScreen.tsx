import { navPush } from '@/utils/nav';
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Image } from 'expo-image';
import * as LocalAuthentication from 'expo-local-authentication';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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
} from '@/context/AuthContext';

const TERMS_URL   = 'https://zod.dhabli.com/terms';
const PRIVACY_URL = 'https://zod.dhabli.com/privacy';

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
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

export default function WelcomeScreen() {
  const { signIn, performQuickSignIn } = useAuth();
  const router = useRouter();
  const [appleLoading,  setAppleLoading]  = useState(false);
  const [quickLoading,  setQuickLoading]  = useState(false);
  const [eulaAccepted,  setEulaAccepted]  = useState(false);
  // null = loading, undefined = no recent account, RecentAccount = has one
  const [recentAccount, setRecentAccount] = useState<RecentAccount | null | undefined>(null);
  const [showOtherMethods, setShowOtherMethods] = useState(false);

  useEffect(() => {
    loadRecentAccount()
      .then(acc => setRecentAccount(acc ?? undefined))
      .catch(() => setRecentAccount(undefined));
  }, []);

  const openInAppBrowser = (url: string) =>
    WebBrowser.openBrowserAsync(url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      enableBarCollapsing: true,
    });

  /** Navigate to passkey setup passing account info so the screen can save it.
   *  If the same user is signing in again → skip (already saved).
   *  If a different user → silently overwrite the saved account.
   *  If no saved account → show the passkey setup screen to ask permission. */
  const goToPasskeySetup = async (
    account: { name: string | null; phone: string | null; photo: string | null; method: 'phone' | 'apple' },
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
    router.replace(next as any);
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

      const data = await apiFetch<TokenResponse>('/auth/apple', {
        method: 'POST',
        body: JSON.stringify({ identity_token: identityToken, full_name: appleFullName }),
      });

      const me = await authedFetch<{
        is_onboarded: boolean;
        full_name?: string | null;
        phone?: string | null;
        photos?: string[] | null;
      }>('/profile/me', data.access_token);

      await signIn(data.access_token, data.refresh_token, me.is_onboarded, 'apple');

      // After signing in, offer to save to Keychain only if this was a fresh sign-in
      if (!fromQuickSignIn) {
        const dest = me.is_onboarded ? '/(tabs)' : '/gender';
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
        // Success — navigate directly, no OTP needed
        router.replace(dest as any);
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
            <Text style={styles.taglineSans}>Find True</Text>
            <Text style={styles.taglineSerif}>Love</Text>
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
                  style={[styles.btnApple, !eulaAccepted && { opacity: 0.45 }]}
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
  taglineSans: {
    fontSize: 54,
    fontFamily: 'ProductSans-Black',
    color: '#fff',
    textAlign: 'left',
    lineHeight: 58,
  },
  taglineSerif: {
    fontSize: 54,
    fontFamily: 'ProductSans-Black',
    color: '#fff',
    textAlign: 'left',
    lineHeight: 58,
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
  btnAppleInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnAppleText: { fontSize: 16, fontFamily: 'ProductSans-Bold', color: '#000' },
  btnPhone: {
    backgroundColor: 'transparent',
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#fff',
    paddingVertical: 18,
    alignItems: 'center',
  },
  btnPhoneText: { fontSize: 16, fontFamily: 'ProductSans-Bold', color: '#fff' },
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
