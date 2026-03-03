import { VisualizerSettings } from '../types';

export const drawCircularBars = (ctx: CanvasRenderingContext2D, data: Uint8Array, cx: number, cy: number, radius: number, s: VisualizerSettings) => {
    const bars = 180;
    const effectiveBars = s.mirror ? bars / 2 : bars;
    const step = Math.floor(data.length / effectiveBars);

    for (let i = 0; i < bars; i++) {
        let dataIndex;
        if (s.mirror) {
            if (i < bars / 2) dataIndex = i * step;
            else dataIndex = (bars - 1 - i) * step;
        } else {
            dataIndex = i * step;
        }

        const value = data[dataIndex] || 0;
        const percent = value / 255;
        const height = (percent * 150 * s.sensitivity) + 10;
        const angle = (i / bars) * Math.PI * 2 - Math.PI / 2;

        const x1 = cx + Math.cos(angle) * radius;
        const y1 = cy + Math.sin(angle) * radius;
        const x2 = cx + Math.cos(angle) * (radius + height);
        const y2 = cy + Math.sin(angle) * (radius + height);

        const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
        gradient.addColorStop(0, s.primaryColor);
        gradient.addColorStop(1, s.secondaryColor);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = s.barWidth;
        ctx.lineCap = 'round';
        ctx.stroke();
    }
};

export const drawCircularWave = (ctx: CanvasRenderingContext2D, data: Uint8Array, cx: number, cy: number, radius: number, s: VisualizerSettings) => {
    const points = 360;
    const effectivePoints = s.mirror ? points / 2 : points;
    const step = Math.floor(data.length / effectivePoints);

    // Draw a thin glowing stroke wave — no fill, no overlap with center
    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
        let dataIndex;
        if (s.mirror) {
            if (i < points / 2) dataIndex = i * step;
            else dataIndex = (points - i) * step;
        } else {
            dataIndex = i * step;
        }

        const value = data[dataIndex] || 0;
        const percent = value / 255;
        const offset = percent * 100 * s.sensitivity;
        const r = radius + offset;
        const angle = (i / points) * Math.PI * 2 - Math.PI / 2;

        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = s.primaryColor;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Second subtle inner wave ring
    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
        let dataIndex;
        if (s.mirror) {
            if (i < points / 2) dataIndex = i * step;
            else dataIndex = (points - i) * step;
        } else {
            dataIndex = (i * step + 40) % data.length;
        }
        const value = data[dataIndex] || 0;
        const percent = value / 255;
        const offset = percent * 50 * s.sensitivity;
        const r = radius + offset;
        const angle = (i / points) * Math.PI * 2 - Math.PI / 2;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = s.secondaryColor;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.4;
    ctx.stroke();
    ctx.globalAlpha = 1;
};

export const drawSpiral = (ctx: CanvasRenderingContext2D, data: Uint8Array, cx: number, cy: number, radius: number, s: VisualizerSettings) => {
    const points = 180;
    const step = Math.floor(data.length / points);

    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) { // 2 loops
        const dataIndex = (i % points) * step;
        const value = data[dataIndex] || 0;
        const percent = value / 255;

        const angle = (i / points) * Math.PI * 2;
        const spiralOffset = (i * 2); // Spiraling out
        const audioOffset = percent * 100 * s.sensitivity;

        const r = radius + spiralOffset + audioOffset;

        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }

    ctx.strokeStyle = s.primaryColor;
    ctx.lineWidth = s.barWidth;
    ctx.stroke();
};

