/**
 * Sonic Visualizer — Render Server v3
 * =====================================
 * Async job queue — fixes the 30-second Render.com proxy timeout.
 *
 * API:
 *   POST /render          → { jobId }   (responds immediately, renders in background)
 *   GET  /status/:jobId   → { status, progress, error? }
 *   GET  /download/:jobId → streams finished MP4
 *   GET  /health          → { status, renderApi: true }
 *   GET  /ffmpeg-core.*   → static WASM files with security headers
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import { randomUUID } from 'crypto';
import multer from 'multer';
import { createCanvas } from 'canvas';
import { renderFrame, getByteFrequencyData } from './renderer.js';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, 'public');
const PORT = process.env.PORT || 3001;

if (!fs.existsSync(PUBLIC)) fs.mkdirSync(PUBLIC, { recursive: true });

// ── In-memory job store ───────────────────────────────────────────────────────
// { [jobId]: { status: 'queued'|'processing'|'done'|'error', progress: 0-100,
//              outputPath, tmpDir, error, createdAt } }
const jobs = new Map();

// Clean up jobs older than 1 hour
setInterval(() => {
    const now = Date.now();
    for (const [id, job] of jobs) {
        if (now - job.createdAt > 60 * 60 * 1000) {
            try { fs.rmSync(job.tmpDir, { recursive: true }); } catch { }
            jobs.delete(id);
        }
    }
}, 10 * 60 * 1000);

const app = express();
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

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });

// ── Static WASM files ─────────────────────────────────────────────────────────
app.use(express.static(PUBLIC, {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.wasm')) res.setHeader('Content-Type', 'application/wasm');
        if (filePath.endsWith('.js')) res.setHeader('Content-Type', 'text/javascript');
    },
}));

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
    const coreJs = fs.existsSync(path.join(PUBLIC, 'ffmpeg-core.js'));
    const coreWasm = fs.existsSync(path.join(PUBLIC, 'ffmpeg-core.wasm'));
    res.json({ status: coreJs && coreWasm ? 'ok' : 'missing-files', renderApi: true, activeJobs: jobs.size });
});

app.get('/', (_req, res) => res.json({ name: 'Sonic Visualizer Render Server v3', endpoints: ['POST /render', 'GET /status/:jobId', 'GET /download/:jobId'] }));

// ── POST /render — queue a render job ────────────────────────────────────────
// Responds immediately with { jobId }. Render happens in background.
app.post('/render', upload.single('audio'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No audio file' });

    let settings;
    try { settings = JSON.parse(req.body.settings || '{}'); }
    catch { return res.status(400).json({ error: 'Invalid settings JSON' }); }

    const qualityMap = { '1080p': [1920, 1080], '2k': [2560, 1440], '4k': [3840, 2160] };
    let [W, H] = qualityMap[req.body.quality] || [1920, 1080];
    if (req.body.aspect === '9:16') [W, H] = [H, W];

    const jobId = randomUUID();
    const tmpDir = fs.mkdtempSync(path.join('/tmp', 'sonic-'));
    jobs.set(jobId, { status: 'queued', progress: 0, outputPath: null, tmpDir, error: null, createdAt: Date.now() });

    // Respond immediately — before any rendering starts
    res.json({ jobId });

    // Start render in background (don't await)
    processRender(jobId, req.file, settings, W, H, tmpDir).catch(err => {
        console.error(`[job:${jobId}] Unhandled error:`, err);
        const job = jobs.get(jobId);
        if (job) { job.status = 'error'; job.error = err.message; }
    });
});

// ── GET /status/:jobId ────────────────────────────────────────────────────────
app.get('/status/:jobId', (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json({ status: job.status, progress: job.progress, error: job.error || undefined });
});

// ── GET /download/:jobId ──────────────────────────────────────────────────────
app.get('/download/:jobId', (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.status !== 'done') return res.status(409).json({ error: `Job not ready (status: ${job.status})` });
    if (!job.outputPath || !fs.existsSync(job.outputPath)) return res.status(410).json({ error: 'Output file missing' });

    const stat = fs.statSync(job.outputPath);
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', 'attachment; filename="sonic-visualizer.mp4"');
    const stream = fs.createReadStream(job.outputPath);
    stream.pipe(res);
    stream.on('end', () => {
        // Cleanup after download
        setTimeout(() => {
            try { fs.rmSync(job.tmpDir, { recursive: true }); } catch { }
            jobs.delete(req.params.jobId);
        }, 30_000);
    });
});

// ── Background render function ────────────────────────────────────────────────
async function processRender(jobId, file, settings, W, H, tmpDir) {
    const job = jobs.get(jobId);
    const FPS = 30;
    const FFT_SIZE = 2048;
    const HALF_FFT = FFT_SIZE >> 1;

    try {
        job.status = 'processing';
        job.progress = 1;

        // Write audio to disk
        const audioPath = path.join(tmpDir, `audio${path.extname(file.originalname) || '.mp3'}`);
        const outputPath = path.join(tmpDir, 'output.mp4');
        fs.writeFileSync(audioPath, file.buffer);
        // Release the upload buffer from memory
        file.buffer = null;

        // Decode audio → PCM
        job.progress = 3;
        const rawPcmPath = path.join(tmpDir, 'audio.pcm');
        await execFileAsync('ffmpeg', ['-i', audioPath, '-ac', '1', '-ar', '44100', '-f', 'f32le', rawPcmPath]);
        console.log(`[job:${jobId}] Audio decoded`);

        let rawPcm = fs.readFileSync(rawPcmPath);
        try { fs.unlinkSync(rawPcmPath); } catch { }
        let monoPCM = new Float32Array(rawPcm.buffer, rawPcm.byteOffset, rawPcm.byteLength / 4);

        const SR = 44100;
        const duration = monoPCM.length / SR;
        const totalFrames = Math.ceil(duration * FPS);
        console.log(`[job:${jobId}] ${duration.toFixed(1)}s → ${totalFrames} frames`);

        // ── Pre-compute ALL FFT frames → free 244 MB PCM ──────────────────────
        job.progress = 5;
        console.log(`[job:${jobId}] Pre-computing FFT…`);
        const allFFTData = new Uint8Array(totalFrames * HALF_FFT);
        const smoothedMags = new Float32Array(HALF_FFT);
        for (let fi = 0; fi < totalFrames; fi++) {
            const sampleOffset = Math.floor((fi / FPS) * SR);
            const frame = getByteFrequencyData(monoPCM, sampleOffset, FFT_SIZE, smoothedMags);
            allFFTData.set(frame, fi * HALF_FFT);
        }
        // FREE the 244 MB PCM buffer before the render loop
        monoPCM = null; rawPcm = null;
        await new Promise(r => setTimeout(r, 100)); // let GC run
        console.log(`[job:${jobId}] PCM freed. Starting render…`);
        job.progress = 10;

        // ── Canvas + settings ─────────────────────────────────────────────────
        const canvas = createCanvas(W, H);
        const ctx = canvas.getContext('2d');
        const state = { rotation: 0, colorCycleHue: 0 };
        const s = {
            type: 'bars', primaryColor: '#00ff88', secondaryColor: '#00aaff',
            sensitivity: 1.5, barWidth: 3, radius: Math.min(W, H) * 0.25,
            rotationSpeed: 0, glowEnabled: true, trailEnabled: false,
            pulseEnabled: false, colorCycle: false, echoEnabled: false,
            invertColors: false, shakeEnabled: false, bgParticlesEnabled: false,
            centerMode: 'text', centerText: 'SONIC', centerTextSize: 20,
            centerColor: '#000000', logoScale: 0.5, bgBlur: 10, bgOpacity: 0.5,
            mirror: true, performanceMode: false,
            ...settings,
        };
        if (s.radius < 50) s.radius = Math.min(W, H) * 0.25;

        // ── FFmpeg encode ─────────────────────────────────────────────────────
        const ffmpegProc = spawn('ffmpeg', [
            '-f', 'rawvideo', '-pix_fmt', 'bgra', '-s', `${W}x${H}`, '-r', String(FPS), '-i', 'pipe:0',
            '-i', audioPath,
            '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '18', '-pix_fmt', 'yuv420p', '-threads', '0',
            '-c:a', 'aac', '-b:a', '192k', '-shortest',
            '-movflags', '+faststart', '-y', outputPath,
        ], { stdio: ['pipe', 'pipe', 'pipe'] });
        ffmpegProc.stderr.on('data', d => process.stdout.write(`[job:${jobId}][ffmpeg] ` + d));

        const ffmpegDone = new Promise((resolve, reject) => {
            ffmpegProc.on('close', code => code === 0 ? resolve() : reject(new Error(`FFmpeg exited ${code}`)));
            ffmpegProc.on('error', reject);
        });

        // ── Render loop ───────────────────────────────────────────────────────
        for (let fi = 0; fi < totalFrames; fi++) {
            const dataArray = allFFTData.subarray(fi * HALF_FFT, (fi + 1) * HALF_FFT);
            renderFrame(ctx, W, H, dataArray, s, state);

            const rawBuf = canvas.toBuffer('raw');
            const ok = ffmpegProc.stdin.write(rawBuf);
            if (!ok) await new Promise(r => ffmpegProc.stdin.once('drain', r));

            // Update progress: 10% → 95% during render
            if (fi % 60 === 0) {
                job.progress = Math.round(10 + (fi / totalFrames) * 85);
                console.log(`[job:${jobId}] ${fi}/${totalFrames} frames (${job.progress}%)`);
            }
        }

        ffmpegProc.stdin.end();
        await ffmpegDone;

        job.outputPath = outputPath;
        job.status = 'done';
        job.progress = 100;
        console.log(`[job:${jobId}] Done → ${outputPath}`);

    } catch (err) {
        console.error(`[job:${jobId}] Error:`, err.message);
        job.status = 'error';
        job.error = err.message;
        try { fs.rmSync(tmpDir, { recursive: true }); } catch { }
    }
}

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`[Server] Listening on port ${PORT}`);
    const coreJs = fs.existsSync(path.join(PUBLIC, 'ffmpeg-core.js'));
    const coreWasm = fs.existsSync(path.join(PUBLIC, 'ffmpeg-core.wasm'));
    console.log(coreJs && coreWasm ? '[Server] ✓ FFmpeg WASM files ready' : '[Server] ⚠️  WASM files missing');
    console.log('[Server] ✓ POST /render endpoint active');

    // Cloud Run handles keep-alive automatically — no self-ping needed.
    // (Unlike Render.com free tier, Cloud Run scales to zero but wakes up instantly on request)
    const cloudRunUrl = process.env.K_SERVICE; // Cloud Run sets K_SERVICE automatically
    if (cloudRunUrl) {
        console.log(`[Cloud Run] Service: ${cloudRunUrl}`);
    }
});
