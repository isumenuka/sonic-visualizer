import { FFmpeg } from '@ffmpeg/ffmpeg';
// @ts-ignore: Vite ?url import is not recognized by standard TS setup
import workerURL from '@ffmpeg/ffmpeg/worker?url';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import {
    drawCircularBars, drawCircularWave, drawSpiral, drawParticles,
    drawRing, drawStrings, drawOrbit, drawSpikes, drawLaser,
    drawNebula, drawAura, drawPeaks,
} from '../visualizers/drawings';
import { VisualizerSettings } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Particle = { x: number; y: number; speed: number; angle: number; life: number; color: string; wobbleOffset?: number };
type NebParticle = { x: number; y: number; vx: number; vy: number; life: number; size: number; color: string };
type BgParticle = { x: number; y: number; vx: number; vy: number; life: number; size: number; color: string };

interface RenderState {
    rotation: number;
    particles: Particle[];
    nebParticles: NebParticle[];
    bgParticles: BgParticle[];
    colorCycleHue: number;
    smoothedMags: Float32Array;
}

export interface ExportOptions {
    audioFile: File;
    width: number;
    height: number;
    quality: '1080p' | '2k' | '4k';
    settings: VisualizerSettings;
    bgImg: HTMLImageElement | null;
    centerImg: HTMLImageElement | null;
    logoImg: HTMLImageElement | null;
    onProgress: (percent: number, speedMultiplier: number) => void;
    signal: AbortSignal;
}

// ─── FFT ──────────────────────────────────────────────────────────────────────

function computeFFT(real: Float32Array, imag: Float32Array): void {
    const n = real.length;
    for (let i = 1, j = 0; i < n; i++) {
        let bit = n >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) {
            let t = real[i]; real[i] = real[j]; real[j] = t;
            t = imag[i]; imag[i] = imag[j]; imag[j] = t;
        }
    }
    for (let len = 2; len <= n; len <<= 1) {
        const ang = -2 * Math.PI / len;
        const wRe = Math.cos(ang), wIm = Math.sin(ang);
        for (let i = 0; i < n; i += len) {
            let cRe = 1, cIm = 0;
            for (let j = 0; j < len >> 1; j++) {
                const uRe = real[i + j], uIm = imag[i + j];
                const vRe = real[i + j + (len >> 1)] * cRe - imag[i + j + (len >> 1)] * cIm;
                const vIm = real[i + j + (len >> 1)] * cIm + imag[i + j + (len >> 1)] * cRe;
                real[i + j] = uRe + vRe; imag[i + j] = uIm + vIm;
                real[i + j + (len >> 1)] = uRe - vRe; imag[i + j + (len >> 1)] = uIm - vIm;
                const nr = cRe * wRe - cIm * wIm;
                cIm = cRe * wIm + cIm * wRe; cRe = nr;
            }
        }
    }
}

function getByteFrequencyData(pcm: Float32Array, offset: number, fftSize: number, smoothed: Float32Array): Uint8Array {
    const half = fftSize >> 1;
    const real = new Float32Array(fftSize);
    const imag = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
        const s = pcm[offset + i] ?? 0;
        const w = 0.42 - 0.5 * Math.cos(2 * Math.PI * i / fftSize) + 0.08 * Math.cos(4 * Math.PI * i / fftSize);
        real[i] = s * w;
    }
    computeFFT(real, imag);
    const SMOOTH = 0.8;
    for (let i = 0; i < half; i++) {
        const mag = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]) / fftSize;
        smoothed[i] = SMOOTH * smoothed[i] + (1 - SMOOTH) * mag;
    }
    const out = new Uint8Array(half);
    const MIN_DB = -100, MAX_DB = -30;
    for (let i = 0; i < half; i++) {
        const db = 20 * Math.log10(Math.max(smoothed[i], 1e-10));
        out[i] = Math.round(Math.max(0, Math.min(1, (db - MIN_DB) / (MAX_DB - MIN_DB))) * 255);
    }
    return out;
}

// ─── Frame Renderer ───────────────────────────────────────────────────────────

