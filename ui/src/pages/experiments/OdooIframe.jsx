import { useRef } from 'react';
import { makeStyles, tokens } from '@fluentui/react-components';

// Experimental: embed the Odoo backend full-window inside our shell.
//
// The iframe targets `/web` (proxied to localhost:7170 by Vite) so the
// browser sees same-origin. That sidesteps Odoo's X-Frame-Options
// (stripped on the proxy edge) AND lets the parent window introspect
// the iframe — used by the "live context" rail on the right.
//
// The rail demonstrates the supported low-coupling path for building
// CRM / activity-feed features alongside Odoo: parse `iframe.contentWindow
// .location.{pathname,search,hash}` on every router change to learn what
// the user is currently looking at (model, res_id, action, menu_id, cids).
//
// Odoo 19 changed the router from hash-based (#action=...&model=...) to
// path-based (/odoo/<action-or-model>/<resId?>?cids=...&menu_id=...). We
// parse both so this page also works against v17 backends if you swap
// the Vite proxy back.
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

const TRACKED_KEYS = ['model', 'res_id', 'action', 'menu_id', 'cids', 'active_id'];

function isNumeric(s) {
  return typeof s === 'string' && s !== '' && !isNaN(Number(s));
}

// v17 hash: #action=123&model=res.partner&res_id=44&menu_id=5&cids=1
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

// v19 URL: /odoo/<segment>(/<resId-or-active>)*?cids=…&menu_id=…
//   segment forms:
//     "contacts"             → action='contacts'
//     "action-123"           → action='123' (numeric)
//     "action-base.action_x" → action='base.action_x' (xml id)
//     "m-sale.order"         → model='sale.order' (model with no dot needs m- prefix)
//     "res.partner"          → model='res.partner'
//   numeric segments are resId (or active_id when followed by another action).
function parsePath(pathname, search) {
  if (!pathname) return null;
  const parts = pathname.split('/').filter(Boolean);
  const [prefix, ...rest] = parts;
  if (!['odoo', 'scoped_app'].includes(prefix)) return null;
  const out = {};
  // Last action segment wins for display; track the last numeric as res_id.
  for (let i = 0; i < rest.length; i++) {
    const seg = rest[i];
    if (isNumeric(seg)) {
      // numeric → either active_id (preceding ctx) or res_id (current record)
      // If the next segment is another action, we're an active_id; otherwise res_id.
      const next = rest[i + 1];
      if (next && !isNumeric(next) && next !== 'new') {
        out.active_id = seg;
      } else {
        out.res_id = seg;
      }
    } else if (seg === 'new') {
      out.res_id = 'new';
    } else if (seg.startsWith('action-')) {
      out.action = seg.slice(7);
    } else if (seg.startsWith('m-')) {
      out.model = seg.slice(2);
    } else if (seg.includes('.')) {
      out.model = seg;
    } else {
      out.action = seg;
    }
  }
  // Merge search params (cids, menu_id, etc.)
  if (search) {
    const sp = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    for (const [k, v] of sp) {
      // Only set if not already set from the path
      if (!(k in out)) out[k] = v;
    }
  }
  return Object.keys(out).length ? out : null;
}

function parseLocation(loc) {
  // Prefer v19 path-based form; fall back to v17 hash.
  const fromPath = parsePath(loc.pathname, loc.search);
  if (fromPath) return fromPath;
  return parseHash(loc.hash);
}

export default function OdooIframe() {
  const styles = useStyles();
  const iframeRef = useRef(null);

  return (
    <div className={styles.root}>
      <div className={styles.body}>
        <div className={styles.frameWrap}>
          <iframe
            ref={iframeRef}
            className={styles.frame}
            src="/web?embed=1"
            title="Odoo embed"
          />
        </div>
      </div>
    </div>
  );
}
