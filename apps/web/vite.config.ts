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
  },
  build: {
    outDir: 'dist',
  },
});