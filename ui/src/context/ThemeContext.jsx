import { createContext, useContext, useState, useMemo, useEffect } from 'react';
import THEMES, { THEME_KEYS } from '../theme/themes';
import { buildTheme, buildBrand } from '../styles/muiTheme';
import { tenantOverrides } from '../styles/tokens';

const STORAGE_KEY_THEME = 'tb_theme';
const STORAGE_KEY_MODE  = 'tb_mode';

const ThemeContext = createContext();

// Register a brand color (from legacy themes.js) as a tenant CSS-variable override,
// so var(--color-primary) consumers see the same primary that MUI gets.
function applyTenantStyleOverrides(themeKey) {
  const def = THEMES[themeKey];
  if (!def) return;
  const primary   = def.primaryColor || def.mui?.palette?.primary?.main;
  const primaryHv = def.mui?.palette?.primary?.dark || primary;
  const primaryBg = def.mui?.palette?.primary?.light || primary;
  let style = document.getElementById('tenant-style-overrides');
  if (!style) {
    style = document.createElement('style');
    style.id = 'tenant-style-overrides';
    document.head.appendChild(style);
  }
  // Generate an override block per registered themeKey so switching works without
  // remounting styles. Sidebar bg is left to the static tenant CSS when present.
  const blocks = THEME_KEYS.map((k) => {
    const t = THEMES[k];
    const p  = t?.primaryColor || t?.mui?.palette?.primary?.main;
    const ph = t?.mui?.palette?.primary?.dark || p;
    const pb = t?.mui?.palette?.primary?.light || p;
    if (!p) return '';
    return `body.theme-tenant-${k}{--color-primary:${p};--color-primary-hover:${ph};--color-primary-bg:${pb};--color-sidebar-active-bg:${p};}`;
  }).filter(Boolean).join('\n');
  style.textContent = blocks;
}

export function ThemeRegistryProvider({ children }) {
  const [themeKey, setThemeKey] = useState(
    () => localStorage.getItem(STORAGE_KEY_THEME) || 'green',
  );
  const [mode, setMode] = useState(
    () => localStorage.getItem(STORAGE_KEY_MODE) || 'light',
  );

  const switchTheme = (key) => {
    if (THEME_KEYS.includes(key) || THEMES[key]) {
      setThemeKey(key);
      localStorage.setItem(STORAGE_KEY_THEME, key);
      document.cookie = `tb_theme=${encodeURIComponent(key)};path=/;max-age=31536000;SameSite=Lax`;
    }
  };

  const setThemeMode = (m) => {
    if (m !== 'light' && m !== 'dark') return;
    setMode(m);
    localStorage.setItem(STORAGE_KEY_MODE, m);
  };
  const toggleMode = () => setThemeMode(mode === 'light' ? 'dark' : 'light');

  // Keep body classes + <style> override block in sync with state.
  useEffect(() => {
    applyTenantStyleOverrides(themeKey);
    document.body.className = [
      `theme-${mode}`,
      `theme-tenant-${themeKey}`,
    ].join(' ');
    document.cookie = `tb_theme=${encodeURIComponent(themeKey)};path=/;max-age=31536000;SameSite=Lax`;
    document.cookie = `tb_mode=${encodeURIComponent(mode)};path=/;max-age=31536000;SameSite=Lax`;
  }, [themeKey, mode]);

  // Build the MUI theme. For dark mode use the token-driven theme (semantic palette
  // flips); for light mode prefer the legacy per-brand theme (preserves existing look).
  const muiTheme = useMemo(() => {
    if (mode === 'dark') {
      // If the brand has a tenant override registered in tokens.js, pass it through;
      // otherwise the dark theme still works off the base dark palette.
      const tenantSlug = tenantOverrides[themeKey] ? themeKey : null;
      return buildTheme('dark', tenantSlug);
    }
    return (THEMES[themeKey] || THEMES.green).mui;
  }, [themeKey, mode]);

  const brand = useMemo(() => {
    // legacy brand shape for Sidebar
    const legacy = (THEMES[themeKey] || THEMES.green).brand;
    if (mode === 'light') return legacy;
    // In dark mode, derive brand from token-driven build so sidebar active/hover look right.
    return buildBrand('dark', tenantOverrides[themeKey] ? themeKey : null);
  }, [themeKey, mode]);

  const primaryColor = (THEMES[themeKey] || THEMES.green).primaryColor;

  const value = useMemo(() => ({
    themeKey,
    switchTheme,
    mode,
    setMode: setThemeMode,
    toggleMode,
    current: THEMES[themeKey] || THEMES.green,
    muiTheme,
    brand,
    primaryColor,
    available: THEME_KEYS.map(k => ({ key: k, label: THEMES[k].label, color: THEMES[k].primaryColor })),
  }), [themeKey, mode, muiTheme, brand]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  return useContext(ThemeContext);
}
