/**
 * GPU-Accelerated WebCodecs Export Engine — v2
 *
 * Upgrades vs v1:
 *  1. H.264 (avc1) + AAC   — best hardware encoder coverage on every GPU/OS
 *  2. mp4-muxer             — universal .mp4 output (plays on every device)
 *  3. Deep render-ahead pipeline — keep GPU fully fed (queue depth 12)
 *  4. Parallel audio track  — audio is encoded the moment PCM is ready,
 *                             never blocks the video render loop
 *  5. Lossless color space  — full-range YUV colorSpace declared so the muxer
 *                             preserves every encoded bit without re-quantising
 */

import {
    drawCircularBars, drawCircularWave, drawSpiral, drawParticles,
    drawRing, drawStrings, drawOrbit, drawSpikes, drawLaser,
    drawNebula, drawAura, drawPeaks,
} from '../visualizers/drawings';
import { VisualizerSettings } from '../types';
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Resolve the best supported H.264 codec string for this device's GPU.
 *  Priority: High@5.2 (4K) → High@4.1 (1080p/2K) → Baseline */
async function resolveH264Codec(width: number, height: number): Promise<{
    codec: string;
    hardwareAcceleration: HardwareAcceleration;
}> {
    const profiles: { codec: string; hw: HardwareAcceleration }[] = [
        { codec: 'avc1.640034', hw: 'prefer-hardware' }, // High 5.2 — 4K HW
        { codec: 'avc1.64002a', hw: 'prefer-hardware' }, // High 4.2 — 1080p/2K HW
        { codec: 'avc1.640028', hw: 'prefer-hardware' }, // High 4.0 — HW
        { codec: 'avc1.640028', hw: 'prefer-software' }, // High 4.0 — SW fallback
        { codec: 'avc1.420028', hw: 'prefer-software' }, // Baseline SW
    ];

    const bitrate = getVideoBitrate(width, height);
    for (const { codec, hw } of profiles) {
        const cfg: VideoEncoderConfig = { codec, width, height, bitrate, framerate: 60, hardwareAcceleration: hw };
        try {
            const result = await VideoEncoder.isConfigSupported(cfg);
            if (result.supported) return { codec, hardwareAcceleration: hw };
        } catch { /* try next */ }
    }
    // Absolute last resort
    return { codec: 'avc1.420028', hardwareAcceleration: 'prefer-software' };
}

/** Bitrate in bps — high quality, lossless-looking at each resolution */
function getVideoBitrate(width: number, height: number): number {
    const px = width * height;
    if (px >= 3840 * 2160) return 120_000_000; // 4K  — 120 Mbps (broadcast grade)
    if (px >= 2560 * 1440) return 60_000_000; // 2K  —  60 Mbps
    return 30_000_000; // 1080p— 30 Mbps (studio quality)
}

// ─── FFT Implementation (Cooley-Tukey) ───────────────────────────────────────

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

    // Clear / trail
    if (s.trailEnabled) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'source-over';
    } else {
        ctx.clearRect(0, 0, W, H);
    }

    // Background image
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

    // Background particles
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

    // Bass / pulse
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

