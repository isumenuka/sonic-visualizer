/**
 * Server-side frame renderer — mirrors the browser visualizer exactly.
 * Uses node-canvas 2D API (same interface as browser CanvasRenderingContext2D).
 */

// ─── FFT ──────────────────────────────────────────────────────────────────────

function computeFFT(real, imag) {
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

export function getByteFrequencyData(pcm, offset, fftSize, smoothed) {
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

// ─── Visualizer drawing ───────────────────────────────────────────────────────

function drawCircularBars(ctx, data, cX, cY, radius, s) {
    const count = Math.min(data.length, s.mirror ? 90 : 180);
    const step = (2 * Math.PI) / (s.mirror ? count * 2 : count);
    ctx.lineWidth = s.barWidth;
    for (let i = 0; i < count; i++) {
        const amp = (data[i] / 255) * s.sensitivity;
        const barLen = amp * radius * 0.8;
        const angle = i * step - Math.PI / 2;
        const x1 = cX + Math.cos(angle) * radius;
        const y1 = cY + Math.sin(angle) * radius;
        const x2 = cX + Math.cos(angle) * (radius + barLen);
        const y2 = cY + Math.sin(angle) * (radius + barLen);
        const grad = ctx.createLinearGradient(x1, y1, x2, y2);
        grad.addColorStop(0, s.primaryColor);
        grad.addColorStop(1, s.secondaryColor);
        ctx.strokeStyle = grad;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        if (s.mirror) {
            const ma = -i * step - Math.PI / 2;
            const mx1 = cX + Math.cos(ma) * radius;
            const my1 = cY + Math.sin(ma) * radius;
            const mx2 = cX + Math.cos(ma) * (radius + barLen);
            const my2 = cY + Math.sin(ma) * (radius + barLen);
            ctx.beginPath(); ctx.moveTo(mx1, my1); ctx.lineTo(mx2, my2); ctx.stroke();
        }
    }
}

function drawCircularWave(ctx, data, cX, cY, radius, s) {
    const count = data.length;
    ctx.strokeStyle = s.primaryColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= count; i++) {
        const amp = (data[i % count] / 255) * s.sensitivity;
        const r = radius + amp * radius * 0.5;
        const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
        const x = cX + Math.cos(angle) * r;
        const y = cY + Math.sin(angle) * r;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.stroke();
}

function drawRing(ctx, data, cX, cY, radius, s) {
    const count = Math.min(data.length, 128);
    for (let i = 0; i < count; i++) {
        const amp = (data[i] / 255) * s.sensitivity;
        const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
        const r = radius + amp * 40;
        const x = cX + Math.cos(angle) * r;
        const y = cY + Math.sin(angle) * r;
        const size = 1 + amp * 4;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, 2 * Math.PI);
        ctx.fillStyle = i < count / 2 ? s.primaryColor : s.secondaryColor;
        ctx.fill();
    }
}

function drawSpiral(ctx, data, cX, cY, radius, s) {
    ctx.strokeStyle = s.primaryColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
        const amp = (data[i] / 255) * s.sensitivity;
        const angle = (i / data.length) * 6 * Math.PI;
        const r = (radius * 0.3) + (i / data.length) * radius * 0.7 + amp * 30;
        const x = cX + Math.cos(angle) * r;
        const y = cY + Math.sin(angle) * r;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
}

function drawSpikes(ctx, data, cX, cY, radius, s) {
    const count = Math.min(data.length, 64);
    for (let i = 0; i < count; i++) {
        const amp = (data[i] / 255) * s.sensitivity;
        const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
        const len = amp * radius;
        const x1 = cX + Math.cos(angle) * radius;
        const y1 = cY + Math.sin(angle) * radius;
        const x2 = cX + Math.cos(angle) * (radius + len);
        const y2 = cY + Math.sin(angle) * (radius + len);
        ctx.strokeStyle = amp > 0.7 ? s.secondaryColor : s.primaryColor;
        ctx.lineWidth = 1.5 + amp * 3;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
}

function drawAura(ctx, data, cX, cY, radius, s) {
    let avg = 0;
    for (let i = 0; i < 32; i++) avg += data[i];
    avg = (avg / 32 / 255) * s.sensitivity;
    for (let layer = 3; layer >= 0; layer--) {
        const r = radius * (0.8 + layer * 0.15) + avg * 50;
        const alpha = (0.15 - layer * 0.03) * (1 + avg);
        const grad = ctx.createRadialGradient(cX, cY, r * 0.5, cX, cY, r);
        const col = layer % 2 === 0 ? s.primaryColor : s.secondaryColor;
        grad.addColorStop(0, col + Math.round(alpha * 255).toString(16).padStart(2, '0'));
        grad.addColorStop(1, col + '00');
        ctx.beginPath(); ctx.arc(cX, cY, r, 0, 2 * Math.PI);
        ctx.fillStyle = grad; ctx.fill();
    }
}

function drawPeaks(ctx, data, cX, cY, radius, s) {
    const count = Math.min(data.length, 120);
    for (let i = 0; i < count; i++) {
        const amp = (data[i] / 255) * s.sensitivity;
        const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
        const inner = radius;
        const outer = radius + amp * radius * 0.6;
        const x1 = cX + Math.cos(angle) * inner;
        const y1 = cY + Math.sin(angle) * inner;
        const x2 = cX + Math.cos(angle) * outer;
        const y2 = cY + Math.sin(angle) * outer;
        const grad = ctx.createLinearGradient(x1, y1, x2, y2);
        grad.addColorStop(0, s.primaryColor);
        grad.addColorStop(1, s.secondaryColor);
        ctx.fillStyle = grad;
        const bw = (2 * Math.PI * radius / count) * 0.7;
        const px1 = cX + Math.cos(angle - bw / (2 * radius)) * inner;
        const py1 = cY + Math.sin(angle - bw / (2 * radius)) * inner;
        const px2 = cX + Math.cos(angle + bw / (2 * radius)) * inner;
        const py2 = cY + Math.sin(angle + bw / (2 * radius)) * inner;
        ctx.beginPath();
        ctx.moveTo(px1, py1); ctx.lineTo(x2, y2); ctx.lineTo(px2, py2);
        ctx.closePath(); ctx.fill();
    }
}

// ─── Main frame render ────────────────────────────────────────────────────────

export function renderFrame(ctx, W, H, dataArray, settings, state) {
    const s = settings;
    const cX = W / 2, cY = H / 2;

    // Clear / trail
    if (s.trailEnabled) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'source-over';
    } else {
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, W, H);
    }

    // Bass for pulse
    let bassT = 0, maxBass = 0;
    for (let i = 0; i < 20; i++) { bassT += dataArray[i]; if (dataArray[i] > maxBass) maxBass = dataArray[i]; }
    const pScale = s.pulseEnabled ? 1 + (bassT / 20 / 255) * 0.2 : 1;
    const radius = s.radius * pScale;

    state.rotation += s.rotationSpeed * 0.01;
    if (s.colorCycle) state.colorCycleHue = (state.colorCycleHue + 0.5) % 360;

    ctx.save();
    if (s.invertColors) ctx.filter = 'invert(1) hue-rotate(180deg)';
    ctx.translate(cX, cY); ctx.rotate(state.rotation); ctx.translate(-cX, -cY);
    if (s.glowEnabled) { ctx.shadowBlur = 20; ctx.shadowColor = s.colorCycle ? `hsl(${state.colorCycleHue},100%,60%)` : s.primaryColor; }

    const vPrimary = s.colorCycle ? `hsl(${state.colorCycleHue},100%,60%)` : s.primaryColor;
    const vSecondary = s.colorCycle ? `hsl(${(state.colorCycleHue + 120) % 360},100%,60%)` : s.secondaryColor;
    const vs = s.colorCycle ? { ...s, primaryColor: vPrimary, secondaryColor: vSecondary } : s;

    const drawViz = (sm, a) => {
        ctx.save();
        ctx.translate(cX, cY); ctx.scale(sm, sm); ctx.translate(-cX, -cY);
        ctx.globalAlpha = a;
        if (s.type === 'bars') drawCircularBars(ctx, dataArray, cX, cY, radius, vs);
        else if (s.type === 'wave') drawCircularWave(ctx, dataArray, cX, cY, radius, vs);
        else if (s.type === 'spiral') drawSpiral(ctx, dataArray, cX, cY, radius, vs);
        else if (s.type === 'ring') drawRing(ctx, dataArray, cX, cY, radius, vs);
        else if (s.type === 'spikes') drawSpikes(ctx, dataArray, cX, cY, radius, vs);
        else if (s.type === 'aura') drawAura(ctx, dataArray, cX, cY, radius, vs);
        else if (s.type === 'peaks') drawPeaks(ctx, dataArray, cX, cY, radius, vs);
        else drawCircularBars(ctx, dataArray, cX, cY, radius, vs); // default
        ctx.restore();
    };

    drawViz(1, 1);
    if (s.echoEnabled) { drawViz(1.2, 0.3); drawViz(1.5, 0.1); }
    ctx.shadowBlur = 0;

    // Center circle
    ctx.beginPath(); ctx.arc(cX, cY, radius - 5, 0, 2 * Math.PI);
    ctx.fillStyle = s.centerColor; ctx.fill();

    // Center text
    if (s.centerMode === 'text' && s.centerText) {
        ctx.font = `bold ${s.centerTextSize * pScale}px sans-serif`;
        ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowBlur = 10; ctx.shadowColor = s.primaryColor;
        ctx.fillText(s.centerText, cX, cY);
        ctx.shadowBlur = 0;
    }

    // Outer ring
    ctx.strokeStyle = s.primaryColor; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cX, cY, radius - 5, 0, 2 * Math.PI); ctx.stroke();
    ctx.restore();
}
