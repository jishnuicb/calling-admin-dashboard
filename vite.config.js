import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  // `loadEnv` rather than process.env: the config file runs before Vite injects
  // env vars, so process.env would not see anything from a .env file.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      // The dev server proxies /api to the backend so the browser sees a
      // same-origin request. This keeps CORS out of the picture entirely during
      // development and means no backend config has to change.
      proxy: {
        '/api': {
          target: env.VITE_PROXY_TARGET || 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      // Recharts and the query client dominate the bundle; splitting them keeps
      // the app chunk small enough that a config change does not invalidate them.
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            charts: ['recharts'],
            query: ['@tanstack/react-query', 'axios'],
          },
        },
      },
    },
  };
});
