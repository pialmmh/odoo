import { useState, useEffect, useRef } from 'react';
import { makeStyles, tokens, Text, Button, Divider } from '@fluentui/react-components';
import {
  Open20Regular, ArrowClockwise20Regular, Eye20Regular,
} from '@fluentui/react-icons';

// Experimental: embed the Odoo backend full-window inside our shell.
//
// The iframe targets `/web` (proxied to localhost:7169 by Vite) so the
// browser sees same-origin. That sidesteps Odoo's X-Frame-Options
// (stripped on the proxy edge) AND lets the parent window introspect
// the iframe — used by the "live context" rail on the right.
//
// The rail demonstrates the supported low-coupling path for building
// CRM / activity-feed features alongside Odoo: parse `iframe.contentWindow
// .location.hash` on every `hashchange` event to learn what the user
// is currently looking at (model, res_id, action, view_type, menu_id).
//
// Page is scaled to 95% (per request) using transform + compensating
// width/height so the inner content still fills the viewport.

const SCALE = 0.95;
const COMP = `${(100 / SCALE).toFixed(4)}%`; // 105.2632%
const RAIL_WIDTH = '300px';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    marginTop: '-24px',
    marginLeft: '-24px',
    marginRight: '-24px',
    marginBottom: '-24px',
    height: 'calc(100vh - 64px)',
    backgroundColor: tokens.colorNeutralBackground2,
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalS,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  toolbarMuted: { color: tokens.colorNeutralForeground3 },
  toolbarSpacer: { flexGrow: 1 },
  body: {
    display: 'flex',
    flexGrow: 1,
    minHeight: 0,
  },
  frameWrap: {
    position: 'relative',
    flexGrow: 1,
    overflow: 'hidden',
  },
  frame: {
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderTopStyle: 'none',
    borderRightStyle: 'none',
    borderBottomStyle: 'none',
    borderLeftStyle: 'none',
    width: COMP,
    height: COMP,
    transform: `scale(${SCALE})`,
    transformOrigin: 'top left',
    display: 'block',
  },
  rail: {
    width: RAIL_WIDTH,
    flexShrink: 0,
    borderLeftWidth: '1px',
    borderLeftStyle: 'solid',
    borderLeftColor: tokens.colorNeutralStroke2,
    backgroundColor: tokens.colorNeutralBackground1,
    paddingTop: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalM,
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalS,
    overflowY: 'auto',
  },
  railHeader: {
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalXS,
  },
  railCaption: { color: tokens.colorNeutralForeground3 },
  field: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalXXS,
  },
  fieldLabel: {
    color: tokens.colorNeutralForeground3,
    textTransform: 'uppercase',
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase100,
    letterSpacing: '0.04em',
  },
  fieldValue: {
    fontFamily: tokens.fontFamilyMonospace,
  },
  empty: {
    color: tokens.colorNeutralForeground3,
    fontStyle: 'italic',
  },
});

const TRACKED_KEYS = ['model', 'res_id', 'action', 'view_type', 'menu_id', 'cids'];

function parseHash(hash) {
  if (!hash || hash === '#') return null;
  const out = {};
  for (const part of hash.replace(/^#/, '').split('&')) {
    if (!part) continue;
    const eq = part.indexOf('=');
    const k = eq < 0 ? part : part.slice(0, eq);
    const v = eq < 0 ? '' : decodeURIComponent(part.slice(eq + 1));
    out[k] = v;
  }
  return out;
}

export default function OdooIframe() {
  const styles = useStyles();
  const [reloadKey, setReloadKey] = useState(0);
  const [ctx, setCtx] = useState(null);
  const [eventCount, setEventCount] = useState(0);
  const iframeRef = useRef(null);

  // Wire same-origin introspection: mirror the iframe's location.hash
  // into React state. We need three signals because Odoo's Owl router
  // mutates history with `pushState` — that DOES change the hash but
  // does NOT fire `hashchange`. Order of preference:
  //   1. `hashchange`  — fires on `location.hash = '#...'` assignments
  //   2. `popstate`    — fires on browser back/forward
  //   3. polling (250ms diff) — fallback that catches `pushState`
  // Polling is cheap (one string read) and only runs while the page
  // is mounted; it could be replaced by monkey-patching `pushState` /
  // `replaceState` if we ever need event-exact timing.
  useEffect(() => {
    const f = iframeRef.current;
    if (!f) return undefined;
    let teardown = null;

    const sync = (cw, reason) => {
      try {
        const next = cw.location.hash;
        // Only count when something actually changed
        setCtx((prev) => {
          const parsed = parseHash(next);
          const prevHash = prev?.__raw;
          if (prevHash === next) return prev; // no change
          if (parsed) parsed.__raw = next;
          setEventCount((n) => n + 1);
          return parsed;
        });
      } catch {
        // Cross-origin (shouldn't happen with our same-origin proxy).
      }
    };

    const onLoad = () => {
      try {
        const cw = f.contentWindow;
        if (!cw) return;
        const onHash = () => sync(cw, 'hash');
        const onPop = () => sync(cw, 'pop');
        cw.addEventListener('hashchange', onHash);
        cw.addEventListener('popstate', onPop);
        const poll = setInterval(() => sync(cw, 'poll'), 250);
        teardown?.();
        teardown = () => {
          cw.removeEventListener('hashchange', onHash);
          cw.removeEventListener('popstate', onPop);
          clearInterval(poll);
        };
        sync(cw, 'load');
      } catch {
        /* ignore */
      }
    };

    f.addEventListener('load', onLoad);
    if (f.contentDocument && f.contentDocument.readyState === 'complete') {
      onLoad();
    }

    return () => {
      f.removeEventListener('load', onLoad);
      teardown?.();
    };
  }, [reloadKey]);

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <Text size={300} weight="semibold">Odoo (embed)</Text>
        <Text size={200} className={styles.toolbarMuted}>
          experimental — proxied via /web
        </Text>
        <div className={styles.toolbarSpacer} />
        <Button
          appearance="subtle"
          size="small"
          icon={<ArrowClockwise20Regular />}
          onClick={() => setReloadKey((k) => k + 1)}
        >
          Reload
        </Button>
        <Button
          appearance="subtle"
          size="small"
          icon={<Open20Regular />}
          onClick={() => window.open('/web', '_blank', 'noopener')}
        >
          Open in new tab
        </Button>
      </div>

      <div className={styles.body}>
        <div className={styles.frameWrap}>
          <iframe
            ref={iframeRef}
            key={reloadKey}
            className={styles.frame}
            src="/web"
            title="Odoo embed"
          />
        </div>

        <aside className={styles.rail}>
          <div className={styles.railHeader}>
            <Eye20Regular />
            <Text size={300} weight="semibold">Live iframe context</Text>
          </div>
          <Text size={200} className={styles.railCaption}>
            Reads <code>iframe.contentWindow.location.hash</code> on every{' '}
            <code>hashchange</code>. Foundation for CRM panels, activity feeds,
            anything that needs to react to what the user is looking at.
          </Text>
          <Divider />
          {ctx ? (
            <>
              {TRACKED_KEYS.map((k) => (
                <div key={k} className={styles.field}>
                  <Text className={styles.fieldLabel}>{k}</Text>
                  <Text className={styles.fieldValue}>{ctx[k] || '—'}</Text>
                </div>
              ))}
              <Divider />
              <Text size={200} className={styles.railCaption}>
                hashchange events: {eventCount}
              </Text>
            </>
          ) : (
            <Text size={200} className={styles.empty}>
              Waiting for backend to navigate (sign in or click any menu)…
            </Text>
          )}
        </aside>
      </div>
    </div>
  );
}
