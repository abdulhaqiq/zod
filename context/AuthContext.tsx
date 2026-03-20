import * as SecureStore from 'expo-secure-store';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { API_V1, WS_V1, registerAuthHandlers } from '@/constants/api';

export const RECENT_ACCOUNT_KEY = 'recent_account';
export interface RecentAccount {
  name: string | null;
  phone: string | null;
  photo: string | null;
  method: 'phone' | 'apple';
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

  mood_emoji: string | null;
  mood_text: string | null;

  voice_prompts: Array<{ topic: string; url: string; duration_sec: number }> | null;
  work_experience: Array<{ job_title: string; company: string; start_year: string; end_year: string; current: boolean }> | null;
  education: Array<{ institution: string; course: string; degree: string; grad_year: string }> | null;
  city: string | null;
  hometown: string | null;
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

  // Discover filter preferences
  filter_age_min:         number | null;
  filter_age_max:         number | null;
  filter_max_distance_km: number | null;   // null treated as 80 km max
  filter_verified_only:   boolean;
  filter_star_signs:      number[] | null;
  filter_interests:       number[] | null;
  filter_languages:       number[] | null;
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
  created_at: string;

  face_scan_required: boolean;
  id_scan_required:   boolean;
}

interface AuthContextValue {
  token: string | null;
  refreshToken: string | null;
  isOnboarded: boolean;
  isLoading: boolean;
  isNetworkError: boolean;
  profile: UserProfile | null;
  signIn: (accessToken: string, refreshToken: string, isOnboarded: boolean, method?: 'phone' | 'apple') => Promise<void>;
  signOut: () => Promise<void>;
  setOnboarded: () => Promise<void>;
  updateProfile: (patch: Partial<UserProfile>) => void;
  tryRefresh: () => Promise<string | null>;
  retryBootstrap: () => void;
  /** Silently re-authenticates using the persisted quick-sign-in refresh token.
   *  Returns the destination route on success, or null if the token has expired. */
  performQuickSignIn: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue>({
  token: null,
  refreshToken: null,
  isOnboarded: false,
  isLoading: true,
  isNetworkError: false,
  profile: null,
  signIn: async (_a: string, _b: string, _c: boolean, _d?: 'phone' | 'apple') => {},
  signOut: async () => {},
  setOnboarded: async () => {},
  updateProfile: () => {},
  tryRefresh: async () => null,
  retryBootstrap: () => {},
  performQuickSignIn: async () => null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken]               = useState<string | null>(null);
  const [refreshToken, setRefresh]      = useState<string | null>(null);
  const [isOnboarded, setIsOnboarded]   = useState(false);
  const [isLoading, setIsLoading]       = useState(true);
  const [isNetworkError, setIsNetworkError] = useState(false);
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
            setProfile(prev => prev ? { ...prev, face_scan_required: data.required } : prev);
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

  async function _fetchProfile(accessToken: string): Promise<UserProfile | null | 'network_error'> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout
      const res = await fetch(`${API_V1}/profile/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) return res.json() as Promise<UserProfile>;
      // 401/403 = bad token; any other HTTP error is not a network error
      return null;
    } catch {
      // fetch() threw — network unreachable, DNS failure, or timeout
      return 'network_error';
    }
  }

  useEffect(() => {
    async function bootstrap() {
      const [access, refresh] = await Promise.all([
        SecureStore.getItemAsync(ACCESS_KEY),
        SecureStore.getItemAsync(REFRESH_KEY),
      ]);

      if (!access) {
        setIsNetworkError(false);
        setIsLoading(false);
        return;
      }

      let activeToken = access;
      let me = await _fetchProfile(access);

      if (me === 'network_error') {
        // Network unreachable — keep the session intact, show no-connection screen
        setToken(access);
        setRefresh(refresh ?? null);
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
          // Network error while refreshing — keep session alive, show no-connection
          setToken(access);
          setRefresh(refresh);
          setIsNetworkError(true);
          setIsLoading(false);
          return;
        }
        if (newAccess) {
          activeToken = newAccess;
          const retried = await _fetchProfile(newAccess);
          if (retried === 'network_error') {
            setToken(newAccess);
            setRefresh(refresh);
            setIsNetworkError(true);
            setIsLoading(false);
            return;
          }
          me = retried;
        }
      }

      setIsNetworkError(false);
      if (me && me !== 'network_error') {
        setToken(activeToken);
        setRefresh(refresh ?? null);
        setProfile(me);
        setIsOnboarded(me.is_onboarded);
      } else {
        // Token genuinely unusable (401 etc) — clear session
        await _clearSession();
      }

      setIsLoading(false);
    }

    bootstrap();
  }, [bootstrapTick]);

  async function _clearSession() {
    await SecureStore.deleteItemAsync(ACCESS_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
    // QUICK_SIGNIN_KEY is intentionally NOT deleted here — it persists across
    // logouts so the user can tap "Continue as [Name]" next time they open the app.
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

  async function _registerPushToken(accessToken: string) {
    try {
      const Notifications = await import('expo-notifications');
      // Request permissions (iOS requires explicit grant)
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') return;

      // Set notification channel for Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }

      // Get Expo push token (works in Expo Go + EAS builds)
      const tokenData = await Notifications.getExpoPushTokenAsync();
      const pushToken = tokenData.data;

      // Register with backend
      await fetch(`${API_V1}/profile/me/push-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ token: pushToken }),
      });
    } catch {
      // Push token registration is non-critical — never block sign-in
    }
  }

  const signIn = async (
    accessToken: string,
    newRefresh: string,
    onboarded: boolean,
    _method: 'phone' | 'apple' = 'phone',
  ) => {
    await SecureStore.setItemAsync(ACCESS_KEY, accessToken);
    await SecureStore.setItemAsync(REFRESH_KEY, newRefresh);
    // Keep quick-sign-in token current so future one-tap logins always work
    await SecureStore.setItemAsync(QUICK_SIGNIN_KEY, newRefresh);
    setToken(accessToken);
    setRefresh(newRefresh);
    setIsOnboarded(onboarded);
    // Fetch fresh profile immediately after login
    const me = await _fetchProfile(accessToken);
    if (me && me !== 'network_error') setProfile(me);
    // Register push token in the background — non-blocking
    _registerPushToken(accessToken);
    // NOTE: saving the recent account is intentionally NOT done here.
    // The caller (OTP screen / Apple sign-in) asks the user first, then
    // calls saveRecentAccount() if they agree.
  };

  const signOut = async () => {
    await _clearSession();
    setToken(null);
    setRefresh(null);
    setIsOnboarded(false);
    setProfile(null);
    setIsNetworkError(false);
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

  useEffect(() => {
    registerAuthHandlers(tryRefresh, signOut);
  }, [refreshToken]);

  return (
    <AuthContext.Provider value={{
      token, refreshToken, isOnboarded, isLoading, isNetworkError, profile,
      signIn, signOut, setOnboarded, updateProfile, tryRefresh, retryBootstrap,
      performQuickSignIn,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