function renderExportFrame(
    ctx: CanvasRenderingContext2D,
    W: number, H: number,
    dataArray: Uint8Array,
    s: VisualizerSettings,
    state: RenderState,
    bgImg: HTMLImageElement | null,
    centerImg: HTMLImageElement | null,
    logoImg: HTMLImageElement | null,
): void {
    const cX = W / 2, cY = H / 2;

    if (s.trailEnabled) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'source-over';
    } else {
        ctx.clearRect(0, 0, W, H);
    }

    if (bgImg) {
        ctx.save();
        const pad = s.bgBlur * 2;
        const sc = Math.max((W + pad * 2) / bgImg.naturalWidth, (H + pad * 2) / bgImg.naturalHeight);
        const sw = bgImg.naturalWidth * sc, sh = bgImg.naturalHeight * sc;
        if (s.bgBlur > 0) ctx.filter = `blur(${s.bgBlur}px)`;
        ctx.globalAlpha = s.bgOpacity;
        ctx.drawImage(bgImg, (W - sw) / 2, (H - sh) / 2, sw, sh);
        ctx.filter = 'none'; ctx.globalAlpha = 1;
        ctx.restore();
    }

    if (s.bgParticlesEnabled) {
        let bass = 0;
        for (let i = 0; i < 10; i++) bass += dataArray[i];
        bass /= 10 * 255;
        if (state.bgParticles.length < 150 && Math.random() < 0.3) {
            state.bgParticles.push({
                x: Math.random() * W, y: Math.random() * H,
                vx: (Math.random() - .5) * .5 * (1 + bass * 2), vy: (Math.random() - .5) * .5 * (1 + bass * 2) - .5,
                life: Math.random() * .5 + .5, size: Math.random() * 2 + .5,
                color: Math.random() > .5 ? s.primaryColor : s.secondaryColor,
            });
        }
        ctx.save();
        for (let i = state.bgParticles.length - 1; i >= 0; i--) {
            const p = state.bgParticles[i];
            p.x += p.vx; p.y += p.vy; p.life -= .002;
            if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
            if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
            if (p.life <= 0) { state.bgParticles.splice(i, 1); continue; }
            ctx.globalAlpha = p.life * .4 * (1 + bass);
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = p.color; ctx.fill();
        }
        ctx.restore();
    }

    let bassT = 0, maxBass = 0;
    for (let i = 0; i < 20; i++) { bassT += dataArray[i]; if (dataArray[i] > maxBass) maxBass = dataArray[i]; }
    const pScale = s.pulseEnabled ? 1 + (bassT / 20 / 255) * .2 : 1;
    const radius = s.radius * pScale;

    state.rotation += s.rotationSpeed * .01;
    if (s.colorCycle) state.colorCycleHue = (state.colorCycleHue + .5) % 360;

    ctx.save();
    if (s.invertColors) ctx.filter = 'invert(1) hue-rotate(180deg)';
    ctx.translate(cX, cY); ctx.rotate(state.rotation); ctx.translate(-cX, -cY);
    if (s.glowEnabled) { ctx.shadowBlur = 20; ctx.shadowColor = s.colorCycle ? `hsl(${state.colorCycleHue},100%,60%)` : s.primaryColor; }

    const vPrimary = s.colorCycle ? `hsl(${state.colorCycleHue},100%,60%)` : s.primaryColor;
    const vSecondary = s.colorCycle ? `hsl(${(state.colorCycleHue + 120) % 360},100%,60%)` : s.secondaryColor;
    const vs = s.colorCycle ? { ...s, primaryColor: vPrimary, secondaryColor: vSecondary } : s;

    const drawViz = (sm: number, a: number) => {
        ctx.save();
        ctx.translate(cX, cY); ctx.scale(sm, sm); ctx.translate(-cX, -cY);
        ctx.globalAlpha = a;
        if (s.type === 'bars') drawCircularBars(ctx, dataArray, cX, cY, radius, vs);
        else if (s.type === 'wave') drawCircularWave(ctx, dataArray, cX, cY, radius, vs);
        else if (s.type === 'spiral') drawSpiral(ctx, dataArray, cX, cY, radius, vs);
        else if (s.type === 'particles') drawParticles(ctx, dataArray, cX, cY, radius, state.particles, vs);
        else if (s.type === 'ring') drawRing(ctx, dataArray, cX, cY, radius, vs);
        else if (s.type === 'strings') drawStrings(ctx, dataArray, cX, cY, radius, vs);
        else if (s.type === 'orbit') drawOrbit(ctx, dataArray, cX, cY, radius, vs);
        else if (s.type === 'spikes') drawSpikes(ctx, dataArray, cX, cY, radius, vs);
        else if (s.type === 'laser') drawLaser(ctx, dataArray, cX, cY, radius, vs);
        else if (s.type === 'nebula') drawNebula(ctx, dataArray, cX, cY, radius, state.nebParticles, vs);
        else if (s.type === 'aura') drawAura(ctx, dataArray, cX, cY, radius, vs);
        else if (s.type === 'peaks') drawPeaks(ctx, dataArray, cX, cY, radius, vs);
        ctx.restore();
    };

    drawViz(1, 1);
    if (s.echoEnabled) { drawViz(1.2, .3); drawViz(1.5, .1); }
    ctx.shadowBlur = 0;

    ctx.beginPath(); ctx.arc(cX, cY, radius - 5, 0, 2 * Math.PI);
    ctx.fillStyle = s.centerColor; ctx.fill();

    if (s.centerMode === 'profile' && centerImg) {
        ctx.save(); ctx.beginPath(); ctx.arc(cX, cY, radius - 5, 0, 2 * Math.PI); ctx.clip();
        ctx.drawImage(centerImg, cX - radius, cY - radius, radius * 2, radius * 2);
        ctx.restore();
    } else if (s.centerMode === 'logo' && logoImg) {
        const size = (radius * 2) * s.logoScale;
        ctx.drawImage(logoImg, cX - size / 2, cY - size / 2, size, size);
    }

    ctx.strokeStyle = s.primaryColor; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cX, cY, radius - 5, 0, 2 * Math.PI); ctx.stroke();
    ctx.restore();

    if (s.centerMode === 'text' && s.centerText) {
        ctx.save();
        ctx.font = `300 ${s.centerTextSize * pScale}px "Inter",sans-serif`;
        ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowBlur = 10; ctx.shadowColor = s.primaryColor;
        const words = s.centerText.split(' ');
        if (words.length > 1 && s.centerText.length > 10) {
            ctx.fillText(words.slice(0, Math.ceil(words.length / 2)).join(' '), cX, cY - (s.centerTextSize * pScale) / 1.5);
            ctx.fillText(words.slice(Math.ceil(words.length / 2)).join(' '), cX, cY + (s.centerTextSize * pScale) / 1.5);
        } else { ctx.fillText(s.centerText, cX, cY); }
        ctx.restore();
    }
}

