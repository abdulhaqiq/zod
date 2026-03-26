import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { API_V1, WS_V1 } from '@/constants/api';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';
import type { AppColors } from '@/constants/appColors';

// ─── Liveness challenges ──────────────────────────────────────────────────────

const CHALLENGES = [
  { id: 'blink',      icon: 'eye-outline',         text: 'Blink slowly twice' },
  { id: 'smile',      icon: 'happy-outline',        text: 'Smile naturally' },
  { id: 'left',       icon: 'arrow-back-outline',   text: 'Turn your head slightly left' },
  { id: 'right',      icon: 'arrow-forward-outline',text: 'Turn your head slightly right' },
  { id: 'nod',        icon: 'arrow-down-outline',   text: 'Nod your head once' },
];

function pickChallenges(n = 2) {
  const shuffled = [...CHALLENGES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

// ─── Pulse ring ───────────────────────────────────────────────────────────────

function PulseRing({ color }: { color: string }) {
  const pulse   = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulse,   { toValue: 1.18, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulse,   { toValue: 1,    duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.15, duration: 900, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.6,  duration: 900, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[styles.pulseRing, { borderColor: color, opacity, transform: [{ scale: pulse }] }]} />
  );
}

// ─── Challenge progress bar ───────────────────────────────────────────────────

function ChallengeBar({ duration, color }: { duration: number; color: string }) {
  const width = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    width.setValue(0);
    Animated.timing(width, { toValue: 100, duration, useNativeDriver: false }).start();
  }, [duration]);

  return (
    <View style={styles.challengeBarTrack}>
      <Animated.View
        style={[styles.challengeBarFill, { backgroundColor: color, width: width.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }]}
      />
    </View>
  );
}

// ─── Face Tab ─────────────────────────────────────────────────────────────────

type FaceState =
  | 'idle'
  | 'camera'
  | 'challenge'
  | 'capturing'
  | 'submitting'   // uploading to backend
  | 'pending'      // waiting for bg analysis
  | 'passed'
  | 'failed';

