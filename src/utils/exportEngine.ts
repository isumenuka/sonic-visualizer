/**
 * WebCodecs-based GPU-accelerated export engine.
 * Renders faster than realtime by processing audio/video offline.
 */

import {
    drawCircularBars, drawCircularWave, drawSpiral, drawParticles,
    drawRing, drawStrings, drawOrbit, drawSpikes, drawLaser,
    drawNebula, drawAura, drawPeaks,
} from '../visualizers/drawings';
import { VisualizerSettings } from '../types';
import { Muxer, ArrayBufferTarget } from 'webm-muxer';

// ─── Particle types (mirroring App.tsx) ─────────────────────────────────────

type Particle = { x: number; y: number; speed: number; angle: number; life: number; color: string; wobbleOffset?: number };
type NebParticle = { x: number; y: number; vx: number; vy: number; life: number; size: number; color: string };
type BgParticle = { x: number; y: number; vx: number; vy: number; life: number; size: number; color: string };

interface RenderState {
    rotation: number;
    particles: Particle[];
    nebParticles: NebParticle[];
    bgParticles: BgParticle[];
    colorCycleHue: number;
    smoothedMags: Float32Array; // for FFT smoothing across frames
    trailCanvas: HTMLCanvasElement | null; // for trail effect accumulation
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

// ─── FFT Implementation ──────────────────────────────────────────────────────

function computeFFT(real: Float32Array, imag: Float32Array): void {
    const n = real.length;
    // Bit-reversal permutation
    for (let i = 1, j = 0; i < n; i++) {
        let bit = n >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) {
            let tmp = real[i]; real[i] = real[j]; real[j] = tmp;
            tmp = imag[i]; imag[i] = imag[j]; imag[j] = tmp;
        }
    }
    // Cooley-Tukey butterfly
    for (let len = 2; len <= n; len <<= 1) {
        const ang = -2 * Math.PI / len;
        const wRe = Math.cos(ang);
        const wIm = Math.sin(ang);
        for (let i = 0; i < n; i += len) {
            let curRe = 1, curIm = 0;
            const half = len >> 1;
            for (let j = 0; j < half; j++) {
                const uRe = real[i + j], uIm = imag[i + j];
                const vRe = real[i + j + half] * curRe - imag[i + j + half] * curIm;
                const vIm = real[i + j + half] * curIm + imag[i + j + half] * curRe;
                real[i + j] = uRe + vRe; imag[i + j] = uIm + vIm;
                real[i + j + half] = uRe - vRe; imag[i + j + half] = uIm - vIm;
                const newCurRe = curRe * wRe - curIm * wIm;
                curIm = curRe * wIm + curIm * wRe;
                curRe = newCurRe;
            }
        }
    }
}

/** Compute frequency data matching Web Audio AnalyserNode.getByteFrequencyData() */
function getByteFrequencyData(
    pcm: Float32Array,
    sampleOffset: number,
    fftSize: number,
    smoothed: Float32Array, // mutated in-place (exponential smoothing)
): Uint8Array {
    const binCount = fftSize >> 1;
    const real = new Float32Array(fftSize);
    const imag = new Float32Array(fftSize); // initialized to 0

    // Copy samples with Blackman window
    for (let i = 0; i < fftSize; i++) {
        const s = pcm[sampleOffset + i] ?? 0;
        const w = 0.42 - 0.5 * Math.cos(2 * Math.PI * i / fftSize) + 0.08 * Math.cos(4 * Math.PI * i / fftSize);
        real[i] = s * w;
    }

    computeFFT(real, imag);

    // Apply AnalyserNode-style exponential smoothing on linear magnitude
    const SMOOTHING = 0.8;
    for (let i = 0; i < binCount; i++) {
        const mag = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]) / fftSize;
        smoothed[i] = SMOOTHING * smoothed[i] + (1 - SMOOTHING) * mag;
    }

    // Convert smoothed magnitude to byte (0-255) using same dB range as AnalyserNode
    const result = new Uint8Array(binCount);
    const MIN_DB = -100, MAX_DB = -30;
    for (let i = 0; i < binCount; i++) {
        const db = 20 * Math.log10(Math.max(smoothed[i], 1e-10));
        result[i] = Math.round(Math.max(0, Math.min(1, (db - MIN_DB) / (MAX_DB - MIN_DB))) * 255);
    }
    return result;
}