// ─── Main Export Function ─────────────────────────────────────────────────────

export async function exportWithFFmpeg(options: ExportOptions): Promise<void> {
    const { audioFile, width, height, settings, bgImg, centerImg, logoImg, onProgress, signal } = options;
    const FPS = 60;
    const FFT_SIZE = 2048;

    // ── 1. Create and Load FFmpeg ─────────────────────────────────────────────
    onProgress(0, 0); // "Initializing FFmpeg (WebAssembly Engine)..."

    // In React/Vite, we can access the core by letting @ffmpeg/ffmpeg fetch from unpkg
    // or passing the URLs explicitly. For multithreading (SharedArrayBuffer) we use core-mt.
    const ffmpeg = new FFmpeg();

    ffmpeg.on('log', ({ message }) => {
        console.log('[FFmpeg Log]', message);
    });

    let transcodeProgress = 0;
    ffmpeg.on('progress', ({ progress, time }) => {
        transcodeProgress = progress; // 0 to 1
        // Map 50-100% block strictly to transcode progress.
        onProgress(50 + (transcodeProgress * 50), 0);
    });

    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
    await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        classWorkerURL: workerURL,
    });

    if (signal.aborted) return;

    // ── 2. Decode audio for Canvas rendering (FFT logic) ───────────────────────
    const arrayBuffer = await audioFile.arrayBuffer();
    if (signal.aborted) return;

    const decodeCtx = new AudioContext();
    const originalBuffer = await decodeCtx.decodeAudioData(arrayBuffer);
    await decodeCtx.close();
    if (signal.aborted) return;

    const ch0 = originalBuffer.getChannelData(0);
    const monoPCM = new Float32Array(ch0.length);
    if (originalBuffer.numberOfChannels > 1) {
        const ch1 = originalBuffer.getChannelData(1);
        for (let i = 0; i < ch0.length; i++) monoPCM[i] = (ch0[i] + ch1[i]) / 2;
    } else {
        monoPCM.set(ch0);
    }

    const duration = originalBuffer.duration;
    const totalFrames = Math.ceil(duration * FPS);

    // ── 3. Write audio to FFmpeg FS ───────────────────────────────────────────
    const audioExt = audioFile.name.split('.').pop() || 'mp3';
    await ffmpeg.writeFile(`audio.${audioExt}`, await fetchFile(audioFile));

    // ── 4. Setup Canvas for Render Loop ───────────────────────────────────────
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

    const state: RenderState = {
        rotation: 0,
        particles: [], nebParticles: [], bgParticles: [],
        colorCycleHue: 0,
        smoothedMags: new Float32Array(FFT_SIZE >> 1),
    };

    // ── 5. Render frames to JPEGs and write to FFmpeg FS ──────────────────────
    const startTime = performance.now();
    for (let fi = 0; fi < totalFrames; fi++) {
        if (signal.aborted) {
            ffmpeg.terminate();
            return;
        }

        const sampleOffset = Math.floor((fi / FPS) * originalBuffer.sampleRate);
        const dataArray = getByteFrequencyData(monoPCM, sampleOffset, FFT_SIZE, state.smoothedMags);

        renderExportFrame(ctx, width, height, dataArray, settings, state, bgImg, centerImg, logoImg);

        // Convert canvas to bold/buffer
        const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
                (b) => (b ? resolve(b) : reject(new Error('Canvas to Blob failed'))),
                'image/jpeg',
                0.8
            );
        });

        const buf = await blob.arrayBuffer();
        await ffmpeg.writeFile(`f_${fi}.jpg`, new Uint8Array(buf));

        // Let the UI breathe and update progress map 0-50% to rendering
        if (fi % 1 === 0) { // update every frame to prevent hanging visual
            await new Promise((r) => setTimeout(r, 0));
            const elapsed = (performance.now() - startTime) / 1000;
            const videoSec = fi / FPS;
            const speedX = elapsed > 0.5 ? +(videoSec / elapsed).toFixed(1) : 0;
            // First 50% is creating images
            onProgress((fi / totalFrames) * 50, speedX);
        }
    }

    if (signal.aborted) {
        ffmpeg.terminate();
        return;
    }

    // ── 6. Execute FFmpeg C/C++ engine via WebAssembly ────────────────────────
    // We pass our image sequence and original audio file to generate output.mp4
    await ffmpeg.exec([
        '-framerate', String(FPS),
        '-i', 'f_%d.jpg',
        '-i', `audio.${audioExt}`,
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '24',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-shortest',
        'output.mp4'
    ]);

    if (signal.aborted) {
        ffmpeg.terminate();
        return;
    }

    // ── 7. Read Output and Cleanup ────────────────────────────────────────────
    const fileData = await ffmpeg.readFile('output.mp4');
    const data = new Uint8Array(fileData as any);

    // Download logic
    const outBlob = new Blob([data], { type: 'video/mp4' });
    const url = URL.createObjectURL(outBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sonic-visualizer-${width}x${height}-wasm.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 3000);

    // Clean up FFmpeg VM memory
    ffmpeg.terminate();
    onProgress(100, 0);
}
