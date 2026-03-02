/**
 * scripts/copy-ffmpeg.js
 * ──────────────────────
 * Copies FFmpeg WASM core files from node_modules into:
 *   1. public/ffmpeg/          (for local dev + Vite dev server)
 *   2. render-server/public/   (for the Render.com WASM static server)
 *
 * Run with: npm run copy-ffmpeg
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Source: @ffmpeg/core ESM dist
const SRC_DIR = path.join(ROOT, 'node_modules', '@ffmpeg', 'core', 'dist', 'esm');

// Destinations
const DEST_PUBLIC = path.join(ROOT, 'public', 'ffmpeg');
const DEST_RENDER_SRV = path.join(ROOT, 'render-server', 'public');

const FILES = ['ffmpeg-core.js', 'ffmpeg-core.wasm'];

function copyFiles(srcDir, destDir) {
    fs.mkdirSync(destDir, { recursive: true });
    for (const file of FILES) {
        const src = path.join(srcDir, file);
        const dest = path.join(destDir, file);
        if (!fs.existsSync(src)) {
            console.warn(`[copy-ffmpeg] ⚠️  Source not found: ${src}`);
            console.warn(`[copy-ffmpeg]    Make sure @ffmpeg/core is installed (npm install).`);
            continue;
        }
        fs.copyFileSync(src, dest);
        const kb = (fs.statSync(dest).size / 1024).toFixed(0);
        console.log(`[copy-ffmpeg] ✓  ${file} → ${path.relative(ROOT, dest)}  (${kb} KB)`);
    }
}

console.log('[copy-ffmpeg] Copying FFmpeg core files…\n');
copyFiles(SRC_DIR, DEST_PUBLIC);
console.log('');
copyFiles(SRC_DIR, DEST_RENDER_SRV);
console.log('\n[copy-ffmpeg] Done.');
