import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
  resolve: {
    alias: {
      '@domain': '/packages/domain/src',
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // Allow tunneled access (dev only; Vite server config does not affect production build)
    allowedHosts: ['.trycloudflare.com', 'localhost', '127.0.0.1'],
    // Single-URL tunnel: proxy /api to local Nest API; rewrite /api/foo -> /foo, preserve headers (e.g. Authorization), multipart
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
  },
});