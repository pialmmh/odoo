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
