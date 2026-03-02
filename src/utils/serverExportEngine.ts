/// <reference types="vite/client" />
/**
 * Server-Side Export Engine
 * Sends audio + settings to the Render.com /render API.
 * The server renders frames with node-canvas + native FFmpeg and streams back an MP4.
 */

export interface ServerExportOptions {
    audioFile: File;
    quality: '1080p' | '2k' | '4k';
    aspectRatio?: '16:9' | '9:16';
    settings: object;
    onProgress: (pct: number, stage: string) => void;
    signal: AbortSignal;
}

export async function exportWithServer(options: ServerExportOptions): Promise<void> {
    const { audioFile, quality, aspectRatio, settings, onProgress, signal } = options;

    const baseUrl = import.meta.env.VITE_FFMPEG_BASE_URL;
    if (!baseUrl) {
        throw new Error('VITE_FFMPEG_BASE_URL is not configured. Set it in Vercel → Environment Variables to your Render.com service URL.');
    }

    const renderUrl = `${baseUrl.replace(/\/$/, '')}/render`;

    // ── Build multipart form ──────────────────────────────────────────────────
    const form = new FormData();
    form.append('audio', audioFile, audioFile.name);
    form.append('settings', JSON.stringify(settings));
    form.append('quality', quality);
    form.append('aspect', aspectRatio ?? '16:9');

    // ── Upload + wait for server to finish rendering ──────────────────────────
    onProgress(0, 'Uploading audio to render server…');

    const response = await new Promise<Response>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', renderUrl, true);
        xhr.responseType = 'blob';

        // Report upload progress (0-40%)
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const pct = (e.loaded / e.total) * 40;
                onProgress(pct, `Uploading… ${Math.round(pct)}%`);
            }
        };

        // After upload completes, server is rendering (40-95%)
        xhr.upload.onload = () => {
            onProgress(40, 'Server rendering video…');
            // Simulate progress while server works — we don't get server-side progress
            let fake = 40;
            const iv = setInterval(() => {
                fake = Math.min(fake + 0.5, 90);
                onProgress(fake, 'Server encoding video…');
            }, 1000);
            (xhr as any)._fakeProgressInterval = iv;
        };

        xhr.onload = () => {
            clearInterval((xhr as any)._fakeProgressInterval);
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(new Response(xhr.response, {
                    status: xhr.status,
                    headers: { 'Content-Type': xhr.getResponseHeader('Content-Type') || 'video/mp4' },
                }));
            } else {
                // Try to parse error JSON from blob
                const blob = xhr.response as Blob;
                blob.text().then(text => {
                    try { reject(new Error(JSON.parse(text).error || text)); }
                    catch { reject(new Error(`Server returned ${xhr.status}: ${text.slice(0, 200)}`)); }
                });
            }
        };

        xhr.onerror = () => {
            clearInterval((xhr as any)._fakeProgressInterval);
            reject(new Error('Network error — could not reach render server. Is VITE_FFMPEG_BASE_URL correct?'));
        };

        xhr.onabort = () => {
            clearInterval((xhr as any)._fakeProgressInterval);
            reject(new DOMException('Export cancelled', 'AbortError'));
        };

        signal.addEventListener('abort', () => xhr.abort());

        xhr.send(form);
    });

    if (signal.aborted) return;

    onProgress(95, 'Downloading video…');

    // ── Trigger browser download ──────────────────────────────────────────────
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sonic-visualizer-${quality}.mp4`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);

    onProgress(100, 'Done!');
}
