import { createTheme } from '@mui/material/styles';

// ── Shared base (typography, spacing, component overrides) ──

const baseTypography = {
  fontSize: 12.5,
  htmlFontSize: 16,
  fontFamily: "'Inter', 'Segoe UI', sans-serif",
  h5: { fontWeight: 600 },
  h6: { fontWeight: 600 },
  subtitle1: { fontWeight: 500 },
};

const baseComponents = {
  MuiButton: {
    styleOverrides: {
      root: { textTransform: 'none', fontWeight: 500, borderRadius: 6 },
    },
  },
  MuiCard: {
    styleOverrides: {
      root: { boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #e9ecef' },
    },
  },
  MuiTableHead: {
    styleOverrides: {
      root: { '& .MuiTableCell-head': { fontWeight: 600, backgroundColor: '#f8f9fa', color: '#2c2c2c' } },
    },
  },
};

/** Helper: build a full theme entry from a color config */
function makeTheme({ label, primary, secondary, sidebar, infra, bg, text }) {
  return {
    label,
    mui: createTheme({
      palette: {
        primary: { main: primary.main, light: primary.light, dark: primary.dark },
        secondary: { main: secondary.main, light: secondary.light, dark: secondary.dark },
        success: { main: '#28c76f' },
        warning: { main: '#ff9f43' },
        error: { main: '#c9302c' },
        info: { main: '#0288d1' },
        background: { default: bg?.default || '#f5f6fa', paper: bg?.paper || '#ffffff' },
        text: { primary: text?.primary || '#0f172a', secondary: text?.secondary || '#334155' },
      },
      typography: baseTypography,
      spacing: 7,
      shape: { borderRadius: 8 },
      components: baseComponents,
    }),
    brand: {
      sidebar: {
        activeBg: sidebar.activeBg,
        hoverBg: sidebar.hoverBg,
      },
      infra: {
        region: infra.region,
        zone: infra.zone,
        dc: infra.dc,
        leaf: infra.leaf || '#6b7280',
      },
    },
    // Raw primary color for external use (KC theme, favicon, etc.)
    primaryColor: primary.main,
  };
}

// ── Theme definitions ──

const THEMES = {
  green: makeTheme({
    label: 'Green',
    primary:   { main: '#94bc66', light: '#cfe1ab', dark: '#6b8f4e' },
    secondary: { main: '#2B5A8A', light: '#5a8ab8', dark: '#1a3d5c' },
    sidebar:   { activeBg: 'rgba(165,201,126,0.14)', hoverBg: 'rgba(165,201,126,0.07)' },
    infra:     { region: '#6b8f4e', zone: '#8bb368', dc: '#94bc66' },
  }),

  blue: makeTheme({
    label: 'Blue',
    primary:   { main: '#1565C0', light: '#5e92f3', dark: '#003c8f' },
    secondary: { main: '#00897B', light: '#4db6ac', dark: '#005b4f' },
    sidebar:   { activeBg: 'rgba(21,101,192,0.08)', hoverBg: 'rgba(21,101,192,0.04)' },
    infra:     { region: '#0d47a1', zone: '#1565c0', dc: '#1976d2' },
  }),

  red: makeTheme({
    label: 'Red',
    primary:   { main: '#C62828', light: '#ef5350', dark: '#8e0000' },
    secondary: { main: '#37474F', light: '#62727b', dark: '#102027' },
    sidebar:   { activeBg: 'rgba(198,40,40,0.08)', hoverBg: 'rgba(198,40,40,0.04)' },
    infra:     { region: '#b71c1c', zone: '#c62828', dc: '#d32f2f' },
  }),

  gray: makeTheme({
    label: 'Gray',
    primary:   { main: '#455A64', light: '#718792', dark: '#1c313a' },
    secondary: { main: '#546E7A', light: '#819ca9', dark: '#29434e' },
    sidebar:   { activeBg: 'rgba(69,90,100,0.08)', hoverBg: 'rgba(69,90,100,0.04)' },
    infra:     { region: '#37474f', zone: '#455a64', dc: '#546e7a' },
  }),

  orange: makeTheme({
    label: 'Orange',
    primary:   { main: '#E65100', light: '#ff833a', dark: '#ac1900' },
    secondary: { main: '#4E342E', light: '#7b5e57', dark: '#260e04' },
    sidebar:   { activeBg: 'rgba(230,81,0,0.08)', hoverBg: 'rgba(230,81,0,0.04)' },
    infra:     { region: '#bf360c', zone: '#d84315', dc: '#e65100' },
  }),

  'light-green': makeTheme({
    label: 'Light Green',
    primary:   { main: '#43A047', light: '#76d275', dark: '#00701a' },
    secondary: { main: '#66BB6A', light: '#98ee99', dark: '#338a3e' },
    sidebar:   { activeBg: 'rgba(67,160,71,0.06)', hoverBg: 'rgba(67,160,71,0.03)' },
    infra:     { region: '#2e7d32', zone: '#388e3c', dc: '#43a047' },
    bg:        { default: '#f1f8e9', paper: '#ffffff' },
  }),

  'light-blue': makeTheme({
    label: 'Light Blue',
    primary:   { main: '#1E88E5', light: '#6ab7ff', dark: '#005cb2' },
    secondary: { main: '#42A5F5', light: '#80d6ff', dark: '#0077c2' },
    sidebar:   { activeBg: 'rgba(30,136,229,0.06)', hoverBg: 'rgba(30,136,229,0.03)' },
    infra:     { region: '#1565c0', zone: '#1976d2', dc: '#1e88e5' },
    bg:        { default: '#e3f2fd', paper: '#ffffff' },
  }),

  'light-red': makeTheme({
    label: 'Light Red',
    primary:   { main: '#E53935', light: '#ff6f60', dark: '#ab000d' },
    secondary: { main: '#EF5350', light: '#ff867c', dark: '#b61827' },
    sidebar:   { activeBg: 'rgba(229,57,53,0.06)', hoverBg: 'rgba(229,57,53,0.03)' },
    infra:     { region: '#c62828', zone: '#d32f2f', dc: '#e53935' },
    bg:        { default: '#ffebee', paper: '#ffffff' },
  }),

  'light-gray': makeTheme({
    label: 'Light Gray',
    primary:   { main: '#607D8B', light: '#8eacbb', dark: '#34515e' },
    secondary: { main: '#78909C', light: '#a7c0cd', dark: '#4b636e' },
    sidebar:   { activeBg: 'rgba(96,125,139,0.06)', hoverBg: 'rgba(96,125,139,0.03)' },
    infra:     { region: '#455a64', zone: '#546e7a', dc: '#607d8b' },
    bg:        { default: '#eceff1', paper: '#ffffff' },
  }),
};

// Legacy aliases for backward compatibility
THEMES.btcl = THEMES.green;
THEMES.telcobright = THEMES.blue;

export const THEME_KEYS = Object.keys(THEMES).filter(k => k !== 'btcl' && k !== 'telcobright');
export default THEMES;
