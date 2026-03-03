/**
 * Extracts the 2 most dominant, vibrant colors from an image
 * using a simple k-means clustering over sampled pixels.
 * Skips near-black and near-white pixels to keep results vivid.
 */
export const extractColors = (imgSrc: string): Promise<[string, string]> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.src = imgSrc;

        img.onload = () => {
            const canvas = document.createElement('canvas');
            const SIZE = 80; // downsample for speed
            canvas.width = SIZE;
            canvas.height = SIZE;
            const ctx = canvas.getContext('2d');
            if (!ctx) return resolve(['#00ffff', '#ff00ff']);

            ctx.drawImage(img, 0, 0, SIZE, SIZE);
            const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

            // ── Collect vibrant pixels ──────────────────────────────────────
            const pixels: [number, number, number][] = [];
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
                if (a < 128) continue; // skip transparent

                // Skip near-black (all channels dark)
                const brightness = (r + g + b) / 3;
                if (brightness < 30) continue;
                // Skip near-white (all channels bright)
                if (brightness > 230 && Math.max(r, g, b) - Math.min(r, g, b) < 20) continue;

                pixels.push([r, g, b]);
            }

            if (pixels.length < 6) return resolve(['#00ffff', '#ff00ff']);

            // ── K-means with k=2, 12 iterations ────────────────────────────
            // Seed centroids by spreading across the pixel array
            let c1 = pixels[0];
            let c2 = pixels[Math.floor(pixels.length / 2)];

            for (let iter = 0; iter < 12; iter++) {
                let s1 = [0, 0, 0], n1 = 0;
                let s2 = [0, 0, 0], n2 = 0;

                for (const [r, g, b] of pixels) {
                    const d1 = colorDist([r, g, b], c1);
                    const d2 = colorDist([r, g, b], c2);
                    if (d1 <= d2) {
                        s1[0] += r; s1[1] += g; s1[2] += b; n1++;
                    } else {
                        s2[0] += r; s2[1] += g; s2[2] += b; n2++;
                    }
                }

                if (n1 > 0) c1 = [s1[0] / n1, s1[1] / n1, s1[2] / n1];
                if (n2 > 0) c2 = [s2[0] / n2, s2[1] / n2, s2[2] / n2];
            }

            // ── Boost saturation so it looks vivid on the visualizer ────────
            const primary = boostSaturation(c1, 1.4);
            let secondary = boostSaturation(c2, 1.4);

            // ── Guarantee the two colors are visually distinct ──────────────
            // If they're too close in RGB space, rotate the secondary hue by 150°
            if (colorDist(c1, c2) < 80 * 80) {
                secondary = rotateHue(primary, 150);
            }

            resolve([primary, secondary]);
        };

        img.onerror = () => resolve(['#00ffff', '#ff00ff']);
    });
};

// Squared Euclidean distance in RGB space
const colorDist = (a: [number, number, number], b: [number, number, number]) =>
    (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

// Rotates a hex color's hue by `degrees` and returns a new hex string
const rotateHue = (hex: string, degrees: number): string => {
    // Parse hex to RGB
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }

    h = (h + degrees / 360) % 1;
    if (h < 0) h += 1;
    // Keep saturation high & lightness in vivid range
    s = Math.max(s, 0.5);
    const lOut = Math.min(0.65, Math.max(0.35, l));

    const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1; if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
    };

    const q = lOut < 0.5 ? lOut * (1 + s) : lOut + s - lOut * s;
    const p = 2 * lOut - q;
    const toHex = (v: number) => { const x = Math.round(v * 255).toString(16); return x.length === 1 ? '0' + x : x; };
    return `#${toHex(hue2rgb(p, q, h + 1 / 3))}${toHex(hue2rgb(p, q, h))}${toHex(hue2rgb(p, q, h - 1 / 3))}`;
};

// Converts RGB → HSL, multiplies S by factor, converts back, returns hex
const boostSaturation = ([r, g, b]: [number, number, number], factor: number): string => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }

    s = Math.min(1, s * factor);
    const lOut = Math.min(0.65, Math.max(0.35, l)); // clamp lightness to readable range

    // HSL → RGB
    const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1; if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
    };

    let rOut, gOut, bOut;
    if (s === 0) {
        rOut = gOut = bOut = lOut;
    } else {
        const q = lOut < 0.5 ? lOut * (1 + s) : lOut + s - lOut * s;
        const p = 2 * lOut - q;
        rOut = hue2rgb(p, q, h + 1 / 3);
        gOut = hue2rgb(p, q, h);
        bOut = hue2rgb(p, q, h - 1 / 3);
    }

    const toHex = (v: number) => {
        const hex = Math.round(v * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(rOut)}${toHex(gOut)}${toHex(bOut)}`;
};