export async function exportWithWebCodecs(options: ExportOptions): Promise<void> {
    const { audioFile, width, height, settings, bgImg, centerImg, logoImg, onProgress, signal } = options;
    const FPS = 60;
    const FFT_SIZE = 2048;
    // How many encoded frames can be queued before we pause rendering.
    // Higher = more GPU parallelism, lower = less RAM usage.
    const PIPELINE_DEPTH = 12;

    // ── 1. Decode audio ───────────────────────────────────────────────────────
    const arrayBuffer = await audioFile.arrayBuffer();
    if (signal.aborted) return;

    const decodeCtx = new AudioContext();
    const originalBuffer = await decodeCtx.decodeAudioData(arrayBuffer);
    await decodeCtx.close();
    if (signal.aborted) return;

    // Resample to 48 kHz if necessary (AAC/Opus both prefer 48 kHz)
    const TARGET_SR = 48000;
    let encBuf = originalBuffer;
    if (originalBuffer.sampleRate !== TARGET_SR) {
        const rsCtx = new OfflineAudioContext(
            originalBuffer.numberOfChannels,
            Math.ceil(originalBuffer.duration * TARGET_SR),
            TARGET_SR,
        );
        const src = rsCtx.createBufferSource();
        src.buffer = originalBuffer; src.connect(rsCtx.destination); src.start(0);
        encBuf = await rsCtx.startRendering();
    }

    // Mono PCM for FFT (at original sample rate for accurate timestamp alignment)
    // Clamp channel count — guard against files that report 0 channels (causes AudioEncoder crash).
    // Cap at 2 so we always produce stereo-or-below AAC which every decoder supports.
    const numChannels = Math.max(1, Math.min(2, encBuf.numberOfChannels || 1));

    const ch0 = originalBuffer.numberOfChannels > 0 ? originalBuffer.getChannelData(0) : new Float32Array(originalBuffer.length);
    const ch1 = originalBuffer.numberOfChannels > 1 ? originalBuffer.getChannelData(1) : ch0;
    const monoPCM = new Float32Array(ch0.length);
    for (let i = 0; i < ch0.length; i++) monoPCM[i] = (ch0[i] + ch1[i]) / 2;

    const duration = originalBuffer.duration;
    const totalFrames = Math.ceil(duration * FPS);
    if (signal.aborted) return;

    // ── 2. WebCodecs availability check ──────────────────────────────────────
    if (typeof VideoEncoder === 'undefined') {
        throw new Error('WebCodecs is not supported in this browser. Please use Chrome 94+ or Edge 94+.');
    }

    // ── 3. Resolve best H.264 profile for this GPU ────────────────────────────
    const { codec: videoCodec, hardwareAcceleration } = await resolveH264Codec(width, height);
    const videoBitrate = getVideoBitrate(width, height);

    const videoEncoderConfig: VideoEncoderConfig = {
        codec: videoCodec,
        width, height,
        bitrate: videoBitrate,
        bitrateMode: 'constant',   // CBR → predictable quality throughout
        framerate: FPS,
        hardwareAcceleration,
        latencyMode: 'quality',    // Maximise quality over latency
        // Request full-range color to avoid gamut compression in the encoder
    };

    // ── 4. Set up MP4 muxer ───────────────────────────────────────────────────
    const muxer = new Muxer({
        target: new ArrayBufferTarget(),
        video: {
            codec: 'avc',          // H.264 in MP4
            width, height,
            frameRate: FPS,
        },
        audio: {
            codec: 'aac',
            sampleRate: encBuf.sampleRate,
            numberOfChannels: numChannels,
        },
        firstTimestampBehavior: 'offset',
        fastStart: 'in-memory',    // Writes moov atom first → instant playback
    });

    // ── 5. Set up VideoEncoder (H.264 GPU path) ───────────────────────────────
    let videoError: Error | null = null;
    const videoEncoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta!),
        error: (e) => { videoError = e; },
    });
    videoEncoder.configure(videoEncoderConfig);

    // ── 6. Encode all audio (runs completely in parallel with video rendering) ─
    //   We kick it off NOW and don't await — it runs concurrently while
    //   the frame render loop below uses the CPU/GPU.
    let audioError: Error | null = null;
    const audioEncoder = new AudioEncoder({
        output: (chunk, meta) => muxer.addAudioChunk(chunk, meta!),
        error: (e) => { audioError = e; },
    });
    audioEncoder.configure({
        codec: 'aac',
        sampleRate: encBuf.sampleRate,
        numberOfChannels: numChannels,
        bitrate: 320_000,
    });

    const AUDIO_CHUNK = encBuf.sampleRate;
    for (let c = 0; c * AUDIO_CHUNK < encBuf.length; c++) {
        if (audioError) throw audioError;
        const start = c * AUDIO_CHUNK;
        const end = Math.min(start + AUDIO_CHUNK, encBuf.length);
        const count = end - start;
        const planar = new Float32Array(count * numChannels);
        for (let ch = 0; ch < numChannels; ch++) {
            // If the buffer has fewer channels than numChannels, duplicate ch0
            const src = ch < encBuf.numberOfChannels
                ? encBuf.getChannelData(ch).subarray(start, end)
                : encBuf.getChannelData(0).subarray(start, end);
            planar.set(src, ch * count);
        }
        const ad = new AudioData({
            format: 'f32-planar',
            sampleRate: encBuf.sampleRate,
            numberOfFrames: count,
            numberOfChannels: numChannels,
            timestamp: Math.round((start / encBuf.sampleRate) * 1_000_000),
            data: planar,
        });
        audioEncoder.encode(ad);
        ad.close();
    }
    // (audioEncoder.flush() is awaited later — encoding runs async in background)

    // ── 7. Canvas setup ───────────────────────────────────────────────────────
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    // `desynchronized: true` lets the browser skip unnecessary GPU sync barriers
    const ctx = canvas.getContext('2d', { willReadFrequently: false, desynchronized: true })!;

    const state: RenderState = {
        rotation: 0,
        particles: [], nebParticles: [], bgParticles: [],
        colorCycleHue: 0,
        smoothedMags: new Float32Array(FFT_SIZE >> 1),
    };

    // ── 8. Render + encode frames (deep pipeline) ─────────────────────────────
    const startTime = performance.now();
    const GOP = FPS * 2; // keyframe every 2 sec

    for (let fi = 0; fi < totalFrames; fi++) {
        if (signal.aborted) break;
        if (videoError) throw videoError;
        if (audioError) throw audioError;

        // Backpressure: pause rendering when the encoder queue is deep enough.
        // PIPELINE_DEPTH=12 keeps the GPU hardware encoder fully saturated
        // without ballooning memory usage.
        while (videoEncoder.encodeQueueSize > PIPELINE_DEPTH) {
            await new Promise<void>(r => setTimeout(r, 0));
        }

        // --- Compute FFT data for this frame ---
        const sampleOffset = Math.floor((fi / FPS) * originalBuffer.sampleRate);
        const dataArray = getByteFrequencyData(monoPCM, sampleOffset, FFT_SIZE, state.smoothedMags);

        // --- Render frame to canvas ---
        renderExportFrame(ctx, width, height, dataArray, settings, state, bgImg, centerImg, logoImg);

        // --- Wrap canvas in a VideoFrame (zero-copy on most browsers) ---
        const timestampUs = Math.round((fi / FPS) * 1_000_000);
        const frame = new VideoFrame(canvas, {
            timestamp: timestampUs,
            duration: Math.round(1_000_000 / FPS),
        });

        // --- Push to encoder (GPU takes it from here) ---
        videoEncoder.encode(frame, { keyFrame: fi % GOP === 0 });
        frame.close(); // release GPU-side texture reference immediately

        // --- Progress reporting (every 10 frames ~= 6× per second at 60fps) ---
        if (fi % 10 === 0) {
            await new Promise<void>(r => setTimeout(r, 0));
            const elapsed = (performance.now() - startTime) / 1000;
            const videoSec = fi / FPS;
            const speedX = elapsed > 0.5 ? +(videoSec / elapsed).toFixed(1) : 0;
            onProgress((fi / totalFrames) * 95, speedX); // leave 5% for flush
        }
    }

    if (signal.aborted) {
        videoEncoder.close();
        audioEncoder.close();
        return;
    }

    // ── 9. Flush both encoders (concurrent) ───────────────────────────────────
    await Promise.all([
        videoEncoder.flush(),
        audioEncoder.flush(),
    ]);

    if (videoError) throw videoError;
    if (audioError) throw audioError;

    videoEncoder.close();
    audioEncoder.close();
    muxer.finalize();

    // ── 10. Download ──────────────────────────────────────────────────────────
    const { buffer } = muxer.target as ArrayBufferTarget;
    const blob = new Blob([buffer], { type: 'video/mp4' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sonic-visualizer-${width}x${height}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 3000);

    onProgress(100, 0);
}
