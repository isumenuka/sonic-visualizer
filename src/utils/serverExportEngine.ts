/// <reference types="vite/client" />
/**
 * Server-Side Export Engine v2 — Async Job Polling
 *
 * Flow:
 *   1. POST /render  → server returns { jobId } immediately (no timeout)
 *   2. Poll GET /status/:jobId every 3 seconds until status === 'done' | 'error'
 *   3. GET /download/:jobId → download the finished MP4
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

    // VITE_CLOUD_RUN_URL = Google Cloud Run server URL
    const baseUrl = import.meta.env.VITE_CLOUD_RUN_URL;
    if (!baseUrl) {
        throw new Error(
            'No render server configured. Set VITE_CLOUD_RUN_URL in Vercel → Environment Variables ' +
            '(your Google Cloud Run URL, e.g. https://sonic-render-xxxx-uc.a.run.app)'
        );
    }
    const root = baseUrl.replace(/\/$/, '');
    console.log(`[Cloud Export] Using Google Cloud Run: ${root}`);

    // ── 1. Upload audio + settings → get jobId ───────────────────────────────
    onProgress(0, 'Uploading audio…');
    const form = new FormData();
    form.append('audio', audioFile, audioFile.name);
    form.append('settings', JSON.stringify(settings));
    form.append('quality', quality);
    form.append('aspect', aspectRatio ?? '16:9');

    // Upload via XHR for progress events
    const jobId = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${root}/render`, true);
        xhr.responseType = 'json';

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                onProgress((e.loaded / e.total) * 30, 'Uploading audio…');
            }
        };

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                const data = xhr.response as { jobId?: string; error?: string };
                if (data?.jobId) resolve(data.jobId);
                else reject(new Error(data?.error || 'Server did not return a job ID'));
            } else {
                const msg = typeof xhr.response === 'object' ? xhr.response?.error : xhr.responseText;
                reject(new Error(`Upload failed (${xhr.status}): ${msg}`));
            }
        };
        xhr.onerror = () => reject(new Error('Network error — could not reach Cloud Run server. Is VITE_CLOUD_RUN_URL correct?'));
        xhr.onabort = () => reject(new DOMException('Export cancelled', 'AbortError'));

        signal.addEventListener('abort', () => xhr.abort());
        xhr.send(form);
    });

    if (signal.aborted) return;
    onProgress(30, 'Server rendering…');
    console.log('[Cloud Export] Job started:', jobId);

    // ── 2. Poll /status/:jobId until done ────────────────────────────────────
    const POLL_MS = 3000; // every 3 seconds
    while (!signal.aborted) {
        await new Promise(r => setTimeout(r, POLL_MS));
        if (signal.aborted) return;

        const statusRes = await fetch(`${root}/status/${jobId}`, { signal });
        const statusData = (await statusRes.json()) as { status: string; progress: number; error?: string };

        if (statusData.status === 'error') {
            throw new Error(`Server render failed: ${statusData.error || 'Unknown error'}`);
        }

        if (statusData.status === 'done') {
            onProgress(96, 'Downloading video…');
            break;
        }

        // Map server progress (0-100) → UI progress (30-95)
        const uiPct = 30 + (statusData.progress / 100) * 65;
        const stage = statusData.progress < 10
            ? 'Decoding audio…'
            : statusData.progress < 15
                ? 'Pre-computing FFT…'
                : `Rendering frame ${Math.round(statusData.progress)}%…`;
        onProgress(uiPct, stage);
    }

    if (signal.aborted) return;

    // ── 3. Download the finished MP4 ─────────────────────────────────────────
    const dlRes = await fetch(`${root}/download/${jobId}`, { signal });
    if (!dlRes.ok) {
        const err = await dlRes.json().catch(() => ({ error: 'Download failed' }));
        throw new Error(err.error || `Download failed (${dlRes.status})`);
    }

    const blob = await dlRes.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sonic-visualizer-${quality}.mp4`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);

    onProgress(100, 'Done!');
}
