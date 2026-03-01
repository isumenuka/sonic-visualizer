// Helper to extract colors from an image
export const extractColors = (imgSrc: string): Promise<[string, string]> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = imgSrc;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return resolve(['#00ffff', '#ff00ff']);

            canvas.width = 100;
            canvas.height = 100;
            ctx.drawImage(img, 0, 0, 100, 100);

            const imageData = ctx.getImageData(0, 0, 100, 100).data;
            let r = 0, g = 0, b = 0;
            let count = 0;

            // Simple average for primary
            for (let i = 0; i < imageData.length; i += 4) {
                r += imageData[i];
                g += imageData[i + 1];
                b += imageData[i + 2];
                count++;
            }

            const toHex = (c: number) => {
                const hex = Math.round(c).toString(16);
                return hex.length === 1 ? '0' + hex : hex;
            };

            const avgR = r / count;
            const avgG = g / count;
            const avgB = b / count;

            const primary = `#${toHex(avgR)}${toHex(avgG)}${toHex(avgB)}`;

            // Generate a complementary/secondary color (simple shift)
            // Shift hue by 180 degrees roughly by inverting or shifting RGB
            const secR = (avgR + 128) % 255;
            const secG = (avgG + 80) % 255;
            const secB = (avgB + 200) % 255;

            const secondary = `#${toHex(secR)}${toHex(secG)}${toHex(secB)}`;

            resolve([primary, secondary]);
        };
        img.onerror = () => resolve(['#00ffff', '#ff00ff']);
    });
};
