import * as SecureStore from 'expo-secure-store';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, NativeModules } from 'react-native';
import { API_V1, WS_V1, registerAuthHandlers } from '@/constants/api';
import Constants, { ExecutionEnvironment } from 'expo-constants';

// RevenueCat is only available in native dev/production builds (not Expo Go)
const _IS_EXPO_GO =
  !NativeModules.RNPurchases ||
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
  (Constants as any).appOwnership === 'expo';

export const RECENT_ACCOUNT_KEY = 'recent_account';
const FCM_TOKEN_KEY = 'fcm_token_v1';
export interface RecentAccount {
  name: string | null;
  phone: string | null;
  photo: string | null;
  method: 'phone' | 'apple' | 'google';
}

/**
 * Saves login info to the iOS Keychain (SecureStore) — protected by
 * Face ID / Touch ID on supported devices. Call only after the user agrees.
 */
export async function saveRecentAccount(account: RecentAccount): Promise<void> {
  await SecureStore.setItemAsync(RECENT_ACCOUNT_KEY, JSON.stringify(account));
}

/** Loads the saved recent account from SecureStore. */
export async function loadRecentAccount(): Promise<RecentAccount | null> {
  try {
    const raw = await SecureStore.getItemAsync(RECENT_ACCOUNT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const ACCESS_KEY        = 'auth_token';
const REFRESH_KEY       = 'refresh_token';
// Survives explicit logout — used for biometric quick sign-in (like Snapchat/Facebook "Continue as")
const QUICK_SIGNIN_KEY  = 'quick_signin_refresh';

// Mirrors backend MeResponse schema.
// All categorical single-value fields use lookup_options integer IDs.
// All categorical multi-value fields are arrays of lookup_options IDs.
// lifestyle values are lookup_options IDs keyed by trait (drinking, smoking, exercise, diet).
export interface UserProfile {
  id: string;
  phone: string | null;
  email: string | null;
  apple_id: string | null;
  google_id: string | null;
  full_name: string | null;
  date_of_birth: string | null;      // YYYY-MM-DD
  gender_id: number | null;          // lookup_options id (category=gender)
  bio: string | null;

  // Multi-value ID arrays
  purpose: number[] | null;          // [relationship_types.id, ...]
  interests: number[] | null;        // [lookup_options.id] category=interests
  lifestyle: Record<string, number> | null; // {drinking: id, smoking: id, exercise: id, diet: id}
  values_list: number[] | null;      // [lookup_options.id] category=values_list
  languages: number[] | null;        // [lookup_options.id] category=language
  causes: number[] | null;           // [lookup_options.id] category=causes

  height_cm: number | null;
  prompts: Record<string, string>[] | null;
  photos: string[] | null;

  // Single-value ID fields
  education_level_id: number | null; // lookup_options id (category=education_level)
  looking_for_id: number | null;     // lookup_options id (category=looking_for)
  family_plans_id: number | null;    // lookup_options id (category=family_plans)
  have_kids_id: number | null;       // lookup_options id (category=have_kids)
  star_sign_id: number | null;       // lookup_options id (category=star_sign)
  religion_id: number | null;        // lookup_options id (category=religion)
  ethnicity_id: number | null;       // lookup_options id (category=ethnicity)

  // Halal profile fields
  sect_id:              number | null;  // lookup_options id (category=sect)
  prayer_frequency_id:  number | null;  // lookup_options id (category=prayer_frequency)
  marriage_timeline_id: number | null;  // lookup_options id (category=marriage_timeline)
  wali_email:           string | null;
  wali_name:            string | null;
  wali_age:             number | null;
  wali_relation:        string | null;
  wali_verified:        boolean;
  blur_photos_halal:    boolean;
  halal_mode_enabled:   boolean;
  work_mode_enabled:    boolean;

  // Notification preferences
  notif_new_match:     boolean;
  notif_new_message:   boolean;
  notif_super_like:    boolean;
  notif_liked_profile: boolean;
  notif_profile_views: boolean;
  notif_ai_picks:      boolean;
  notif_promotions:    boolean;
  notif_dating_tips:   boolean;

  mood_emoji: string | null;
  mood_text: string | null;

  voice_prompts: Array<{ topic: string; url: string; duration_sec: number }> | null;
  work_experience: Array<{ job_title: string; company: string; start_year: string; end_year: string; current: boolean }> | null;
  education: Array<{ institution: string; course: string; degree: string; grad_year: string }> | null;
  city: string | null;
  hometown: string | null;
  living_in: string | null;
  address: string | null;
  country: string | null;
  subscription_tier: string;         // "free" | "pro"
  super_likes_remaining: number;
  dark_mode: boolean;
  best_photo_enabled: boolean;
  face_match_score: number | null;
  verification_status: 'unverified' | 'pending' | 'verified' | 'rejected';

  // Zod Work profile
  work_photos: string[] | null;
  work_prompts: Array<{ question: string; answer: string }> | null;
  work_matching_goals: number[] | null;        // [lookup_options.id] category=work_matching_goals
  work_are_you_hiring: boolean | null;
  work_commitment_level_id: number | null;     // lookup_options id (category=work_commitment_level)
  work_skills: number[] | null;               // [lookup_options.id] category=work_skills
  work_equity_split_id: number | null;         // lookup_options id (category=work_equity_split)
  work_industries: number[] | null;           // [lookup_options.id] category=work_industries
  work_scheduling_url: string | null;
  work_who_to_show_id: number | null;          // lookup_options id (category=work_who_to_show)
  work_priority_startup: boolean | null;
  linkedin_url: string | null;
  linkedin_verified: boolean;

  // Discover filter preferences
  filter_age_min:         number | null;
  filter_age_max:         number | null;
  filter_max_distance_km: number | null;   // null treated as 80 km max
  filter_verified_only:   boolean;
  filter_star_signs:      number[] | null;
  filter_interests:       number[] | null;
  filter_languages:       number[] | null;
  filter_religions:       number[] | null;
  // Pro-only filters
  filter_purpose:         number[] | null;
  filter_looking_for:     number[] | null;
  filter_education_level: number[] | null;
  filter_family_plans:    number[] | null;
  filter_have_kids:       number[] | null;
  filter_ethnicities:     number[] | null;
  filter_exercise:        number[] | null;
  filter_drinking:        number[] | null;
  filter_smoking:         number[] | null;
  filter_height_min:      number | null;
  filter_height_max:      number | null;
  // Halal-specific filters
  filter_sect:               number[] | null;
  filter_prayer_frequency:   number[] | null;
  filter_marriage_timeline:  number[] | null;
  filter_wali_verified_only: boolean;
  filter_wants_to_work:      boolean | null;

  university:                string | null;
  university_email:          string | null;
  university_email_verified: boolean;
  hide_age:                 boolean;
  hide_distance:            boolean;
  require_verified_to_chat: boolean;

  is_incognito:        boolean;
  travel_mode_enabled: boolean;
  auto_zod_enabled:    boolean;
  travel_city:         string | null;
  travel_country:      string | null;

  is_verified: boolean;
  is_onboarded: boolean;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;

  face_scan_required: boolean;
  id_scan_required:   boolean;
  has_push_token:     boolean;
}

interface AuthContextValue {
  token: string | null;
  refreshToken: string | null;
  isOnboarded: boolean;
  isLoading: boolean;
  isNetworkError: boolean;
  isSuspended: boolean;
  profile: UserProfile | null;
  signIn: (accessToken: string, refreshToken: string, isOnboarded: boolean, method?: 'phone' | 'apple' | 'google', prefetchedProfile?: UserProfile) => Promise<void>;
  signOut: () => Promise<void>;
  setOnboarded: () => Promise<void>;
  updateProfile: (patch: Partial<UserProfile>) => void;
  tryRefresh: () => Promise<string | null>;
  retryBootstrap: () => void;
  /** Silently re-authenticates using the persisted quick-sign-in refresh token.
   *  Returns the destination route on success, or null if the token has expired. */
  performQuickSignIn: () => Promise<string | null>;
  /** Request notification permission (if not already granted) and register the
   *  FCM token with the backend. Safe to call multiple times — idempotent. */
  requestAndRegisterPushToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  token: null,
  refreshToken: null,
  isOnboarded: false,
  isLoading: true,
  isNetworkError: false,
  profile: null,
  signIn: async (_a: string, _b: string, _c: boolean, _d?: 'phone' | 'apple' | 'google', _e?: UserProfile) => {},
  signOut: async () => {},
  setOnboarded: async () => {},
  updateProfile: () => {},
  tryRefresh: async () => null,
  retryBootstrap: () => {},
  performQuickSignIn: async () => null,
  requestAndRegisterPushToken: async () => {},
  isSuspended: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken]               = useState<string | null>(null);
  const [refreshToken, setRefresh]      = useState<string | null>(null);
  const [isOnboarded, setIsOnboarded]   = useState(false);
  const [isLoading, setIsLoading]       = useState(true);
  const [isNetworkError, setIsNetworkError] = useState(false);
  const [isSuspended, setIsSuspended]   = useState(false);
  const [profile, setProfile]           = useState<UserProfile | null>(null);
  const [bootstrapTick, setBootstrapTick] = useState(0);

  const refreshTokenRef = useRef<string | null>(null);
  refreshTokenRef.current = refreshToken;

  // ── Global presence WebSocket — keeps user "online" in notify_manager ────────
  const presenceWsRef = useRef<WebSocket | null>(null);
  const presenceRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!token) {
      presenceWsRef.current?.close();
      presenceWsRef.current = null;
      return;
    }

    let disposed = false;

    function connectPresence(t: string) {
      if (disposed) return;
      const ws = new WebSocket(`${WS_V1}/ws/notify?token=${t}`);
      presenceWsRef.current = ws;

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          // Reply to server-initiated keep-alive pings so the connection stays alive
          if (data.type === 'ping' && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'pong' }));
          }
        } catch {}
      };

      ws.onclose = () => {
        presenceWsRef.current = null;
        if (!disposed) {
          presenceRetryRef.current = setTimeout(() => connectPresence(t), 5000);
        }
      };

      ws.onerror = () => ws.close();
    }

    connectPresence(token);

    return () => {
      disposed = true;
      if (presenceRetryRef.current) clearTimeout(presenceRetryRef.current);
      presenceWsRef.current?.close();
      presenceWsRef.current = null;
    };
  }, [token]);

  // ── Face-scan-required WebSocket ─────────────────────────────────────────────
  // Listens for server-push events that flag an account as requiring a new
  // face scan (e.g. after receiving N catfishing / false-gender reports).
  const faceScanWsRef    = useRef<WebSocket | null>(null);
  const faceScanRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!token || !profile?.id) {
      faceScanWsRef.current?.close();
      faceScanWsRef.current = null;
      return;
    }

    let disposed = false;

    function connectFaceScan(t: string, userId: string) {
      if (disposed) return;
      const ws = new WebSocket(`${WS_V1}/ws/face-scan-required/${userId}?token=${t}`);
      faceScanWsRef.current = ws;

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'heartbeat') return;
          if (typeof data.required === 'boolean') {
            setProfile(prev => {
              if (!prev) return prev;
              // Once the user is verified, never re-impose the face-scan gate from
              // a stale WebSocket message (e.g. DB not yet reflecting the latest
              // scan result due to a slow commit or network blip).
              if (data.required && prev.is_verified) return prev;
              return { ...prev, face_scan_required: data.required };
            });
          }
        } catch {}
      };

      ws.onclose = () => {
        faceScanWsRef.current = null;
        if (!disposed) {
          faceScanRetryRef.current = setTimeout(() => connectFaceScan(t, userId), 5000);
        }
      };

      ws.onerror = () => ws.close();
    }

    connectFaceScan(token, profile.id);

    return () => {
      disposed = true;
      if (faceScanRetryRef.current) clearTimeout(faceScanRetryRef.current);
      faceScanWsRef.current?.close();
      faceScanWsRef.current = null;
    };
  }, [token, profile?.id]);

  async function _fetchProfile(
    accessToken: string,
    attempt = 1,
  ): Promise<UserProfile | null | 'network_error' | 'suspended'> {
    try {
      const controller = new AbortController();
      const timeoutMs = 8_000;
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(`${API_V1}/profile/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) return res.json() as Promise<UserProfile>;
      // 403 with suspension detail → dedicated suspended state (not a token error)
      if (res.status === 403) {
        try {
          const body = await res.json();
          if (
            typeof body?.detail === 'string' &&
            body.detail.toLowerCase().includes('suspend')
          ) {
            return 'suspended';
          }
        } catch {}
      }
      return null;
    } catch {
      // Retry up to 4 attempts with increasing backoff before declaring network error.
      // This covers server restarts which typically take 5-15s.
      // Delays: 2s → 4s → 6s between attempts
      if (attempt < 4) {
        const delay = attempt * 2_000;
        await new Promise(r => setTimeout(r, delay));
        return _fetchProfile(accessToken, attempt + 1);
      }
      return 'network_error';
    }
  }

  useEffect(() => {
    async function bootstrap() {
      // Read stored tokens first — fast operation (< 100ms normally).
      let [access, refresh]: [string | null, string | null] = [null, null];
      try {
        [access, refresh] = await Promise.all([
          SecureStore.getItemAsync(ACCESS_KEY),
          SecureStore.getItemAsync(REFRESH_KEY),
        ]);
      } catch {
        setIsLoading(false);
        return;
      }

      if (!access) {
        setIsNetworkError(false);
        setIsLoading(false);
        return;
      }

      // Set the token immediately from SecureStore so that if the watchdog fires
      // during network retries, the routing layer still sees the user as logged-in
      // and shows the "No Connection" overlay instead of redirecting to login.
      setToken(access);
      setRefresh(refresh ?? null);

      // Watchdog: prevent the splash hanging forever. Now that token is pre-set
      // above, firing this will still show the user as logged-in (just loading).
      const watchdog = setTimeout(() => setIsLoading(false), 8_000);

      let activeToken = access;
      let me = await _fetchProfile(access);

      if (me === 'suspended') {
        clearTimeout(watchdog);
        setIsSuspended(true);
        setIsLoading(false);
        return;
      }

      if (me === 'network_error') {
        clearTimeout(watchdog);
        setIsNetworkError(true);
        setIsLoading(false);
        return;
      }

      if (!me && refresh) {
        // Access token expired — try a refresh
        let newAccess: string | null = null;
        try {
          newAccess = await _doRefresh(refresh);
        } catch {
          clearTimeout(watchdog);
          setIsNetworkError(true);
          setIsLoading(false);
          return;
        }
        if (newAccess) {
          activeToken = newAccess;
          setToken(newAccess);
          const retried = await _fetchProfile(newAccess);
          if (retried === 'suspended') {
            clearTimeout(watchdog);
            setIsSuspended(true);
            setIsLoading(false);
            return;
          }
          if (retried === 'network_error') {
            clearTimeout(watchdog);
            setIsNetworkError(true);
            setIsLoading(false);
            return;
          }
          me = retried;
        }
      }

      clearTimeout(watchdog);
      setIsNetworkError(false);
      setIsSuspended(false);
      if (me && me !== 'network_error' && me !== 'suspended') {
        setToken(activeToken);
        setRefresh(refresh ?? null);
        setProfile(me);
        setIsOnboarded(me.is_onboarded);
        // Re-register push token on every successful session restore so stale
        // or missing tokens are refreshed automatically without requiring a re-login.
        _registerPushToken(activeToken);
      } else {
        // Token genuinely unusable (401 / expired with no valid refresh) — clear
        // both SecureStore AND React state so the routing guard sees isLoggedIn=false
        // and routes to /welcome rather than landing on a stale protected screen.
        await _clearSession();
        setToken(null);
        setRefresh(null);
        setProfile(null);
        setIsOnboarded(false);
      }

      setIsLoading(false);
    }

    bootstrap();
  }, [bootstrapTick]);

  async function _clearSession() {
    await SecureStore.deleteItemAsync(ACCESS_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
    await SecureStore.deleteItemAsync(FCM_TOKEN_KEY);
    // Clear quick-sign-in and recent-account data on explicit logout so that
    // a different user opening the app on the same device doesn't see the
    // previous user's "Continue as" card or get silently signed in as them.
    await SecureStore.deleteItemAsync(QUICK_SIGNIN_KEY);
    await SecureStore.deleteItemAsync(RECENT_ACCOUNT_KEY);
  }

  async function _doRefresh(refresh: string): Promise<string | null> {
    let res: Response;
    try {
      res = await fetch(`${API_V1}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refresh }),
      });
    } catch {
      // Network unreachable — throw so callers can distinguish from a genuine
      // auth failure (where the refresh token is actually invalid / expired).
      throw new Error('NETWORK_ERROR');
    }
    if (!res.ok) return null; // Refresh token genuinely rejected by server
    // Backend rotates on every refresh — BOTH tokens must be saved
    const data: { access_token: string; refresh_token: string } = await res.json();
    const newAccess  = data.access_token;
    const newRefresh = data.refresh_token;
    await SecureStore.setItemAsync(ACCESS_KEY,  newAccess);
    await SecureStore.setItemAsync(REFRESH_KEY, newRefresh);
    // Keep quick-sign-in token up to date with the latest refresh token
    await SecureStore.setItemAsync(QUICK_SIGNIN_KEY, newRefresh);
    setToken(newAccess);
    setRefresh(newRefresh);
    return newAccess;
  }

  /** Silently re-authenticates using the persisted quick-sign-in refresh token.
   *  All HTTP work is done before any state is touched so the auth guard never
   *  fires with a half-initialised session (which would briefly show the profile
   *  screen before landing on the feed).
   *  Returns the destination route on success, null if the token has expired. */
  const performQuickSignIn = async (): Promise<string | null> => {
    const quickRefresh = await SecureStore.getItemAsync(QUICK_SIGNIN_KEY);
    if (!quickRefresh) return null;

    // ── Step 1: refresh token (no state changes yet) ──────────────────────────
    let newAccess: string;
    let newRefresh: string;
    try {
      const res = await fetch(`${API_V1}/auth/refresh`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ refresh_token: quickRefresh }),
      });
      if (!res.ok) {
        // Token expired or revoked — clear quick-sign-in data
        await SecureStore.deleteItemAsync(QUICK_SIGNIN_KEY);
        await SecureStore.deleteItemAsync(RECENT_ACCOUNT_KEY);
        return null;
      }
      const data: { access_token: string; refresh_token: string } = await res.json();
      newAccess  = data.access_token;
      newRefresh = data.refresh_token;
    } catch {
      throw new Error('NETWORK_ERROR');
    }

    // ── Step 2: fetch profile (still no state changes) ────────────────────────
    const me = await _fetchProfile(newAccess);
    if (!me || me === 'network_error') {
      await SecureStore.deleteItemAsync(QUICK_SIGNIN_KEY);
      await SecureStore.deleteItemAsync(RECENT_ACCOUNT_KEY);
      return null;
    }

    // ── Step 3: persist tokens then update ALL state in one batch ─────────────
    // Doing this last prevents the auth guard from firing with profile = null
    // (which would briefly flash the profile/onboarding screen).
    await SecureStore.setItemAsync(ACCESS_KEY,       newAccess);
    await SecureStore.setItemAsync(REFRESH_KEY,      newRefresh);
    await SecureStore.setItemAsync(QUICK_SIGNIN_KEY, newRefresh);
    setToken(newAccess);
    setRefresh(newRefresh);
    setProfile(me);
    setIsOnboarded(me.is_onboarded);
    _registerPushToken(newAccess);

    return me.is_onboarded ? '/(tabs)' : '/gender';
  };

  const tryRefresh = async (): Promise<string | null> => {
    const refresh = refreshTokenRef.current;
    if (!refresh) return null;
    return _doRefresh(refresh);
  };

  /**
   * Sends a known FCM token to the backend.
   * Call this whenever a token is available (login, token refresh, feed mount).
   */
  async function _sendPushTokenToBackend(fcmToken: string, accessToken: string) {
    try {
      await fetch(`${API_V1}/profile/me/push-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ token: fcmToken }),
      });
    } catch { /* non-critical */ }
  }

  /**
   * Silently registers the push token when the user is already authenticated.
   * Called on sign-in if the backend already has a token (cheap idempotency check).
   */
  async function _registerPushToken(accessToken: string, _profileHasPushToken?: boolean) {
    try {
      const pushToken = await _getExpoPushToken();
      if (!pushToken) return;
      await SecureStore.setItemAsync(FCM_TOKEN_KEY, pushToken);
      await _sendPushTokenToBackend(pushToken, accessToken);
    } catch { /* non-critical — never block sign-in */ }
  }

  /**
   * Uses expo-notifications to get an Expo push token.
   *
   * We use Expo's push service instead of Firebase's getToken() because
   * Firebase SDK 12.x has a known hang in FIRInstallations.authTokenWithCompletion
   * on certain iOS 26 device/OS combinations. Expo's push service handles APNs
   * token exchange internally on their servers, which is fully compatible with
   * ExpoAppDelegate and works reliably on iOS 26.
   *
   * The returned token looks like: ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
   */
  async function _getExpoPushToken(): Promise<string | null> {
    try {
      const Notifications = await import('expo-notifications');
      const result = await Notifications.getExpoPushTokenAsync({
        projectId: 'fec81194-6a20-43f7-bf00-fb4638346ba2',
      });
      return result.data ?? null;
    } catch (e) {
      console.warn('[PUSH] getExpoPushToken failed:', e);
      return null;
    }
  }

  /**
   * Called from the feed page on first mount.
   * Skips entirely if a token is already stored — avoids hitting the backend
   * on every app open. Only runs the full flow the very first time (or after
   * the stored token is cleared, e.g. on sign-out).
   */
  async function requestAndRegisterPushToken() {
    const accessToken = await SecureStore.getItemAsync(ACCESS_KEY);
    if (!accessToken) return;
    try {
      // Already registered — nothing to do.
      const existing = await SecureStore.getItemAsync(FCM_TOKEN_KEY);
      if (existing) return;

      const Notifications = await import('expo-notifications');

      const { status } = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
      });
      if (status !== 'granted') return;

      const pushToken = await _getExpoPushToken();
      if (!pushToken) return;

      await SecureStore.setItemAsync(FCM_TOKEN_KEY, pushToken);
      await _sendPushTokenToBackend(pushToken, accessToken);
    } catch { /* non-critical */ }
  }

  const signIn = async (
    accessToken: string,
    newRefresh: string,
    onboarded: boolean,
    _method: 'phone' | 'apple' | 'google' = 'phone',
    prefetchedProfile?: UserProfile,
  ) => {
    await SecureStore.setItemAsync(ACCESS_KEY, accessToken);
    await SecureStore.setItemAsync(REFRESH_KEY, newRefresh);
    // Keep quick-sign-in token current so future one-tap logins always work
    await SecureStore.setItemAsync(QUICK_SIGNIN_KEY, newRefresh);
    setToken(accessToken);
    setRefresh(newRefresh);
    setIsOnboarded(onboarded);
    // Use pre-fetched profile from caller if provided — avoids a redundant /profile/me round-trip
    const me = prefetchedProfile ?? await _fetchProfile(accessToken);
    if (me && me !== 'network_error' && me !== 'suspended') setProfile(me as UserProfile);
    // Register push token in background — skip if backend already has a valid FCM token
    const hasPushToken = me && me !== 'network_error' && me !== 'suspended' ? (me as any).has_push_token === true : false;
    _registerPushToken(accessToken, hasPushToken);
    // NOTE: saving the recent account is intentionally NOT done here.
    // The caller (OTP screen / Apple sign-in) asks the user first, then
    // calls saveRecentAccount() if they agree.
  };

  const signOut = async () => {
    // Revoke the refresh token server-side so the session disappears from the
    // Security → Active Sessions list immediately. Best-effort — local state
    // is always cleared even if the network call fails.
    try {
      const currentRefresh = await SecureStore.getItemAsync(REFRESH_KEY);
      if (currentRefresh) {
        await fetch(`${API_V1}/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: currentRefresh }),
        });
      }
    } catch { /* best-effort */ }

    // Reset RevenueCat to anonymous so the next login gets a fresh customer profile.
    if (!_IS_EXPO_GO) {
      try {
        const Purchases = require('react-native-purchases').default;
        await Purchases.logOut();
      } catch { /* non-critical — RC may not be configured yet */ }
    }
    await _clearSession();
    setToken(null);
    setRefresh(null);
    setIsOnboarded(false);
    setProfile(null);
    setIsNetworkError(false);
    setIsSuspended(false);
  };

  const setOnboarded = async () => {
    setIsOnboarded(true);
    setProfile((p) => p ? { ...p, is_onboarded: true } : p);
  };

  const updateProfile = (patch: Partial<UserProfile>) => {
    setProfile((prev) => prev ? { ...prev, ...patch } : prev);
    if (patch.is_onboarded !== undefined) setIsOnboarded(patch.is_onboarded);
  };

  const retryBootstrap = () => {
    setIsLoading(true);
    // Keep isNetworkError=true so the Stack stays hidden while we retry;
    // bootstrap() will clear it only on success.
    setBootstrapTick(t => t + 1);
  };

  // Auto-retry bootstrap when app returns to foreground while on "No Connection"
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active' && isNetworkError) {
        retryBootstrap();
      }
    };
    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [isNetworkError]);

  // Auto-retry every 12s while on "No Connection" (e.g. server restarted in bg)
  useEffect(() => {
    if (!isNetworkError) return;
    const timer = setInterval(() => {
      retryBootstrap();
    }, 12_000);
    return () => clearInterval(timer);
  }, [isNetworkError]);

  useEffect(() => {
    registerAuthHandlers(tryRefresh, signOut);
  }, [refreshToken]);


  return (
    <AuthContext.Provider value={{
      token, refreshToken, isOnboarded, isLoading, isNetworkError, isSuspended, profile,
      signIn, signOut, setOnboarded, updateProfile, tryRefresh, retryBootstrap,
      performQuickSignIn, requestAndRegisterPushToken,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
