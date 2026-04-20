import { createTheme } from '@mui/material/styles';
import { tokens, tenantOverrides, baseTokens } from './tokens';

// Build an MUI theme from the design tokens so that `@mui/material`
// components (Button, Chip, Table, ...) pick up the same palette as
// plain CSS using var(--token).
export function buildTheme(mode = 'light', tenantSlug = null) {
  const base = tokens[mode] || tokens.light;
  const override = (tenantSlug && tenantOverrides[tenantSlug]) || null;
  const t = { ...base, ...(override || {}) };

  return createTheme({
    palette: {
      mode,
      primary:    { main: t.colorPrimary, dark: t.colorPrimaryHover, light: t.colorPrimaryBg, contrastText: t.colorTextInverse },
      success:    { main: t.colorSuccess, contrastText: t.colorTextInverse },
      warning:    { main: t.colorWarning, contrastText: t.colorTextInverse },
      error:      { main: t.colorDanger,  contrastText: t.colorTextInverse },
      info:       { main: t.colorInfo,    contrastText: t.colorTextInverse },
      background: { default: t.colorBgApp, paper: t.colorBgSurface },
      text:       { primary: t.colorTextPrimary, secondary: t.colorTextSecondary, disabled: t.colorTextDisabled },
      divider:    t.colorBorder,
    },
    typography: {
      fontFamily: baseTokens.fontSans,
      fontSize: baseTokens.fontSizeBase,
      htmlFontSize: 16,
      h5: { fontWeight: 600 },
      h6: { fontWeight: 600 },
      subtitle1: { fontWeight: 500 },
      button:    { fontWeight: 600, textTransform: 'none' },
    },
    shape: { borderRadius: baseTokens.radiusLg },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: { backgroundColor: t.colorBgApp, color: t.colorTextPrimary },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: { borderRadius: baseTokens.radiusLg, textTransform: 'none', fontWeight: 600 },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: baseTokens.radius2xl,
            border: `1px solid ${t.colorBorder}`,
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          },
        },
      },
      MuiTableHead: {
        styleOverrides: {
          root: {
            '& .MuiTableCell-head': {
              fontWeight: 700,
              backgroundColor: t.colorBgSubtle,
              color: t.colorTextMuted,
              fontSize: baseTokens.fontSizeXs,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
            },
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: t.colorBgSurface,
            color: t.colorTextPrimary,
            borderBottom: `1px solid ${t.colorBorder}`,
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: { backgroundColor: t.colorBgSurface, borderRight: `1px solid ${t.colorBorder}` },
        },
      },
      MuiLink: {
        styleOverrides: {
          root: { color: t.colorPrimaryText },
        },
      },
    },
  });
}

// Expose a brand slot that matches the legacy ThemeContext.brand shape so
// existing components (Sidebar) don't have to change.
export function buildBrand(mode = 'light', tenantSlug = null) {
  const base = tokens[mode] || tokens.light;
  const override = (tenantSlug && tenantOverrides[tenantSlug]) || null;
  const t = { ...base, ...(override || {}) };
  // rgba-ish active backgrounds derived from primary
  const activeBg = hexToRgba(t.colorPrimary, 0.08);
  const hoverBg  = hexToRgba(t.colorPrimary, 0.04);
  return {
    sidebar: { activeBg, hoverBg, bg: t.colorSidebarBg, text: t.colorSidebarText },
    infra:   { region: t.colorPrimaryHover, zone: t.colorPrimary, dc: t.colorAccentBlue, leaf: t.colorTextMuted },
  };
}

function hexToRgba(hex, a) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
  if (!m) return `rgba(0,0,0,${a})`;
  const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
  return `rgba(${r},${g},${b},${a})`;
}
