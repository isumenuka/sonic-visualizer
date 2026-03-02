import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        // Inject COOP + COEP headers during `vite dev` so SharedArrayBuffer
        // (required by FFmpeg WASM threads) is available locally.
        name: 'configure-response-headers',
        configureServer: (server) => {
          server.middlewares.use((_req, res, next) => {
            res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
            res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
            next();
          });
        },
      },
    ],

    // Treat .wasm as static assets — Vite gives them a hashed URL that Vercel caches.
    assetsInclude: ['**/*.wasm'],

    // Never pre-bundle FFmpeg — it uses SharedArrayBuffer workers that must
    // be native ES modules loaded by the browser at runtime.
    optimizeDeps: {
      exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util', '@ffmpeg/core'],
    },

    define: {
      // Expose the Render.com FFmpeg CDN URL to the client bundle.
      // Set VITE_FFMPEG_BASE_URL in Vercel's Environment Variables dashboard
      // to point at your Render.com Web Service (e.g. https://sonic-ffmpeg.onrender.com).
      'import.meta.env.VITE_FFMPEG_BASE_URL': JSON.stringify(
        env.VITE_FFMPEG_BASE_URL || ''
      ),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },

    build: {
      rollupOptions: {
        output: {
          // Split large vendor chunks so Vercel Edge caches them separately.
          manualChunks: {
            react: ['react', 'react-dom'],
            motion: ['motion'],
            lucide: ['lucide-react'],
          },
        },
      },
    },

    server: {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
