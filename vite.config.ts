import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The Vite dev server proxies API calls to the local Express backend so the
// whole app is reachable from a single origin during development.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
