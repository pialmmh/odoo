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

// ── Theme definitions ──

const THEMES = {
  btcl: {
    label: 'BTCL',
    mui: createTheme({
      palette: {
        primary: { main: '#00A651', light: '#4dc97a', dark: '#007a3b' },
        secondary: { main: '#2B5A8A', light: '#5a8ab8', dark: '#1a3d5c' },
        success: { main: '#28c76f' },
        warning: { main: '#ff9f43' },
        error: { main: '#c9302c' },
        info: { main: '#7CB518' },
        background: { default: '#f5f6fa', paper: '#ffffff' },
        text: { primary: '#2c2c2c', secondary: '#626262' },
      },
      typography: baseTypography,
      spacing: 7,
      shape: { borderRadius: 8 },
      components: baseComponents,
    }),
    // Semantic colors used outside MUI (tree badges, sidebar highlights, etc.)
    brand: {
      sidebar: { activeBg: 'rgba(0,166,81,0.08)', hoverBg: 'rgba(0,166,81,0.04)' },
      infra: {
        region: '#1b7a3d',
        zone: '#2e7d50',
        dc: '#00875a',
        leaf: '#6b7280',
      },
    },
  },

  telcobright: {
    label: 'Telcobright',
    mui: createTheme({
      palette: {
        primary: { main: '#1565C0', light: '#5e92f3', dark: '#003c8f' },
        secondary: { main: '#00897B', light: '#4db6ac', dark: '#005b4f' },
        success: { main: '#2e7d32' },
        warning: { main: '#ef6c00' },
        error: { main: '#c62828' },
        info: { main: '#0277bd' },
        background: { default: '#f4f6f9', paper: '#ffffff' },
        text: { primary: '#1a1a2e', secondary: '#54596e' },
      },
      typography: baseTypography,
      spacing: 7,
      shape: { borderRadius: 8 },
      components: baseComponents,
    }),
    brand: {
      sidebar: { activeBg: 'rgba(21,101,192,0.08)', hoverBg: 'rgba(21,101,192,0.04)' },
      infra: {
        region: '#0d47a1',
        zone: '#1565c0',
        dc: '#1976d2',
        leaf: '#546e7a',
      },
    },
  },
};

export const THEME_KEYS = Object.keys(THEMES);
export default THEMES;
