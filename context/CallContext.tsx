/**
 * Global call context — manages the shared /ws/notify WebSocket,
 * a WebRTC RTCPeerConnection for real audio/video, and the full-screen
 * CallScreen overlay rendered above everything in the app.
 *
 * WebRTC flow (Approach 2 – offer after accept):
 *  1. Caller  → call_invite  → Callee sees incoming screen
 *  2. Callee  → call_accept  → Both show "active" screen
 *  3. Caller  (on receiving call_accept) → creates offer → sdp_offer
 *  4. Callee  (on receiving sdp_offer)   → creates answer → sdp_answer
 *  5. Both sides stream ICE candidates via ice_candidate
 *  6. Audio/Video flows
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  AppState,
  AppStateStatus,
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Constants from 'expo-constants';

/** True when running inside the Expo Go sandbox — native modules unavailable */
const IS_EXPO_GO = Constants.appOwnership === 'expo';

/**
 * Lazily require react-native-webrtc and react-native-incall-manager so the
 * import never executes at module-load time inside Expo Go (which would crash).
 * Outside Expo Go (development build / production) these resolve normally.
 */
function getRTC() {
  if (IS_EXPO_GO) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('react-native-webrtc') as {
      RTCPeerConnection: any;
      RTCIceCandidate: any;
      RTCSessionDescription: any;
      mediaDevices: any;
      RTCView: any;
    };
  } catch { return null; }
}

function getInCallManager() {
  if (IS_EXPO_GO) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return (require('react-native-incall-manager') as any).default ?? null;
  } catch { return null; }
}
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WS_V1 } from '@/constants/api';
import { darkColors, lightColors } from '@/constants/appColors';
import { useAppTheme } from '@/context/ThemeContext';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CallPartner {
  id:     string;
  name:   string;
  image?: string;
}

export interface CallRecord {
  id:          string;
  sender_id:   string;
  receiver_id: string;
  msg_type:    string;
  metadata:    any;
  created_at:  string;
  call_type:   'missed' | 'ended' | 'declined';
  duration:    number;
  call_kind:   'audio' | 'video';
}

interface CallContextType {
  callState:        'outgoing' | 'incoming' | 'active' | null;
  callPartner:      CallPartner | null;
  callKind:         'audio' | 'video';
  callSeconds:      number;
  isMuted:          boolean;
  isSpeaker:        boolean;
  isCameraOff:      boolean;
  localStreamURL:   string | null;
  remoteStreamURL:  string | null;
  initiateCall:     (partner: CallPartner, kind?: 'audio' | 'video') => void;
  acceptCall:       () => void;
  declineCall:      () => void;
  endCall:          () => void;
  toggleMute:       () => void;
  toggleSpeaker:    () => void;
  toggleCamera:     () => void;
  /** Used by _layout.tsx to inject an incoming call from a push-notification tap */
  setIncomingCall:  (partner: CallPartner, kind?: 'audio' | 'video') => void;
  /** Subscribe to call_record events so chat page can add bubbles */
  onCallRecord:     (handler: (rec: CallRecord) => void) => () => void;
  /** Subscribe to raw notify-WS messages (presence, new_message, etc.) */
  onNotifyMessage:  (handler: (payload: any) => void) => () => void;
  /** Send a message over the shared notify WS */
  notifySend:       (data: object) => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export function useCall(): CallContextType {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used inside <CallProvider>');
  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────────
// CallScreen — full-screen Modal, rendered above everything
// ─────────────────────────────────────────────────────────────────────────────

const AVATAR_SIZE = 120;

interface CallScreenProps {
  visible:          boolean;
  callState:        'outgoing' | 'incoming' | 'active';
  partner:          CallPartner;
  callKind:         'audio' | 'video';
  callSeconds:      number;
  isMuted:          boolean;
  isSpeaker:        boolean;
  isCameraOff:      boolean;
  localStreamURL:   string | null;
  remoteStreamURL:  string | null;
  onAccept:         () => void;
  onDecline:        () => void;
  onEnd:            () => void;
  onToggleMute:     () => void;
  onToggleSpeaker:  () => void;
  onToggleCamera:   () => void;
  onFlipCamera:     () => void;
}

function CallScreen(props: CallScreenProps) {
  const {
    visible, callState, partner, callKind, callSeconds,
    isMuted, isSpeaker, isCameraOff,
    localStreamURL, remoteStreamURL,
    onAccept, onDecline, onEnd,
    onToggleMute, onToggleSpeaker, onToggleCamera, onFlipCamera,
  } = props;

  const insets     = useSafeAreaInsets();
  const { isDark } = useAppTheme();
  const colors     = isDark ? darkColors : lightColors;

  const ring1S = useRef(new Animated.Value(1)).current;
  const ring1O = useRef(new Animated.Value(0)).current;
  const ring2S = useRef(new Animated.Value(1)).current;
  const ring2O = useRef(new Animated.Value(0)).current;
  const ring3S = useRef(new Animated.Value(1)).current;
  const ring3O = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;
  const btnSc  = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (!visible) {
      fadeIn.setValue(0);
      btnSc.setValue(0.8);
      return;
    }
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.spring(btnSc,  { toValue: 1, damping: 18, stiffness: 220, useNativeDriver: true }),
    ]).start();

