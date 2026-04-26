import { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { CallClientProvider, CallPanel } from '@telcobright/crm-call-react';
import '@telcobright/crm-call-react/styles.css';
import './CallPanel.theme.css';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/ThemeContext';
import { buildEspoCallProviders } from './providers';

/**
 * Read the computed --color-primary from body and push its R,G,B triplet
 * into --cc-primary-rgb so the call panel's rgba() glow/pulse effects
 * use the same accent as the rest of the app. Runs any time the host
 * theme key changes.
 */
function useCallPanelRgbSync(themeKey) {
  useEffect(() => {
    const hex = getComputedStyle(document.body)
      .getPropertyValue('--color-primary')
      .trim();
    const rgb = hexToRgbString(hex);
    if (rgb) {
      document.documentElement.style.setProperty('--cc-primary-rgb', rgb);
    }
  }, [themeKey]);
}

function hexToRgbString(hex) {
  if (!hex) return null;
  let v = hex.replace(/^#/, '');
  if (v.length === 3) v = v.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(v)) return null;
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

/**
 * Mounts the call window for the current agent. Placed inside
 * AuthProvider + BrowserRouter so it has both Keycloak auth and router
 * context available.
 *
 * The provider bundle is built once per session from `auth`. Logout
 * triggers a Keycloak redirect (full page reload) so we don't need to
 * react to auth changes here.
 */
export default function CallHost({ children }) {
  const { auth, isLoggedIn } = useAuth();

  if (!isLoggedIn) return <>{children}</>;

  return (
    <CallHostInner auth={auth}>
      {children}
    </CallHostInner>
  );
}

function CallHostInner({ auth, children }) {
  const location = useLocation();
  const { themeKey } = useAppTheme();
  const providers = useMemo(() => buildEspoCallProviders(auth), []); // eslint-disable-line react-hooks/exhaustive-deps

  useCallPanelRgbSync(themeKey);

  return (
    <CallClientProvider providers={providers}>
      {children}
      {/* `theme` sets the cc-theme-* class; our CallPanel.theme.css
          overrides the vars inside it to use the host's --color-primary.
          Picking "green" as the base class just keeps the default
          fallback visual in case our override CSS fails to load. */}
      <CallPanel theme="green" currentUrl={location.pathname} />
    </CallClientProvider>
  );
}
