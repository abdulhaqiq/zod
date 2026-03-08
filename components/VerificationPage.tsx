import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import ScreenHeader from '@/components/ui/ScreenHeader';
import Squircle from '@/components/ui/Squircle';
import { useAppTheme } from '@/context/ThemeContext';
import type { AppColors } from '@/constants/appColors';

// ─── Face Tab ─────────────────────────────────────────────────────────────────

function PulseRing({ colors }: { colors: AppColors }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.18, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.15, duration: 900, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.6, duration: 900, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.pulseRing,
        { borderColor: colors.text, opacity, transform: [{ scale: pulse }] },
      ]}
    />
  );
}

function FaceTab({ colors }: { colors: AppColors }) {
  const [scanned, setScanned] = useState(false);

  return (
    <View style={styles.tabContent}>
      {/* Camera preview area */}
      <View style={styles.facePreviewWrap}>
        <PulseRing colors={colors} />
        <Squircle
          style={styles.facePreview}
          cornerRadius={56}
          cornerSmoothing={1}
          fillColor={colors.surface}
          strokeColor={colors.border}
          strokeWidth={2}
        >
          {scanned ? (
            <View style={styles.scannedInner}>
              <Squircle
                style={styles.scannedBadge}
                cornerRadius={24}
                cornerSmoothing={1}
                fillColor={colors.text}
              >
                <Ionicons name="checkmark" size={32} color={colors.bg} />
              </Squircle>
              <Text style={[styles.scannedLabel, { color: colors.text }]}>Face verified!</Text>
            </View>
          ) : (
            <View style={styles.cameraPlaceholder}>
              <Ionicons name="person-outline" size={56} color={colors.textTertiary} />
              <Text style={[styles.cameraHint, { color: colors.textTertiary }]}>
                Position your face here
              </Text>
            </View>
          )}
        </Squircle>
      </View>

      {/* Instructions */}
      <View style={styles.instructionCard}>
        <Squircle
          style={styles.instructionInner}
          cornerRadius={20}
          cornerSmoothing={1}
          fillColor={colors.surface}
          strokeColor={colors.border}
          strokeWidth={1}
        >
          {[
            { icon: 'sunny-outline', text: 'Find good lighting, face the light' },
            { icon: 'eye-outline', text: 'Look directly at the camera' },
            { icon: 'remove-circle-outline', text: 'Remove glasses or hat if wearing any' },
          ].map((item, i, arr) => (
            <View
              key={item.icon}
              style={[
                styles.instructionRow,
                i < arr.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
              ]}
            >
              <Squircle style={styles.instrIcon} cornerRadius={10} cornerSmoothing={1} fillColor={colors.surface2}>
                <Ionicons name={item.icon as any} size={15} color={colors.text} />
              </Squircle>
              <Text style={[styles.instrText, { color: colors.text }]}>{item.text}</Text>
            </View>
          ))}
        </Squircle>
      </View>

      {/* CTA */}
      <Pressable
        style={({ pressed }) => [pressed && { opacity: 0.75 }]}
        onPress={() => setScanned(v => !v)}
      >
        <Squircle
          style={styles.ctaBtn}
          cornerRadius={28}
          cornerSmoothing={1}
          fillColor={scanned ? colors.surface2 : colors.text}
        >
          <Ionicons
            name={scanned ? 'refresh-outline' : 'scan-outline'}
            size={18}
            color={scanned ? colors.text : colors.bg}
          />
          <Text style={[styles.ctaBtnText, { color: scanned ? colors.text : colors.bg }]}>
            {scanned ? 'Scan Again' : 'Start Face Scan'}
          </Text>
        </Squircle>
      </Pressable>
    </View>
  );
}

// ─── ID Upload zone ────────────────────────────────────────────────────────────

function IDZone({
  label, icon, colors,
}: { label: string; icon: string; colors: AppColors }) {
  const [uri, setUri] = useState<string | null>(null);

  const pick = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 10],
      quality: 0.9,
    });
    if (!res.canceled) setUri(res.assets[0].uri);
  };

  return (
    <Pressable onPress={pick} style={({ pressed }) => [pressed && { opacity: 0.75 }]}>
      <Squircle
        style={styles.idZone}
        cornerRadius={22}
        cornerSmoothing={1}
        fillColor={colors.surface}
        strokeColor={uri ? colors.text : colors.border}
        strokeWidth={uri ? 2 : 1}
      >
        {uri ? (
          <>
            <Image source={{ uri }} style={styles.idPreview} resizeMode="cover" />
            <View style={[styles.idReplaceBadge, { backgroundColor: colors.surface }]}>
              <Ionicons name="pencil" size={13} color={colors.text} />
              <Text style={[styles.idReplaceText, { color: colors.text }]}>Replace</Text>
            </View>
          </>
        ) : (
          <View style={styles.idZonePlaceholder}>
            <Squircle style={styles.idIconWrap} cornerRadius={18} cornerSmoothing={1} fillColor={colors.surface2}>
              <Ionicons name={icon as any} size={26} color={colors.textSecondary} />
            </Squircle>
            <Text style={[styles.idZoneLabel, { color: colors.text }]}>{label}</Text>
            <Text style={[styles.idZoneSub, { color: colors.textSecondary }]}>
              Tap to upload · JPG or PNG
            </Text>
          </View>
        )}
      </Squircle>
    </Pressable>
  );
}

