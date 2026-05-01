import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['@mui/x-tree-view'],
  },
  server: {
    port: 5180,
    proxy: {
      // All API calls route through APISIX gateway
      '/api': {
        target: 'http://127.0.0.1:9081',
        changeOrigin: true,
      },
      // ERP bundle inside iDempiere — direct proxy in dev. In prod this
      // will land behind APISIX with auth.
      '/erp-api': {
        target: 'http://127.0.0.1:7079',
        changeOrigin: true,
      },
      // Odoo backend — proxied as same-origin so the experimental embed
      // page can iframe it (Odoo sends X-Frame-Options: SAMEORIGIN +
      // CSP frame-ancestors 'self', which would block a cross-origin
      // iframe). The paths below are all under Odoo's namespace and
      // do NOT collide with any React route.
      '/web': {
        target: 'http://127.0.0.1:7170',
        changeOrigin: true,
        // Odoo hard-sets X-Frame-Options: DENY on the authenticated
        // backend pages (clickjacking protection). For our same-origin
        // iframe embed (experimental page only) we strip it on the
        // proxy edge — no Odoo-side change required.
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            delete proxyRes.headers['x-frame-options'];
            const csp = proxyRes.headers['content-security-policy'];
            if (csp) {
              proxyRes.headers['content-security-policy'] =
                csp.replace(/frame-ancestors[^;]*;?\s*/i, '').trim() || undefined;
            }
          });
        },
      },
      '/longpolling': { target: 'http://127.0.0.1:7170', changeOrigin: true, ws: true },
      '/websocket':   { target: 'http://127.0.0.1:7170', changeOrigin: true, ws: true },
      // Odoo Discuss + chatter long-poll endpoints. Without these the
      // embedded iframe shows an "Oops!" because /mail/data 404s on
      // the Vite origin and the Discuss client treats it as a lost
      // connection. /mail/, /bus/, /im_livechat/, /odoo/ all live in
      // Odoo's namespace and don't collide with React routes.
      '/mail':        { target: 'http://127.0.0.1:7170', changeOrigin: true },
      '/bus':         { target: 'http://127.0.0.1:7170', changeOrigin: true },
      '/odoo':        { target: 'http://127.0.0.1:7170', changeOrigin: true },
      // OpenProject HAL+JSON API — proxied so React dev server avoids CORS.
      // Apache's ServerName is 'localhost' so we must force the Host header.
      '/op-api': {
        target: 'http://127.0.0.1:6543',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/op-api/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('host', 'localhost');
          });
        },
      },
    },
    fs: {
      // node_modules/@telcobright/crm-call-* are `file:` links to a sibling
      // repo; Vite's default fs.allow blocks paths outside the project root.
      allow: [
        '..',
        '/home/mustafa/telcobright-projects/Contact_Center/espocrm/crm-call-window-js',
      ],
    },
  },
})
