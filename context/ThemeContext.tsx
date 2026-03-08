import { createContext, useContext, useState } from 'react';
import { darkColors, lightColors, type AppColors } from '@/constants/appColors';

interface AppThemeContextValue {
  isDark: boolean;
  colors: AppColors;
  toggle: () => void;
}

const AppThemeContext = createContext<AppThemeContextValue>({
  isDark: true,
  colors: darkColors,
  toggle: () => {},
});

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(true);

  return (
    <AppThemeContext.Provider
      value={{
        isDark,
        colors: isDark ? darkColors : lightColors,
        toggle: () => setIsDark((d) => !d),
      }}
    >
      {children}
    </AppThemeContext.Provider>
  );
}

export function useAppTheme() {
  return useContext(AppThemeContext);
}