    const pulse = (s: Animated.Value, o: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(s, { toValue: 2.4, duration: 2000, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(o, { toValue: 0.5, duration: 200,  useNativeDriver: true }),
            Animated.timing(o, { toValue: 0,   duration: 1800, useNativeDriver: true }),
          ]),
        ]),
        Animated.parallel([
          Animated.timing(s, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(o, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ]));

    const a1 = pulse(ring1S, ring1O, 0);
    const a2 = pulse(ring2S, ring2O, 700);
    const a3 = pulse(ring3S, ring3O, 1400);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, [visible]);

  const fmt       = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const statusTxt = callState === 'outgoing'
    ? (callKind === 'video' ? 'Video calling…' : 'Calling…')
    : callState === 'incoming'
      ? (callKind === 'video' ? 'Incoming Video Call' : 'Voice Call')
      : fmt(callSeconds);
  const ringColor = callState === 'incoming' ? '#22c55e' : '#7c3aed';

  if (!visible) return null;

  // ── Active video call — full-screen camera view ───────────────────────────
  const isActiveVideo = callKind === 'video' && callState === 'active';
  if (isActiveVideo) {
    const RTCView = getRTC()?.RTCView ?? null;

    return (
      <Modal transparent visible animationType="fade" statusBarTranslucent>
        <View style={cs.root}>

          {/* ── Remote video full-screen background ── */}
          {RTCView && remoteStreamURL ? (
            <RTCView
              streamURL={remoteStreamURL}
              style={StyleSheet.absoluteFill}
              objectFit="cover"
              zOrder={0}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: '#111118' }]}>
              {/* Connecting — show blurred avatar placeholder */}
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                {partner.image ? (
                  <Image
                    source={{ uri: partner.image }}
                    style={{ width: 160, height: 160, borderRadius: 80, opacity: 0.35 }}
                    contentFit="cover"
                    blurRadius={18}
                  />
                ) : (
                  <View style={{ width: 160, height: 160, borderRadius: 80, backgroundColor: '#2a1a4e', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 64, color: 'rgba(255,255,255,0.3)' }}>{partner.name.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, fontFamily: 'ProductSans-Regular', marginTop: 18 }}>Connecting video…</Text>
              </View>
            </View>
          )}

          {/* ── Strong gradient at top (status bar legibility) ── */}
          <LinearGradient
            colors={['rgba(0,0,0,0.55)', 'transparent']}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 120 }}
          />

          {/* ── Strong gradient at bottom (controls legibility) ── */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.78)', 'rgba(0,0,0,0.96)']}
            style={cs.videoGradient}
          />

          {/* ── Local video PiP — top right ── */}
          <View style={[cs.pip, { top: insets.top + 10 }]}>
            {RTCView && localStreamURL && !isCameraOff ? (
              <RTCView
                streamURL={localStreamURL}
                style={cs.pipVideo}
                objectFit="cover"
                zOrder={1}
                mirror
              />
            ) : (
              <View style={[cs.pipVideo, { backgroundColor: '#1c1c2e', alignItems: 'center', justifyContent: 'center' }]}>
                <Ionicons name="videocam-off" size={22} color="rgba(255,255,255,0.55)" />
              </View>
            )}
            {/* Subtle border */}
            <View style={cs.pipBorder} pointerEvents="none" />
          </View>

          {/* ── Bottom info + controls ── */}
          <View style={[cs.videoBottom, { paddingBottom: insets.bottom + 20 }]}>

            {/* Partner name + live timer chip */}
            <View style={cs.videoInfoChip}>
              {partner.image ? (
                <Image source={{ uri: partner.image }} style={cs.chipAvatar} contentFit="cover" />
              ) : (
                <View style={[cs.chipAvatar, { backgroundColor: '#7c3aed', alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ color: '#fff', fontSize: 11, fontFamily: 'ProductSans-Bold' }}>{partner.name.charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <Text style={cs.chipName} numberOfLines={1}>{partner.name}</Text>
              <View style={cs.chipDivider} />
              <View style={cs.liveDotSmall} />
              <Text style={cs.chipTimer}>{fmt(callSeconds)}</Text>
            </View>

            {/* Control row */}
            <View style={cs.videoControls}>
              <VideoBtn
                icon={isMuted ? 'mic-off' : 'mic'}
                active={isMuted}
                onPress={onToggleMute}
              />
              <VideoBtn
                icon={isCameraOff ? 'videocam-off' : 'videocam'}
                active={isCameraOff}
                onPress={onToggleCamera}
              />
              {/* End call — large red pill */}
              <Pressable
                onPress={onEnd}
                style={({ pressed }) => [cs.endBtn, pressed && { opacity: 0.8 }]}
              >
                <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
              </Pressable>
              <VideoBtn
                icon={isSpeaker ? 'volume-high' : 'volume-medium'}
                active={isSpeaker}
                onPress={onToggleSpeaker}
              />
              <VideoBtn
                icon="camera-reverse-outline"
                active={false}
                onPress={onFlipCamera}
              />
            </View>
          </View>

        </View>
      </Modal>
    );
  }

  // ── Audio call OR outgoing/incoming video call ────────────────────────────
  return (
    <Modal transparent visible animationType="none" statusBarTranslucent>
      <Animated.View style={[cs.root, { opacity: fadeIn }]}>
        <LinearGradient colors={['#0d0d14', '#1a0e2e', '#0d0d14']} style={StyleSheet.absoluteFill} />

        {/* Top info */}
        <View style={[cs.topInfo, { paddingTop: insets.top + 24 }]}>
          {callKind === 'video' && (
            <View style={cs.videoCallBadge}>
              <Ionicons name="videocam" size={13} color="#fff" />
              <Text style={cs.videoCallBadgeText}>Video Call</Text>
            </View>
          )}
          <Text style={cs.name}>{partner.name}</Text>
          <Text style={cs.status}>{statusTxt}</Text>
          {callState === 'active' && (
            <View style={cs.liveRow}>
              <View style={cs.liveDot} />
              <Text style={cs.liveText}>LIVE</Text>
            </View>
          )}
        </View>

        {/* Avatar + pulsing rings */}
        <View style={cs.avatarWrap}>
          {[{ s: ring1S, o: ring1O }, { s: ring2S, o: ring2O }, { s: ring3S, o: ring3O }].map((r, i) => (
            <Animated.View
              key={i}
              style={[cs.ring, { borderColor: ringColor, opacity: r.o, transform: [{ scale: r.s }] }]}
            />
          ))}
          <View style={cs.avatarOuter}>
            <View style={cs.avatarInner}>
              {partner.image ? (
                <Image source={{ uri: partner.image }} style={cs.avatarImg} contentFit="cover" />
              ) : (
                <View style={[cs.avatarImg, { backgroundColor: '#7c3aed', alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ fontSize: 48, color: '#fff' }}>{partner.name.charAt(0).toUpperCase()}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Controls */}
        <Animated.View style={[cs.controls, { paddingBottom: insets.bottom + 32, transform: [{ scale: btnSc }] }]}>
          {callState === 'incoming' ? (
            <View style={cs.row}>
              {/* Message (dismiss to chat) */}
              <CtrlBtn icon="chatbubble-ellipses" label="Message" bg="rgba(255,255,255,0.12)" onPress={onDecline} />
              {/* Decline */}
              <CtrlBtn icon="call" label="Decline" bg="#ef4444" rotate="135deg" onPress={onDecline} />
              {/* Accept */}
              <CtrlBtn icon={callKind === 'video' ? 'videocam' : 'call'} label="Accept" bg="#22c55e" onPress={onAccept} size={72} />
            </View>
          ) : (
            <View style={cs.row}>
              <CtrlBtn icon={isMuted ? 'mic-off' : 'mic'} label={isMuted ? 'Unmute' : 'Mute'}
                bg={isMuted ? '#fff' : 'rgba(255,255,255,0.15)'}
                iconColor={isMuted ? '#1a0e2e' : '#fff'}
                onPress={onToggleMute} />
              <CtrlBtn icon="call" label="End" bg="#ef4444" rotate="135deg" onPress={onEnd} size={72} />
              {callKind === 'video' ? (
                <CtrlBtn
                  icon={isCameraOff ? 'videocam-off' : 'videocam'}
                  label={isCameraOff ? 'Cam Off' : 'Camera'}
                  bg={isCameraOff ? '#fff' : 'rgba(255,255,255,0.15)'}
                  iconColor={isCameraOff ? '#1a0e2e' : '#fff'}
                  onPress={onToggleCamera}
                />
              ) : (
                <CtrlBtn icon={isSpeaker ? 'volume-high' : 'volume-medium'} label={isSpeaker ? 'Speaker' : 'Earpiece'}
                  bg={isSpeaker ? '#fff' : 'rgba(255,255,255,0.15)'}
                  iconColor={isSpeaker ? '#1a0e2e' : '#fff'}
                  onPress={onToggleSpeaker} />
              )}
            </View>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

function CtrlBtn({ icon, label, bg, iconColor = '#fff', rotate, size = 64, onPress }: {
  icon: any; label: string; bg: string; iconColor?: string;
  rotate?: string; size?: number; onPress: () => void;
}) {
  return (
    <View style={{ alignItems: 'center', gap: 10 }}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          cs.btn, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
          pressed && { opacity: 0.7 },
        ]}
      >
        <Ionicons name={icon} size={size === 72 ? 30 : 24} color={iconColor}
          style={rotate ? { transform: [{ rotate }] } : undefined} />
      </Pressable>
      <Text style={cs.label}>{label}</Text>
    </View>
  );
}

/** Small frosted icon button used in the active video call control row */
function VideoBtn({ icon, active, onPress }: {
  icon: any; active: boolean; onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        cs.videoBtn,
        active && cs.videoBtnActive,
        pressed && { opacity: 0.7 },
      ]}
    >
      <Ionicons name={icon} size={22} color={active ? '#111' : '#fff'} />
    </Pressable>
  );
}

const cs = StyleSheet.create({
  root:               { flex: 1, alignItems: 'center' },
  topInfo:            { alignItems: 'center', gap: 8, paddingHorizontal: 24, width: '100%' },
  videoCallBadge:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(124,58,237,0.85)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginBottom: 4 },
  videoCallBadgeText: { fontSize: 12, color: '#fff', fontFamily: 'ProductSans-Bold' },
  name:               { fontSize: 28, fontFamily: 'ProductSans-Bold',    color: '#fff', textAlign: 'center' },
  status:             { fontSize: 16, fontFamily: 'ProductSans-Regular', color: 'rgba(255,255,255,0.7)' },
  liveRow:            { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  liveDot:            { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' },
  liveDotSmall:       { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ef4444' },
  liveText:           { fontSize: 13, color: '#ef4444', fontFamily: 'ProductSans-Bold', letterSpacing: 2 },
  avatarWrap:         { flex: 1, alignItems: 'center', justifyContent: 'center' },
  ring:               { position: 'absolute', width: AVATAR_SIZE + 20, height: AVATAR_SIZE + 20, borderRadius: (AVATAR_SIZE + 20) / 2, borderWidth: 2 },
  avatarOuter:        { width: AVATAR_SIZE + 16, height: AVATAR_SIZE + 16, borderRadius: (AVATAR_SIZE + 16) / 2, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  avatarInner:        { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2, overflow: 'hidden', borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)' },
  avatarImg:          { width: '100%', height: '100%' },
  controls:           { width: '100%', paddingHorizontal: 32 },
  row:                { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end' },
  btn:                { alignItems: 'center', justifyContent: 'center' },
  label:              { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontFamily: 'ProductSans-Regular', textAlign: 'center' },

  // ── Active video call ─────────────────────────────────────────────────────
  videoGradient:   { position: 'absolute', bottom: 0, left: 0, right: 0, height: 320 },
  // PiP (local self-view)
  pip:             { position: 'absolute', right: 16, width: 96, height: 132, borderRadius: 18, overflow: 'hidden', backgroundColor: '#111' },
  pipBorder:       { ...StyleSheet.absoluteFillObject, borderRadius: 18, borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.25)' },
  pipVideo:        { width: '100%', height: '100%' },
  // Bottom section
  videoBottom:     { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 24, gap: 20 },
  // Name + timer chip
  videoInfoChip:   { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 50, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  chipAvatar:      { width: 30, height: 30, borderRadius: 15, overflow: 'hidden' },
  chipName:        { fontSize: 15, fontFamily: 'ProductSans-Bold', color: '#fff', maxWidth: 160 },
  chipDivider:     { width: 1, height: 14, backgroundColor: 'rgba(255,255,255,0.25)' },
  chipTimer:       { fontSize: 14, fontFamily: 'ProductSans-Regular', color: 'rgba(255,255,255,0.85)', letterSpacing: 0.5 },
  // Control row
  videoControls:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  videoBtn:        { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  videoBtnActive:  { backgroundColor: '#fff' },
  endBtn:          { width: 68, height: 68, borderRadius: 34, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center', shadowColor: '#ef4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 8 },
});

// ─────────────────────────────────────────────────────────────────────────────
// WebRTC config
// ─────────────────────────────────────────────────────────────────────────────

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Provider  (token passed as prop — no circular import with AuthContext)
// ─────────────────────────────────────────────────────────────────────────────

interface CallProviderProps {
  token:    string | null;
  children: React.ReactNode;
}

export function CallProvider({ token, children }: CallProviderProps) {
  const [callState,       setCallState]       = useState<'outgoing' | 'incoming' | 'active' | null>(null);
  const [callPartner,     setCallPartner]     = useState<CallPartner | null>(null);
  const [callKind,        setCallKind]        = useState<'audio' | 'video'>('audio');
  const [callSeconds,     setCallSeconds]     = useState(0);
  const [isMuted,         setIsMuted]         = useState(false);
  const [isSpeaker,       setIsSpeaker]       = useState(false);
  const [isCameraOff,     setIsCameraOff]     = useState(false);
  const [localStreamURL,  setLocalStreamURL]  = useState<string | null>(null);
  const [remoteStreamURL, setRemoteStreamURL] = useState<string | null>(null);

  // Core refs
  const callStateRef   = useRef<'outgoing' | 'incoming' | 'active' | null>(null);
  const callPartnerRef = useRef<CallPartner | null>(null);
  const callKindRef    = useRef<'audio' | 'video'>('audio');
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const sendRef        = useRef<((d: object) => void) | null>(null);

  // WebRTC refs (typed as any — native modules loaded lazily)
  const pcRef             = useRef<any>(null);
  const localStreamRef    = useRef<any>(null);
  const pendingCandidates = useRef<any[]>([]);
  const remoteDescSet     = useRef(false);
  const isCallerRef       = useRef(false);

  // Pub/sub listeners
  const callRecordListeners = useRef<Set<(r: CallRecord) => void>>(new Set());
  const notifyListeners     = useRef<Set<(p: any) => void>>(new Set());

  // Background notification refs
  const inCallNotifId = useRef<string | null>(null);
  const appStateRef   = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => { callStateRef.current  = callState;   }, [callState]);
  useEffect(() => { callPartnerRef.current = callPartner; }, [callPartner]);
  useEffect(() => { callKindRef.current   = callKind;    }, [callKind]);

  // ── Persistent "In a call" notification when app is backgrounded ────────────

  const showInCallNotif = useCallback(async (partnerName: string) => {
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: `📞 In a call with ${partnerName}`,
          body:  'Tap to return to the call',
          data:  { type: 'active_call' },
          sound: false,
          ...(require('expo-constants').default.platform?.android
            ? { sticky: true, ongoing: true }
            : {}),
        },
        trigger: null,
      });
      inCallNotifId.current = id;
    } catch { /* notifications not granted */ }
  }, []);

  const dismissInCallNotif = useCallback(async () => {
    if (inCallNotifId.current) {
      await Notifications.dismissNotificationAsync(inCallNotifId.current).catch(() => {});
      inCallNotifId.current = null;
    }
  }, []);

  useEffect(() => {
    if (callState !== 'active' || !callPartner) {
      dismissInCallNotif();
      return;
    }
    if (appStateRef.current !== 'active') showInCallNotif(callPartner.name);
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      appStateRef.current = next;
      if (callStateRef.current !== 'active') return;
      const partner = callPartnerRef.current;
      if (next === 'background' || next === 'inactive') {
        if (partner) showInCallNotif(partner.name);
      } else if (next === 'active') {
        dismissInCallNotif();
      }
    });
    return () => { sub.remove(); dismissInCallNotif(); };
  }, [callState, callPartner, showInCallNotif, dismissInCallNotif]);

  // ── Timer ─────────────────────────────────────────────────────────────────

  const startTimer = useCallback(() => {
    setCallSeconds(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setCallSeconds(s => s + 1), 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  // ── WebRTC helpers ────────────────────────────────────────────────────────

  const cleanupWebRTC = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t: any) => t.stop());
      localStreamRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    pendingCandidates.current = [];
    remoteDescSet.current     = false;
    setLocalStreamURL(null);
    setRemoteStreamURL(null);
    try { getInCallManager()?.stop(); } catch {}
  }, []);

  const getMediaStream = useCallback(async (kind: 'audio' | 'video'): Promise<any> => {
    const rtc = getRTC();
    if (!rtc) return null;
    try {
      return await rtc.mediaDevices.getUserMedia({
        audio: true,
        video: kind === 'video' ? { facingMode: 'user', width: 640, height: 480 } : false,
      });
    } catch (e) {
      console.warn('[WebRTC] getUserMedia failed:', e);
      return null;
    }
  }, []);

  const createPC = useCallback((kind: 'audio' | 'video'): any => {
    const rtc = getRTC();
    if (!rtc) return null;
    const pc = new rtc.RTCPeerConnection(RTC_CONFIG);
    pc.addEventListener('icecandidate', (e: any) => {
      if (e.candidate && callPartnerRef.current) {
        sendRef.current?.({
          type:      'ice_candidate',
          to:        callPartnerRef.current.id,
          candidate: e.candidate,
        });
      }
    });
    pc.addEventListener('connectionstatechange', () => {
      console.log('[WebRTC] connection state:', pc.connectionState);
    });
    if (kind === 'video') {
      pc.addEventListener('track', (e: any) => {
        if (e.streams && e.streams[0]) {
          setRemoteStreamURL(e.streams[0].toURL());
        }
      });
    }
    return pc;
  }, []);

  const drainCandidates = useCallback(async (pc: any) => {
    const rtc = getRTC();
    if (!rtc) return;
    const buffered = pendingCandidates.current.splice(0);
    for (const c of buffered) {
      try { await pc.addIceCandidate(new rtc.RTCIceCandidate(c)); } catch {}
    }
  }, []);

  // ── Public API ────────────────────────────────────────────────────────────

  const initiateCall = useCallback((partner: CallPartner, kind: 'audio' | 'video' = 'audio') => {
    setCallPartner(partner);
    setCallState('outgoing');
    setCallKind(kind);
    callKindRef.current = kind;
    setIsMuted(false);
    setIsSpeaker(false);
    setIsCameraOff(false);
    setLocalStreamURL(null);
    setRemoteStreamURL(null);
    isCallerRef.current = true;
    sendRef.current?.({ type: 'call_invite', to: partner.id, call_kind: kind });
  }, []);

  const setIncomingCall = useCallback((partner: CallPartner, kind: 'audio' | 'video' = 'audio') => {
    setCallPartner(partner);
    setCallState('incoming');
    setCallKind(kind);
    callKindRef.current = kind;
    setIsMuted(false);
    setIsSpeaker(false);
    setIsCameraOff(false);
    setLocalStreamURL(null);
    setRemoteStreamURL(null);
    isCallerRef.current = false;
  }, []);

  const acceptCall = useCallback(async () => {
    const partner = callPartnerRef.current;
    const kind    = callKindRef.current;
    if (!partner) return;
    setCallState('active');
    startTimer();
    sendRef.current?.({ type: 'call_accept', to: partner.id });

    try { getInCallManager()?.start({ media: kind === 'video' ? 'video' : 'audio' }); } catch {}
    const stream = await getMediaStream(kind);
    if (!stream) return;
    localStreamRef.current = stream;
    if (kind === 'video') {
      setLocalStreamURL(stream.toURL());
    }
    const pc = createPC(kind);
    pcRef.current = pc;
    stream.getTracks().forEach((t: any) => pc.addTrack(t, stream));
  }, [startTimer, getMediaStream, createPC]);

  const declineCall = useCallback(() => {
    const partner = callPartnerRef.current;
    cleanupWebRTC();
    dismissInCallNotif();
    setCallState(null);
    setCallPartner(null);
    if (partner) sendRef.current?.({ type: 'call_decline', to: partner.id });
  }, [cleanupWebRTC, dismissInCallNotif]);

  const endCall = useCallback(() => {
    const partner  = callPartnerRef.current;
    const duration = timerRef.current ? callSeconds : 0;
    stopTimer();
    cleanupWebRTC();
    dismissInCallNotif();
    setCallState(null);
    setCallPartner(null);
    if (partner) sendRef.current?.({ type: 'call_end', to: partner.id, duration });
  }, [callSeconds, stopTimer, cleanupWebRTC, dismissInCallNotif]);

  // Real mute: disable the local audio track
  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach((t: any) => { t.enabled = !next; });
      }
      return next;
    });
  }, []);

  // Real speaker: route via InCallManager
  const toggleSpeaker = useCallback(() => {
    setIsSpeaker(prev => {
      const next = !prev;
      try { getInCallManager()?.setSpeakerphoneOn(next); } catch {}
      return next;
    });
  }, []);

  // Camera on/off: disable the local video track
  const toggleCamera = useCallback(() => {
    setIsCameraOff(prev => {
      const next = !prev;
      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach((t: any) => { t.enabled = !next; });
      }
      return next;
    });
  }, []);

  // Flip between front and back camera
  const flipCamera = useCallback(() => {
    try {
      localStreamRef.current?.getVideoTracks?.()[0]?._switchCamera?.();
    } catch {}
  }, []);

  const notifySend = useCallback((data: object) => { sendRef.current?.(data); }, []);

  const onCallRecord = useCallback((handler: (r: CallRecord) => void) => {
    callRecordListeners.current.add(handler);
    return () => { callRecordListeners.current.delete(handler); };
  }, []);

  const onNotifyMessage = useCallback((handler: (p: any) => void) => {
    notifyListeners.current.add(handler);
    return () => { notifyListeners.current.delete(handler); };
  }, []);

  // ── Notify WebSocket ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!token) return;
    let disposed = false;

    function connect() {
      const ws = new WebSocket(`${WS_V1}/ws/notify?token=${token}`);

      sendRef.current = (data: object) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
      };

      ws.onmessage = async (e: MessageEvent) => {
        try {
          const p = JSON.parse(e.data as string);

          // Broadcast to all registered screen-level listeners first
          notifyListeners.current.forEach(h => h(p));

          // ── Incoming call invite ──────────────────────────────────────────
          if (p.type === 'call_invite') {
            if (callStateRef.current !== null) return;
            isCallerRef.current = false;
            const kind: 'audio' | 'video' = p.call_kind === 'video' ? 'video' : 'audio';
            callKindRef.current = kind;
            setCallKind(kind);
            setCallPartner({ id: p.from, name: p.caller_name ?? 'Unknown', image: p.caller_image });
            setCallState('incoming');
            setIsMuted(false);
            setIsSpeaker(false);
            setIsCameraOff(false);
            setLocalStreamURL(null);
            setRemoteStreamURL(null);

          // ── Caller receives: callee accepted → start WebRTC as caller ─────
          } else if (p.type === 'call_accept') {
            if (callStateRef.current === 'outgoing') {
              const kind = callKindRef.current;
              setCallState('active');
              startTimer();

              try { getInCallManager()?.start({ media: kind === 'video' ? 'video' : 'audio' }); } catch {}

              const stream = await getMediaStream(kind);
              if (!stream) return;
              localStreamRef.current = stream;
              if (kind === 'video') {
                setLocalStreamURL(stream.toURL());
              }
              const pc = createPC(kind);
              if (!pc) return;
              pcRef.current = pc;
              stream.getTracks().forEach((t: any) => pc.addTrack(t, stream));

              const offer = await pc.createOffer({});
              await pc.setLocalDescription(offer);
              const partner = callPartnerRef.current;
              if (partner) {
                sendRef.current?.({
                  type: 'sdp_offer',
                  to:   partner.id,
                  sdp:  pc.localDescription,
                });
              }
            }

          // ── Callee receives: SDP offer from caller → create answer ────────
          } else if (p.type === 'sdp_offer') {
            const rtc2 = getRTC();
            const pc = pcRef.current;
            if (!pc || !rtc2) return;
            await pc.setRemoteDescription(new rtc2.RTCSessionDescription(p.sdp));
            remoteDescSet.current = true;
            await drainCandidates(pc);

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            const partner = callPartnerRef.current;
            if (partner) {
              sendRef.current?.({
                type: 'sdp_answer',
                to:   partner.id,
                sdp:  pc.localDescription,
              });
            }

          // ── Caller receives: SDP answer from callee ───────────────────────
          } else if (p.type === 'sdp_answer') {
            const rtc3 = getRTC();
            const pc = pcRef.current;
            if (!pc || !rtc3) return;
            await pc.setRemoteDescription(new rtc3.RTCSessionDescription(p.sdp));
            remoteDescSet.current = true;
            await drainCandidates(pc);

          // ── ICE candidate ─────────────────────────────────────────────────
          } else if (p.type === 'ice_candidate') {
            const rtc4 = getRTC();
            const pc = pcRef.current;
            if (!pc || !rtc4) return;
            const candidate = new rtc4.RTCIceCandidate(p.candidate);
            if (remoteDescSet.current) {
              try { await pc.addIceCandidate(candidate); } catch {}
            } else {
              // Buffer until remote description is set
              pendingCandidates.current.push(p.candidate);
            }

          // ── Call decline ──────────────────────────────────────────────────
          } else if (p.type === 'call_decline') {
            stopTimer();
            cleanupWebRTC();
            const partner = callPartnerRef.current;
            if (partner) sendRef.current?.({ type: 'call_end', to: partner.id, duration: 0 });
            setCallState(null);
            setCallPartner(null);

          // ── Call end ──────────────────────────────────────────────────────
          } else if (p.type === 'call_end') {
            stopTimer();
            cleanupWebRTC();
            setCallState(null);
            setCallPartner(null);

          // ── Call record (chat bubble) ─────────────────────────────────────
          } else if (p.type === 'call_record') {
            const rec: CallRecord = {
              id:          p.id,
              sender_id:   p.sender_id,
              receiver_id: p.receiver_id,
              msg_type:    p.msg_type,
              metadata:    p.metadata,
              created_at:  p.created_at,
              call_type:   p.metadata?.call_type ?? 'ended',
              duration:    Number(p.metadata?.duration ?? 0),
              call_kind:   p.metadata?.call_kind === 'video' ? 'video' : 'audio',
            };
            callRecordListeners.current.forEach(h => h(rec));
          }
        } catch { /* ignore malformed frames */ }
      };

      ws.onerror  = () => { /* silent — onclose will reconnect */ };
      ws.onclose  = () => {
        sendRef.current = null;
        if (!disposed) setTimeout(connect, 3000);
      };
    }

    connect();
    return () => {
      disposed = true;
      sendRef.current = null;
    };
  }, [token, startTimer, stopTimer, cleanupWebRTC, getMediaStream, createPC, drainCandidates]);

  // ── Context value ─────────────────────────────────────────────────────────

  const value: CallContextType = {
    callState, callPartner, callKind, callSeconds,
    isMuted, isSpeaker, isCameraOff,
    localStreamURL, remoteStreamURL,
    initiateCall, setIncomingCall, acceptCall, declineCall, endCall,
    toggleMute, toggleSpeaker, toggleCamera,
    onCallRecord, onNotifyMessage, notifySend,
  };

  return (
    <CallContext.Provider value={value}>
      {children}

      {callState !== null && callPartner !== null && (
        <CallScreen
          visible
          callState={callState}
          partner={callPartner}
          callKind={callKind}
          callSeconds={callSeconds}
          isMuted={isMuted}
          isSpeaker={isSpeaker}
          isCameraOff={isCameraOff}
          localStreamURL={localStreamURL}
          remoteStreamURL={remoteStreamURL}
          onAccept={acceptCall}
          onDecline={declineCall}
          onEnd={endCall}
          onToggleMute={toggleMute}
          onToggleSpeaker={toggleSpeaker}
          onToggleCamera={toggleCamera}
          onFlipCamera={flipCamera}
        />
      )}
    </CallContext.Provider>
  );
}
