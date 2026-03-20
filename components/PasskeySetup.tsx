import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Button from '@/components/ui/Button';
import Squircle from '@/components/ui/Squircle';
import { saveRecentAccount, loadRecentAccount, type RecentAccount } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';

const Logo = ({ color }: { color: string }) => (
  <Svg width={80} height={38} viewBox="0 0 741 347" fill="none">
    <Path
      d="M168.701 346.924H0L128.174 116.699C84.9609 127.441 35.6445 169.922 21.4844 201.416C6.34766 186.768 0 170.898 0 156.494C0 130.615 20.9961 109.619 49.5605 109.619H218.262L91.0645 339.6C134.033 328.613 182.617 286.377 196.777 255.127C211.914 269.775 218.262 285.4 218.262 299.805C218.262 325.928 197.266 346.924 168.701 346.924ZM347.9 346.924C282.471 346.924 229.492 293.701 229.492 228.027C229.492 162.354 282.471 109.131 347.9 109.131C413.33 109.131 466.309 162.354 466.309 228.027C466.309 293.701 413.33 346.924 347.9 346.924ZM393.799 320.068C402.344 320.068 407.471 312.988 407.471 301.025C407.471 253.662 336.182 136.23 302.002 135.986C293.945 135.986 288.33 142.578 288.33 155.029C288.33 202.393 359.619 320.068 393.799 320.068ZM707.275 346.924C675.781 346.924 644.775 335.693 644.775 300.781C631.592 330.566 602.539 346.924 573.73 346.924C545.166 346.924 516.846 331.055 503.662 297.119C497.314 280.518 494.141 259.521 494.141 237.793C494.141 209.229 499.512 179.932 509.521 158.936C525.635 124.756 556.396 108.887 584.473 108.887C612.061 108.887 637.207 124.023 644.775 151.855V80.8105C644.775 58.1055 640.869 51.5137 623.535 41.2598L724.854 0V312.012C724.854 324.951 729.248 339.355 740.723 342.773C730.957 345.459 718.994 346.924 707.275 346.924ZM615.479 307.129C625.244 307.129 635.742 301.514 644.775 291.26V161.133C636.475 148.926 627.93 143.555 619.873 143.555C596.436 143.555 582.764 186.768 582.764 237.305C582.764 250.732 583.74 263.916 586.182 275.391C590.82 297.119 602.539 307.129 615.479 307.129Z"
      fill={color}
    />
  </Svg>
);

const BULLET_POINTS: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }[] = [
  { icon: 'lock-closed',      text: "Saved securely to your Apple Keychain — only Face ID or Touch ID can unlock it." },
  { icon: 'phone-portrait',   text: 'One tap to sign back in on this device, no password needed.' },
  { icon: 'shield-checkmark', text: 'Your login details are encrypted and never leave your device.' },
  { icon: 'time',             text: "Skip this for now — you can always enable it later in Settings." },
];

export default function PasskeySetup() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(true);

  // Account info is passed as params from OTP/Apple sign-in
  const params = useLocalSearchParams<{
    name?: string;
    phone?: string;
    photo?: string;
    method?: 'phone' | 'apple';
    next?: string; // where to go after this screen
  }>();

  const proceed = () => {
    const next = params.next ?? '/(tabs)';
    router.replace(next as any);
  };

  // If keychain is already saved for this device, skip immediately — never show twice
  useEffect(() => {
    loadRecentAccount().then(existing => {
      if (existing) {
        proceed();
      } else {
        setChecking(false);
      }
    }).catch(() => setChecking(false));
  // proceed reference is stable (router is stable), deps intentionally empty
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const account: RecentAccount = {
        name:   params.name   ?? null,
        phone:  params.phone  ?? null,
        photo:  params.photo  ?? null,
        method: (params.method as 'phone' | 'apple') ?? 'phone',
      };
      await saveRecentAccount(account);
      proceed();
    } catch {
      Alert.alert('Could not save', 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Render nothing while checking keychain to avoid any UI flash before auto-skipping
  if (checking) return null;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable onPress={proceed} hitSlop={12}>
            <Squircle style={styles.backBtn} cornerRadius={14} cornerSmoothing={1} fillColor={colors.backBtnBg}>
              <Ionicons name="close" size={20} color={colors.text} />
            </Squircle>
          </Pressable>
        </View>

        <View style={styles.body}>
          <View style={styles.logoWrap}>
            <Logo color={colors.text} />
          </View>

          <Squircle style={styles.passkeyIcon} cornerRadius={24} cornerSmoothing={1} fillColor={colors.surface2}>
            <Ionicons name="key" size={32} color={colors.text} />
          </Squircle>

          <Text style={[styles.title, { color: colors.text }]}>Save login info{'\n'}to Apple Keychain?</Text>

          <View style={styles.bullets}>
            {BULLET_POINTS.map((item, i) => (
              <View key={i} style={styles.bulletRow}>
                <View style={styles.bulletIconWrap}>
                  <Ionicons name={item.icon} size={16} color={colors.textSecondary} />
                </View>
                <Text style={[styles.bulletText, { color: colors.textSecondary }]}>{item.text}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.borderFaint }]}>
        <Button
          title={saving ? 'Saving…' : 'Save to Keychain'}
          onPress={handleSave}
          disabled={saving}
          style={styles.btn}
        />
        <Pressable
          style={({ pressed }) => [styles.notNowBtn, pressed && { opacity: 0.6 }]}
          onPress={proceed}
        >
          <Text style={[styles.notNowText, { color: colors.textSecondary }]}>Not now</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1 },
  scroll:         { flexGrow: 1 },
  topBar:         { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  backBtn:        { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  body:           { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 },
  logoWrap:       { marginBottom: 32 },
  passkeyIcon:    { width: 68, height: 68, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  title:          { fontSize: 34, fontFamily: 'ProductSans-Black', lineHeight: 42, marginBottom: 36 },
  bullets:        { gap: 24 },
  bulletRow:      { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  bulletIconWrap: { width: 24, alignItems: 'center', marginTop: 2 },
  bulletText:     { flex: 1, fontSize: 15, fontFamily: 'ProductSans-Regular', lineHeight: 23 },
  footer:         { paddingHorizontal: 24, paddingBottom: 32, paddingTop: 12, gap: 12, borderTopWidth: 1 },
  btn:            { width: '100%' },
  notNowBtn:      { height: 54, alignItems: 'center', justifyContent: 'center' },
  notNowText:     { fontSize: 15, fontFamily: 'ProductSans-Medium' },
});