function IDTab({ colors }: { colors: AppColors }) {
  return (
    <View style={styles.tabContent}>
      <IDZone label="Front of ID" icon="card-outline" colors={colors} />
      <IDZone label="Back of ID" icon="card-outline" colors={colors} />

      {/* Why we verify */}
      <Squircle
        style={styles.whyCard}
        cornerRadius={18}
        cornerSmoothing={1}
        fillColor={colors.surface}
        strokeColor={colors.border}
        strokeWidth={1}
      >
        <View style={styles.whyRow}>
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.text} />
          <Text style={[styles.whyTitle, { color: colors.text }]}>Why we verify your ID</Text>
        </View>
        <Text style={[styles.whyText, { color: colors.textSecondary }]}>
          ID verification helps keep our community safe and authentic. Your ID is securely processed
          and never stored or shared. Only your verified status is shown to others.
        </Text>
      </Squircle>

      <Pressable style={({ pressed }) => [pressed && { opacity: 0.75 }]}>
        <Squircle style={styles.ctaBtn} cornerRadius={28} cornerSmoothing={1} fillColor={colors.text}>
          <Ionicons name="checkmark-circle-outline" size={18} color={colors.bg} />
          <Text style={[styles.ctaBtnText, { color: colors.bg }]}>Submit for Review</Text>
        </Squircle>
      </Pressable>
    </View>
  );
}

// ─── Verification Page ────────────────────────────────────────────────────────

export default function VerificationPage() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const [tab, setTab] = useState<'face' | 'id'>('face');

  const tabs = (
    <View style={styles.tabRow}>
      {(['face', 'id'] as const).map(t => (
        <Pressable key={t} onPress={() => setTab(t)}>
          <View style={[styles.tabPill, tab === t && { backgroundColor: colors.text }]}>
            <Ionicons
              name={t === 'face' ? 'scan-outline' : 'card-outline'}
              size={12}
              color={tab === t ? colors.bg : colors.textSecondary}
              style={{ marginRight: 5 }}
            />
            <Text style={[styles.tabPillText, { color: tab === t ? colors.bg : colors.textSecondary }]}>
              {t === 'face' ? 'Face Scan' : 'ID Upload'}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );

  return (
    <View style={[styles.safe, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScreenHeader
          title="Verification"
          onClose={() => router.back()}
          colors={colors}
        >
          {tabs}
        </ScreenHeader>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {tab === 'face' ? <FaceTab colors={colors} /> : <IDTab colors={colors} />}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:               { flex: 1 },
  flex:               { flex: 1 },
  scroll:             { paddingHorizontal: 20, paddingBottom: 48, paddingTop: 8 },

  // Tabs in header
  tabRow:             { flexDirection: 'row', gap: 8 },
  tabPill:            { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 50 },
  tabPillText:        { fontSize: 13, fontFamily: 'ProductSans-Bold' },

  // Shared tab content
  tabContent:         { gap: 18, paddingTop: 10 },

  // Face scan
  facePreviewWrap:    { alignItems: 'center', justifyContent: 'center', height: 280 },
  pulseRing:          { position: 'absolute', width: 240, height: 240, borderRadius: 120, borderWidth: 3 },
  facePreview:        { width: 210, height: 210, alignItems: 'center', justifyContent: 'center' },
  cameraPlaceholder:  { alignItems: 'center', gap: 10 },
  cameraHint:         { fontSize: 13, fontFamily: 'ProductSans-Regular', textAlign: 'center' },
  scannedInner:       { alignItems: 'center', gap: 12 },
  scannedBadge:       { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  scannedLabel:       { fontSize: 15, fontFamily: 'ProductSans-Bold' },

  // Instructions
  instructionCard:    { },
  instructionInner:   { overflow: 'hidden' },
  instructionRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  instrIcon:          { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  instrText:          { flex: 1, fontSize: 13, fontFamily: 'ProductSans-Regular', lineHeight: 19 },

  // CTA button
  ctaBtn:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 18 },
  ctaBtnText:         { fontSize: 15, fontFamily: 'ProductSans-Black' },

  // ID zones
  idZone:             { height: 140, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  idPreview:          { width: '100%', height: '100%' },
  idReplaceBadge:     { position: 'absolute', bottom: 10, right: 12, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  idReplaceText:      { fontSize: 11, fontFamily: 'ProductSans-Bold' },
  idZonePlaceholder:  { alignItems: 'center', gap: 10 },
  idIconWrap:         { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  idZoneLabel:        { fontSize: 15, fontFamily: 'ProductSans-Bold' },
  idZoneSub:          { fontSize: 12, fontFamily: 'ProductSans-Regular' },

  // Why card
  whyCard:            { padding: 16, gap: 10 },
  whyRow:             { flexDirection: 'row', alignItems: 'center', gap: 8 },
  whyTitle:           { fontSize: 14, fontFamily: 'ProductSans-Bold' },
  whyText:            { fontSize: 13, fontFamily: 'ProductSans-Regular', lineHeight: 20 },
});
