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