export function FaceTab({ colors, onSwitchToId, onPassed, skipCheck }: { colors: AppColors; onSwitchToId: () => void; onPassed?: () => void; skipCheck?: boolean }) {
  const { token, profile } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const wsRef     = useRef<WebSocket | null>(null);

  const [state,        setState]        = useState<FaceState>('idle');
  const [challenges,   setChallenges]   = useState(pickChallenges(2));
  const [challengeIdx, setChallengeIdx] = useState(0);
  const [failReason,   setFailReason]   = useState<string | null>(null);
  const [matchScore,   setMatchScore]   = useState<number | null>(null);
  const [initializing, setInitializing] = useState(true);

  const CHALLENGE_MS = 3000;

  // On mount: skip the status check entirely when skipCheck=true (e.g. coming
  // from the filter — user just wants to scan now, no need to hit the API).
  // Otherwise restore pending/verified only; rejected always resets to idle.
  useEffect(() => {
    if (skipCheck) { setInitializing(false); return; }
    if (!token) { setInitializing(false); return; }
    fetch(`${API_V1}/upload/verify-face/status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const s = data?.attempt?.status;
        if (s === 'pending') {
          setState('pending');
        } else if (s === 'verified') {
          setMatchScore(data.attempt?.face_match_score ?? null);
          setState('passed');
          onPassed?.();
        }
        // rejected or no attempt → stay idle (fresh start)
      })
      .catch(() => {})
      .finally(() => setInitializing(false));
  }, [token]);

  // Auto-advance challenges then capture
  useEffect(() => {
    if (state !== 'challenge') return;
    const timer = setTimeout(async () => {
      if (challengeIdx < challenges.length - 1) {
        setChallengeIdx(i => i + 1);
      } else {
        setState('capturing');
        await new Promise(r => setTimeout(r, 600));
        await captureAndSubmit();
      }
    }, CHALLENGE_MS);
    return () => clearTimeout(timer);
  }, [state, challengeIdx]);

  // WebSocket-only while pending — auto-reconnects if the connection drops
  useEffect(() => {
    if (state !== 'pending' || !profile?.id) {
      wsRef.current?.close();
      wsRef.current = null;
      return;
    }

    let settled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const applyResult = (data: any) => {
      if (settled) return;
      if (data.status === 'verified') {
        settled = true;
        setMatchScore(data.face_match_score ?? null);
        setState('passed');
        onPassed?.();
      } else if (data.status === 'rejected') {
        settled = true;
        setMatchScore(data.face_match_score ?? null);
        setFailReason(data.rejection_reason ?? 'Verification failed. Please try again.');
        setState('failed');
      }
    };

    const connect = () => {
      if (settled) return;
      const ws = new WebSocket(`${WS_V1}/ws/verify-face/${profile.id}`);
      wsRef.current = ws;
      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.status === 'heartbeat') return;
          applyResult(data);
        } catch {}
      };
      ws.onerror = () => ws.close();
      // Reconnect after 3s if closed before a result arrives
      ws.onclose = () => {
        if (!settled) {
          reconnectTimer = setTimeout(connect, 3000);
        }
      };
    };

    connect();

    return () => {
      settled = true;
      wsRef.current?.close();
      wsRef.current = null;
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [state, profile?.id]);

  const startScan = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) return;
    }
    setChallenges(pickChallenges(2));
    setChallengeIdx(0);
    setFailReason(null);
    setMatchScore(null);
    setState('camera');
    setTimeout(() => setState('challenge'), 1200);
  };

  const captureAndSubmit = async () => {
    setState('submitting');
    try {
      const photo = await cameraRef.current?.takePictureAsync({ base64: false, quality: 0.92, exif: true });
      if (!photo?.uri) throw new Error('No photo captured');

      const formData = new FormData();
      formData.append('file', { uri: photo.uri, name: 'face.jpg', type: 'image/jpeg' } as any);
      formData.append('platform', Platform.OS);
      formData.append('device_model', `${Platform.OS} ${Platform.Version}`);

      const res = await fetch(`${API_V1}/upload/verify-face`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();

      if (data.status === 'pending') {
        setState('pending');
      } else {
        // Unexpected fallback
        setFailReason(data.detail ?? 'Submission failed. Please try again.');
        setState('failed');
      }
    } catch {
      setFailReason('Could not submit scan. Check your connection and try again.');
      setState('failed');
    }
  };

  const isLiveCamera  = state === 'camera' || state === 'challenge' || state === 'capturing';
  const currentChallenge = challenges[challengeIdx];
  const ringColor =
    state === 'passed'  ? '#22c55e' :
    state === 'failed'  ? colors.error :
    state === 'pending' ? '#f59e0b' : colors.text;

  // While checking existing status — show neutral spinner
  if (initializing) {
    return (
      <View style={[styles.tabContent, { alignItems: 'center', justifyContent: 'center', paddingTop: 60 }]}>
        <ActivityIndicator size="large" color={colors.textSecondary} />
        <Text style={{ color: colors.textSecondary, fontFamily: 'ProductSans-Regular', fontSize: 13, marginTop: 12 }}>
          Checking status…
        </Text>
      </View>
    );
  }

  // ── Passed: full-width success card (not inside circle) ─────────────────────
  if (state === 'passed') {
    return (
      <View style={styles.tabContent}>
        <Squircle
          style={styles.successCard}
          cornerRadius={28}
          cornerSmoothing={1}
          fillColor="#052010"
          strokeColor="#22c55e"
          strokeWidth={1.5}
        >
          {/* Big checkmark */}
          <View style={styles.successIconWrap}>
            <Ionicons name="checkmark" size={40} color="#fff" />
          </View>

          <Text style={styles.successTitle}>Face Verified</Text>
          <Text style={styles.successSub}>Your identity has been confirmed</Text>

          {matchScore !== null && (
            <View style={styles.successScoreRow}>
              <View style={styles.successScoreDot} />
              <Text style={styles.successScore}>{matchScore.toFixed(0)}% match confidence</Text>
            </View>
          )}
        </Squircle>

        {/* Prompt to do ID next */}
        <Pressable
          style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}
          onPress={onSwitchToId}
        >
          <Squircle
            style={styles.successNextCard}
            cornerRadius={20}
            cornerSmoothing={1}
            fillColor="rgba(34,197,94,0.07)"
            strokeColor="rgba(34,197,94,0.25)"
            strokeWidth={1}
          >
            <Ionicons name="card-outline" size={18} color="#22c55e" />
            <View style={{ flex: 1 }}>
              <Text style={styles.successNextTitle}>Complete Identity Verification</Text>
              <Text style={styles.successNextSub}>Upload your ID to get fully verified</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#22c55e" />
          </Squircle>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.tabContent}>
      {/* Camera / preview area */}
      <View style={styles.facePreviewWrap}>
        <PulseRing color={ringColor} />

        <View style={[styles.facePreview, { borderRadius: 56, overflow: 'hidden', borderWidth: 2, borderColor: ringColor }]}>
          {isLiveCamera ? (
            <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />

          ) : state === 'failed' ? (
            <View style={[StyleSheet.absoluteFill, styles.overlayCenter, { backgroundColor: '#1a0800' }]}>
              <Ionicons name="close-circle" size={56} color={colors.error} />
              <Text style={[styles.cameraHint, { color: colors.error }]}>Verification failed</Text>
              {matchScore !== null && matchScore > 0 && (
                <Text style={{ fontSize: 13, color: 'rgba(255,59,48,0.7)', fontFamily: 'ProductSans-Bold' }}>
                  {matchScore.toFixed(0)}% match (need 80%)
                </Text>
              )}
            </View>

          ) : state === 'pending' ? (
            <View style={[StyleSheet.absoluteFill, styles.overlayCenter, { backgroundColor: 'rgba(0,0,0,0.85)' }]}>
              <ActivityIndicator size="large" color="#f59e0b" />
              <Text style={[styles.scannedLabel, { color: '#f59e0b', marginTop: 10 }]}>Under Review</Text>
              <Text style={[styles.cameraHint, { color: 'rgba(245,158,11,0.7)' }]}>Analysing your scan…</Text>
            </View>

          ) : state === 'submitting' ? (
            <View style={[StyleSheet.absoluteFill, styles.overlayCenter, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={[styles.cameraHint, { color: '#fff', marginTop: 12 }]}>Submitting…</Text>
            </View>

          ) : (
            <View style={[StyleSheet.absoluteFill, styles.overlayCenter, { backgroundColor: colors.surface }]}>
              <Ionicons name="person-outline" size={56} color={colors.textTertiary} />
              <Text style={[styles.cameraHint, { color: colors.textTertiary }]}>Position your face here</Text>
            </View>
          )}

          {/* Challenge overlay */}
          {state === 'challenge' && currentChallenge && (
            <View style={styles.challengeOverlay}>
              <View style={[styles.challengeCard, { backgroundColor: 'rgba(0,0,0,0.72)' }]}>
                <Ionicons name={currentChallenge.icon as any} size={22} color="#fff" />
                <Text style={styles.challengeText}>{currentChallenge.text}</Text>
                <Text style={styles.challengeCounter}>{challengeIdx + 1} / {challenges.length}</Text>
              </View>
              <ChallengeBar duration={CHALLENGE_MS} color="#fff" key={`${challengeIdx}`} />
            </View>
          )}

          {/* Capturing overlay */}
          {state === 'capturing' && (
            <View style={[styles.challengeOverlay, { justifyContent: 'center' }]}>
              <View style={[styles.challengeCard, { backgroundColor: 'rgba(0,0,0,0.72)' }]}>
                <ActivityIndicator color="#fff" />
                <Text style={styles.challengeText}>Hold still…</Text>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* Pending notice */}
      {state === 'pending' && (
        <Squircle style={styles.pendingCard} cornerRadius={16} cornerSmoothing={1}
          fillColor={'rgba(245,158,11,0.1)'} strokeColor={'#f59e0b'} strokeWidth={StyleSheet.hairlineWidth}>
          <Ionicons name="hourglass-outline" size={16} color="#f59e0b" />
          <Text style={[styles.failText, { color: '#f59e0b' }]}>
            Your scan has been submitted and is being reviewed. This usually takes a few seconds.
          </Text>
        </Squircle>
      )}

      {/* Failure reason */}
      {state === 'failed' && failReason && (
        <Squircle style={styles.failCard} cornerRadius={16} cornerSmoothing={1}
          fillColor={colors.errorBg} strokeColor={colors.error} strokeWidth={StyleSheet.hairlineWidth}>
          <Ionicons name="warning-outline" size={16} color={colors.error} />
          <Text style={[styles.failText, { color: colors.error }]}>{failReason}</Text>
        </Squircle>
      )}

      {/* Instructions (only while idle) */}
      {state === 'idle' && (
        <View style={styles.instructionCard}>
          <Squircle style={styles.instructionInner} cornerRadius={20} cornerSmoothing={1}
            fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
            {[
              { icon: 'sunny-outline',            text: 'Find good lighting, face the light' },
              { icon: 'eye-outline',               text: 'Look directly at the camera' },
              { icon: 'remove-circle-outline',     text: 'Remove glasses or hat if wearing any' },
              { icon: 'shield-checkmark-outline',  text: 'Liveness check detects photos & screens' },
            ].map((item, i, arr) => (
              <View key={item.icon} style={[
                styles.instructionRow,
                i < arr.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
              ]}>
                <Squircle style={styles.instrIcon} cornerRadius={10} cornerSmoothing={1} fillColor={colors.surface2}>
                  <Ionicons name={item.icon as any} size={15} color={colors.text} />
                </Squircle>
                <Text style={[styles.instrText, { color: colors.text }]}>{item.text}</Text>
              </View>
            ))}
          </Squircle>
        </View>
      )}

      {/* CTA — idle: start scan · failed: try again */}
      {(state === 'idle' || state === 'failed') && (
        <Pressable style={({ pressed }) => [pressed && { opacity: 0.75 }]} onPress={startScan}>
          <Squircle style={styles.ctaBtn} cornerRadius={28} cornerSmoothing={1} fillColor={colors.text}>
            <Ionicons name="scan-outline" size={18} color={colors.bg} />
            <Text style={[styles.ctaBtnText, { color: colors.bg }]}>
              {state === 'failed' ? 'Try Again' : 'Start Face Scan'}
            </Text>
          </Squircle>
        </Pressable>
      )}

    </View>
  );
}

// ─── ID Upload zone ────────────────────────────────────────────────────────────

function IDZone({
  label, icon, colors, uri, onSet,
}: { label: string; icon: string; colors: AppColors; uri: string | null; onSet: (u: string) => void }) {
  const [showOptions, setShowOptions] = useState(false);

  const fromGallery = async () => {
    setShowOptions(false);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 10],
      quality: 0.9,
    });
    if (!res.canceled) onSet(res.assets[0].uri);
  };

  const fromCamera = async () => {
    setShowOptions(false);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 10],
      quality: 0.9,
    });
    if (!res.canceled) onSet(res.assets[0].uri);
  };

  return (
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
          {showOptions ? (
            <View style={[styles.idOptionBar, { backgroundColor: 'rgba(0,0,0,0.72)' }]}>
              <Pressable onPress={fromCamera} style={styles.idOptionBtn}>
                <Ionicons name="camera-outline" size={16} color="#fff" />
                <Text style={styles.idOptionText}>Camera</Text>
              </Pressable>
              <View style={[styles.idOptionDivider, { backgroundColor: 'rgba(255,255,255,0.2)' }]} />
              <Pressable onPress={fromGallery} style={styles.idOptionBtn}>
                <Ionicons name="images-outline" size={16} color="#fff" />
                <Text style={styles.idOptionText}>Gallery</Text>
              </Pressable>
              <View style={[styles.idOptionDivider, { backgroundColor: 'rgba(255,255,255,0.2)' }]} />
              <Pressable onPress={() => setShowOptions(false)} style={styles.idOptionBtn}>
                <Ionicons name="close-outline" size={16} color="rgba(255,255,255,0.6)" />
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={[styles.idReplaceBadge, { backgroundColor: colors.surface }]}
              onPress={() => setShowOptions(true)}
            >
              <Ionicons name="pencil" size={13} color={colors.text} />
              <Text style={[styles.idReplaceText, { color: colors.text }]}>Replace</Text>
            </Pressable>
          )}
        </>
      ) : (
        <View style={styles.idZonePlaceholder}>
          <Squircle style={styles.idIconWrap} cornerRadius={18} cornerSmoothing={1} fillColor={colors.surface2}>
            <Ionicons name={icon as any} size={26} color={colors.textSecondary} />
          </Squircle>
          <Text style={[styles.idZoneLabel, { color: colors.text }]}>{label}</Text>
          <View style={styles.idSourceRow}>
            <Pressable
              style={({ pressed }) => [styles.idSourceBtn, { backgroundColor: colors.surface2, opacity: pressed ? 0.7 : 1 }]}
              onPress={fromCamera}
            >
              <Ionicons name="camera-outline" size={15} color={colors.text} />
              <Text style={[styles.idSourceLabel, { color: colors.text }]}>Camera</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.idSourceBtn, { backgroundColor: colors.surface2, opacity: pressed ? 0.7 : 1 }]}
              onPress={fromGallery}
            >
              <Ionicons name="images-outline" size={15} color={colors.text} />
              <Text style={[styles.idSourceLabel, { color: colors.text }]}>Gallery</Text>
            </Pressable>
          </View>
        </View>
      )}
    </Squircle>
  );
}

type IDState = 'idle' | 'submitting' | 'pending' | 'passed' | 'failed';

interface IDResult {
  id_face_match_score: number | null;
  id_has_name: boolean | null;
  id_has_dob: boolean | null;
  id_has_expiry: boolean | null;
  id_has_number: boolean | null;
  id_name_match: boolean | null;
  id_dob_match: boolean | null;
  rejection_reason: string | null;
}

function IDTab({ colors, active = true }: { colors: AppColors; active?: boolean }) {
  const { token, profile, updateProfile } = useAuth();
  const [frontUri, setFrontUri] = useState<string | null>(null);
  const [backUri,  setBackUri]  = useState<string | null>(null);
  const [idState,  setIdState]  = useState<IDState>('idle');
  const [idResult, setIdResult] = useState<IDResult | null>(null);
  const [idInitializing, setIdInitializing] = useState(true);
  const wsIdRef = useRef<WebSocket | null>(null);

  // Only check status when this tab is actually active (lazy init).
  // This prevents firing /verify-id/status when the user opens face scan only.
  useEffect(() => {
    if (!active) return;
    if (!token) { setIdInitializing(false); return; }
    fetch(`${API_V1}/upload/verify-id/status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const s = data?.attempt?.status;
        if (s === 'pending') {
          setIdState('pending');
        } else if (s === 'verified') {
          setIdResult(data.attempt);
          setIdState('passed');
        } else if (s === 'rejected') {
          setIdResult(data.attempt);
          setIdState('failed');
        }
      })
      .catch(() => {})
      .finally(() => setIdInitializing(false));
  }, [token, active]);

  // WebSocket-only while pending — auto-reconnects if the connection drops
  useEffect(() => {
    if (idState !== 'pending' || !profile?.id) {
      wsIdRef.current?.close();
      wsIdRef.current = null;
      return;
    }

    let settled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const applyResult = (data: any) => {
      if (settled) return;
      if (data.status === 'verified') {
        settled = true;
        setIdResult(data);
        setIdState('passed');
        // Update profile context so FeedScreen halal gate knows we're now verified
        updateProfile({ verification_status: 'verified', is_verified: true });
      } else if (data.status === 'rejected') {
        settled = true;
        setIdResult(data);
        setIdState('failed');
      }
    };

    const connect = () => {
      if (settled) return;
      const ws = new WebSocket(`${WS_V1}/ws/verify-face/${profile.id}?type=id`);
      wsIdRef.current = ws;
      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.status === 'heartbeat') return;
          applyResult(data);
        } catch {}
      };
      ws.onerror = () => ws.close();
      // Reconnect after 3s if closed before a result arrives
      ws.onclose = () => {
        if (!settled) {
          reconnectTimer = setTimeout(connect, 3000);
        }
      };
    };

    connect();

    return () => {
      settled = true;
      wsIdRef.current?.close();
      wsIdRef.current = null;
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [idState, profile?.id]);

  const submit = async () => {
    if (!frontUri) return;
    setIdState('submitting');
    try {
      const formData = new FormData();
      formData.append('front', { uri: frontUri, name: 'id_front.jpg', type: 'image/jpeg' } as any);
      if (backUri) {
        formData.append('back', { uri: backUri, name: 'id_back.jpg', type: 'image/jpeg' } as any);
      }
      formData.append('platform', Platform.OS);
      formData.append('device_model', `${Platform.OS} ${Platform.Version}`);

      const res = await fetch(`${API_V1}/upload/verify-id`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (data.status === 'pending') {
        setIdState('pending');
      } else {
        setIdResult({ rejection_reason: data.detail ?? 'Submission failed.', id_face_match_score: null, id_has_name: null, id_has_dob: null, id_has_expiry: null, id_has_number: null, id_name_match: null, id_dob_match: null });
        setIdState('failed');
      }
    } catch {
      setIdResult({ rejection_reason: 'Could not submit. Check your connection.', id_face_match_score: null, id_has_name: null, id_has_dob: null, id_has_expiry: null, id_has_number: null, id_name_match: null, id_dob_match: null });
      setIdState('failed');
    }
  };

  const tryAgain = () => {
    setIdState('idle');
    setIdResult(null);
    setFrontUri(null);
    setBackUri(null);
  };

  if (idInitializing) {
    return (
      <View style={[styles.tabContent, { alignItems: 'center', justifyContent: 'center', paddingTop: 60 }]}>
        <ActivityIndicator size="large" color={colors.textSecondary} />
        <Text style={{ color: colors.textSecondary, fontFamily: 'ProductSans-Regular', fontSize: 13, marginTop: 12 }}>
          Checking status…
        </Text>
      </View>
    );
  }

  // ── Passed state ─────────────────────────────────────────────────────────────
  if (idState === 'passed') {
    const checks = [
      { label: 'Name matches profile',   val: idResult?.id_name_match ?? idResult?.id_has_name },
      { label: 'Birth year matches',     val: idResult?.id_dob_match  ?? idResult?.id_has_dob },
      { label: 'Face matches selfie',    val: idResult?.id_face_match_score != null ? idResult.id_face_match_score >= 70 : true },
    ];
    return (
      <View style={styles.tabContent}>
        <Squircle style={styles.idResultCard} cornerRadius={22} cornerSmoothing={1}
          fillColor={'#052010'} strokeColor={'#22c55e'} strokeWidth={1}>
          <View style={styles.idResultHeader}>
            <View style={[styles.idResultIcon, { backgroundColor: '#22c55e' }]}>
              <Ionicons name="checkmark" size={28} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.idResultTitle, { color: '#22c55e' }]}>Identity Verified!</Text>
              {idResult?.id_face_match_score != null && (
                <Text style={[styles.idResultSub, { color: 'rgba(34,197,94,0.7)' }]}>
                  {idResult.id_face_match_score.toFixed(0)}% face match
                </Text>
              )}
            </View>
          </View>
          <View style={styles.idFieldList}>
            {checks.map(f => (
              <View key={f.label} style={styles.idFieldRow}>
                <Ionicons name={f.val ? 'checkmark-circle' : 'ellipse-outline' as any} size={15}
                  color={f.val ? '#22c55e' : 'rgba(34,197,94,0.3)'} />
                <Text style={[styles.idFieldText, { color: f.val ? '#22c55e' : 'rgba(34,197,94,0.5)' }]}>{f.label}</Text>
              </View>
            ))}
          </View>
        </Squircle>
      </View>
    );
  }

  // ── Failed state ─────────────────────────────────────────────────────────────
  if (idState === 'failed') {
    const checks = idResult ? [
      { label: 'Name matches profile',  val: idResult.id_name_match },
      { label: 'Birth year matches',    val: idResult.id_dob_match },
      { label: 'Face matches selfie',   val: idResult.id_face_match_score != null ? idResult.id_face_match_score >= 70 : null },
    ] : [];
    return (
      <View style={styles.tabContent}>
        <Squircle style={styles.idResultCard} cornerRadius={22} cornerSmoothing={1}
          fillColor={'#1a0800'} strokeColor={colors.error} strokeWidth={1}>
          <View style={styles.idResultHeader}>
            <Ionicons name="close-circle" size={40} color={colors.error} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.idResultTitle, { color: colors.error }]}>Identity Check Failed</Text>
              {idResult?.id_face_match_score != null && idResult.id_face_match_score > 0 && (
                <Text style={[styles.idResultSub, { color: 'rgba(255,59,48,0.7)' }]}>
                  {idResult.id_face_match_score.toFixed(0)}% face match (need 70%)
                </Text>
              )}
            </View>
          </View>
          {idResult?.rejection_reason && (
            <Text style={[styles.idResultReason, { color: 'rgba(255,59,48,0.85)' }]}>
              {idResult.rejection_reason}
            </Text>
          )}
          {checks.some(f => f.val !== null) && (
            <View style={styles.idFieldList}>
              {checks.map(f => f.val !== null ? (
                <View key={f.label} style={styles.idFieldRow}>
                  <Ionicons name={f.val ? 'checkmark-circle' : 'close-circle' as any} size={15}
                    color={f.val ? 'rgba(34,197,94,0.7)' : colors.error} />
                  <Text style={[styles.idFieldText, { color: f.val ? 'rgba(34,197,94,0.7)' : colors.error }]}>{f.label}</Text>
                </View>
              ) : null)}
            </View>
          )}
        </Squircle>
        <Pressable style={({ pressed }) => [pressed && { opacity: 0.75 }]} onPress={tryAgain}>
          <Squircle style={styles.ctaBtn} cornerRadius={28} cornerSmoothing={1} fillColor={colors.text}>
            <Ionicons name="refresh-outline" size={18} color={colors.bg} />
            <Text style={[styles.ctaBtnText, { color: colors.bg }]}>Try Again</Text>
          </Squircle>
        </Pressable>
      </View>
    );
  }

  // ── Pending / Submitting state ────────────────────────────────────────────────
  if (idState === 'pending' || idState === 'submitting') {
    const isUploading = idState === 'submitting';
    // All checks are shown as in-progress until the backend returns a real result.
    // Never show false green ticks — we only know results when the attempt settles.
    const checks = [
      { label: 'Name matches your profile' },
      { label: 'Birth year matches'        },
      { label: 'Document is readable'      },
      { label: 'Face matches your selfie'  },
    ];
    return (
      <View style={styles.tabContent}>
        {/* Header card */}
        <View style={[styles.idPendingCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.idPendingTop}>
            <View style={[styles.idPendingIconWrap, { backgroundColor: colors.surface2 }]}>
              <ActivityIndicator size="large" color={colors.text} />
            </View>
            <Text style={[styles.idPendingTitle, { color: colors.text }]}>
              {isUploading ? 'Uploading Document…' : 'Document Under Review'}
            </Text>
            <Text style={[styles.idPendingSub, { color: colors.textSecondary }]}>
              {isUploading
                ? 'Please keep the app open while we upload your ID.'
                : 'Analysing your document — this takes 10–20 seconds. You can close this screen.'}
            </Text>
          </View>

          {/* Checks list */}
          <View style={[styles.idPendingDivider, { backgroundColor: colors.border }]} />
          {checks.map((c, i) => (
            <View key={c.label} style={[
              styles.idPendingRow,
              i < checks.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
            ]}>
              <View style={[styles.idPendingDot, { backgroundColor: 'transparent', borderColor: colors.border }]} />
              <Text style={[styles.idPendingRowText, { color: colors.textSecondary }]}>
                {c.label}
              </Text>
              {!isUploading && (
                <ActivityIndicator size="small" color={colors.textSecondary} style={{ marginLeft: 'auto' }} />
              )}
            </View>
          ))}
        </View>

        {/* Note */}
        <View style={[styles.idPendingNote, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
          <Text style={[styles.idPendingNoteText, { color: colors.textSecondary }]}>
            You'll be notified once your ID is verified. You can close this screen.
          </Text>
        </View>
      </View>
    );
  }

  // ── Idle state ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.tabContent}>
      <IDZone label="Front of ID" icon="card-outline" colors={colors} uri={frontUri} onSet={setFrontUri} />
      <IDZone label="Back of ID (optional)" icon="card-outline" colors={colors} uri={backUri} onSet={setBackUri} />

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
          <Text style={[styles.whyTitle, { color: colors.text }]}>What we check</Text>
        </View>
        {[
          { icon: 'person-outline',         text: 'Name is visible on the ID' },
          { icon: 'calendar-outline',        text: 'Date of birth is readable' },
          { icon: 'barcode-outline',         text: 'ID number is present' },
          { icon: 'scan-circle-outline',     text: 'Face on ID matches your selfie' },
        ].map((item, i, arr) => (
          <View key={item.icon} style={[styles.instructionRow,
            i < arr.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
            <Squircle style={styles.instrIcon} cornerRadius={10} cornerSmoothing={1} fillColor={colors.surface2}>
              <Ionicons name={item.icon as any} size={15} color={colors.text} />
            </Squircle>
            <Text style={[styles.instrText, { color: colors.text }]}>{item.text}</Text>
          </View>
        ))}
      </Squircle>

      <Pressable
        style={({ pressed }) => [pressed && { opacity: 0.75 }, !frontUri && { opacity: 0.4 }]}
        onPress={submit}
        disabled={!frontUri}
      >
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
  const { profile } = useAuth();
  const params = useLocalSearchParams<{ tab?: string }>();

  // Explicit ?tab=face always wins (e.g. from filter — skip ID tab entirely).
  // Otherwise open ID tab if face is already verified or caller requested id.
  const defaultTab: 'face' | 'id' =
    params.tab === 'face' ? 'face' :
    (params.tab === 'id' || profile?.verification_status === 'verified') ? 'id' : 'face';
  const [tab, setTab] = useState<'face' | 'id'>(defaultTab);

  // Skip the face status check when the caller explicitly requested face tab
  // (e.g. from the filter "Verify your face" button — go straight to idle).
  const faceSkipCheck = params.tab === 'face';

  const tabs = (
    <View style={styles.tabRow}>
      {(['face', 'id'] as const).map(t => (
        <Pressable key={t} onPress={() => setTab(t)}>
          <View style={[styles.tabPill, tab === t && { backgroundColor: colors.text }]}>
            <Ionicons
              name={t === 'face' ? 'scan-outline' : 'card-outline' as any}
              size={12}
              color={tab === t ? colors.bg : colors.textSecondary}
              style={{ marginRight: 5 }}
            />
            <Text style={[styles.tabPillText, { color: tab === t ? colors.bg : colors.textSecondary }]}>
              {t === 'face' ? 'Face Scan' : 'ID Verify'}
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
          title="Identity Verification"
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
          {tab === 'face'
            ? <FaceTab colors={colors} onSwitchToId={() => setTab('id')} skipCheck={faceSkipCheck} />
            : <IDTab colors={colors} active={tab === 'id'} />
          }
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

  // Passed success card
  successCard:        { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24, gap: 10 },
  successIconWrap:    { width: 80, height: 80, borderRadius: 40, backgroundColor: '#22c55e', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  successTitle:       { fontSize: 24, fontFamily: 'ProductSans-Black', color: '#22c55e', letterSpacing: -0.3 },
  successSub:         { fontSize: 14, fontFamily: 'ProductSans-Regular', color: 'rgba(34,197,94,0.65)', textAlign: 'center' },
  successScoreRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  successScoreDot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' },
  successScore:       { fontSize: 13, fontFamily: 'ProductSans-Bold', color: 'rgba(34,197,94,0.8)' },
  successNextCard:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  successNextTitle:   { fontSize: 14, fontFamily: 'ProductSans-Bold', color: '#22c55e' },
  successNextSub:     { fontSize: 12, fontFamily: 'ProductSans-Regular', color: 'rgba(34,197,94,0.65)', marginTop: 2 },

  // Face scan
  facePreviewWrap:    { alignItems: 'center', justifyContent: 'center', height: 280 },
  pulseRing:          { position: 'absolute', width: 240, height: 240, borderRadius: 120, borderWidth: 3 },
  facePreview:        { width: 210, height: 210 },
  overlayCenter:      { alignItems: 'center', justifyContent: 'center', gap: 10 },
  cameraHint:         { fontSize: 13, fontFamily: 'ProductSans-Regular', textAlign: 'center' },
  scannedBadge:       { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  scannedLabel:       { fontSize: 15, fontFamily: 'ProductSans-Bold' },

  // Challenge overlay
  challengeOverlay:   { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
  challengeCard:      { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  challengeText:      { flex: 1, fontSize: 14, fontFamily: 'ProductSans-Bold', color: '#fff' },
  challengeCounter:   { fontSize: 11, fontFamily: 'ProductSans-Regular', color: 'rgba(255,255,255,0.55)' },
  challengeBarTrack:  { height: 3, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, overflow: 'hidden' },
  challengeBarFill:   { height: 3, borderRadius: 2 },

  // Failure card
  failCard:           { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14 },
  failText:           { flex: 1, fontSize: 13, fontFamily: 'ProductSans-Regular', lineHeight: 19 },

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
  idZone:             { minHeight: 160, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  idPreview:          { width: '100%', height: '100%', position: 'absolute' },
  idReplaceBadge:     { position: 'absolute', bottom: 10, right: 12, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  idReplaceText:      { fontSize: 11, fontFamily: 'ProductSans-Bold' },
  idZonePlaceholder:  { alignItems: 'center', gap: 12, paddingVertical: 20 },
  idIconWrap:         { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  idZoneLabel:        { fontSize: 15, fontFamily: 'ProductSans-Bold' },
  idZoneSub:          { fontSize: 12, fontFamily: 'ProductSans-Regular' },
  // Source picker buttons
  idSourceRow:        { flexDirection: 'row', gap: 10 },
  idSourceBtn:        { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 50, paddingHorizontal: 16, paddingVertical: 8 },
  idSourceLabel:      { fontSize: 13, fontFamily: 'ProductSans-Bold' },
  // Option bar (when image is set and Replace tapped)
  idOptionBar:        { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12 },
  idOptionBtn:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 4 },
  idOptionText:       { fontSize: 13, fontFamily: 'ProductSans-Bold', color: '#fff' },
  idOptionDivider:    { width: 1, height: 20 },

  // Pending card
  pendingCard:        { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14 },

  // ID pending state
  idPendingCard:      { borderRadius: 22, borderWidth: 1, overflow: 'hidden' },
  idPendingTop:       { alignItems: 'center', paddingHorizontal: 24, paddingTop: 28, paddingBottom: 20, gap: 10 },
  idPendingIconWrap:  { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  idPendingTitle:     { fontSize: 18, fontFamily: 'ProductSans-Black', textAlign: 'center', letterSpacing: -0.2 },
  idPendingSub:       { fontSize: 13, fontFamily: 'ProductSans-Regular', textAlign: 'center', lineHeight: 19 },
  idPendingDivider:   { height: StyleSheet.hairlineWidth },
  idPendingRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 14 },
  idPendingDot:       { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  idPendingRowText:   { fontSize: 13, fontFamily: 'ProductSans-Regular', flex: 1 },
  idPendingNote:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 16, borderWidth: 1 },
  idPendingNoteText:  { flex: 1, fontSize: 12, fontFamily: 'ProductSans-Regular', lineHeight: 18 },

  // Why card
  whyCard:            { padding: 16, gap: 10 },
  whyRow:             { flexDirection: 'row', alignItems: 'center', gap: 8 },
  whyTitle:           { fontSize: 14, fontFamily: 'ProductSans-Bold' },
  whyText:            { fontSize: 13, fontFamily: 'ProductSans-Regular', lineHeight: 20 },

  // ID result card (passed / failed)
  idResultCard:       { padding: 18, gap: 14 },
  idResultHeader:     { flexDirection: 'row', alignItems: 'center', gap: 14 },
  idResultIcon:       { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  idResultTitle:      { fontSize: 17, fontFamily: 'ProductSans-Black' },
  idResultSub:        { fontSize: 13, fontFamily: 'ProductSans-Regular', marginTop: 2 },
  idResultReason:     { fontSize: 13, fontFamily: 'ProductSans-Regular', lineHeight: 19 },
  idFieldList:        { gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.08)', paddingTop: 12 },
  idFieldRow:         { flexDirection: 'row', alignItems: 'center', gap: 8 },
  idFieldText:        { fontSize: 13, fontFamily: 'ProductSans-Regular' },
});
