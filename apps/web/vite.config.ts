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
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // Allow tunneled access (dev only; Vite server config does not affect production build)
    allowedHosts: ['.trycloudflare.com', 'localhost', '127.0.0.1'],
    // Single-URL tunnel: proxy /api to local Nest API; rewrite /api/foo -> /foo, preserve headers (e.g. Authorization), multipart
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            /node_modules[\\/](i18next|react-i18next)[\\/]/.test(id)
          ) {
            return 'vendor-i18n';
          }
          if (/node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/recharts')) return 'vendor-charts';
          if (/node_modules[\\/]pdfjs-dist[\\/]/.test(id)) return 'vendor-pdfjs';
          if (/node_modules[\\/]tesseract\.js[\\/]/.test(id)) {
            return 'vendor-ocr';
          }
          if (id.includes('node_modules')) return 'vendor-core';
          return undefined;
        },
      },
    },
  },
});
