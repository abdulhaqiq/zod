/**
 * ThemeContext — industry-standard persistence pattern
 *
 * Toggle  → instant UI + SecureStore (no API call)
 * Sync up → PATCH /profile/me only when app goes to background (AppState)
 * Sync in → once per session from backend profile after login
 *
 * This is the same pattern used by Bumble, Hinge, Tinder etc.
 * The local preference is truth during a session;
 * the backend is a backup for cross-device consistency.
 */

import * as SecureStore from 'expo-secure-store';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { darkColors, lightColors, type AppColors } from '@/constants/appColors';

const THEME_KEY = 'app_dark_mode';

interface AppThemeContextValue {
  isDark: boolean;
  colors: AppColors;
  toggle: () => void;
  syncFromBackend: (darkMode: boolean) => void;
  setApiFetch: (fn: (fields: Record<string, unknown>) => Promise<void>) => void;
}

const AppThemeContext = createContext<AppThemeContextValue>({
  isDark: true,
  colors: darkColors,
  toggle: () => {},
  syncFromBackend: () => {},
  setApiFetch: () => {},
});

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(true);

  // Tracks whether the preference changed since last backend sync
  const pendingSync  = useRef(false);
  const currentDark  = useRef(true);
  const apiSave      = useRef<((fields: Record<string, unknown>) => Promise<void>) | null>(null);
  // True once SecureStore has been read — prevents backend from overwriting local pref
  const localLoaded  = useRef(false);
  // True when SecureStore had a saved value — backend must NOT override a local pref
  const hasLocalPref = useRef(false);

  // ── 1. Boot: load from SecureStore instantly ──────────────────────────────
  useEffect(() => {
    SecureStore.getItemAsync(THEME_KEY).then(val => {
      if (val !== null) {
        const dark = val === 'true';
        setIsDark(dark);
        currentDark.current = dark;
        hasLocalPref.current = true;
      }
      localLoaded.current = true;
    });
  }, []);

  // ── 2. Sync to backend when app goes to background ────────────────────────
  useEffect(() => {
    const handleAppState = (next: AppStateStatus) => {
      if (next === 'background' || next === 'inactive') {
        if (pendingSync.current && apiSave.current) {
          pendingSync.current = false;
          apiSave.current({ dark_mode: currentDark.current }).catch(() => {
            pendingSync.current = true;
          });
        }
      }
    };

    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, []);

  // ── 3. Sync from backend once per session after profile loads ─────────────
  const syncFromBackend = useCallback((darkMode: boolean) => {
    // Local preference (SecureStore) always wins over the backend value.
    // Only apply the backend value on a brand-new install where no local
    // preference has been saved yet and the user hasn't toggled during this session.
    if (hasLocalPref.current || pendingSync.current) return;
    setIsDark(darkMode);
    currentDark.current = darkMode;
    SecureStore.setItemAsync(THEME_KEY, String(darkMode));
  }, []);

  // ── 4. Register the API save function (injected once token is ready) ──────
  const setApiFetch = useCallback((fn: (fields: Record<string, unknown>) => Promise<void>) => {
    apiSave.current = fn;
  }, []);

  // ── 5. Toggle — instant, local only ──────────────────────────────────────
  const toggle = useCallback(() => {
    setIsDark(prev => {
      const next = !prev;
      currentDark.current = next;
      pendingSync.current = true;                          // will flush on background
      SecureStore.setItemAsync(THEME_KEY, String(next));   // persist locally right away
      return next;
    });
  }, []);

  return (
    <AppThemeContext.Provider
      value={{
        isDark,
        colors: isDark ? darkColors : lightColors,
        toggle,
        syncFromBackend,
        setApiFetch,
      }}
    >
      {children}
    </AppThemeContext.Provider>
  );
}

export function useAppTheme() {
  return useContext(AppThemeContext);
}
