import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@domain': '/packages/domain/src',
    },
  },
  server: {
    port: 5173,
    // Allow tunneled access (dev only; Vite server config does not affect production build)
    allowedHosts: ['.trycloudflare.com'],
    // Single-URL tunnel: proxy /api to local Nest API so no VITE_API_BASE_URL needed when sharing via Cloudflare
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
  },
});