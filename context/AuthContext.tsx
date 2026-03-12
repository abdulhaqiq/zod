import * as SecureStore from 'expo-secure-store';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { API_V1, registerAuthHandlers } from '@/constants/api';

const ACCESS_KEY  = 'auth_token';
const REFRESH_KEY = 'refresh_token';

// Mirrors backend MeResponse schema.
// All categorical single-value fields use lookup_options integer IDs.
// All categorical multi-value fields are arrays of lookup_options IDs.
// lifestyle values are lookup_options IDs keyed by trait (drinking, smoking, exercise, diet).
export interface UserProfile {
  id: string;
  phone: string | null;
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

  voice_prompts: Array<{ topic: string; url: string; duration_sec: number }> | null;
  work_experience: Array<{ job_title: string; company: string; start_year: string; end_year: string; current: boolean }> | null;
  education: Array<{ institution: string; course: string; degree: string; grad_year: string }> | null;
  city: string | null;
  hometown: string | null;
  address: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  subscription_tier: string;         // "free" | "pro"
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

  is_verified: boolean;
  is_onboarded: boolean;
  is_active: boolean;
  created_at: string;
}

interface AuthContextValue {
  token: string | null;
  refreshToken: string | null;
  isOnboarded: boolean;
  isLoading: boolean;
  profile: UserProfile | null;
  signIn: (accessToken: string, refreshToken: string, isOnboarded: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  setOnboarded: () => Promise<void>;
  updateProfile: (patch: Partial<UserProfile>) => void;
  tryRefresh: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue>({
  token: null,
  refreshToken: null,
  isOnboarded: false,
  isLoading: true,
  profile: null,
  signIn: async () => {},
  signOut: async () => {},
  setOnboarded: async () => {},
  updateProfile: () => {},
  tryRefresh: async () => null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken]               = useState<string | null>(null);
  const [refreshToken, setRefresh]      = useState<string | null>(null);
  const [isOnboarded, setIsOnboarded]   = useState(false);
  const [isLoading, setIsLoading]       = useState(true);
  const [profile, setProfile]           = useState<UserProfile | null>(null);

  const refreshTokenRef = useRef<string | null>(null);
  refreshTokenRef.current = refreshToken;

  async function _fetchProfile(accessToken: string): Promise<UserProfile | null> {
    try {
      const res = await fetch(`${API_V1}/profile/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) return res.json() as Promise<UserProfile>;
      return null;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    async function bootstrap() {
      const [access, refresh] = await Promise.all([
        SecureStore.getItemAsync(ACCESS_KEY),
        SecureStore.getItemAsync(REFRESH_KEY),
      ]);

      if (!access) {
        setIsLoading(false);
        return;
      }

      let activeToken = access; // tracks whichever token is currently valid
      let me = await _fetchProfile(access);

      if (!me && refresh) {
        // Access token expired — try a refresh
        const newAccess = await _doRefresh(refresh);
        if (newAccess) {
          activeToken = newAccess; // use the refreshed token going forward
          me = await _fetchProfile(newAccess);
        }
      }

      if (me) {
        // Always set the correct (possibly refreshed) token — never overwrite
        // with the old expired one
        setToken(activeToken);
        setRefresh(refresh ?? null);
        setProfile(me);
        setIsOnboarded(me.is_onboarded);
      } else {
        // Token unusable — clear session
        await _clearSession();
      }

      setIsLoading(false);
    }

    bootstrap();
  }, []);

  async function _clearSession() {
    await SecureStore.deleteItemAsync(ACCESS_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  }

  async function _doRefresh(refresh: string): Promise<string | null> {
    try {
      const res = await fetch(`${API_V1}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      if (!res.ok) return null;
      // Backend rotates on every refresh — BOTH tokens must be saved
      const data: { access_token: string; refresh_token: string } = await res.json();
      const newAccess  = data.access_token;
      const newRefresh = data.refresh_token;
      await SecureStore.setItemAsync(ACCESS_KEY,  newAccess);
      await SecureStore.setItemAsync(REFRESH_KEY, newRefresh);
      setToken(newAccess);
      setRefresh(newRefresh);
      return newAccess;
    } catch {
      return null;
    }
  }

  const tryRefresh = async (): Promise<string | null> => {
    const refresh = refreshTokenRef.current;
    if (!refresh) return null;
    return _doRefresh(refresh);
  };

  const signIn = async (accessToken: string, newRefresh: string, onboarded: boolean) => {
    await SecureStore.setItemAsync(ACCESS_KEY, accessToken);
    await SecureStore.setItemAsync(REFRESH_KEY, newRefresh);
    setToken(accessToken);
    setRefresh(newRefresh);
    setIsOnboarded(onboarded);
    // Fetch fresh profile immediately after login
    const me = await _fetchProfile(accessToken);
    if (me) setProfile(me);
  };

  const signOut = async () => {
    await _clearSession();
    setToken(null);
    setRefresh(null);
    setIsOnboarded(false);
    setProfile(null);
  };

  const setOnboarded = async () => {
    setIsOnboarded(true);
    setProfile((p) => p ? { ...p, is_onboarded: true } : p);
  };

  const updateProfile = (patch: Partial<UserProfile>) => {
    setProfile((prev) => prev ? { ...prev, ...patch } : prev);
    if (patch.is_onboarded !== undefined) setIsOnboarded(patch.is_onboarded);
  };

  useEffect(() => {
    registerAuthHandlers(tryRefresh, signOut);
  }, [refreshToken]);

  return (
    <AuthContext.Provider value={{
      token, refreshToken, isOnboarded, isLoading, profile,
      signIn, signOut, setOnboarded, updateProfile, tryRefresh,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
