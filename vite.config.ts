import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The Vite dev server proxies API calls to the local Express backend so the
// whole app is reachable from a single origin during development.
export default defineConfig({
  plugins: [react()],
  server: {
    // Bind to all interfaces so the app is reachable from outside the
    // container / behind a preview proxy (not just localhost).
    host: true,
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
