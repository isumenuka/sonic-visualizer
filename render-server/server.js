/**
 * Sonic Visualizer — FFmpeg WASM Static Server + Server-Side Render API v2
 * =========================================================================
 * Deploy this to Render.com as a Web Service (Node.js).
 *
 * Endpoints:
 *   GET  /                → info
 *   GET  /health          → WASM file status
 *   GET  /ffmpeg-core.js  → FFmpeg WASM JS shim
 *   GET  /ffmpeg-core.wasm → FFmpeg WASM binary
 *   POST /render          → server-side video render (audio + settings → MP4)
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import multer from 'multer';
import { createCanvas } from 'canvas';
import { renderFrame, getByteFrequencyData } from './renderer.js';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, 'public');
const PORT = process.env.PORT || 3001;

if (!fs.existsSync(PUBLIC)) fs.mkdirSync(PUBLIC, { recursive: true });

const app = express();

// ── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({ origin: '*' }));

// ── Security headers ──────────────────────────────────────────────────────────
app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range');
    if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
    next();
});

// ── Multer: accept audio file in memory (max 200 MB) ─────────────────────────
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });

// ── Static WASM files ─────────────────────────────────────────────────────────
app.use(express.static(PUBLIC, {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.wasm')) res.setHeader('Content-Type', 'application/wasm');
        if (filePath.endsWith('.js')) res.setHeader('Content-Type', 'text/javascript');
    },
}));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
    const coreJs = fs.existsSync(path.join(PUBLIC, 'ffmpeg-core.js'));
    const coreWasm = fs.existsSync(path.join(PUBLIC, 'ffmpeg-core.wasm'));
    res.json({
        status: coreJs && coreWasm ? 'ok' : 'missing-files',
        files: { 'ffmpeg-core.js': coreJs, 'ffmpeg-core.wasm': coreWasm },
        renderApi: true,
    });
});

// ── Root ──────────────────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
    res.json({
        name: 'Sonic Visualizer — Render Server v2',
        endpoints: { health: '/health', render: 'POST /render' },
    });
});

// ── /render — server-side video rendering ─────────────────────────────────────
// POST multipart/form-data:
//   audio    : audio file (mp3, wav, ogg, …)
//   settings : JSON string with VisualizerSettings
//   quality  : '1080p' | '2k' | '4k'   (default: '1080p')
//   aspect   : '16:9' | '9:16'           (default: '16:9')
app.post('/render', upload.single('audio'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No audio file uploaded' });
    }

    let settings;
    try {
        settings = JSON.parse(req.body.settings || '{}');
    } catch {
        return res.status(400).json({ error: 'Invalid settings JSON' });
    }

    const qualityMap = { '1080p': [1920, 1080], '2k': [2560, 1440], '4k': [3840, 2160] };
    let [W, H] = qualityMap[req.body.quality] || [1920, 1080];
    if (req.body.aspect === '9:16') [W, H] = [H, W];

    const FPS = 30;
    const FFT_SIZE = 2048;

    console.log(`[/render] Starting: ${W}×${H} @${FPS}fps, audio=${req.file.size} bytes`);

    // ── Write audio to temp file so ffmpeg can decode it ──────────────────────
    const tmpDir = fs.mkdtempSync(path.join('/tmp', 'sonic-'));
    const audioPath = path.join(tmpDir, `audio${path.extname(req.file.originalname) || '.mp3'}`);
    const outputPath = path.join(tmpDir, 'output.mp4');
    fs.writeFileSync(audioPath, req.file.buffer);

    try {
        // ── Decode audio to raw PCM float32 mono at 44100 Hz ──────────────────
        const rawPcmPath = path.join(tmpDir, 'audio.pcm');
        await execFileAsync('ffmpeg', [
            '-i', audioPath,
            '-ac', '1',          // mono for FFT
            '-ar', '44100',
            '-f', 'f32le',       // raw 32-bit float little-endian
            rawPcmPath,
        ]);
        const rawPcm = fs.readFileSync(rawPcmPath);
        const monoPCM = new Float32Array(rawPcm.buffer, rawPcm.byteOffset, rawPcm.byteLength / 4);
        const SR = 44100;
        const duration = monoPCM.length / SR;
        const totalFrames = Math.ceil(duration * FPS);
        console.log(`[/render] Audio decoded: ${duration.toFixed(1)}s → ${totalFrames} frames`);

        // ── Set up canvas ──────────────────────────────────────────────────────
        const canvas = createCanvas(W, H);
        const ctx = canvas.getContext('2d');
        const smoothedMags = new Float32Array(FFT_SIZE >> 1);
        const state = {
            rotation: 0,
            colorCycleHue: 0,
        };

        // ── Fill default settings ──────────────────────────────────────────────
        const s = {
            type: 'bars',
            primaryColor: '#00ff88',
            secondaryColor: '#00aaff',
            sensitivity: 1.5,
            barWidth: 3,
            radius: Math.min(W, H) * 0.25,
            rotationSpeed: 0,
            glowEnabled: true,
            trailEnabled: false,
            pulseEnabled: false,
            colorCycle: false,
            echoEnabled: false,
            invertColors: false,
            shakeEnabled: false,
            bgParticlesEnabled: false,
            centerMode: 'text',
            centerText: 'SONIC',
            centerTextSize: 20,
            centerColor: '#000000',
            logoScale: 0.5,
            bgBlur: 10,
            bgOpacity: 0.5,
            mirror: true,
            performanceMode: false,
            ...settings,
        };
        // Scale radius to canvas size if it's using a small default from the browser
        if (s.radius < 50) s.radius = Math.min(W, H) * 0.25;

        // ── Spawn FFmpeg to encode frames piped via stdin ──────────────────────
        const ffmpegArgs = [
            // Video input: raw BGRA frames from stdin
            // node-canvas toBuffer('raw') gives Cairo's native BGRA (on Linux x86 little-endian)
            '-f', 'rawvideo',
            '-pix_fmt', 'bgra',
            '-s', `${W}x${H}`,
            '-r', String(FPS),
            '-i', 'pipe:0',
            // Audio input
            '-i', audioPath,
            // Video encode: H.264 ultrafast (3-5× faster than fast, same perceptual quality at CRF 18)
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-crf', '18',
            '-pix_fmt', 'yuv420p',
            '-threads', '0',        // use all CPU cores
            // Audio encode: AAC 192k
            '-c:a', 'aac',
            '-b:a', '192k',
            '-shortest',
            // Output
            '-movflags', '+faststart',
            '-y', outputPath,
        ];

        const ffmpegProc = spawn('ffmpeg', ffmpegArgs, { stdio: ['pipe', 'pipe', 'pipe'] });
        ffmpegProc.stderr.on('data', (d) => process.stdout.write('[ffmpeg] ' + d));

        const ffmpegDone = new Promise((resolve, reject) => {
            ffmpegProc.on('close', (code) => code === 0 ? resolve() : reject(new Error(`FFmpeg exited ${code}`)));
            ffmpegProc.on('error', reject);
        });

        // ── Render each frame → write RGBA buffer to ffmpeg stdin ─────────────
        let framesDone = 0;
        for (let fi = 0; fi < totalFrames; fi++) {
            const sampleOffset = Math.floor((fi / FPS) * SR);
            const dataArray = getByteFrequencyData(monoPCM, sampleOffset, FFT_SIZE, smoothedMags);

            renderFrame(ctx, W, H, dataArray, s, state);

            // canvas.toBuffer('raw') returns the native Cairo pixel buffer (BGRA on Linux)
            // directly — no JS ImageData object allocation, no copy. Much faster than getImageData.
            const rawBuf = canvas.toBuffer('raw');
            const ok = ffmpegProc.stdin.write(rawBuf);

            // Backpressure: if stdin buffer full, wait for drain
            if (!ok) {
                await new Promise(r => ffmpegProc.stdin.once('drain', r));
            }

            framesDone++;
            if (fi % 30 === 0) console.log(`[/render] ${fi}/${totalFrames} frames (${Math.round(fi / totalFrames * 100)}%)`);
        }

        ffmpegProc.stdin.end();
        await ffmpegDone;
        console.log(`[/render] Encoding done → ${outputPath}`);

        // ── Stream the finished MP4 to the client ─────────────────────────────
        const stat = fs.statSync(outputPath);
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Content-Disposition', 'attachment; filename="sonic-visualizer.mp4"');

        const readStream = fs.createReadStream(outputPath);
        readStream.pipe(res);
        readStream.on('end', () => {
            // Cleanup temp files after stream finishes
            setTimeout(() => {
                try { fs.rmSync(tmpDir, { recursive: true }); } catch { }
            }, 5000);
        });

    } catch (err) {
        console.error('[/render] Error:', err);
        // Cleanup on error
        try { fs.rmSync(tmpDir, { recursive: true }); } catch { }
        if (!res.headersSent) {
            res.status(500).json({ error: err.message || 'Render failed' });
        }
    }
});

// ── Listen ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`[Server] Listening on port ${PORT}`);
    const coreJs = fs.existsSync(path.join(PUBLIC, 'ffmpeg-core.js'));
    const coreWasm = fs.existsSync(path.join(PUBLIC, 'ffmpeg-core.wasm'));
    if (!coreJs || !coreWasm) {
        console.warn('[Server] ⚠️  WASM files not found. Run `npm run copy-ffmpeg` from the main repo root.');
    } else {
        console.log('[Server] ✓ FFmpeg WASM files ready');
    }
    console.log('[Server] ✓ POST /render endpoint active');

    // Self-ping keep-alive (free tier)
    const renderUrl = process.env.RENDER_EXTERNAL_URL;
    if (renderUrl) {
        setInterval(() => {
            fetch(`${renderUrl}/health`).catch(() => { });
        }, 10 * 60 * 1000);
        console.log(`[Keep-Alive] Pinging ${renderUrl}/health every 10 min`);
    }
});