export const drawParticles = (ctx: CanvasRenderingContext2D, data: Uint8Array, cx: number, cy: number, radius: number, particles: any[], s: VisualizerSettings) => {
    const bass = data[0];
    if (bass > 180 && Math.random() > 0.3) {
        for (let i = 0; i < 8; i++) {
            particles.push({
                x: cx,
                y: cy,
                angle: Math.random() * Math.PI * 2,
                speed: (Math.random() * 6 + 3) * (bass / 255),
                life: 1,
                color: Math.random() > 0.5 ? s.primaryColor : s.secondaryColor
            });
        }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += Math.cos(p.angle) * p.speed;
        p.y += Math.sin(p.angle) * p.speed;
        p.speed *= 0.97; // slow down
        p.life -= 0.018;

        if (p.life <= 0) { particles.splice(i, 1); continue; }

        const dist = Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2);
        if (dist > radius) {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2 + (1 - p.life) * 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    }

    // Draw a minimal pulse ring so there's always something to see
    let avgFreq = 0;
    for (let i = 0; i < 80; i++) avgFreq += data[i];
    avgFreq = avgFreq / 80;
    const pulseR = radius + (avgFreq / 255) * 60 * s.sensitivity;
    ctx.beginPath();
    ctx.arc(cx, cy, pulseR, 0, Math.PI * 2);
    ctx.strokeStyle = s.secondaryColor;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.3;
    ctx.stroke();
    ctx.globalAlpha = 1;
};

export const drawRing = (ctx: CanvasRenderingContext2D, data: Uint8Array, cx: number, cy: number, radius: number, s: VisualizerSettings) => {
    let bassTotal = 0;
    for (let i = 0; i < 20; i++) bassTotal += data[i];
    const bassAverage = bassTotal / 20;
    const pulseOffset = (bassAverage / 255) * 100 * s.sensitivity;

    ctx.beginPath();
    ctx.arc(cx, cy, radius + pulseOffset, 0, Math.PI * 2);
    ctx.strokeStyle = s.primaryColor;
    ctx.lineWidth = s.barWidth * 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, radius + pulseOffset + 15, 0, Math.PI * 2);
    ctx.strokeStyle = s.secondaryColor;
    ctx.lineWidth = s.barWidth;
    ctx.globalAlpha = 0.5;
    ctx.stroke();
    ctx.globalAlpha = 1;
};

export const drawStrings = (ctx: CanvasRenderingContext2D, data: Uint8Array, cx: number, cy: number, radius: number, s: VisualizerSettings) => {
    const points = 60;
    const step = Math.floor(data.length / points);
    const coords: { x: number, y: number }[] = [];

    for (let i = 0; i < points; i++) {
        const value = data[i * step] || 0;
        const percent = value / 255;
        const offset = percent * 80 * s.sensitivity;
        const r = radius + offset;
        const angle = (i / points) * Math.PI * 2;
        coords.push({
            x: cx + Math.cos(angle) * r,
            y: cy + Math.sin(angle) * r
        });
    }

    ctx.strokeStyle = s.primaryColor;
    ctx.lineWidth = 1;
    ctx.beginPath();

    // Connect every point to several other points across the circle
    for (let i = 0; i < points; i++) {
        for (let j = i + 1; j < points; j += 7) {
            if (Math.abs(i - j) > 3) {
                const p1 = coords[i];
                const p2 = coords[j];
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
            }
        }
    }
    ctx.stroke();

    // Outline
    ctx.strokeStyle = s.secondaryColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
        const p = coords[i % points];
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
};

