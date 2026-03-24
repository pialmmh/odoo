import { createContext, useContext, useState, useMemo } from 'react';
import THEMES, { THEME_KEYS } from '../theme/themes';

const STORAGE_KEY = 'tb_theme';

const ThemeContext = createContext();

export function ThemeRegistryProvider({ children }) {
  const [themeKey, setThemeKey] = useState(
    () => localStorage.getItem(STORAGE_KEY) || 'green',
  );

  const switchTheme = (key) => {
    if (THEME_KEYS.includes(key) || THEMES[key]) {
      setThemeKey(key);
      localStorage.setItem(STORAGE_KEY, key);
      // Set cookie so Keycloak login page can read the theme
      document.cookie = `tb_theme=${encodeURIComponent(key)};path=/;max-age=31536000;SameSite=Lax`;
    }
  };

  // Set cookie on initial load too
  if (typeof document !== 'undefined') {
    document.cookie = `tb_theme=${encodeURIComponent(themeKey)};path=/;max-age=31536000;SameSite=Lax`;
  }

  const resolved = THEMES[themeKey] || THEMES.green;

  const value = useMemo(() => ({
    themeKey,
    switchTheme,
    current: resolved,
    muiTheme: resolved.mui,
    brand: resolved.brand,
    primaryColor: resolved.primaryColor,
    available: THEME_KEYS.map(k => ({ key: k, label: THEMES[k].label, color: THEMES[k].primaryColor })),
  }), [themeKey]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  return useContext(ThemeContext);
}
