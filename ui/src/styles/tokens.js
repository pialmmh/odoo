// JS-side source of truth for design tokens.
// Mirrors the CSS variables in theme-light.css / theme-dark.css so the MUI
// theme and plain CSS stay in sync. Update both places when adding a token.

export const baseTokens = {
  fontSans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif",
  fontSizeXs: 11,
  fontSizeSm: 12,
  fontSizeBase: 13,
  fontSizeMd: 14,
  fontSizeLg: 16,
  fontSizeXl: 20,
  radiusSm: 4,
  radiusMd: 6,
  radiusLg: 8,
  radiusXl: 10,
  radius2xl: 12,
  radiusFull: 9999,
};

export const lightTokens = {
  colorBgApp: '#f3f4f6',
  colorBgSurface: '#ffffff',
  colorBgSubtle: '#f9fafb',
  colorBgMuted: '#f3f4f6',

  colorTextPrimary: '#18202e',
  colorTextSecondary: '#374151',
  colorTextMuted: '#6b7280',
  colorTextDisabled: '#9ca3af',
  colorTextInverse: '#ffffff',

  colorBorder: '#e5e7eb',
  colorBorderStrong: '#d1d5db',
  colorBorderSubtle: '#f3f4f6',

  colorPrimary: '#2563eb',
  colorPrimaryHover: '#1d4ed8',
  colorPrimaryBg: '#eff6ff',
  colorPrimaryText: '#1e40af',

  colorSidebarBg: '#1e3a5f',
  colorSidebarText: '#94a3b8',
  colorSidebarTextHover: '#e2e8f0',
  colorSidebarItemText: '#2a3441',

  colorSuccess: '#94bc66',
  colorSuccessBg: '#eef5e0',
  colorSuccessText: '#6b8f4e',
  colorSuccessBorder: '#cfe1ab',
  colorSuccessSurface: '#f7faed',

  colorWarning: '#ca8a04',
  colorWarningBg: '#fef9c3',
  colorWarningText: '#a16207',
  colorWarningBorder: '#fef08a',
  colorWarningSurface: '#fefce8',

  colorDanger: '#dc2626',
  colorDangerBg: '#fee2e2',
  colorDangerText: '#b91c1c',
  colorDangerBorder: '#fecaca',
  colorDangerSurface: '#fef2f2',

  colorInfo: '#2563eb',
  colorInfoBg: '#dbeafe',
  colorInfoText: '#1d4ed8',

  colorNeutralBg: '#f3f4f6',
  colorNeutralText: '#6b7280',

  colorAccentBlue: '#2563eb',
  colorAccentViolet: '#7c3aed',
  colorAccentPink: '#db2777',
  colorAccentAmber: '#d97706',
  colorAccentEmerald: '#065f46',
};

export const darkTokens = {
  colorBgApp: '#0f172a',
  colorBgSurface: '#1e293b',
  colorBgSubtle: '#334155',
  colorBgMuted: '#1e293b',

  colorTextPrimary: '#f1f5f9',
  colorTextSecondary: '#cbd5e1',
  colorTextMuted: '#94a3b8',
  colorTextDisabled: '#64748b',
  colorTextInverse: '#0f172a',

  colorBorder: '#334155',
  colorBorderStrong: '#475569',
  colorBorderSubtle: '#1e293b',

  colorPrimary: '#3b82f6',
  colorPrimaryHover: '#2563eb',
  colorPrimaryBg: '#1e3a8a',
  colorPrimaryText: '#bfdbfe',

  colorSidebarBg: '#020617',
  colorSidebarText: '#64748b',
  colorSidebarTextHover: '#cbd5e1',
  colorSidebarItemText: '#cbd5e1',

  colorSuccess: '#a5c97e',
  colorSuccessBg: '#14532d',
  colorSuccessText: '#86efac',
  colorSuccessBorder: '#166534',
  colorSuccessSurface: '#052e16',

  colorWarning: '#eab308',
  colorWarningBg: '#713f12',
  colorWarningText: '#fde68a',
  colorWarningBorder: '#854d0e',
  colorWarningSurface: '#422006',

  colorDanger: '#ef4444',
  colorDangerBg: '#7f1d1d',
  colorDangerText: '#fca5a5',
  colorDangerBorder: '#991b1b',
  colorDangerSurface: '#450a0a',

  colorInfo: '#3b82f6',
  colorInfoBg: '#1e3a8a',
  colorInfoText: '#bfdbfe',

  colorNeutralBg: '#334155',
  colorNeutralText: '#94a3b8',

  colorAccentBlue: '#60a5fa',
  colorAccentViolet: '#a78bfa',
  colorAccentPink: '#f472b6',
  colorAccentAmber: '#fbbf24',
  colorAccentEmerald: '#34d399',
};

export const tokens = {
  light: lightTokens,
  dark: darkTokens,
};

// Tenant overrides — only primary + sidebar, everything else inherits.
// A tenant slug mapped to `null` here means "use base theme unchanged".
export const tenantOverrides = {
  default: null,
  btcl: {
    colorPrimary: '#6b8f4e',
    colorPrimaryHover: '#567a3d',
    colorPrimaryBg: '#e6efd6',
    colorPrimaryText: '#4a6937',
    colorSidebarBg: '#3d4a2a',
  },
  telcobright: {
    colorPrimary: '#1565C0',
    colorPrimaryHover: '#003c8f',
    colorPrimaryBg: '#e3f2fd',
    colorPrimaryText: '#003c8f',
    colorSidebarBg: '#0d2c4d',
  },
};