export const drawOrbit = (ctx: CanvasRenderingContext2D, data: Uint8Array, cx: number, cy: number, radius: number, s: VisualizerSettings) => {
    const orbs = 24;
    const step = Math.floor(data.length / orbs);
    const time = Date.now() * 0.001;

    for (let i = 0; i < orbs; i++) {
        const value = data[i * step] || 0;
        const percent = value / 255;
        const dist = radius + 20 + (percent * 150 * s.sensitivity);
        const angle = (i / orbs) * Math.PI * 2 + (time * (i % 2 === 0 ? 1 : -1) * 0.5);

        const x = cx + Math.cos(angle) * dist;
        const y = cy + Math.sin(angle) * dist;

        ctx.beginPath();
        ctx.arc(x, y, 4 + percent * 10, 0, Math.PI * 2);
        ctx.fillStyle = i % 2 === 0 ? s.primaryColor : s.secondaryColor;
        ctx.fill();

        if (percent > 0.5) {
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(x, y);
            ctx.strokeStyle = s.primaryColor;
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.2;
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
    }

    // Base ring
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = s.secondaryColor;
    ctx.lineWidth = 2;
    ctx.stroke();
};

export const drawSpikes = (ctx: CanvasRenderingContext2D, data: Uint8Array, cx: number, cy: number, radius: number, s: VisualizerSettings) => {
    const count = s.mirror ? 90 : 180;
    const step = Math.floor(data.length / count);

    for (let i = 0; i < (s.mirror ? count / 2 : count) * (s.mirror ? 2 : 1); i++) {
        let dataIndex;
        if (s.mirror) {
            if (i < count) dataIndex = i * step;
            else dataIndex = (count * 2 - 1 - i) * step;
        } else {
            dataIndex = i * step;
        }
        const value = data[dataIndex] || 0;
        const percent = value / 255;
        const h = percent * 180 * s.sensitivity;
        if (h < 2) continue;
        const angle = (i / (s.mirror ? count * 2 : count)) * Math.PI * 2 - Math.PI / 2;
        const x1 = cx + Math.cos(angle) * radius;
        const y1 = cy + Math.sin(angle) * radius;
        const tipX = cx + Math.cos(angle) * (radius + h);
        const tipY = cy + Math.sin(angle) * (radius + h);
        // Triangle spike: tip + two base points rotated ±1 degree
        const w = 0.012; // spike width
        const lAngle = angle - w;
        const rAngle = angle + w;
        const lx = cx + Math.cos(lAngle) * (radius + 2);
        const ly = cy + Math.sin(lAngle) * (radius + 2);
        const rx = cx + Math.cos(rAngle) * (radius + 2);
        const ry = cy + Math.sin(rAngle) * (radius + 2);
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(lx, ly);
        ctx.lineTo(rx, ry);
        ctx.closePath();
        const grad = ctx.createLinearGradient(x1, y1, tipX, tipY);
        grad.addColorStop(0, s.secondaryColor);
        grad.addColorStop(1, s.primaryColor);
        ctx.fillStyle = grad;
        ctx.globalAlpha = 0.5 + percent * 0.5;
        ctx.fill();
    }
    ctx.globalAlpha = 1;
};

export const drawLaser = (ctx: CanvasRenderingContext2D, data: Uint8Array, cx: number, cy: number, radius: number, s: VisualizerSettings) => {
    const rays = 36;
    const step = Math.floor(data.length / rays);
    for (let i = 0; i < rays; i++) {
        const value = data[i * step] || 0;
        const percent = value / 255;
        if (percent < 0.05) continue;
        const len = radius + percent * 300 * s.sensitivity;
        const angle = (i / rays) * Math.PI * 2 - Math.PI / 2;

        // Outer glowing line
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
        ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
        ctx.strokeStyle = s.primaryColor;
        ctx.lineWidth = 1;
        ctx.globalAlpha = percent * 0.9;
        ctx.shadowBlur = 15;
        ctx.shadowColor = s.primaryColor;
        ctx.stroke();

        // Mirror
        if (s.mirror) {
            const mAngle = Math.PI - angle + Math.PI;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(mAngle) * radius, cy + Math.sin(mAngle) * radius);
            ctx.lineTo(cx + Math.cos(mAngle) * len, cy + Math.sin(mAngle) * len);
            ctx.stroke();
        }
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
};

export const drawNebula = (ctx: CanvasRenderingContext2D, data: Uint8Array, cx: number, cy: number, radius: number, nebParticles: any[], s: VisualizerSettings) => {
    let energy = 0;
    for (let i = 0; i < 60; i++) energy += data[i];
    energy = energy / 60 / 255;

    if (nebParticles.length < 200 && Math.random() < energy * 0.6) {
        const angle = Math.random() * Math.PI * 2;
        const spawnR = radius + Math.random() * 20;
        nebParticles.push({
            x: cx + Math.cos(angle) * spawnR,
            y: cy + Math.sin(angle) * spawnR,
            vx: Math.cos(angle) * (1 + energy * 4 * s.sensitivity) + (Math.random() - 0.5),
            vy: Math.sin(angle) * (1 + energy * 4 * s.sensitivity) + (Math.random() - 0.5),
            life: 1,
            size: 1.5 + Math.random() * 3,
            color: Math.random() > 0.5 ? s.primaryColor : s.secondaryColor
        });
    }

    for (let i = nebParticles.length - 1; i >= 0; i--) {
        const p = nebParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.98;
        p.vy *= 0.98;
        p.life -= 0.006;
        if (p.life <= 0) { nebParticles.splice(i, 1); continue; }
        ctx.globalAlpha = p.life * 0.8;
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
};

export const drawAura = (ctx: CanvasRenderingContext2D, data: Uint8Array, cx: number, cy: number, radius: number, s: VisualizerSettings) => {
    const points = 180;
    const effectivePoints = s.mirror ? points / 2 : points;
    const step = Math.floor(data.length / effectivePoints);

    ctx.beginPath();

    // Draw outer peaks
    for (let i = 0; i <= points; i++) {
        let dataIndex;
        if (s.mirror) {
            if (i <= points / 2) dataIndex = i * step;
            else dataIndex = (points - i) * step;
        } else {
            dataIndex = i * step;
        }

        const value = data[dataIndex] || 0;
        // Exponential scaling for flatter valleys and sharper peaks (Trap style)
        const percent = Math.pow(value / 255, 2.5);
        const height = percent * 200 * s.sensitivity;

        // Start at bottom (+ PI/2) so the main bass energy splits symmetrically downwards
        const angle = (i / points) * Math.PI * 2 + Math.PI / 2;
        const r = radius + height;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }

    // Connect back along the inner radius to form a continuous filled polygon
    ctx.arc(cx, cy, radius, Math.PI * 2 + Math.PI / 2, Math.PI / 2, true);
    ctx.closePath();

    // Create Gradient for fill
    const gradient = ctx.createLinearGradient(cx, cy - radius - 200, cx, cy + radius + 200);
    gradient.addColorStop(0, s.primaryColor);
    gradient.addColorStop(1, s.secondaryColor);

    ctx.fillStyle = gradient;
    ctx.fill();

    // White/Bright border on the outside
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.stroke();
};

export const drawPeaks = (ctx: CanvasRenderingContext2D, data: Uint8Array, cx: number, cy: number, radius: number, s: VisualizerSettings) => {
    const points = 180;
    const effectivePoints = s.mirror ? points / 2 : points;
    const step = Math.floor(data.length / effectivePoints);

    // Helper to draw a single sharp peak shape filled towards center
    const drawFilledLayer = (colorStr: string, heightScale: number, layerData: Uint8Array) => {
        ctx.beginPath();

        // Draw outer jagged peaks
        for (let i = 0; i <= points; i++) {
            let dataIndex;
            if (s.mirror) {
                if (i <= points / 2) dataIndex = i * step;
                else dataIndex = (points - i) * step;
            } else {
                dataIndex = i * step;
            }

            const value = layerData[dataIndex] || 0;
            // Keep it raw/sharp, no extreme smoothing like Aura
            const percent = value / 255;
            const height = percent * heightScale * s.sensitivity;

            // Start at top (-PI/2)
            const angle = (i / points) * Math.PI * 2 - Math.PI / 2;
            const r = radius + height;
            const x = cx + Math.cos(angle) * r;
            const y = cy + Math.sin(angle) * r;

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }

        // Connect back along the inner radius to form a continuous filled shape
        ctx.arc(cx, cy, radius, Math.PI * 2 - Math.PI / 2, -Math.PI / 2, true);
        ctx.closePath();

        // Outer Stroke
        ctx.strokeStyle = colorStr;
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'miter';
        ctx.stroke();

        // Inner fade fill
        ctx.fillStyle = colorStr;
        ctx.globalAlpha = 1.0; // Make fill semi-transparent
        ctx.fill();
        ctx.globalAlpha = 1.0;
    };

    // First layer: Background peaks (Secondary color, slightly taller/wider offset)
    // Shift data array reading slightly for visual separation
    const shiftedData = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) shiftedData[i] = data[(i + 15) % data.length];

    // Draw Secondary Layer Behind
    drawFilledLayer(s.secondaryColor, 180, shiftedData);

    // Draw Primary Layer in Front (shorter spikes)
    drawFilledLayer(s.primaryColor, 130, data);
};

// ── NEW: Diamond ──────────────────────────────────────────────────────────────
// Draws sharp diamond-facet bars arranged in a circle — each bar is a
// rotated square/rhombus that grows with the audio amplitude.
export const drawDiamond = (ctx: CanvasRenderingContext2D, data: Uint8Array, cx: number, cy: number, radius: number, s: VisualizerSettings) => {
    const count = 60;
    const step = Math.floor(data.length / count);
    for (let i = 0; i < count; i++) {
        const value = data[i * step] || 0;
        const percent = value / 255;
        const size = (6 + percent * 60 * s.sensitivity);
        const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
        const dist = radius + size * 0.5;
        const x = cx + Math.cos(angle) * dist;
        const y = cy + Math.sin(angle) * dist;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle + Math.PI / 4);

        const grad = ctx.createLinearGradient(-size, -size, size, size);
        grad.addColorStop(0, s.primaryColor);
        grad.addColorStop(1, s.secondaryColor);
        ctx.fillStyle = grad;
        ctx.globalAlpha = 0.4 + percent * 0.6;

        // Draw diamond (rotated square)
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(size, 0);
        ctx.lineTo(0, size);
        ctx.lineTo(-size, 0);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = s.primaryColor;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.8;
        ctx.stroke();
        ctx.restore();
    }
    ctx.globalAlpha = 1;
};

