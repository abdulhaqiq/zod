import { navReplace } from '@/utils/nav';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Squircle from '@/components/ui/Squircle';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';
import { FaceTab, type FaceTabHandle } from '@/components/VerificationPage';

export default function FaceScanRequiredPage() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { updateProfile, signOut } = useAuth();
  const clearedRef  = useRef(false);
  const faceTabRef  = useRef<FaceTabHandle>(null);
  const [scanState, setScanState] = useState<string>('idle');

  const handlePassed = async () => {
    if (clearedRef.current) return;
    clearedRef.current = true;
    await updateProfile({ face_scan_required: false, needs_face_verification: false, is_verified: true });
    // Bypass throttle — use router directly since this is a post-verification nav
    setTimeout(() => router.replace('/(tabs)/' as any), 400);
  };

  // Only show the sticky button while the user still needs to act
  const showBtn = scanState === 'idle' || scanState === 'failed';
  const btnLabel = scanState === 'failed' ? 'Try Again' : 'Start Face Scan';

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>

      {/* ── Compact header: icon + title only ────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + 24 }]}>
        <Pressable
          style={styles.logoutBtn}
          onPress={signOut}
          hitSlop={12}
        >
          <Text style={[styles.logoutText, { color: colors.textSecondary }]}>Log out</Text>
        </Pressable>
        <View style={[styles.iconWrap, { backgroundColor: colors.surface }]}>
          <Ionicons name="scan-outline" size={30} color={colors.text} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>One last step</Text>
      </View>

      {/* ── Face camera (fills remaining space) ───────────────────── */}
      <View style={styles.cameraArea}>
        <FaceTab
          ref={faceTabRef}
          colors={colors}
          onSwitchToId={() => {}}
          onPassed={handlePassed}
          skipCheck={false}
          hideCta
          onStateChange={setScanState}
        />
      </View>

      {/* ── Sticky bottom CTA ─────────────────────────────────────── */}
      {showBtn && (
        <View style={[styles.stickyBar, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable
            style={({ pressed }) => [pressed && { opacity: 0.75 }]}
            onPress={() => faceTabRef.current?.startScan()}
          >
            <Squircle
              style={styles.ctaBtn}
              cornerRadius={28}
              cornerSmoothing={1}
              fillColor={colors.text}
            >
              <Ionicons name="scan-outline" size={19} color={colors.bg} />
              <Text style={[styles.ctaBtnText, { color: colors.bg }]}>{btnLabel}</Text>
            </Squircle>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 12,
    gap: 10,
  },
  logoutBtn: {
    position: 'absolute',
    top: 0,
    right: 24,
  },
  logoutText: {
    fontSize: 14,
    fontFamily: 'ProductSans-Regular',
  },
  iconWrap: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    fontSize: 26,
    fontFamily: 'ProductSans-Black',
    letterSpacing: -0.4,
  },

  cameraArea: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 4,
  },

  stickyBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
  },
  ctaBtnText: {
    fontSize: 16,
    fontFamily: 'ProductSans-Black',
  },
});