// ─── Single Frame Renderer ───────────────────────────────────────────────────

function renderExportFrame(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    dataArray: Uint8Array,
    s: VisualizerSettings,
    state: RenderState,
    bgImg: HTMLImageElement | null,
    centerImg: HTMLImageElement | null,
    logoImg: HTMLImageElement | null,
): void {
    const W = canvas.width;
    const H = canvas.height;
    const centerX = W / 2;
    const centerY = H / 2;

    // Trail effect
    if (s.trailEnabled) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'source-over';
    } else {
        ctx.clearRect(0, 0, W, H);
    }

    // Background image (cover-fill with blur + opacity)
    if (bgImg) {
        ctx.save();
        const blurPad = s.bgBlur * 2;
        const imgScale = Math.max(
            (W + blurPad * 2) / bgImg.naturalWidth,
            (H + blurPad * 2) / bgImg.naturalHeight,
        );
        const sw = bgImg.naturalWidth * imgScale;
        const sh = bgImg.naturalHeight * imgScale;
        if (s.bgBlur > 0) ctx.filter = `blur(${s.bgBlur}px)`;
        ctx.globalAlpha = s.bgOpacity;
        ctx.drawImage(bgImg, (W - sw) / 2, (H - sh) / 2, sw, sh);
        ctx.filter = 'none';
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    // Background particles
    if (s.bgParticlesEnabled) {
        let bassEnergy = 0;
        for (let i = 0; i < 10; i++) bassEnergy += dataArray[i];
        bassEnergy /= 10 * 255;

        if (state.bgParticles.length < 150 && Math.random() < 0.3) {
            state.bgParticles.push({
                x: Math.random() * W, y: Math.random() * H,
                vx: (Math.random() - 0.5) * 0.5 * (1 + bassEnergy * 2),
                vy: (Math.random() - 0.5) * 0.5 * (1 + bassEnergy * 2) - 0.5,
                life: Math.random() * 0.5 + 0.5,
                size: Math.random() * 2 + 0.5,
                color: Math.random() > 0.5 ? s.primaryColor : s.secondaryColor,
            });
        }
        ctx.save();
        for (let i = state.bgParticles.length - 1; i >= 0; i--) {
            const p = state.bgParticles[i];
            p.x += p.vx; p.y += p.vy; p.life -= 0.002;
            if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
            if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
            if (p.life <= 0) { state.bgParticles.splice(i, 1); continue; }
            ctx.globalAlpha = p.life * 0.4 * (1 + bassEnergy);
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = p.color; ctx.fill();
        }
        ctx.restore();
    }

    // Bass for pulse
    let bassTotal = 0, maxBass = 0;
    for (let i = 0; i < 20; i++) {
        bassTotal += dataArray[i];
        if (dataArray[i] > maxBass) maxBass = dataArray[i];
    }
    const bassAverage = bassTotal / 20;
    const pulseScale = s.pulseEnabled ? 1 + (bassAverage / 255) * 0.2 : 1;
    const currentRadius = s.radius * pulseScale;

    state.rotation += s.rotationSpeed * 0.01;
    if (s.colorCycle) state.colorCycleHue = (state.colorCycleHue + 0.5) % 360;

    ctx.save();
    if (s.invertColors) ctx.filter = 'invert(1) hue-rotate(180deg)';
    ctx.translate(centerX, centerY);
    ctx.rotate(state.rotation);
    ctx.translate(-centerX, -centerY);

    if (s.glowEnabled) {
        ctx.shadowBlur = 20;
        ctx.shadowColor = s.colorCycle ? `hsl(${state.colorCycleHue},100%,60%)` : s.primaryColor;
    }

    const vizPrimary = s.colorCycle ? `hsl(${state.colorCycleHue},100%,60%)` : s.primaryColor;
    const vizSecondary = s.colorCycle ? `hsl(${(state.colorCycleHue + 120) % 360},100%,60%)` : s.secondaryColor;
    const vizSettings = s.colorCycle ? { ...s, primaryColor: vizPrimary, secondaryColor: vizSecondary } : s;

    const drawViz = (scaleMult: number, alpha: number) => {
        ctx.save();
        ctx.translate(centerX, centerY); ctx.scale(scaleMult, scaleMult); ctx.translate(-centerX, -centerY);
        ctx.globalAlpha = alpha;
        if (s.type === 'bars') drawCircularBars(ctx, dataArray, centerX, centerY, currentRadius, vizSettings);
        else if (s.type === 'wave') drawCircularWave(ctx, dataArray, centerX, centerY, currentRadius, vizSettings);
        else if (s.type === 'spiral') drawSpiral(ctx, dataArray, centerX, centerY, currentRadius, vizSettings);
        else if (s.type === 'particles') drawParticles(ctx, dataArray, centerX, centerY, currentRadius, state.particles, vizSettings);
        else if (s.type === 'ring') drawRing(ctx, dataArray, centerX, centerY, currentRadius, vizSettings);
        else if (s.type === 'strings') drawStrings(ctx, dataArray, centerX, centerY, currentRadius, vizSettings);
        else if (s.type === 'orbit') drawOrbit(ctx, dataArray, centerX, centerY, currentRadius, vizSettings);
        else if (s.type === 'spikes') drawSpikes(ctx, dataArray, centerX, centerY, currentRadius, vizSettings);
        else if (s.type === 'laser') drawLaser(ctx, dataArray, centerX, centerY, currentRadius, vizSettings);
        else if (s.type === 'nebula') drawNebula(ctx, dataArray, centerX, centerY, currentRadius, state.nebParticles, vizSettings);
        else if (s.type === 'aura') drawAura(ctx, dataArray, centerX, centerY, currentRadius, vizSettings);
        else if (s.type === 'peaks') drawPeaks(ctx, dataArray, centerX, centerY, currentRadius, vizSettings);
        ctx.restore();
    };

    drawViz(1, 1);
    if (s.echoEnabled) { drawViz(1.2, 0.3); drawViz(1.5, 0.1); }

    ctx.shadowBlur = 0;

    // Center circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, currentRadius - 5, 0, 2 * Math.PI);
    ctx.fillStyle = s.centerColor;
    ctx.fill();

    // Center content
    if (s.centerMode === 'profile' && centerImg) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, currentRadius - 5, 0, 2 * Math.PI);
        ctx.clip();
        ctx.drawImage(centerImg, centerX - currentRadius, centerY - currentRadius, currentRadius * 2, currentRadius * 2);
        ctx.restore();
    } else if (s.centerMode === 'logo' && logoImg) {
        const size = (currentRadius * 2) * s.logoScale;
        ctx.drawImage(logoImg, centerX - size / 2, centerY - size / 2, size, size);
    }

    // Outline ring
    ctx.strokeStyle = s.primaryColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, currentRadius - 5, 0, 2 * Math.PI);
    ctx.stroke();

    ctx.restore(); // end rotation context

    // Center text (drawn after rotation reset so it stays static)
    if (s.centerMode === 'text' && s.centerText) {
        ctx.save();
        ctx.font = `300 ${s.centerTextSize * pulseScale}px "Inter", sans-serif`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 10;
        ctx.shadowColor = s.primaryColor;
        const words = s.centerText.split(' ');
        if (words.length > 1 && s.centerText.length > 10) {
            ctx.fillText(words.slice(0, Math.ceil(words.length / 2)).join(' '), centerX, centerY - (s.centerTextSize * pulseScale) / 1.5);
            ctx.fillText(words.slice(Math.ceil(words.length / 2)).join(' '), centerX, centerY + (s.centerTextSize * pulseScale) / 1.5);
        } else {
            ctx.fillText(s.centerText, centerX, centerY);
        }
        ctx.restore();
    }
}

