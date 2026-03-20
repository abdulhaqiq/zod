import { navReplace } from '@/utils/nav';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Squircle from '@/components/ui/Squircle';
import { API_V1 } from '@/constants/api';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';

const REPORT_THRESHOLD = 5;

const REASON_ITEMS = [
  {
    icon: 'person-remove-outline' as const,
    title: 'Multiple identity reports',
    body: `Your account has received ${REPORT_THRESHOLD} or more reports for misrepresenting gender or identity (catfishing).`,
  },
  {
    icon: 'shield-checkmark-outline' as const,
    title: 'Safety verification required',
    body: 'A real-time face scan confirms you are who you say you are and keeps the community safe.',
  },
  {
    icon: 'lock-closed-outline' as const,
    title: 'Access restricted until verified',
    body: 'App features are paused until your identity is confirmed. This usually takes a few seconds.',
  },
];

type ScanStatus = 'idle' | 'pending' | 'passed';

export default function FaceScanRequiredPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { token, updateProfile, profile } = useAuth();
  const clearedRef = useRef(false);
  const isDark = colors.bg === '#000000';

  const [status, setStatus] = useState<ScanStatus>('idle');
  const [checking, setChecking] = useState(true);

  // On focus: only restore pending/passed — failed resets to idle so user always
  // sees a fresh "Scan Face Now" and not a leftover failure from a past session.
  useFocusEffect(
    useCallback(() => {
      if (!token) { setChecking(false); return; }
      setChecking(true);
      fetch(`${API_V1}/upload/verify-face/status`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          const s = data?.attempt?.status;
          if (s === 'verified') {
            setStatus('passed');
            handlePassed();
          } else if (s === 'pending') {
            setStatus('pending');
          } else {
            // rejected or no attempt → show fresh idle state
            setStatus('idle');
          }
        })
        .catch(() => {})
        .finally(() => setChecking(false));
    }, [token])
  );

  const handlePassed = async () => {
    if (clearedRef.current) return;
    clearedRef.current = true;
    try {
      await fetch(`${API_V1}/profile/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ face_scan_required: false }),
      });
    } catch {}
    updateProfile({ face_scan_required: false });
    navReplace('/(tabs)' as any);
  };

  // Determine which tab to open based on what's required.
  // face_scan_required always → face tab; id_scan_required only → id tab.
  const scanTab = profile?.id_scan_required && !profile?.face_scan_required ? 'id' : 'face';

  const goToScan = () => {
    router.push({ pathname: '/verification', params: { tab: scanTab } } as any);
  };

  const gradientColors = isDark
    ? (['#110000', '#080000', '#000000'] as const)
    : (['#fff5f5', '#fffafa', '#ffffff'] as const);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

        {/* Top banner — minimal red tint */}
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          style={[styles.banner, { paddingTop: insets.top + 16 }]}
        >
          {/* Badge */}
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Ionicons name="warning" size={12} color="#ef4444" />
              <Text style={styles.badgeText}>Action Required</Text>
            </View>
          </View>

          <Text style={[styles.bannerTitle, { color: colors.text }]}>
            Identity Verification{'\n'}Required
          </Text>
          <Text style={[styles.bannerSub, { color: colors.textSecondary }]}>
            Your account has been flagged for a mandatory face scan before you can continue.
          </Text>

          {/* Reason cards — dark surface, single red left-border accent */}
          <View style={styles.reasonList}>
            {REASON_ITEMS.map((item, i) => (
              <Squircle
                key={i}
                style={styles.reasonCard}
                cornerRadius={20}
                cornerSmoothing={1}
                fillColor={colors.surface}
                strokeColor={colors.border}
                strokeWidth={1}
              >
                <View style={[styles.reasonIconWrap, { backgroundColor: colors.surface2 }]}>
                  <Ionicons name={item.icon} size={15} color={colors.textSecondary} />
                </View>
                <View style={styles.reasonTextWrap}>
                  <Text style={[styles.reasonTitle, { color: colors.text }]}>{item.title}</Text>
                  <Text style={[styles.reasonBody, { color: colors.textSecondary }]}>{item.body}</Text>
                </View>
              </Squircle>
            ))}
          </View>
        </LinearGradient>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Action section */}
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.scanHeader}>
            <Ionicons name="scan-outline" size={17} color={colors.text} />
            <Text style={[styles.scanHeaderText, { color: colors.text }]}>Complete Your Face Scan</Text>
          </View>

          {checking ? (
            <View style={styles.centerRow}>
              <ActivityIndicator size="small" color={colors.textSecondary} />
              <Text style={[styles.hint, { color: colors.textSecondary }]}>Checking status…</Text>
            </View>

          ) : status === 'pending' ? (
            <Squircle style={styles.statusCard} cornerRadius={16} cornerSmoothing={1}
              fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <ActivityIndicator size="small" color={colors.text} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.statusTitle, { color: colors.text }]}>Under Review</Text>
                <Text style={[styles.statusSub, { color: colors.textSecondary }]}>
                  Your scan is being analysed — usually a few seconds.
                </Text>
              </View>
            </Squircle>

          ) : (
            /* idle — primary CTA */
            <>
              <Text style={[styles.hint, { color: colors.textSecondary }]}>
                {scanTab === 'id'
                  ? 'Upload a valid government-issued ID to continue'
                  : 'Takes about 30 seconds · Your face is never stored'}
              </Text>

              <Pressable
                style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}
                onPress={goToScan}
              >
                <Squircle style={styles.ctaBtn} cornerRadius={28} cornerSmoothing={1}
                  fillColor={colors.text}>
                  <Ionicons name={scanTab === 'id' ? 'card-outline' : 'scan-outline'} size={19} color={colors.bg} />
                  <Text style={[styles.ctaBtnText, { color: colors.bg }]}>
                    {scanTab === 'id' ? 'Verify ID Now' : 'Scan Face Now'}
                  </Text>
                </Squircle>
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1 },
  flex:           { flex: 1 },

  banner:         { paddingHorizontal: 20, paddingBottom: 24, gap: 12 },
  badgeRow:       { flexDirection: 'row' },
  badge:          {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 50,
    backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
  },
  badgeText:      { fontSize: 11, fontFamily: 'ProductSans-Bold', color: '#ef4444' },
  bannerTitle:    { fontSize: 26, fontFamily: 'ProductSans-Black', lineHeight: 32, letterSpacing: -0.5 },
  bannerSub:      { fontSize: 13, fontFamily: 'ProductSans-Regular', lineHeight: 19 },

  reasonList:     { gap: 8, marginTop: 4 },
  reasonCard:     { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, overflow: 'hidden' },
  reasonIconWrap: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  reasonTextWrap: { flex: 1, gap: 2 },
  reasonTitle:    { fontSize: 13, fontFamily: 'ProductSans-Bold' },
  reasonBody:     { fontSize: 12, fontFamily: 'ProductSans-Regular', lineHeight: 17 },

  divider:        { height: StyleSheet.hairlineWidth },

  scroll:         { paddingHorizontal: 20, paddingTop: 22, gap: 16 },
  scanHeader:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scanHeaderText: { fontSize: 15, fontFamily: 'ProductSans-Black' },

  centerRow:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hint:           { fontSize: 13, fontFamily: 'ProductSans-Regular', lineHeight: 19 },

  statusCard:     { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  statusTitle:    { fontSize: 14, fontFamily: 'ProductSans-Bold' },
  statusSub:      { fontSize: 12, fontFamily: 'ProductSans-Regular', lineHeight: 18, marginTop: 2 },

  ctaBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18 },
  ctaBtnText:     { fontSize: 16, fontFamily: 'ProductSans-Black' },
});
