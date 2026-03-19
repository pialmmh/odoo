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
      // All API calls route through the API Gateway → PLATFORM-API service
      '/api': {
        target: 'http://127.0.0.1:8001/PLATFORM-API',
        changeOrigin: true,
      },
    },
  },
})
