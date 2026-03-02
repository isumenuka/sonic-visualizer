/**
 * Sonic Visualizer — FFmpeg WASM Static Server
 * =============================================
 * Deploy this to Render.com as a Web Service (Node.js).
 *
 * It serves the two FFmpeg core files with the security headers required
 * for SharedArrayBuffer (WASM threads) to work cross-origin:
 *   - Cross-Origin-Resource-Policy: cross-origin  (allow Vercel to fetch)
 *   - Cross-Origin-Opener-Policy:   same-origin
 *   - Cross-Origin-Embedder-Policy: require-corp
 *   - Access-Control-Allow-Origin:  *             (CORS for cross-origin fetch)
 *
 * Files expected in ./public/:
 *   ffmpeg-core.js    (~500 KB)
 *   ffmpeg-core.wasm  (~30 MB)
 *
 * How to get these files (run from the main repo root):
 *   npm run copy-ffmpeg
 *
 * Render.com config:
 *   Build Command:  cd render-server && npm install
 *   Start Command:  cd render-server && node server.js
 *   Root Directory: (leave blank — repo root)
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, 'public');
const PORT = process.env.PORT || 3001;

// Ensure public dir exists
if (!fs.existsSync(PUBLIC)) {
    fs.mkdirSync(PUBLIC, { recursive: true });
}

const app = express();

// ── CORS: allow all origins so Vercel (any subdomain) can fetch ───────────────
app.use(cors({ origin: '*' }));

// ── Security headers required for SharedArrayBuffer (FFmpeg threads) ──────────
app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Range');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range');
    next();
});

// ── Serve static WASM files ───────────────────────────────────────────────────
app.use(express.static(PUBLIC, {
    // Cache WASM for 7 days in prod (Render CDN / browser)
    maxAge: 7 * 24 * 60 * 60 * 1000,
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.wasm')) {
            res.setHeader('Content-Type', 'application/wasm');
        }
        if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'text/javascript');
        }
    },
}));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
    const coreJs = fs.existsSync(path.join(PUBLIC, 'ffmpeg-core.js'));
    const coreWasm = fs.existsSync(path.join(PUBLIC, 'ffmpeg-core.wasm'));
    res.json({
        status: coreJs && coreWasm ? 'ok' : 'missing-files',
        files: { 'ffmpeg-core.js': coreJs, 'ffmpeg-core.wasm': coreWasm },
    });
});

// ── Root ──────────────────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
    res.json({
        name: 'Sonic Visualizer — FFmpeg WASM Server',
        version: '1.0.0',
        endpoints: {
            health: '/health',
            'ffmpeg-core.js': '/ffmpeg-core.js',
            'ffmpeg-core.wasm': '/ffmpeg-core.wasm',
        },
    });
});

app.listen(PORT, () => {
    console.log(`[FFmpeg Server] Listening on port ${PORT}`);
    console.log(`[FFmpeg Server] Serving files from: ${PUBLIC}`);
    const coreJs = fs.existsSync(path.join(PUBLIC, 'ffmpeg-core.js'));
    const coreWasm = fs.existsSync(path.join(PUBLIC, 'ffmpeg-core.wasm'));
    if (!coreJs || !coreWasm) {
        console.warn('[FFmpeg Server] ⚠️  WASM files not found in ./public/');
        console.warn('[FFmpeg Server]    Run `npm run copy-ffmpeg` from the main repo root to copy them.');
    } else {
        console.log('[FFmpeg Server] ✓  ffmpeg-core.js and ffmpeg-core.wasm ready');
    }

    // ── Self-ping keep-alive (prevents Render free tier from sleeping) ──────────
    // Render automatically sets RENDER_EXTERNAL_URL to the public service URL.
    const renderUrl = process.env.RENDER_EXTERNAL_URL;
    if (renderUrl) {
        const PING_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
        const pingHealth = () => {
            fetch(`${renderUrl}/health`)
                .then(r => r.json())
                .then(data => console.log(`[Keep-Alive] ping OK — status: ${data.status}`))
                .catch(err => console.warn(`[Keep-Alive] ping failed: ${err.message}`));
        };
        setInterval(pingHealth, PING_INTERVAL_MS);
        console.log(`[Keep-Alive] Self-ping enabled every 10 min → ${renderUrl}/health`);
    } else {
        console.log('[Keep-Alive] RENDER_EXTERNAL_URL not set — skipping self-ping (local dev mode)');
    }
});
