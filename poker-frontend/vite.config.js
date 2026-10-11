import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const backend = { target: 'http://127.0.0.1:1111', changeOrigin: true };

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Fail instead of drifting to 5174: the SSH tunnel and the backend's
    // dev origin allowlist (poker-backend/config/origins.js) both expect 5173.
    strictPort: true,
    proxy: {
      '/api': backend,
      '/uploads': backend,
    },
  },
});
