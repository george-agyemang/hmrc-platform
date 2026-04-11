import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/auth':        { target: 'http://localhost:3001', changeOrigin: true },
      '/users':       { target: 'http://localhost:3001', changeOrigin: true },
      '/businesses':  { target: 'http://localhost:3001', changeOrigin: true },
      '/submissions': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
});
