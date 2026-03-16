import * as AppleAuthentication from 'expo-apple-authentication';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
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

import { apiFetch, authedFetch } from '@/constants/api';
import { useAuth } from '@/context/AuthContext';

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

const Logo = () => (
  <Svg width={120} height={56} viewBox="0 0 741 347" fill="none">
    <Path
      d="M168.701 346.924H0L128.174 116.699C84.9609 127.441 35.6445 169.922 21.4844 201.416C6.34766 186.768 0 170.898 0 156.494C0 130.615 20.9961 109.619 49.5605 109.619H218.262L91.0645 339.6C134.033 328.613 182.617 286.377 196.777 255.127C211.914 269.775 218.262 285.4 218.262 299.805C218.262 325.928 197.266 346.924 168.701 346.924ZM347.9 346.924C282.471 346.924 229.492 293.701 229.492 228.027C229.492 162.354 282.471 109.131 347.9 109.131C413.33 109.131 466.309 162.354 466.309 228.027C466.309 293.701 413.33 346.924 347.9 346.924ZM393.799 320.068C402.344 320.068 407.471 312.988 407.471 301.025C407.471 253.662 336.182 136.23 302.002 135.986C293.945 135.986 288.33 142.578 288.33 155.029C288.33 202.393 359.619 320.068 393.799 320.068ZM707.275 346.924C675.781 346.924 644.775 335.693 644.775 300.781C631.592 330.566 602.539 346.924 573.73 346.924C545.166 346.924 516.846 331.055 503.662 297.119C497.314 280.518 494.141 259.521 494.141 237.793C494.141 209.229 499.512 179.932 509.521 158.936C525.635 124.756 556.396 108.887 584.473 108.887C612.061 108.887 637.207 124.023 644.775 151.855V80.8105C644.775 58.1055 640.869 51.5137 623.535 41.2598L724.854 0V312.012C724.854 324.951 729.248 339.355 740.723 342.773C730.957 345.459 718.994 346.924 707.275 346.924ZM615.479 307.129C625.244 307.129 635.742 301.514 644.775 291.26V161.133C636.475 148.926 627.93 143.555 619.873 143.555C596.436 143.555 582.764 186.768 582.764 237.305C582.764 250.732 583.74 263.916 586.182 275.391C590.82 297.119 602.539 307.129 615.479 307.129Z"
      fill="white"
    />
  </Svg>
);

export default function WelcomeScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  const handleAppleSignIn = async () => {
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

      // Build display name from Apple's name components (only sent on first sign-in)
      const appleFullName = [fullName?.givenName, fullName?.familyName]
        .filter(Boolean)
        .join(' ') || undefined;

      const data = await apiFetch<TokenResponse>('/auth/apple', {
        method: 'POST',
        body: JSON.stringify({
          identity_token: identityToken,
          full_name: appleFullName,
        }),
      });

      // Fetch profile to check onboarding status before triggering the auth guard
      const me = await authedFetch<{ is_onboarded: boolean }>(
        '/profile/me',
        data.access_token,
      );

      await signIn(data.access_token, data.refresh_token, me.is_onboarded);
    } catch (err: any) {
      // User cancelled the Apple dialog — don't show an error
      if (err?.code === 'ERR_REQUEST_CANCELED') return;
      Alert.alert('Sign In Failed', err.message ?? 'Please try again.');
    } finally {
      setAppleLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Background image */}
      <Image
        source={{ uri: 'https://i.ibb.co/RkpmdXSH/2148020007.jpg' }}
        style={styles.bg}
        contentFit="cover"
      />

      {/* Dark overlay */}
      <View style={styles.overlay} />

      {/* Safe content */}
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {/* Logo */}
          <View style={styles.logoRow}>
            <Logo />
          </View>

          {/* Tagline */}
          <Text style={styles.tagline}>Find{'\n'}True Love</Text>

          {/* Bottom section */}
          <View style={styles.bottom}>
            {expanded ? (
              <View style={styles.authButtons}>
                {/* Sign in with Apple */}
                <TouchableOpacity
                  style={styles.btnApple}
                  onPress={handleAppleSignIn}
                  disabled={appleLoading}
                  activeOpacity={0.85}
                >
                  {appleLoading ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <Text style={styles.btnAppleText}>  Continue with Apple</Text>
                  )}
                </TouchableOpacity>

                {/* Phone number */}
                <TouchableOpacity
                  style={styles.btnPhone}
                  onPress={() => router.push('/phone' as any)}
                >
                  <Text style={styles.btnPhoneText}>Use phone number</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <TouchableOpacity style={styles.btnPrimary} onPress={() => setExpanded(true)}>
                  <Text style={styles.btnPrimaryText}>Quick sign in</Text>
                </TouchableOpacity>

                <Pressable onPress={() => setExpanded(true)}>
                  <Text style={styles.otherMethods}>Continue with other methods</Text>
                </Pressable>
              </>
            )}

            <Text style={styles.legal}>
              By signing up, you agree to our{' '}
              <Text style={styles.legalLink}>Terms</Text>. See how we use your data in our{' '}
              <Text style={styles.legalLink}>Privacy Policy</Text>.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 36,
    justifyContent: 'space-between',
  },
  logoRow: {
    alignItems: 'flex-start',
  },
  tagline: {
    fontSize: 54,
    fontFamily: 'ProductSans-Black',
    color: '#fff',
    lineHeight: 60,
    marginTop: 'auto',
    marginBottom: 32,
  },
  bottom: {
    gap: 14,
  },
  btnPrimary: {
    backgroundColor: '#fff',
    borderRadius: 50,
    paddingVertical: 18,
    alignItems: 'center',
  },
  btnPrimaryText: {
    fontSize: 16,
    fontFamily: 'ProductSans-Bold',
    color: '#000',
  },
  otherMethods: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'ProductSans-Medium',
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  authButtons: {
    gap: 12,
  },
  btnApple: {
    backgroundColor: '#fff',
    borderRadius: 50,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  btnAppleText: {
    fontSize: 16,
    fontFamily: 'ProductSans-Bold',
    color: '#000',
  },
  btnPhone: {
    backgroundColor: 'transparent',
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#fff',
    paddingVertical: 18,
    alignItems: 'center',
  },
  btnPhoneText: {
    fontSize: 16,
    fontFamily: 'ProductSans-Bold',
    color: '#fff',
  },
  legal: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontFamily: 'ProductSans-Regular',
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 4,
  },
  legalLink: {
    textDecorationLine: 'underline',
    color: '#fff',
  },
});
