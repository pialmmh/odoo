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
      '/1.0/kb': {
        target: 'http://127.0.0.1:18080',
        changeOrigin: true,
      },
      '/odoo': {
        target: 'http://127.0.0.1:7169',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/odoo/, ''),
      },
    },
  },
})
