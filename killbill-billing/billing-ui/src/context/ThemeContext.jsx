import { createContext, useContext, useState, useMemo } from 'react';
import THEMES, { THEME_KEYS } from '../theme/themes';

const STORAGE_KEY = 'tb_theme';

const ThemeContext = createContext();

export function ThemeRegistryProvider({ children }) {
  const [themeKey, setThemeKey] = useState(
    () => localStorage.getItem(STORAGE_KEY) || 'btcl',
  );

  const switchTheme = (key) => {
    if (THEME_KEYS.includes(key)) {
      setThemeKey(key);
      localStorage.setItem(STORAGE_KEY, key);
    }
  };

  const value = useMemo(() => ({
    themeKey,
    switchTheme,
    current: THEMES[themeKey] || THEMES.btcl,
    muiTheme: (THEMES[themeKey] || THEMES.btcl).mui,
    brand: (THEMES[themeKey] || THEMES.btcl).brand,
    available: THEME_KEYS.map(k => ({ key: k, label: THEMES[k].label })),
  }), [themeKey]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  return useContext(ThemeContext);
}
