import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: true,
    proxy: {
      '/api/v1/chat/stream': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/api/v1/graph': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/api': { target: 'http://127.0.0.1:8080', changeOrigin: true },
      '/ws': { target: 'ws://127.0.0.1:8080', ws: true, changeOrigin: true },
    },
  },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return;
          if (['react', 'react-dom', 'react-router-dom'].some(p => id.includes(`/${p}/`))) return 'vendor';
          if (id.includes('/recharts/')) return 'charts';
          if (['react-markdown', 'remark-gfm', 'remark-breaks', 'react-syntax-highlighter'].some(p => id.includes(`/${p}/`))) return 'markdown';
        },
      },
    },
  },
})