// ─── Helper: bitrate by resolution ──────────────────────────────────────────

function getVideoBitrate(width: number, height: number): number {
    const px = width * height;
    if (px >= 3840 * 2160) return 80_000_000; // 4K
    if (px >= 2560 * 1440) return 40_000_000; // 2K
    return 20_000_000;                          // 1080p
}

// ─── Main Export Function ────────────────────────────────────────────────────

export async function exportWithWebCodecs(options: ExportOptions): Promise<void> {
    const { audioFile, width, height, settings, bgImg, centerImg, logoImg, onProgress, signal } = options;
    const FPS = 60;
    const fftSize = 2048;

    // ── 1. Decode audio ──────────────────────────────────────────────────────
    const arrayBuffer = await audioFile.arrayBuffer();
    if (signal.aborted) return;

    // Temp context just for decoding
    const decodeCtx = new AudioContext();
    const originalBuffer = await decodeCtx.decodeAudioData(arrayBuffer);
    await decodeCtx.close();
    if (signal.aborted) return;

    // Resample to 48000 Hz for Opus compatibility (if needed)
    const TARGET_SAMPLE_RATE = 48000;
    let encodingBuffer = originalBuffer;
    if (originalBuffer.sampleRate !== TARGET_SAMPLE_RATE) {
        const resampleCtx = new OfflineAudioContext(
            originalBuffer.numberOfChannels,
            Math.ceil(originalBuffer.duration * TARGET_SAMPLE_RATE),
            TARGET_SAMPLE_RATE,
        );
        const src = resampleCtx.createBufferSource();
        src.buffer = originalBuffer;
        src.connect(resampleCtx.destination);
        src.start(0);
        encodingBuffer = await resampleCtx.startRendering();
    }

    // Build mono PCM for FFT analysis (use original sample rate for timestamps)
    const ch0 = originalBuffer.getChannelData(0);
    const ch1 = originalBuffer.numberOfChannels > 1 ? originalBuffer.getChannelData(1) : ch0;
    const monoPCM = new Float32Array(ch0.length);
    for (let i = 0; i < ch0.length; i++) monoPCM[i] = (ch0[i] + ch1[i]) / 2;

    const duration = originalBuffer.duration;
    const totalFrames = Math.ceil(duration * FPS);
    if (signal.aborted) return;

    // ── 2. Check WebCodecs support ───────────────────────────────────────────
    if (typeof VideoEncoder === 'undefined') {
        throw new Error('WebCodecs VideoEncoder is not supported in this browser. Please use Chrome or Edge.');
    }

    const videoConfig: VideoEncoderConfig = {
        codec: 'vp09.00.41.08',
        width, height,
        bitrate: getVideoBitrate(width, height),
        framerate: FPS,
        hardwareAcceleration: 'prefer-hardware',
        latencyMode: 'quality',
    };

    // Fall back to baseline VP9 if profile 3 not supported
    const support = await VideoEncoder.isConfigSupported(videoConfig);
    if (!support.supported) {
        videoConfig.codec = 'vp09.00.10.08';
        videoConfig.hardwareAcceleration = 'prefer-software';
    }

    // ── 3. Set up muxer ──────────────────────────────────────────────────────
    const muxer = new Muxer({
        target: new ArrayBufferTarget(),
        video: { codec: 'V_VP9', width, height, frameRate: FPS },
        audio: {
            codec: 'A_OPUS',
            sampleRate: encodingBuffer.sampleRate,
            numberOfChannels: encodingBuffer.numberOfChannels,
        },
        firstTimestampBehavior: 'offset',
    });

    // ── 4. Set up VideoEncoder ───────────────────────────────────────────────
    let videoError: Error | null = null;
    const videoEncoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta!),
        error: (e) => { videoError = e; },
    });
    videoEncoder.configure(videoConfig);

    // ── 5. Encode audio (in 1-second chunks to reduce memory) ───────────────
    let audioError: Error | null = null;
    const audioEncoder = new AudioEncoder({
        output: (chunk, meta) => muxer.addAudioChunk(chunk, meta!),
        error: (e) => { audioError = e; },
    });
    audioEncoder.configure({
        codec: 'opus',
        sampleRate: encodingBuffer.sampleRate,
        numberOfChannels: encodingBuffer.numberOfChannels,
        bitrate: 192_000,
    });

    const AUDIO_CHUNK_FRAMES = encodingBuffer.sampleRate; // 1 second
    for (let c = 0; c * AUDIO_CHUNK_FRAMES < encodingBuffer.length; c++) {
        if (audioError) throw audioError;
        const start = c * AUDIO_CHUNK_FRAMES;
        const end = Math.min(start + AUDIO_CHUNK_FRAMES, encodingBuffer.length);
        const count = end - start;
        const planar = new Float32Array(count * encodingBuffer.numberOfChannels);
        for (let ch = 0; ch < encodingBuffer.numberOfChannels; ch++) {
            planar.set(encodingBuffer.getChannelData(ch).subarray(start, end), ch * count);
        }
        const ad = new AudioData({
            format: 'f32-planar',
            sampleRate: encodingBuffer.sampleRate,
            numberOfFrames: count,
            numberOfChannels: encodingBuffer.numberOfChannels,
            timestamp: Math.round((start / encodingBuffer.sampleRate) * 1_000_000),
            data: planar,
        });
        audioEncoder.encode(ad);
        ad.close();
    }

    // ── 6. Create offscreen canvas for rendering ─────────────────────────────
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: false })!;

    const state: RenderState = {
        rotation: 0,
        particles: [],
        nebParticles: [],
        bgParticles: [],
        colorCycleHue: 0,
        smoothedMags: new Float32Array(fftSize >> 1),
        trailCanvas: null,
    };

    // ── 7. Render frames ─────────────────────────────────────────────────────
    const startTime = performance.now();

    for (let fi = 0; fi < totalFrames; fi++) {
        if (signal.aborted) break;
        if (videoError) throw videoError;

        // Backpressure: wait if encoder queue is large
        while (videoEncoder.encodeQueueSize > 5) {
            await new Promise<void>(r => setTimeout(r, 0));
        }

        const sampleOffset = Math.floor((fi / FPS) * originalBuffer.sampleRate);
        const dataArray = getByteFrequencyData(monoPCM, sampleOffset, fftSize, state.smoothedMags);

        renderExportFrame(ctx, canvas, dataArray, settings, state, bgImg, centerImg, logoImg);

        const timestampUs = Math.round((fi / FPS) * 1_000_000);
        const frame = new VideoFrame(canvas, {
            timestamp: timestampUs,
            duration: Math.round(1_000_000 / FPS),
        });
        videoEncoder.encode(frame, { keyFrame: fi % (FPS * 2) === 0 });
        frame.close();

        // Yield to event loop every 5 frames, report progress
        if (fi % 5 === 0) {
            await new Promise<void>(r => setTimeout(r, 0));
            const elapsed = (performance.now() - startTime) / 1000;
            const videoTime = fi / FPS;
            const speedX = elapsed > 0.5 ? videoTime / elapsed : 0;
            onProgress((fi / totalFrames) * 100, speedX);
        }
    }

    if (signal.aborted) {
        videoEncoder.close();
        audioEncoder.close();
        return;
    }

    // ── 8. Flush encoders, finalize muxer ────────────────────────────────────
    await videoEncoder.flush();
    await audioEncoder.flush();
    if (videoError) throw videoError;
    if (audioError) throw audioError;

    videoEncoder.close();
    audioEncoder.close();
    muxer.finalize();

    // ── 9. Trigger download ───────────────────────────────────────────────────
    const { buffer } = muxer.target as ArrayBufferTarget;
    const blob = new Blob([buffer], { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sonic-visualizer-${width}x${height}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);

    onProgress(100, 0);
}
