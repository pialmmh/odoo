import { useRef } from 'react';
import { makeStyles, tokens } from '@fluentui/react-components';

// Plain Odoo iframe embed. src is "/web" — the original known-good
// form: Odoo handles the redirect into the v19 path-based router
// internally and bootstraps Owl correctly.
//
// Earlier attempts to deep-link into a section directly (e.g.
// src="/odoo/products?embed=1") rendered the page un-mounted (Owl
// never bootstrapped), so we keep src stable. Section-level URL
// mirroring lives outside this file for now — revisit once we have a
// reliable way to deep-link without breaking Owl.

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
  frame: {
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderTopStyle: 'none',
    borderRightStyle: 'none',
    borderBottomStyle: 'none',
    borderLeftStyle: 'none',
    width: '100%',
    height: '100%',
    flexGrow: 1,
    display: 'block',
  },
});

export default function OdooEmbedPage() {
  const styles = useStyles();
  const iframeRef = useRef(null);

  return (
    <div className={styles.root}>
      <iframe
        ref={iframeRef}
        className={styles.frame}
        src="/web"
        title="Odoo (embedded)"
      />
    </div>
  );
}