// ── NEW: Tunnel ───────────────────────────────────────────────────────────────
// Concentric rings that collapse/expand with bass — creates a zoom-tunnel effect.
export const drawTunnel = (ctx: CanvasRenderingContext2D, data: Uint8Array, cx: number, cy: number, radius: number, s: VisualizerSettings) => {
    const rings = 10;
    const time = Date.now() * 0.001;

    let bassTotal = 0;
    for (let i = 0; i < 30; i++) bassTotal += data[i];
    const bass = bassTotal / 30 / 255;

    for (let r = rings; r >= 1; r--) {
        const t = r / rings;
        // Rings oscillate with time + bass
        const oscillate = Math.sin(time * 2 + r) * 10 * bass * s.sensitivity;
        const ringRadius = (radius * 0.15 * r) + oscillate;
        if (ringRadius <= 0) continue;

        const avgStart = Math.floor((r / rings) * data.length * 0.5);
        let bandAvg = 0;
        for (let k = 0; k < 8; k++) bandAvg += data[avgStart + k] || 0;
        bandAvg = bandAvg / 8 / 255;

        // Alternate primary/secondary per ring
        const color = r % 2 === 0 ? s.primaryColor : s.secondaryColor;
        ctx.beginPath();
        ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1 + bandAvg * 4 * s.sensitivity;
        ctx.globalAlpha = t * (0.3 + bandAvg * 0.7);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
};

// ── NEW: Frequency ────────────────────────────────────────────────────────────
// Classic linear spectrum displayed as a halo of vertical bars radiating
// from a semicircle — like a frequency analyser wrapped around the circle.
export const drawFrequency = (ctx: CanvasRenderingContext2D, data: Uint8Array, cx: number, cy: number, radius: number, s: VisualizerSettings) => {
    const bars = 128;
    const step = Math.floor(data.length / bars);
    const spread = Math.PI; // half circle, then mirrored

    for (let pass = 0; pass < 2; pass++) {
        const flip = pass === 0 ? 1 : -1;
        for (let i = 0; i < bars; i++) {
            const value = data[i * step] || 0;
            const percent = value / 255;
            const barH = percent * 120 * s.sensitivity;
            if (barH < 1) continue;

            const angle = (i / bars) * spread * flip - Math.PI / 2;
            const x1 = cx + Math.cos(angle) * radius;
            const y1 = cy + Math.sin(angle) * radius;
            const x2 = cx + Math.cos(angle) * (radius + barH);
            const y2 = cy + Math.sin(angle) * (radius + barH);

            const grad = ctx.createLinearGradient(x1, y1, x2, y2);
            grad.addColorStop(0, s.secondaryColor);
            grad.addColorStop(1, s.primaryColor);

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.strokeStyle = grad;
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.globalAlpha = 0.5 + percent * 0.5;
            ctx.stroke();
        }
    }
    ctx.globalAlpha = 1;
};

// ── NEW: Fractal ──────────────────────────────────────────────────────────────
// Recursive branching tree that sprouts from the circle edge,
// branch length driven by different frequency bands.
export const drawFractal = (ctx: CanvasRenderingContext2D, data: Uint8Array, cx: number, cy: number, radius: number, s: VisualizerSettings) => {
    const arms = 6;
    const maxDepth = 4;

    const getBand = (start: number, len: number) => {
        let sum = 0;
        for (let i = start; i < start + len && i < data.length; i++) sum += data[i];
        return sum / len / 255;
    };

    const drawBranch = (
        x: number, y: number,
        angle: number, length: number,
        depth: number, alpha: number
    ) => {
        if (depth === 0 || length < 2) return;
        const endX = x + Math.cos(angle) * length;
        const endY = y + Math.sin(angle) * length;

        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = depth % 2 === 0 ? s.primaryColor : s.secondaryColor;
        ctx.lineWidth = depth * 0.8;
        ctx.globalAlpha = alpha;
        ctx.stroke();

        const spread = 0.45 + getBand(depth * 10, 8) * 0.4;
        const nextLen = length * 0.62;
        drawBranch(endX, endY, angle - spread, nextLen, depth - 1, alpha * 0.75);
        drawBranch(endX, endY, angle + spread, nextLen, depth - 1, alpha * 0.75);
    };

    for (let i = 0; i < arms; i++) {
        const armAngle = (i / arms) * Math.PI * 2 - Math.PI / 2;
        const band = getBand(i * 20, 20);
        const length = (30 + band * 80) * s.sensitivity;
        const startX = cx + Math.cos(armAngle) * radius;
        const startY = cy + Math.sin(armAngle) * radius;
        drawBranch(startX, startY, armAngle, length, maxDepth, 0.9);
    }
    ctx.globalAlpha = 1;
};

// ── NEW: Helix ────────────────────────────────────────────────────────────────
// Double-helix (DNA strand) rotating around the circle, strand thickness
// and separation driven by audio.
export const drawHelix = (ctx: CanvasRenderingContext2D, data: Uint8Array, cx: number, cy: number, radius: number, s: VisualizerSettings) => {
    const points = 200;
    const time = Date.now() * 0.001;
    const step = Math.floor(data.length / points);

    for (let strand = 0; strand < 2; strand++) {
        const phaseOffset = strand * Math.PI;
        ctx.beginPath();
        for (let i = 0; i <= points; i++) {
            const value = data[(i * step) % data.length] || 0;
            const amp = (value / 255) * 40 * s.sensitivity;
            const circleAngle = (i / points) * Math.PI * 2 - Math.PI / 2;
            const helixAngle = (i / points) * Math.PI * 6 + time * 1.5 + phaseOffset;
            const helixOffset = Math.sin(helixAngle) * (12 + amp);
            // Perpendicular offset direction
            const perpX = -Math.sin(circleAngle);
            const perpY = Math.cos(circleAngle);
            const r = radius + helixOffset;
            const x = cx + Math.cos(circleAngle) * r + perpX * helixOffset * 0.3;
            const y = cy + Math.sin(circleAngle) * r + perpY * helixOffset * 0.3;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = strand === 0 ? s.primaryColor : s.secondaryColor;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.85;
        ctx.stroke();
    }

    // Cross-links between strands on beats
    let bass = 0;
    for (let i = 0; i < 20; i++) bass += data[i];
    bass = bass / 20 / 255;
    ctx.strokeStyle = s.primaryColor;
    ctx.lineWidth = 1;
    ctx.globalAlpha = bass * 0.5;
    for (let i = 0; i < points; i += 12) {
        const circleAngle = (i / points) * Math.PI * 2 - Math.PI / 2;
        const helixAngle = (i / points) * Math.PI * 6 + time * 1.5;
        const off1 = Math.sin(helixAngle) * 14;
        const off2 = Math.sin(helixAngle + Math.PI) * 14;
        const x1 = cx + Math.cos(circleAngle) * (radius + off1);
        const y1 = cy + Math.sin(circleAngle) * (radius + off1);
        const x2 = cx + Math.cos(circleAngle) * (radius + off2);
        const y2 = cy + Math.sin(circleAngle) * (radius + off2);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
};

// ── NEW: Constellation ────────────────────────────────────────────────────────
// Star field with lines connecting nearby stars; star brightness/size
// driven by frequency bands.
export const drawConstellation = (ctx: CanvasRenderingContext2D, data: Uint8Array, cx: number, cy: number, radius: number, s: VisualizerSettings) => {
    const starCount = 40;
    const step = Math.floor(data.length / starCount);
    // Deterministic star positions based on index
    const stars: { x: number; y: number; brightness: number }[] = [];

    for (let i = 0; i < starCount; i++) {
        const value = data[i * step] || 0;
        const percent = value / 255;
        // Spread stars across the ring area
        const seed = (i * 2.5) % (Math.PI * 2);
        const dist = radius * (0.9 + (((i * 137) % 60) / 60) * 0.8 * s.sensitivity * percent);
        const angle = seed + (i / starCount) * Math.PI * 2;
        stars.push({
            x: cx + Math.cos(angle) * dist,
            y: cy + Math.sin(angle) * dist,
            brightness: 0.3 + percent * 0.7,
        });
    }

    // Draw connecting lines between nearby stars
    ctx.strokeStyle = s.secondaryColor;
    ctx.lineWidth = 0.5;
    for (let i = 0; i < stars.length; i++) {
        for (let j = i + 1; j < stars.length; j++) {
            const dx = stars[i].x - stars[j].x;
            const dy = stars[i].y - stars[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 80) {
                ctx.globalAlpha = (1 - dist / 80) * Math.min(stars[i].brightness, stars[j].brightness) * 0.5;
                ctx.beginPath();
                ctx.moveTo(stars[i].x, stars[i].y);
                ctx.lineTo(stars[j].x, stars[j].y);
                ctx.stroke();
            }
        }
    }

    // Draw stars
    for (const star of stars) {
        ctx.beginPath();
        ctx.arc(star.x, star.y, 1.5 + star.brightness * 3, 0, Math.PI * 2);
        ctx.fillStyle = star.brightness > 0.6 ? s.primaryColor : s.secondaryColor;
        ctx.globalAlpha = star.brightness;
        ctx.fill();
    }
    ctx.globalAlpha = 1;
};

// ── NEW: Lightning ────────────────────────────────────────────────────────────
// Electric bolts branch outward from the circle edge on bass hits.
export const drawLightning = (ctx: CanvasRenderingContext2D, data: Uint8Array, cx: number, cy: number, radius: number, s: VisualizerSettings) => {
    const boltCount = 8;
    const step = Math.floor(data.length / boltCount);

    const drawBolt = (x1: number, y1: number, x2: number, y2: number, depth: number, alpha: number) => {
        if (depth === 0) return;
        const mx = (x1 + x2) / 2 + (Math.random() - 0.5) * (40 / depth);
        const my = (y1 + y2) / 2 + (Math.random() - 0.5) * (40 / depth);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(mx, my);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = depth === 3 ? s.primaryColor : s.secondaryColor;
        ctx.lineWidth = depth * 0.8;
        ctx.globalAlpha = alpha;
        ctx.stroke();
        if (Math.random() > 0.4) {
            const branchX = mx + (Math.random() - 0.5) * 30;
            const branchY = my + (Math.random() - 0.5) * 30;
            drawBolt(mx, my, branchX, branchY, depth - 1, alpha * 0.6);
        }
        drawBolt(mx, my, x2, y2, depth - 1, alpha * 0.8);
    };

    for (let i = 0; i < boltCount; i++) {
        const value = data[i * step] || 0;
        const percent = value / 255;
        if (percent < 0.3) continue;
        const angle = (i / boltCount) * Math.PI * 2 - Math.PI / 2;
        const startX = cx + Math.cos(angle) * radius;
        const startY = cy + Math.sin(angle) * radius;
        const len = 30 + percent * 80 * s.sensitivity;
        const endX = cx + Math.cos(angle) * (radius + len);
        const endY = cy + Math.sin(angle) * (radius + len);
        drawBolt(startX, startY, endX, endY, 3, 0.7 + percent * 0.3);
    }
    ctx.globalAlpha = 1;
};

// ── NEW: Waveform ─────────────────────────────────────────────────────────────
// Classic oscilloscope-style waveform wrapped around the circle.
export const drawWaveform = (ctx: CanvasRenderingContext2D, data: Uint8Array, cx: number, cy: number, radius: number, s: VisualizerSettings) => {
    const points = 256;

    // Inner ring (time-domain waveform shape)
    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
        const idx = Math.floor((i / points) * data.length);
        const value = data[idx] || 0;
        // Center waveform: map 0-255 → -1 to +1
        const amp = ((value / 255) - 0.5) * 2 * 60 * s.sensitivity;
        const angle = (i / points) * Math.PI * 2 - Math.PI / 2;
        const r = radius + amp;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();

    const grad = ctx.createLinearGradient(cx - radius, cy, cx + radius, cy);
    grad.addColorStop(0, s.primaryColor);
    grad.addColorStop(0.5, s.secondaryColor);
    grad.addColorStop(1, s.primaryColor);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.9;
    ctx.stroke();

    // Outer echo ring
    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
        const idx = Math.floor((i / points) * data.length);
        const value = data[idx] || 0;
        const amp = ((value / 255) - 0.5) * 2 * 30 * s.sensitivity;
        const angle = (i / points) * Math.PI * 2 - Math.PI / 2;
        const r = radius + 15 + amp;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = s.secondaryColor;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;
    ctx.stroke();
    ctx.globalAlpha = 1;
};

// ── NEW: Prism ────────────────────────────────────────────────────────────────
// Layered concentric frequency bands, each colored by its position in
// the spectrum — bass at bottom, treble at top.
export const drawPrism = (ctx: CanvasRenderingContext2D, data: Uint8Array, cx: number, cy: number, radius: number, s: VisualizerSettings) => {
    const bands = 6;
    const bandSize = Math.floor(data.length / (bands * 2));

    const hslToHex = (h: number, sat: number, l: number) => {
        const a = sat * Math.min(l, 1 - l);
        const f = (n: number) => {
            const k = (n + h / 30) % 12;
            const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
            return Math.round(255 * color).toString(16).padStart(2, '0');
        };
        return `#${f(0)}${f(8)}${f(4)}`;
    };

    for (let b = 0; b < bands; b++) {
        let bandAvg = 0;
        const start = b * bandSize;
        for (let i = start; i < start + bandSize; i++) bandAvg += data[i] || 0;
        bandAvg = bandAvg / bandSize / 255;

        const height = bandAvg * 80 * s.sensitivity;
        if (height < 1) continue;

        const innerR = radius + b * 6;
        const outerR = innerR + height;

        // Hue spans the color wheel across bands
        const hue = (b / bands) * 300 + (Date.now() * 0.02 % 360);
        const color = hslToHex(hue % 360, 1, 0.55);

        ctx.beginPath();
        ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
        ctx.arc(cx, cy, innerR, 0, Math.PI * 2, true);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.15 + bandAvg * 0.5;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.6 + bandAvg * 0.4;
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
};

